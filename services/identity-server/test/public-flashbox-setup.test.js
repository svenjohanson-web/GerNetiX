"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");
const page = fs.readFileSync(path.join(root, "public", "flashbox-einrichten", "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "public", "flashbox-einrichten", "app.js"), "utf8");
const publisher = fs.readFileSync(path.join(root, "..", "..", "tools", "publish-flashbox-initial-release.js"), "utf8");

test("serves a public Flashbox setup without account or build-job APIs", () => {
  assert.match(server, /url\.pathname === "\/flashbox-einrichten"[\s\S]*serveStatic\(res, publicDir, "\/flashbox-einrichten\/index\.html"\)/);
  assert.match(server, /url\.pathname === "\/api\/public\/flashbox\/initial-firmware" && req\.method === "GET"/);
  assert.match(server, /url\.pathname === "\/api\/public\/flashbox\/initial-firmware\/content" && req\.method === "GET"/);
  assert.match(server, /currentFlashboxInitialFirmware\(\)/);
  assert.match(page, /class="site-header"/);
  assert.match(page, /href="\/entdecken\/">GerNetiX entdecken/);
  assert.match(page, /href="\/flashbox-einrichten\/" aria-current="page">USB Helper/);
  assert.match(page, /src="\/landing\.js/);
  assert.doesNotMatch(page, /account_id|claim_code|build_job|project_id/i);
});

test("checks ESP32-S3 and shows storage values before enabling the initial flash", () => {
  assert.match(page, /FlashBox automatisch suchen/);
  assert.match(page, /COM-Port manuell ausw&auml;hlen/);
  assert.match(page, /id="hardwareCheckContinueButton"/);
  assert.match(page, /Boarddaten best&auml;tigen und weiter/);
  assert.match(app, /navigator\.serial\.getPorts\(\)/);
  assert.match(app, /navigator\.serial\.requestPort/);
  assert.match(app, /ESP32-S3/);
  assert.doesNotMatch(app, /minimumFlashMb/);
  assert.doesNotMatch(app, /minimumPsramMb/);
  assert.match(app, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(app, /hardwareConfirmation/);
  assert.match(page, /FlashBox zum Inventar hinzufügen/);
  assert.match(page, /Jetzt anmelden und hinzufügen/);
  assert.match(app, /inventoryNext/);
  assert.match(app, /confirmHardwareCheck/);
  assert.match(app, /hardwareAcknowledged/);
  assert.match(app, /loader\.writeFlash/);
});

test("publishing is fixed to the Flashbox initial-image release type", () => {
  assert.match(publisher, /download_id: "flashbox-initial-image"/);
  assert.match(publisher, /platform: "esp32"/);
  assert.match(publisher, /architecture: "esp32-s3"/);
  assert.match(publisher, /repository\.publish/);
});
