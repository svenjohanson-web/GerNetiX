"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const shared = fs.readFileSync(path.join(root, "src/gernetix_avr_diagnostics.c"), "utf8");
const arduinoMain = fs.readFileSync(path.resolve(root, "../arduino-framework/src/main.cpp"), "utf8");
const atmelMain = fs.readFileSync(path.resolve(root, "../arduino-atmel/src/main.c"), "utf8");
const arduinoIni = fs.readFileSync(path.resolve(root, "../arduino-framework/platformio.ini"), "utf8");
const atmelIni = fs.readFileSync(path.resolve(root, "../arduino-atmel/platformio.ini"), "utf8");

test("both AVR basis variants use one capability-based no-RTOS diagnostics core", () => {
  assert.ok(shared.includes('\\"schema_version\\":2'));
  assert.ok(shared.includes('\\"capabilities\\":[\\"system\\",\\"memory\\",\\"reset\\"'));
  assert.ok(shared.includes('\\"family\\":\\"avr_8bit'));
  assert.ok(shared.includes('\\"rtos\\":\\"none'));
  assert.match(shared, /free_sram_estimate/);
  assert.match(shared, /minimum_free_sram/);
  assert.match(shared, /stack_heap_gap_bytes/);
  assert.match(shared, /retained_reset_flags/);
  assert.match(shared, /diagnostics_status/);
  assert.match(shared, /diagnostics_logs/);
  assert.match(arduinoMain, /gernetix_avr_diagnostics_init/);
  assert.match(arduinoMain, /micros\(\) - startedAt/);
  assert.match(atmelMain, /gernetix_avr_diagnostics_init/);
  assert.match(atmelMain, /UCSR0A/);
  assert.match(arduinoIni, /lib_extra_dirs = \.\.\/arduino-avr-shared/);
  assert.match(atmelIni, /lib_extra_dirs = \.\.\/arduino-avr-shared/);
  assert.doesNotMatch(shared, /FreeRTOS|PSRAM|rtos_tasks/);
});
