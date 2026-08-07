"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dialog = require(path.join(__dirname, "../public/app/unified-flash-dialog.js"));

test("normalizes the same USB, OTA and FlashBox choices for every flash entry", () => {
  const methods = dialog.normalizeMethods({
    usb: { enabled: true },
    ota: { enabled: false, reason: "Kein Device zugeordnet." },
  });
  assert.deepEqual(methods.map((method) => method.id), ["usb", "ota", "flashbox"]);
  assert.equal(methods[0].enabled, true);
  assert.equal(methods[1].reason, "Kein Device zugeordnet.");
  assert.equal(methods[2].enabled, false);
  assert.match(methods[2].reason, /FlashBox/);
});

test("formats the flash artifact size centrally", () => {
  assert.equal(dialog.formatBytes(2048), "2.0 KB");
  assert.equal(dialog.formatBytes(2 * 1024 * 1024), "2.0 MB");
});

test("Nexi uses guided flash progress, detects one Helper port and continues to commissioning", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/nachbauprojekte/nexi-sprachassistent/nexi-flash.js"), "utf8");
  assert.match(source, /GerNetiXFlashDialog\.create\(\)/);
  assert.match(source, /progressPresentation: "guided"/);
  assert.match(source, /onExecute\(method, progress\)/);
  assert.match(source, /onComplete\(\) \{ window\.location\.assign\("inbetriebnahme\/index\.html"\); \}/);
  assert.match(source, /const ports = await serialService\.ports\(\)/);
  assert.match(source, /selectedPort = \{ \.\.\.ports\[0\], source: "gernetix_serial_service" \}/);
  assert.doesNotMatch(source, /job\.logs|writeLine\(line\)|write\(line\)/);
  assert.doesNotMatch(source, /choose-port|flash-button|port-status/);
});

test("unified flash dialog can replace terminal logs with one guided status", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/app/unified-flash-dialog.js"), "utf8");
  assert.match(source, /progressPresentation === "guided"/);
  assert.match(source, /terminalTitle\.textContent = guidedProgress \? "FORTSCHRITT" : "TERMINAL"/);
  assert.match(source, /clearButton\.hidden = guidedProgress/);
  assert.match(source, /await config\.onComplete\?\.\(method\.id\)/);
});
