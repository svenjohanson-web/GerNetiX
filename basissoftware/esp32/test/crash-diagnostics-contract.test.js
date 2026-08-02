"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const crash = fs.readFileSync(path.join(root, "src/functions/crash_diagnostics.cpp"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main.cpp"), "utf8");
const serial = fs.readFileSync(path.join(root, "src/functions/serial_provisioning.cpp"), "utf8");
const web = fs.readFileSync(path.join(root, "src/functions/startDeviceWebServer.cpp"), "utf8");
const cmake = fs.readFileSync(path.join(root, "src/CMakeLists.txt"), "utf8");

test("crash snapshots use bounded RTC retention without flash writes", () => {
  assert.match(crash, /RTC_DATA_ATTR CrashSnapshot/);
  assert.match(crash, /SNAPSHOT_INTERVAL_MS = 5000/);
  assert.match(crash, /HEALTH_MILESTONE_MS = 60000/);
  assert.match(crash, /CORE_DUMP_RETENTION_MS = 600000/);
  assert.match(crash, /BOOTLOOP_THRESHOLD = 3/);
  assert.doesNotMatch(crash, /nvs_|fopen|SPIFFS|LittleFS/);
  assert.match(crash, /esp_core_dump_image_erase/);
  assert.match(main, /initializeCrashDiagnostics\(\)/);
  assert.match(main, /startCrashDiagnosticsMonitor\(\)/);
});

test("the report carries the exact ESP-IDF ELF digest and bounded fault fields", () => {
  assert.match(crash, /app_elf_sha256/);
  assert.match(crash, /char build_id\[65\]/);
  assert.match(crash, /FIXED_CODE_BYTES = 32/);
  assert.match(crash, /FIXED_TASK_BYTES = 24/);
  assert.match(crash, /esp_core_dump_get_summary/);
  assert.match(crash, /coreDumpBacktrace\[16\]/);
  assert.match(crash, /backtrace_addresses/);
});

test("serial and local web status expose the same crash report", () => {
  assert.match(serial, /jsonAppendRaw\(writer, "crash_report", crashReport\)/);
  assert.match(web, /"\\\"crash_report\\\":%s,"/);
  assert.match(cmake, /functions\/crash_diagnostics\.cpp/);
  assert.match(cmake, /esp_app_format/);
  assert.match(cmake, /espcoredump/);
});

test("runtime diagnostics expose bounded heap and every task stack without payload data", () => {
  assert.match(crash, /writeRuntimeResourceDiagnosticsJson/);
  assert.match(crash, /uxTaskGetSystemState/);
  assert.match(crash, /minimum_free_stack_bytes/);
  assert.match(crash, /HEAP_WARNING_BYTES = 32768/);
  assert.match(crash, /STACK_CRITICAL_BYTES = 512/);
  assert.match(crash, /heap_caps_get_largest_free_block/);
  assert.match(crash, /MALLOC_CAP_INTERNAL/);
  assert.match(crash, /MALLOC_CAP_SPIRAM/);
  assert.match(crash, /fragmentation_percent/);
  assert.match(crash, /esp_get_idf_version/);
  assert.match(crash, /esp_chip_info/);
  assert.match(crash, /taskStateName/);
  assert.match(crash, /base_priority/);
  assert.match(crash, /cpu_usage_status/);
  assert.match(crash, /"basissoftware"/);
  assert.match(serial, /jsonAppendRaw\(writer, "diagnostics",/);
  assert.match(web, /"\\"diagnostics\\":%s,"/);
  assert.ok(crash.includes('\\"capabilities\\"'));
  assert.ok(crash.includes('\\"rtos_tasks\\"'));
  assert.ok(crash.includes('\\"rtos\\":\\"freertos\\"'));
  assert.doesNotMatch(crash, /password|credential|network_payload/i);
});
