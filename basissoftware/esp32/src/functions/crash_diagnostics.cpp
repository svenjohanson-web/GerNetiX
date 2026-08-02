#include "basissoftware/crash_diagnostics.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cstdarg>

#include "esp_app_desc.h"
#include "esp_attr.h"
#include "esp_chip_info.h"
#include "esp_heap_caps.h"
#include "esp_idf_version.h"
#include "esp_random.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "sdkconfig.h"
#if defined(CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH) && CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH
#include "esp_core_dump.h"
#endif
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"

namespace {
constexpr const char *TAG = "crashDiagnostics";
constexpr uint32_t SNAPSHOT_MAGIC = 0x474e5843;  // GNXC
constexpr uint16_t SNAPSHOT_SCHEMA = 1;
constexpr uint32_t SNAPSHOT_INTERVAL_MS = 5000;
constexpr uint32_t HEALTH_MILESTONE_MS = 60000;
constexpr uint32_t CORE_DUMP_RETENTION_MS = 600000;
constexpr uint32_t BOOTLOOP_THRESHOLD = 3;
constexpr size_t FIXED_CODE_BYTES = 32;
constexpr size_t FIXED_TASK_BYTES = 24;
constexpr uint32_t HEAP_WARNING_BYTES = 32768;
constexpr uint32_t HEAP_CRITICAL_BYTES = 16384;
constexpr uint32_t STACK_WARNING_BYTES = 1024;
constexpr uint32_t STACK_CRITICAL_BYTES = 512;
constexpr uint32_t FRAGMENTATION_WARNING_PERCENT = 50;
constexpr uint32_t FRAGMENTATION_CRITICAL_PERCENT = 70;
constexpr UBaseType_t MAX_DIAGNOSTIC_TASKS = 32;

struct CrashSnapshot {
  uint32_t magic;
  uint16_t schema;
  uint16_t reserved;
  uint32_t checksum;
  uint32_t boot_id;
  uint32_t failed_boot_count;
  uint64_t uptime_ms;
  uint32_t minimum_free_heap_bytes;
  uint32_t monitor_stack_watermark_words;
  uintptr_t program_counter;
  uint8_t healthy;
  char build_id[65];
  char fault_code[FIXED_CODE_BYTES];
  char task_name[FIXED_TASK_BYTES];
};

RTC_DATA_ATTR CrashSnapshot retainedSnapshot = {};
CrashSnapshot previousSnapshot = {};
bool previousSnapshotAvailable = false;
esp_reset_reason_t currentResetReason = ESP_RST_UNKNOWN;
bool coreDumpSummaryAvailable = false;
uintptr_t coreDumpBacktrace[16] = {};
size_t coreDumpBacktraceDepth = 0;
uintptr_t coreDumpProgramCounter = 0;
char coreDumpTaskName[FIXED_TASK_BYTES] = {};

uint32_t checksum(const CrashSnapshot &snapshot) {
  const uint8_t *bytes = reinterpret_cast<const uint8_t *>(&snapshot);
  uint32_t value = 2166136261u;
  for (size_t index = 0; index < sizeof(CrashSnapshot); ++index) {
    if (index >= offsetof(CrashSnapshot, checksum)
        && index < offsetof(CrashSnapshot, checksum) + sizeof(snapshot.checksum)) continue;
    value = (value ^ bytes[index]) * 16777619u;
  }
  return value;
}

bool snapshotValid(const CrashSnapshot &snapshot) {
  return snapshot.magic == SNAPSHOT_MAGIC
      && snapshot.schema == SNAPSHOT_SCHEMA
      && snapshot.checksum == checksum(snapshot);
}

void sealSnapshot() {
  retainedSnapshot.checksum = 0;
  retainedSnapshot.checksum = checksum(retainedSnapshot);
}

void copyFixed(char *target, size_t targetSize, const char *value) {
  if (target == nullptr || targetSize == 0) return;
  size_t written = 0;
  for (const char *cursor = value == nullptr ? "" : value; *cursor != '\0' && written + 1 < targetSize; ++cursor) {
    const char current = *cursor;
    target[written++] = (current >= 'a' && current <= 'z') || (current >= 'A' && current <= 'Z')
        || (current >= '0' && current <= '9') || current == '_' || current == '-' || current == '.'
      ? current : '_';
  }
  target[written] = '\0';
}

const char *resetReasonName(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON: return "power_on";
    case ESP_RST_EXT: return "external_reset";
    case ESP_RST_SW: return "software_reset";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "interrupt_watchdog";
    case ESP_RST_TASK_WDT: return "task_watchdog";
    case ESP_RST_WDT: return "watchdog";
    case ESP_RST_DEEPSLEEP: return "deep_sleep";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_SDIO: return "sdio";
    case ESP_RST_UNKNOWN:
    default: return "unknown";
  }
}

const char *taskOwner(const char *taskName) {
  if (taskName == nullptr) return "unknown";
  if (std::strcmp(taskName, "runtime") == 0) return "shared_runtime";
  constexpr const char *basissoftwareTasks[] = {
    "crashDiag", "serial-provision", "serial-provisioning", "ota-update",
    "wifi-connect", "wifi-reconnect", "gernetix-captive-dns"
  };
  for (const char *known : basissoftwareTasks) {
    if (std::strcmp(taskName, known) == 0) return "basissoftware";
  }
  constexpr const char *systemTasks[] = {
    "IDLE0", "IDLE1", "ipc0", "ipc1", "esp_timer", "timer", "sys_evt",
    "wifi", "tiT", "Tmr Svc", "main"
  };
  for (const char *known : systemTasks) {
    if (std::strcmp(taskName, known) == 0) return "platform_runtime";
  }
  return "project_or_dependency";
}

const char *resourceState(uint32_t remaining, uint32_t warning, uint32_t critical) {
  if (remaining <= critical) return "critical";
  if (remaining <= warning) return "warning";
  return "ok";
}

const char *taskStateName(eTaskState state) {
  switch (state) {
    case eRunning: return "running";
    case eReady: return "ready";
    case eBlocked: return "blocked";
    case eSuspended: return "suspended";
    case eDeleted: return "deleted";
    case eInvalid:
    default: return "invalid";
  }
}

uint32_t heapFragmentationPercent(size_t freeBytes, size_t largestBlockBytes) {
  if (freeBytes == 0 || largestBlockBytes >= freeBytes) return 0;
  return static_cast<uint32_t>(((freeBytes - largestBlockBytes) * 100U) / freeBytes);
}

const char *combinedHeapState(uint32_t minimumBytes, uint32_t fragmentationPercent) {
  if (minimumBytes <= HEAP_CRITICAL_BYTES || fragmentationPercent >= FRAGMENTATION_CRITICAL_PERCENT) return "critical";
  if (minimumBytes <= HEAP_WARNING_BYTES || fragmentationPercent >= FRAGMENTATION_WARNING_PERCENT) return "warning";
  return "ok";
}

bool appendJson(char *target, size_t targetSize, size_t &written, const char *format, ...) {
  if (written >= targetSize) return false;
  va_list values;
  va_start(values, format);
  const int count = std::vsnprintf(target + written, targetSize - written, format, values);
  va_end(values);
  if (count < 0 || static_cast<size_t>(count) >= targetSize - written) {
    target[0] = '\0';
    return false;
  }
  written += static_cast<size_t>(count);
  return true;
}

bool abnormalReset(esp_reset_reason_t reason) {
  return reason == ESP_RST_PANIC || reason == ESP_RST_INT_WDT
      || reason == ESP_RST_TASK_WDT || reason == ESP_RST_WDT
      || reason == ESP_RST_BROWNOUT || reason == ESP_RST_UNKNOWN;
}

void snapshotMonitorTask(void *) {
  while (true) {
    retainedSnapshot.uptime_ms = static_cast<uint64_t>(esp_timer_get_time() / 1000);
    retainedSnapshot.minimum_free_heap_bytes = esp_get_minimum_free_heap_size();
    retainedSnapshot.monitor_stack_watermark_words = uxTaskGetStackHighWaterMark(nullptr);
    if (!retainedSnapshot.healthy && retainedSnapshot.uptime_ms >= HEALTH_MILESTONE_MS) {
      retainedSnapshot.healthy = 1;
      retainedSnapshot.failed_boot_count = 0;
      feedbackInfo(TAG, "Boot health milestone reached after %u ms", HEALTH_MILESTONE_MS);
    }
#if defined(CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH) && CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH
    if (coreDumpSummaryAvailable && retainedSnapshot.uptime_ms >= CORE_DUMP_RETENTION_MS) {
      if (esp_core_dump_image_erase() == ESP_OK) {
        coreDumpSummaryAvailable = false;
        feedbackInfo(TAG, "Core dump erased after stable-runtime retention window");
      }
    }
#endif
    sealSnapshot();
    vTaskDelay(pdMS_TO_TICKS(SNAPSHOT_INTERVAL_MS));
  }
}
}

void writeFirmwareBuildId(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) return;
  target[0] = '\0';
  const esp_app_desc_t *description = esp_app_get_description();
  if (description == nullptr || targetSize < 65) return;
  for (size_t index = 0; index < sizeof(description->app_elf_sha256); ++index) {
    std::snprintf(target + index * 2, targetSize - index * 2, "%02x", description->app_elf_sha256[index]);
  }
}

void initializeCrashDiagnostics() {
  currentResetReason = esp_reset_reason();
  previousSnapshotAvailable = snapshotValid(retainedSnapshot)
      && (abnormalReset(currentResetReason) || retainedSnapshot.healthy == 0);
  if (previousSnapshotAvailable) previousSnapshot = retainedSnapshot;

#if defined(CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH) && CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH
  esp_core_dump_summary_t summary = {};
  if (esp_core_dump_get_summary(&summary) == ESP_OK) {
    coreDumpSummaryAvailable = true;
    coreDumpProgramCounter = summary.exc_pc;
    copyFixed(coreDumpTaskName, sizeof(coreDumpTaskName), summary.exc_task);
    coreDumpBacktraceDepth = summary.exc_bt_info.depth < 16 ? summary.exc_bt_info.depth : 16;
    for (size_t index = 0; index < coreDumpBacktraceDepth; ++index) {
      coreDumpBacktrace[index] = summary.exc_bt_info.bt[index];
    }
  }
#endif

  const uint32_t failedBoots = snapshotValid(retainedSnapshot) && retainedSnapshot.healthy == 0
      ? retainedSnapshot.failed_boot_count + 1
      : 0;
  retainedSnapshot = {};
  retainedSnapshot.magic = SNAPSHOT_MAGIC;
  retainedSnapshot.schema = SNAPSHOT_SCHEMA;
  retainedSnapshot.boot_id = esp_random();
  retainedSnapshot.failed_boot_count = failedBoots;
  retainedSnapshot.minimum_free_heap_bytes = esp_get_minimum_free_heap_size();
  writeFirmwareBuildId(retainedSnapshot.build_id, sizeof(retainedSnapshot.build_id));
  copyFixed(retainedSnapshot.fault_code, sizeof(retainedSnapshot.fault_code), "not_captured");
  copyFixed(retainedSnapshot.task_name, sizeof(retainedSnapshot.task_name), "unavailable");
  sealSnapshot();

  if (failedBoots >= BOOTLOOP_THRESHOLD) {
    feedbackWarning(TAG, "Bootloop suspected: failed_boot_count=%u", failedBoots);
  }
}

void startCrashDiagnosticsMonitor() {
  const BaseType_t created = xTaskCreate(
      snapshotMonitorTask,
      "crashDiag",
      3072,
      nullptr,
      2,
      nullptr);
  if (created != pdPASS) feedbackWarning(TAG, "Crash monitor task could not be started");
}

void recordCrashFaultContext(const char *faultCode, const char *taskName, uintptr_t programCounter) {
  copyFixed(retainedSnapshot.fault_code, sizeof(retainedSnapshot.fault_code), faultCode);
  copyFixed(retainedSnapshot.task_name, sizeof(retainedSnapshot.task_name), taskName);
  retainedSnapshot.program_counter = programCounter;
  retainedSnapshot.uptime_ms = static_cast<uint64_t>(esp_timer_get_time() / 1000);
  retainedSnapshot.minimum_free_heap_bytes = esp_get_minimum_free_heap_size();
  retainedSnapshot.healthy = 0;
  sealSnapshot();
}

bool writeCrashDiagnosticsJson(char *target, size_t targetSize) {
  if (target == nullptr || targetSize < 512) return false;
  char backtrace[384] = "[]";
  const CrashSnapshot &report = previousSnapshotAvailable ? previousSnapshot : retainedSnapshot;
  const bool reportAvailable = previousSnapshotAvailable || coreDumpSummaryAvailable;
  const uint32_t failedBoots = retainedSnapshot.failed_boot_count;
  const uintptr_t programCounter = coreDumpSummaryAvailable ? coreDumpProgramCounter : report.program_counter;
  const char *taskName = coreDumpSummaryAvailable ? coreDumpTaskName : report.task_name;
  const char *faultCode = coreDumpSummaryAvailable ? "panic_core_dump" : report.fault_code;
  if (coreDumpSummaryAvailable && coreDumpBacktraceDepth > 0) {
    size_t written = 0;
    backtrace[written++] = '[';
    for (size_t index = 0; index < coreDumpBacktraceDepth && written + 24 < sizeof(backtrace); ++index) {
      const int count = std::snprintf(backtrace + written, sizeof(backtrace) - written, "%s\"0x%llx\"",
          index == 0 ? "" : ",", static_cast<unsigned long long>(coreDumpBacktrace[index]));
      if (count < 0 || static_cast<size_t>(count) >= sizeof(backtrace) - written) break;
      written += static_cast<size_t>(count);
    }
    if (written + 2 <= sizeof(backtrace)) {
      backtrace[written++] = ']';
      backtrace[written] = '\0';
    }
  } else if (programCounter != 0) {
    std::snprintf(backtrace, sizeof(backtrace), "[\"0x%llx\"]", static_cast<unsigned long long>(report.program_counter));
  }
  const int written = std::snprintf(
      target,
      targetSize,
      "{\"schema_version\":1,\"available\":%s,\"storage\":\"rtc_retention_no_flash_writes\","
      "\"build_id\":\"%s\",\"reset_reason\":\"%s\",\"boot_id\":\"%08x\","
      "\"failed_boot_count\":%u,\"bootloop_suspected\":%s,\"health_milestone_reached\":%s,"
      "\"uptime_before_reset_ms\":%llu,\"minimum_free_heap_bytes\":%u,"
      "\"stack_watermark_words\":%u,\"fault_code\":\"%s\",\"task_name\":\"%s\","
      "\"fault_owner\":\"%s\","
      "\"program_counter\":\"0x%llx\",\"backtrace_addresses\":%s,"
      "\"capture_limit\":\"%s\"}",
      reportAvailable ? "true" : "false",
      report.build_id,
      resetReasonName(currentResetReason),
      static_cast<unsigned>(report.boot_id),
      static_cast<unsigned>(failedBoots),
      failedBoots >= BOOTLOOP_THRESHOLD ? "true" : "false",
      retainedSnapshot.healthy ? "true" : "false",
      static_cast<unsigned long long>(report.uptime_ms),
      static_cast<unsigned>(report.minimum_free_heap_bytes),
      static_cast<unsigned>(report.monitor_stack_watermark_words),
      faultCode,
      taskName,
      taskOwner(taskName),
      static_cast<unsigned long long>(programCounter),
      backtrace,
      coreDumpSummaryAvailable ? "core_dump_summary_only_raw_image_not_exposed" : "panic_backtrace_requires_enabled_idf_core_dump");
  if (written < 0 || static_cast<size_t>(written) >= targetSize) {
    target[0] = '\0';
    return false;
  }
  return true;
}

bool writeRuntimeResourceDiagnosticsJson(char *target, size_t targetSize) {
  if (target == nullptr || targetSize < 1024) return false;
  target[0] = '\0';
  const uint32_t freeHeap = esp_get_free_heap_size();
  const uint32_t minimumHeap = esp_get_minimum_free_heap_size();
  const size_t largestHeapBlock = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT);
  const uint32_t heapFragmentation = heapFragmentationPercent(freeHeap, largestHeapBlock);
  const size_t internalFree = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  const size_t internalMinimum = heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  const size_t internalLargest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
  const size_t psramFree = heap_caps_get_free_size(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  const size_t psramMinimum = heap_caps_get_minimum_free_size(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  const size_t psramLargest = heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  esp_chip_info_t chip = {};
  esp_chip_info(&chip);
  size_t written = 0;
  if (!appendJson(target, targetSize, written,
      "{\"schema_version\":2,\"capabilities\":[\"system\",\"memory\",\"rtos_tasks\"],"
      "\"platform\":{\"family\":\"esp32\",\"sdk\":\"esp-idf\",\"rtos\":\"freertos\"},\"sections\":{"
      "\"system\":{\"idf_version\":\"%s\",\"target\":\"%s\",\"chip_revision\":%u,\"cpu_cores\":%u,\"cpu_usage_status\":\"not_measured\"},"
      "\"memory\":{\"heap\":{\"free_bytes\":%u,\"minimum_free_bytes\":%u,"
      "\"largest_free_block_bytes\":%u,\"fragmentation_percent\":%u,"
      "\"warning_below_bytes\":%u,\"critical_below_bytes\":%u,\"status\":\"%s\"},"
      "\"regions\":{"
      "\"internal\":{\"free_bytes\":%u,\"minimum_free_bytes\":%u,\"largest_free_block_bytes\":%u,\"fragmentation_percent\":%u},"
      "\"psram\":{\"available\":%s,\"free_bytes\":%u,\"minimum_free_bytes\":%u,\"largest_free_block_bytes\":%u,\"fragmentation_percent\":%u}},"
      "\"stack_thresholds\":{\"warning_below_bytes\":%u,\"critical_below_bytes\":%u}},\"tasks\":{\"items\":[",
      esp_get_idf_version(), CONFIG_IDF_TARGET, static_cast<unsigned>(chip.revision), static_cast<unsigned>(chip.cores),
      static_cast<unsigned>(freeHeap), static_cast<unsigned>(minimumHeap), static_cast<unsigned>(largestHeapBlock),
      static_cast<unsigned>(heapFragmentation),
      static_cast<unsigned>(HEAP_WARNING_BYTES), static_cast<unsigned>(HEAP_CRITICAL_BYTES),
      combinedHeapState(minimumHeap, heapFragmentation),
      static_cast<unsigned>(internalFree), static_cast<unsigned>(internalMinimum), static_cast<unsigned>(internalLargest),
      static_cast<unsigned>(heapFragmentationPercent(internalFree, internalLargest)),
      psramFree > 0 ? "true" : "false", static_cast<unsigned>(psramFree), static_cast<unsigned>(psramMinimum),
      static_cast<unsigned>(psramLargest), static_cast<unsigned>(heapFragmentationPercent(psramFree, psramLargest)),
      static_cast<unsigned>(STACK_WARNING_BYTES), static_cast<unsigned>(STACK_CRITICAL_BYTES))) return false;

#if defined(CONFIG_FREERTOS_USE_TRACE_FACILITY) && CONFIG_FREERTOS_USE_TRACE_FACILITY
  const UBaseType_t totalTasks = uxTaskGetNumberOfTasks();
  const UBaseType_t requested = totalTasks < MAX_DIAGNOSTIC_TASKS ? totalTasks : MAX_DIAGNOSTIC_TASKS;
  TaskStatus_t *tasks = static_cast<TaskStatus_t *>(std::calloc(requested, sizeof(TaskStatus_t)));
  if (tasks == nullptr) return appendJson(target, targetSize, written, "],\"status\":\"allocation_failed\"}}}");
  const UBaseType_t count = uxTaskGetSystemState(tasks, requested, nullptr);
  for (UBaseType_t index = 0; index < count; ++index) {
    char safeName[FIXED_TASK_BYTES] = {};
    copyFixed(safeName, sizeof(safeName), tasks[index].pcTaskName);
    // TaskStatus_t retains the upstream FreeRTOS unit (StackType_t words),
    // even though ESP-IDF documents its direct high-water API in bytes.
    const uint32_t minimumStackBytes = static_cast<uint32_t>(tasks[index].usStackHighWaterMark) * sizeof(StackType_t);
    char coreValue[12] = "null";
#if defined(configTASKLIST_INCLUDE_COREID) && configTASKLIST_INCLUDE_COREID
    if (tasks[index].xCoreID != tskNO_AFFINITY) {
      std::snprintf(coreValue, sizeof(coreValue), "%d", static_cast<int>(tasks[index].xCoreID));
    }
#endif
    if (!appendJson(target, targetSize, written,
        "%s{\"name\":\"%s\",\"owner\":\"%s\",\"state\":\"%s\",\"priority\":%u,\"base_priority\":%u,"
        "\"core\":%s,"
        "\"minimum_free_stack_bytes\":%u,\"status\":\"%s\"}",
        index == 0 ? "" : ",", safeName, taskOwner(safeName),
        taskStateName(tasks[index].eCurrentState),
        static_cast<unsigned>(tasks[index].uxCurrentPriority),
        static_cast<unsigned>(tasks[index].uxBasePriority),
        coreValue,
        static_cast<unsigned>(minimumStackBytes),
        resourceState(minimumStackBytes, STACK_WARNING_BYTES, STACK_CRITICAL_BYTES))) {
      std::free(tasks);
      return false;
    }
  }
  std::free(tasks);
  return appendJson(target, targetSize, written, "],\"count_total\":%u,\"status\":\"%s\"}}}",
      static_cast<unsigned>(totalTasks), totalTasks > MAX_DIAGNOSTIC_TASKS ? "truncated" : "complete");
#else
  return appendJson(target, targetSize, written, "],\"status\":\"trace_facility_disabled\"}}}");
#endif
}
