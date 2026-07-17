const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { SqlitePublicDemoRepository } = require("../src/repositories/sqlite-public-demo-repository");
const { PublicDemoService } = require("../src/services/public-demo-service");

function createRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-public-demo-"));
  return new SqlitePublicDemoRepository(path.join(root, "public-demos.sqlite"));
}

function release(overrides = {}) {
  return {
    demo_id: "touch-spielesammlung",
    title: "Spielfläche",
    description: "Touch-Demo für das ESP32-S3 Touch-Board.",
    board_hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    category: "spiele",
    games: [],
    version: "1.0.0",
    firmware_file_name: "firmware.bin",
    bootloader_base64: Buffer.from([0xe9, 0x00]).toString("base64"),
    partitions_base64: Buffer.from([0xaa, 0x55]).toString("base64"),
    firmware_base64: Buffer.from([0xe9, 0x01, 0x02, 0x03]).toString("base64"),
    ...overrides,
  };
}

test("veröffentlichte Demos enthalten keine Projekt- oder Kontodaten", () => {
  const repository = createRepository();
  const demo = repository.publish(release());

  assert.deepEqual(Object.keys(demo).sort(), [
    "board_hardware_item_id", "category", "demo_id", "description", "games",
    "ota_supported", "published_at", "releases", "title", "usb_flash_only",
  ]);
  assert.equal(demo.usb_flash_only, true);
  assert.equal(demo.ota_supported, false);
  assert.equal(demo.releases[0].firmware_sha256.length, 64);
  assert.equal(repository.listPublicDemos().length, 1);
  repository.close();
});

test("ein öffentlicher Release ist unveränderlich", () => {
  const repository = createRepository();
  repository.publish(release());
  assert.throws(() => repository.publish(release()), { code: "release_already_exists" });
  repository.close();
});

test("Firmware wird nur als firmware.bin und mit korrekter Prüfsumme gespeichert", () => {
  const repository = createRepository();
  assert.throws(() => repository.publish(release({ firmware_file_name: "notes.txt" })), { code: "invalid_firmware_file" });
  assert.throws(() => repository.publish(release({ firmware_sha256: "falsch" })), { code: "firmware_checksum_mismatch" });
  repository.close();
});

test("der öffentliche Lesezugang kann keine Release-Veröffentlichung auslösen", async () => {
  const repository = createRepository();
  const service = new PublicDemoService({ repository });
  const server = http.createServer((request, response) => createHttpApp({ service, publisherToken: "only-for-publisher" })(request, response)
    .catch((error) => {
      response.writeHead(error.status || 500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.code }));
    }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const demoPage = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(demoPage.status, 200);
  assert.match(await demoPage.text(), /Demoanwendungen/);

  const brandLogo = await fetch(`http://127.0.0.1:${port}/gernetix-logo.png`);
  assert.equal(brandLogo.status, 200);
  assert.equal(brandLogo.headers.get("content-type"), "image/png");
  assert.ok((await brandLogo.arrayBuffer()).byteLength > 1_000);

  const forbidden = await fetch(`http://127.0.0.1:${port}/api/internal/public-demos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(release()),
  });
  assert.equal(forbidden.status, 403);

  const published = await fetch(`http://127.0.0.1:${port}/api/internal/public-demos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Public-Demo-Publisher-Token": "only-for-publisher" },
    body: JSON.stringify(release()),
  });
  assert.equal(published.status, 201);
  const catalog = await fetch(`http://127.0.0.1:${port}/api/public/demos`);
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).items[0].demo_id, "touch-spielesammlung");

  await new Promise((resolve) => server.close(resolve));
  repository.close();
});
