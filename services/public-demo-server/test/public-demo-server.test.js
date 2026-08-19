const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp } = require("../src/http-app");
const { createConfig } = require("../src/config");
const { PublicDemoService } = require("../src/services/public-demo-service");
const { InMemoryPublicDemoRepository } = require("./support/in-memory-public-demo-repository");
const { issueInternalToken } = require("../../shared/internal-api-auth");
const path = require("node:path");
const browserApp = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
const browserPage = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const browserStyles = fs.readFileSync(path.join(__dirname, "..", "public", "app.css"), "utf8");

function createRepository() {
  return new InMemoryPublicDemoRepository();
}

test("der Release-Katalog besitzt keinen lokalen Persistenz-Fallback", () => {
  const config = createConfig({ PUBLIC_DEMO_POSTGRES_HOST: "runtime-postgres" });
  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.host, "runtime-postgres");
  assert.throws(() => createConfig({}), /PUBLIC_DEMO_POSTGRES_HOST/);
  const serviceSource = fs.readFileSync(path.join(__dirname, "..", "src", "index.js"), "utf8");
  assert.doesNotMatch(serviceSource, /sqlite-public-demo-repository|SqlitePublicDemoRepository/);
});

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

test("ein Nexi-Release bewahrt die vier ESP-IDF-Images und ihre Board-Offsets", () => {
  const repository = createRepository();
  repository.publish(release({
    demo_id: "nexi-basic-waveshare-s3",
    source_commit_sha: "0123456789abcdef0123456789abcdef01234567",
    flash_assets: [
      { asset_id: "bootloader", flash_offset: 0x0, base64: Buffer.from([1]).toString("base64") },
      { asset_id: "partitions", flash_offset: 0x8000, base64: Buffer.from([2]).toString("base64") },
      { asset_id: "otadata", flash_offset: 0xf000, base64: Buffer.from([3]).toString("base64") },
      { asset_id: "firmware", flash_offset: 0x20000, base64: Buffer.from([4]).toString("base64") },
    ],
  }));
  const manifest = repository.getFlashManifest("nexi-basic-waveshare-s3", "1.0.0");
  assert.equal(repository.getPublicDemo("nexi-basic-waveshare-s3").releases[0].source_commit_sha, "0123456789abcdef0123456789abcdef01234567");
  assert.deepEqual(manifest.assets.map(({ asset_id, flash_offset }) => [asset_id, flash_offset]), [
    ["bootloader", 0x0], ["partitions", 0x8000], ["otadata", 0xf000], ["firmware", 0x20000],
  ]);
  assert.equal(manifest.source_path, "public-demos/nexi-basic-waveshare-s3");
  assert.equal(manifest.source_version, "0123456789abcdef0123456789abcdef01234567");
  repository.close();
});

test("der öffentliche Lesezugang kann keine Release-Veröffentlichung auslösen", async () => {
  const repository = createRepository();
  const service = new PublicDemoService({ repository });
  const internalApiSigningKey = "public-demo-test-signing-key";
  const server = http.createServer((request, response) => createHttpApp({ service, internalApiSigningKey })(request, response)
    .catch((error) => {
      response.writeHead(error.status || 500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error.code }));
    }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const demoPage = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(demoPage.status, 200);
  assert.match(await demoPage.text(), /S3 Touch-Spielesammlung/);

  const brandLogo = await fetch(`http://127.0.0.1:${port}/gernetix-logo.png`);
  assert.equal(brandLogo.status, 200);
  assert.equal(brandLogo.headers.get("content-type"), "image/png");
  assert.ok((await brandLogo.arrayBuffer()).byteLength > 1_000);

  const brandWordmark = await fetch(`http://127.0.0.1:${port}/gernetix-wordmark.png`);
  assert.equal(brandWordmark.status, 200);
  assert.equal(brandWordmark.headers.get("content-type"), "image/png");
  assert.ok((await brandWordmark.arrayBuffer()).byteLength > 1_000);

  const browserIcon = await fetch(`http://127.0.0.1:${port}/gernetix-gx.svg`);
  assert.equal(browserIcon.status, 200);
  assert.equal(browserIcon.headers.get("content-type"), "image/svg+xml");
  assert.match(await browserIcon.text(), /aria-label="GerNetiX GX"/);

  const forbidden = await fetch(`http://127.0.0.1:${port}/api/internal/public-demos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(release()),
  });
  assert.equal(forbidden.status, 403);

  const wrongScope = issueInternalToken({
    iss: "test-publisher",
    sub: "test-publisher",
    aud: "public-demo-server",
    scopes: ["public_demo.read"],
  }, internalApiSigningKey);
  const scopeDenied = await fetch(`http://127.0.0.1:${port}/api/internal/public-demos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${wrongScope}` },
    body: JSON.stringify(release()),
  });
  assert.equal(scopeDenied.status, 403);

  const publisherToken = issueInternalToken({
    iss: "test-publisher",
    sub: "test-publisher",
    aud: "public-demo-server",
    scopes: ["public_demo.publish"],
  }, internalApiSigningKey);
  const published = await fetch(`http://127.0.0.1:${port}/api/internal/public-demos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${publisherToken}` },
    body: JSON.stringify(release()),
  });
  assert.equal(published.status, 201);
  const catalog = await fetch(`http://127.0.0.1:${port}/api/public/demos`);
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).items[0].demo_id, "touch-spielesammlung");

  const executorAsset = await fetch(`http://127.0.0.1:${port}/app/unified-flash-executor.js`);
  assert.equal(executorAsset.status, 200);
  assert.match(await executorAsset.text(), /GerNetiXFlashExecutor/);

  await new Promise((resolve) => server.close(resolve));
  repository.close();
});

test("the game collection delegates verified USB flashing and reset to the unified executor", () => {
  assert.match(browserStyles, /\.hero h1 \{ font-size:clamp\(2rem,4vw,2\.5rem\)/);
  assert.doesNotMatch(browserStyles, /5\.8rem/);
  assert.match(browserPage, /S3 Touch-Spielesammlung installieren/);
  assert.match(browserPage, /id="open-flash-dialog"/);
  assert.match(browserPage, /unified-flash-dialog\.js/);
  assert.match(browserPage, /unified-flash-executor\.js/);
  assert.match(browserPage, /id="publicMenuButton"/);
  assert.match(browserPage, /href="\/s3-touch-spielesammlung\/" aria-current="page"/);
  assert.match(browserPage, /\/landing\.js/);
  assert.doesNotMatch(browserPage, /Verfügbare Demos/);
  assert.match(browserApp, /api\/public\/demos\/\$\{DEMO_ID\}/);
  assert.match(browserApp, /GerNetiXFlashDialog\.create\(\)/);
  assert.match(browserApp, /methods:\s*\{[\s\S]*usb:[\s\S]*ota:[\s\S]*flashbox:/);
  assert.match(browserApp, /Noch keine Flash-Datei veröffentlicht/);
  assert.match(browserApp, /setEntryEnabled\(true, `Flashdialog verfügbar\. Der Release fehlt noch:/);
  assert.match(browserApp, /app\/auth\/\?next=/);
  assert.doesNotMatch(browserApp, /fetch\("api\/public\/demos"\)/);
  assert.match(browserApp, /GerNetiXFlashExecutor\.executeUsb\(/);
  assert.match(browserApp, /resetStrategy: "custom-reset"/);
  assert.doesNotMatch(browserApp, /loader\.writeFlash|loader\.after/);
});

test("unsupported browsers use the Serial Helper adapter from the same dialog", () => {
  assert.doesNotMatch(browserPage, /id="serial-support-dialog"|id="choose-port"|id="flash-button"/);
  assert.match(browserApp, /if \(navigator\.serial\)[\s\S]*navigator\.serial\.requestPort\(\)/);
  assert.match(browserPage, /serial-service-client\.js/);
  assert.match(browserApp, /serialService\.available\(\)/);
  assert.match(browserApp, /serialService\.ports\(\)/);
  assert.match(browserApp, /serialService\.probe\(selectedPort\.path\)/);
  assert.match(browserApp, /GerNetiXFlashExecutor\.executeUsb\(/);
  assert.doesNotMatch(browserApp, /serialService\.flash\(/);
  assert.match(browserApp, /if \(ports\.length > 1\)/);
});

test("the page follows the shared light/dark toggle instead of forcing dark mode", () => {
  // landing.css treats light as the :root baseline and only overrides colours
  // inside html[data-public-theme="dark"]. A bare, unconditional :root block
  // here would redeclare the same custom properties and load after
  // landing.css, permanently locking this page to dark regardless of the
  // toggle the page itself renders (see #publicMenuButton / landing.js).
  assert.doesNotMatch(browserStyles, /:root\s*\{[^}]*--(?:bg|panel|text|muted|line|accent)\s*:/);
  assert.match(browserStyles, /html\[data-public-theme="dark"\]\s*\{[^}]*--bg\s*:\s*#07111e/);
  assert.match(browserPage, /\/landing\.js/);
  const landingJs = fs.readFileSync(path.join(__dirname, "..", "..", "identity-server", "public", "landing.js"), "utf8");
  assert.match(landingJs, /initializePublicTheme/);
});
