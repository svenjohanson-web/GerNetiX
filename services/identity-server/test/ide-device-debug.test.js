"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { readPlatformAppSource } = require("../test-support/platform-app-source");

const app = readPlatformAppSource();
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
const controllerSource = fs.readFileSync(path.resolve(__dirname, "../public/app/device-debug-controller.js"), "utf8");

test("IoT device components expose a local Debug & Diagnose workspace", () => {
  assert.match(app, /`Komponenten\/\$\{label\}\/Debug & Diagnose`/);
  assert.match(app, /virtualAction: "device-debug"/);
  assert.match(app, /data-device-debug=/);
  assert.match(app, /state\.ideViewMode = "device-debug"/);
  assert.match(html, /id="ideDeviceDebugView"/);
  assert.match(html, /device-debug-controller\.js/);
  assert.match(css, /\.device-debug-workspace/);
  assert.match(css, /\.device-debug-events/);
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
  assert.doesNotMatch(controllerSource, /localStorage|postJson\(|sendBeacon/);
});

test("feedback text is normalized into severity, subsystem and monotonic uptime", () => {
  const context = {
    document: { querySelector: () => null },
    window: {},
  };
  const debug = vm.runInNewContext(`${controllerSource}\nGerNetiXDeviceDebug;`, context);
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

test("the in-memory event list de-duplicates ring-buffer re-reads and stays bounded", () => {
  const context = {
    document: { querySelector: () => null },
    window: {},
  };
  const debug = vm.runInNewContext(`${controllerSource}\nGerNetiXDeviceDebug;`, context);
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
