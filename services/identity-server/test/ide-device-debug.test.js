"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { readPlatformAppSource, readForSandbox } = require("../test-support/platform-app-source");

const app = readPlatformAppSource();
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
const controllerSource = readForSandbox("device-debug-controller.js");
/*
 * Die Registratur wird im Browser vor diesem Controller geladen; er meldet
 * sich beim Laden bei ihr an und verwendet ihre Ereignisnamen. Die Sandbox
 * bildet dieselbe Reihenfolge ab, statt die Namen hier zu wiederholen.
 */
const registrySource = readForSandbox("platform-components.js");
const debugSandboxSource = `${registrySource}\n${controllerSource}\nGerNetiXDeviceDebug;`;
const shell = readForSandbox("app-shell-controller.js");

test("Debug & Diagnose is a separate project workspace and not a component-tree entry", () => {
  assert.doesNotMatch(app, /`Komponenten\/\$\{label\}\/In Debug öffnen`/);
  assert.doesNotMatch(app, /virtualAction: "device-debug"/);
  assert.doesNotMatch(app, /data-device-debug=/);
  assert.match(app, /debug: "debugView"/);
  assert.match(app, /\/app\/debug\/\?project=/);
  assert.match(app, /loadDeviceDebugWorkspace\(\)/);
  assert.match(app, /data-debug-device=/);
  assert.doesNotMatch(html, /id="ideDeviceDebugView"/);
  assert.match(html, /id="debugView"/);
  assert.match(html, /id="debugDeviceList"/);
  assert.match(html, /id="debugDeviceView"/);
  assert.match(html, /id="openProjectDebugButton"/);
  assert.doesNotMatch(html, /device-debug-controller\.js/);
  assert.match(shell, /loadIdeWorkbenchAssets[\s\S]*device-debug-controller\.js/);
  assert.match(css, /\.device-debug-workspace/);
  assert.match(css, /\.device-debug-events/);
  assert.match(css, /\.debug-workspace-layout/);
  assert.match(html, /id="ideBuildProfileSelect"/);
  assert.match(controllerSource, /debug-session\/activity/);
  assert.match(controllerSource, /Debug-Session fortsetzen/);
  assert.match(controllerSource, /Browser-Schließen beendet sie nicht/);
  assert.match(controllerSource, /Debug-Firmware möglicherweise noch installiert/);
});

test("local device debug uses read-only USB diagnostics and an explicit local export", () => {
  assert.match(controllerSource, /serialRequest\(session\.port, "diagnostics_status"\)/);
  assert.match(controllerSource, /serialRequest\(session\.port, "diagnostics_logs"\)/);
  assert.doesNotMatch(controllerSource, /Promise\.all\(\[\s*state\.serialService\.serialRequest/);
  assert.match(controllerSource, /state\.serialService\.deviceDiagnostics\(session\.baseUrl\)/);
  assert.match(controllerSource, /local_device_diagnostics/);
  assert.match(controllerSource, /Serial Service 0\.3\.7/);
  assert.match(controllerSource, /Reproduktion beginnt hier/);
  assert.match(controllerSource, /credentials_included: false/);
  assert.match(controllerSource, /URL\.createObjectURL/);
  assert.match(controllerSource, /\/symbolize/);
  assert.doesNotMatch(controllerSource, /localStorage|sendBeacon|support.*upload/i);
});

test("crash reports require an exact build id while internal basissoftware symbols stay protected", () => {
  assert.match(controllerSource, /crash_report/);
  assert.match(controllerSource, /backtrace_addresses/);
  assert.match(controllerSource, /build_artifact_mismatch/);
  assert.match(controllerSource, /ELF, Map und Build-Log bleiben.*serverintern geschützt/);
  assert.match(controllerSource, /GerNetiX-Basissoftware/);
  assert.match(controllerSource, /Interne Symbole geschützt/);
  assert.doesNotMatch(controllerSource, /artifact\.file_name === "firmware\.elf"/);
  assert.match(controllerSource, /data-debug-source/);
  assert.match(css, /\.device-debug-crash/);
  assert.match(css, /\.device-debug-stack/);
});

test("capability-based runtime diagnostics classify only protected basissoftware failures for operator escalation", () => {
  const context = {
    document: { querySelector: () => null },
    window: { addEventListener() {} },
  };
  const debug = vm.runInNewContext(debugSandboxSource, context);
  const incidents = debug.basissoftwareCriticalIncidents({
    diagnostics: {
      schema_version: 2,
      capabilities: ["system", "memory", "rtos_tasks"],
      platform: { family: "esp32", sdk: "esp-idf", rtos: "freertos" },
      sections: { tasks: { items: [
          { name: "crashDiag", owner: "basissoftware", status: "critical", minimum_free_stack_bytes: 240 },
          { name: "runtime", owner: "shared_runtime", status: "critical", minimum_free_stack_bytes: 180 },
        ] } },
    },
    crash_report: { available: true, fault_owner: "basissoftware", task_name: "wifi-connect", fault_code: "panic_core_dump" },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(incidents)), [
    { type: "task_stack_critical", task_name: "crashDiag", minimum_free_stack_bytes: 240 },
    { type: "basissoftware_crash", task_name: "wifi-connect", fault_code: "panic_core_dump" },
  ]);
  assert.match(controllerSource, /capabilities\.has\("rtos_tasks"\)/);
  assert.match(controllerSource, /Speicher und RTOS-Tasks/);
  assert.match(controllerSource, /Speicher und Bare-Metal-Runtime/);
  assert.match(controllerSource, /Größter Heap-Block/);
  assert.match(controllerSource, /Interner RAM frei/);
  assert.match(controllerSource, /PSRAM frei/);
  assert.match(controllerSource, /CPU-Auslastung/);
  assert.match(controllerSource, /Keine erfundene Prozentangabe/);
  assert.match(controllerSource, /taskStateLabel/);
  assert.match(controllerSource, /basissoftware-incidents/);
});

test("AVR diagnostics expose only their supported no-RTOS capabilities", () => {
  const context = { document: { querySelector: () => null }, window: { addEventListener() {} } };
  const debug = vm.runInNewContext(debugSandboxSource, context);
  const status = {
    diagnostics: {
      schema_version: 2,
      capabilities: ["system", "memory", "reset", "timing"],
      platform: { family: "avr_8bit", sdk: "arduino", rtos: "none" },
      sections: {
        memory: { sram: { total_bytes: 2048, free_estimate_bytes: 1100 } },
        reset: { primary_reason: "power_on", raw_flags: 1 },
        timing: { uptime_ms: 1234, maximum_loop_duration_us: 90 },
      },
    },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(debug.diagnosticsForStatus(status).capabilities)), ["system", "memory", "reset", "timing"]);
  assert.equal(debug.statusUptime(status), 1234);
  assert.equal(debug.basissoftwareCriticalIncidents(status).length, 0);
  assert.match(controllerSource, /if \(psram\.available\)/);
  assert.doesNotMatch(JSON.stringify(status), /rtos_tasks|PSRAM|FreeRTOS/);
});

test("feedback text is normalized into severity, subsystem and monotonic uptime", () => {
  const context = {
    document: { querySelector: () => null },
    window: { addEventListener() {} },
  };
  const debug = vm.runInNewContext(debugSandboxSource, context);
  const events = debug.normalizeLog([
    "GerNetiX event log: capacity=2047 bytes used=90 droppedBytes=0",
    "[1250 ms] INFO initWifi: Station connected",
    "[1300 ms] WARN camera: Frame buffer low",
    "[1400 ms] ERROR ota: Image rejected",
  ].join("\n"));
  assert.equal(events.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(events[0])), {
    uptime_ms: 1250,
    severity: "info",
    subsystem: "initwifi",
    message: "Station connected",
    raw: "[1250 ms] INFO initWifi: Station connected",
  });
  assert.equal(events[1].severity, "warn");
  assert.equal(events[2].subsystem, "ota");
});

test("diagnostic log capacity and dropped bytes remain visible instead of being discarded with the header", () => {
  const context = { document: { querySelector: () => null }, window: { addEventListener() {} } };
  const debug = vm.runInNewContext(debugSandboxSource, context);
  assert.deepEqual(JSON.parse(JSON.stringify(debug.diagnosticLogStats(
    "GerNetiX event log: capacity=2047 bytes used=1900 droppedBytes=388\n[10 ms] INFO boot: ready",
  ))), { capacity_bytes: 2047, used_bytes: 1900, dropped_bytes: 388 });
  assert.equal(debug.diagnosticLogStats("no header"), null);
  assert.match(controllerSource, /WLAN-Verbindungsstatus/);
  assert.match(controllerSource, /WLAN-Trennungsgrund/);
  assert.match(controllerSource, /Verworfene Logbytes/);
});

test("the in-memory event list de-duplicates ring-buffer re-reads and stays bounded", () => {
  const context = {
    document: { querySelector: () => null },
    window: { addEventListener() {} },
  };
  const debug = vm.runInNewContext(debugSandboxSource, context);
  const session = { events: [] };
  const repeated = { uptime_ms: 50, severity: "info", subsystem: "boot", message: "ready" };
  debug.appendEvents(session, [repeated, repeated]);
  assert.equal(session.events.length, 1);
  session.bootSequence = 2;
  debug.appendEvents(session, [{ uptime_ms: 50, severity: "info", subsystem: "boot", message: "ready" }]);
  assert.equal(session.events.length, 2, "the same startup event must remain visible after a reboot");
  debug.appendEvents(session, Array.from({ length: 300 }, (_, index) => ({
    uptime_ms: 100 + index,
    severity: "info",
    subsystem: "runtime",
    message: `event-${index}`,
  })));
  assert.equal(session.events.length, 256);
});
