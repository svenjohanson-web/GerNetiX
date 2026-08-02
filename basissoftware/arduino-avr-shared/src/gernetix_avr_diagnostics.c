#include "gernetix_avr_diagnostics.h"

#include <avr/io.h>
#include <avr/wdt.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

extern char __heap_start;
extern void *__brkval;

static uint8_t retained_reset_flags __attribute__((section(".noinit")));
static gernetix_avr_diagnostics_config_t runtime_config;
static uint16_t minimum_free_sram;
static uint32_t last_loop_duration_us;
static uint32_t maximum_loop_duration_us;
static char command_buffer[128];
static uint8_t command_length;

void gernetix_capture_avr_reset_flags(void) __attribute__((naked, used, section(".init3")));
void gernetix_capture_avr_reset_flags(void) {
  retained_reset_flags = MCUSR;
  MCUSR = 0;
  wdt_disable();
}

static uint16_t free_sram_estimate(void) {
  char stack_position;
  const char *heap_end = __brkval == 0 ? &__heap_start : (const char *)__brkval;
  const int16_t distance = (int16_t)(&stack_position - heap_end);
  return distance > 0 ? (uint16_t)distance : 0;
}

static uint16_t heap_used_bytes(void) {
  const char *heap_end = __brkval == 0 ? &__heap_start : (const char *)__brkval;
  const int16_t used = (int16_t)(heap_end - &__heap_start);
  return used > 0 ? (uint16_t)used : 0;
}

static void write_text(const char *text) {
  if (runtime_config.serial_write != 0) runtime_config.serial_write(text);
}

static void write_uint32(uint32_t value) {
  char buffer[11];
  ultoa(value, buffer, 10);
  write_text(buffer);
}

static const char *reset_reason(void) {
  if ((retained_reset_flags & _BV(WDRF)) != 0) return "watchdog";
  if ((retained_reset_flags & _BV(BORF)) != 0) return "brownout";
  if ((retained_reset_flags & _BV(EXTRF)) != 0) return "external_reset";
  if ((retained_reset_flags & _BV(PORF)) != 0) return "power_on";
  return "unknown";
}

static const char *mcu_name(void) {
#if defined(__AVR_ATmega328P__)
  return "ATmega328P";
#elif defined(__AVR_ATmega2560__)
  return "ATmega2560";
#elif defined(__AVR_ATmega32U4__)
  return "ATmega32U4";
#else
  return "AVR-8bit";
#endif
}

static void extract_request_id(const char *command, char *target, uint8_t target_size) {
  const char *key = strstr(command, "\"request_id\"");
  uint8_t written = 0;
  target[0] = '\0';
  if (key == 0) return;
  key = strchr(key, ':');
  if (key == 0) return;
  key = strchr(key, '\"');
  if (key == 0) return;
  key++;
  while (*key != '\0' && *key != '\"' && written + 1 < target_size) {
    const char value = *key++;
    if ((value >= 'a' && value <= 'z') || (value >= 'A' && value <= 'Z')
        || (value >= '0' && value <= '9') || value == '-' || value == '_' || value == '.') {
      target[written++] = value;
    }
  }
  target[written] = '\0';
}

static void begin_response(const char *request_id, const char *event) {
  write_text("{\"type\":\"gernetix.serial_provisioning\",\"request_id\":\"");
  write_text(request_id);
  write_text("\",\"event\":\"");
  write_text(event);
  write_text("\",\"payload\":");
}

static void write_status(const char *request_id) {
  const uint16_t free_sram = free_sram_estimate();
  if (free_sram < minimum_free_sram) minimum_free_sram = free_sram;
  begin_response(request_id, "diagnostics_status");
  write_text("{\"firmware_version\":\"0.1.0\",\"basissoftware_version\":\"0.1.0\",\"reset_reason\":\"");
  write_text(reset_reason());
  write_text("\",\"diagnostics\":{\"schema_version\":2,\"capabilities\":[\"system\",\"memory\",\"reset\"");
  if (runtime_config.uptime_ms != 0) write_text(",\"timing\"");
  write_text("],\"platform\":{\"family\":\"avr_8bit\",\"sdk\":\"");
  write_text(runtime_config.runtime_name == 0 ? "avr-libc" : runtime_config.runtime_name);
  write_text("\",\"rtos\":\"none\"},\"sections\":{\"system\":{\"mcu\":\"");
  write_text(mcu_name());
  write_text("\",\"cpu_cores\":1},\"memory\":{\"sram\":{\"total_bytes\":");
  write_uint32((uint32_t)RAMEND - (uint32_t)RAMSTART + 1U);
  write_text(",\"free_estimate_bytes\":");
  write_uint32(free_sram);
  write_text(",\"minimum_free_estimate_bytes\":");
  write_uint32(minimum_free_sram);
  write_text(",\"heap_used_bytes\":");
  write_uint32(heap_used_bytes());
  write_text(",\"stack_heap_gap_bytes\":");
  write_uint32(free_sram);
  write_text("}},\"reset\":{\"raw_flags\":");
  write_uint32(retained_reset_flags);
  write_text(",\"primary_reason\":\"");
  write_text(reset_reason());
  write_text("\"}");
  if (runtime_config.uptime_ms != 0) {
    write_text(",\"timing\":{\"uptime_ms\":");
    write_uint32(runtime_config.uptime_ms());
    write_text(",\"last_loop_duration_us\":");
    write_uint32(last_loop_duration_us);
    write_text(",\"maximum_loop_duration_us\":");
    write_uint32(maximum_loop_duration_us);
    write_text("}");
  }
  write_text("}}}}\n");
}

static void handle_command(const char *command) {
  char request_id[40];
  extract_request_id(command, request_id, sizeof(request_id));
  if (strstr(command, "\"action\":\"diagnostics_status\"") != 0) {
    write_status(request_id);
  } else if (strstr(command, "\"action\":\"diagnostics_logs\"") != 0) {
    begin_response(request_id, "diagnostics_logs");
    write_text("{\"text\":\"\"}}\n");
  }
}

void gernetix_avr_diagnostics_init(const gernetix_avr_diagnostics_config_t *config) {
  if (config != 0) runtime_config = *config;
  minimum_free_sram = free_sram_estimate();
}

void gernetix_avr_diagnostics_observe_loop(uint32_t duration_us) {
  last_loop_duration_us = duration_us;
  if (duration_us > maximum_loop_duration_us) maximum_loop_duration_us = duration_us;
  const uint16_t free_sram = free_sram_estimate();
  if (free_sram < minimum_free_sram) minimum_free_sram = free_sram;
}

void gernetix_avr_diagnostics_poll(void) {
  if (runtime_config.serial_available == 0 || runtime_config.serial_read == 0) return;
  while (runtime_config.serial_available()) {
    const int16_t value = runtime_config.serial_read();
    if (value < 0) return;
    if (value == '\n') {
      command_buffer[command_length] = '\0';
      if (command_length > 0) handle_command(command_buffer);
      command_length = 0;
    } else if (value != '\r') {
      if (command_length + 1 < sizeof(command_buffer)) command_buffer[command_length++] = (char)value;
      else command_length = 0;
    }
  }
}
