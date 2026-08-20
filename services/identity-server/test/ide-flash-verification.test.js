"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { webcrypto } = require("node:crypto");
const { sandboxModule } = require("../test-support/platform-app-source");

/*
 * Die IDE laedt ihre Flash-Dateien ueber den Executor. Geprueft wird hier, dass
 * sie das wirklich tut und was dabei herauskommt -- nicht, wie der Quelltext
 * formuliert ist. Dafuer bekommt der Executor ein eigenes globales Objekt: dort
 * findet er fetch und crypto, und der Testprozess bleibt unberuehrt.
 */
function loadExecutor(fetchImpl) {
  const modul = { exports: {} };
  sandboxModule("unified-flash-executor.js", {
    module: modul,
    exports: modul.exports,
    window: undefined,
    globalThis: { fetch: fetchImpl, crypto: webcrypto, setTimeout },
  });
  return modul.exports;
}

function loadBuildController(executor, terminal) {
  return sandboxModule("app-device-build-controller.js", {
    GerNetiXFlashExecutor: executor,
    appendTerminalLine: (kind, text) => terminal.push(`${kind}: ${text}`),
    globalThis: {},
  }, ["loadVerifiedFlashPackage"]);
}

const artifacts = {
  "bootloader.bin": Uint8Array.from([0xe9, 0x01, 0x02]),
  "partitions.bin": Uint8Array.from([0xaa, 0xbb]),
  "firmware.bin": Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
};
const addresses = { "bootloader.bin": 0x0000, "partitions.bin": 0x8000, "firmware.bin": 0x10000 };

async function buildWithManifest(overrides = {}) {
  const manifest = [];
  for (const [name, data] of Object.entries(artifacts)) {
    manifest.push({
      name,
      address: addresses[name],
      url: `/api/user-ide/build-artifacts/job-7/${name}`,
      size_bytes: data.length,
      sha256: await sha256Hex(data),
      ...(overrides[name] || {}),
    });
  }
  return { build_job_id: "job-7", flash_manifest: manifest.filter((item) => !overrides.omit?.includes(item.name)) };
}

async function sha256Hex(bytes) {
  const digest = await webcrypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function serveArtifacts(replacements = {}) {
  const calls = [];
  const respond = async (url) => {
    calls.push(url);
    const name = String(url).split("/").pop();
    const data = replacements[name] || artifacts[name];
    return new Response(data, { status: 200 });
  };
  respond.calls = calls;
  return respond;
}

test("the IDE hands on only bytes that match the size and checksum the build reported", async () => {
  const terminal = [];
  const fetchImpl = serveArtifacts();
  const { loadVerifiedFlashPackage } = loadBuildController(loadExecutor(fetchImpl), terminal);

  const files = await loadVerifiedFlashPackage(await buildWithManifest(), "USB");

  assert.deepEqual(files.map((file) => file.name), ["bootloader.bin", "partitions.bin", "firmware.bin"]);
  assert.deepEqual(files.at(-1).data, artifacts["firmware.bin"]);
  assert.deepEqual(files.map((file) => file.address), [0x0000, 0x8000, 0x10000]);
  assert.equal(terminal.filter((line) => /Größe und SHA-256 geprüft · Build job-7/.test(line)).length, 3);
});

test("a firmware whose bytes were altered on the way never reaches the flash step", async () => {
  const terminal = [];
  const fetchImpl = serveArtifacts({ "firmware.bin": Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 9]) });
  const { loadVerifiedFlashPackage } = loadBuildController(loadExecutor(fetchImpl), terminal);

  await assert.rejects(
    loadVerifiedFlashPackage(await buildWithManifest(), "USB"),
    /firmware\.bin hat nicht die veröffentlichte SHA-256-Prüfsumme/,
  );
});

test("a download that stopped early is rejected with both sizes named", async () => {
  const terminal = [];
  const fetchImpl = serveArtifacts({ "firmware.bin": artifacts["firmware.bin"].slice(0, 5) });
  const { loadVerifiedFlashPackage } = loadBuildController(loadExecutor(fetchImpl), terminal);

  await assert.rejects(
    loadVerifiedFlashPackage(await buildWithManifest(), "USB"),
    /firmware\.bin hat eine unerwartete Größe \(5 statt 8 Byte\)/,
  );
});

test("an artifact delivered without a checksum is refused instead of flashed unchecked", async () => {
  const terminal = [];
  const fetchImpl = serveArtifacts();
  const { loadVerifiedFlashPackage } = loadBuildController(loadExecutor(fetchImpl), terminal);

  await assert.rejects(
    loadVerifiedFlashPackage(await buildWithManifest({ "firmware.bin": { sha256: "" } }), "USB"),
    /firmware\.bin besitzt keine SHA-256-Prüfsumme/,
  );
});

test("an incomplete package is refused before anything is downloaded", async () => {
  const terminal = [];
  const fetchImpl = serveArtifacts();
  const { loadVerifiedFlashPackage } = loadBuildController(loadExecutor(fetchImpl), terminal);

  await assert.rejects(
    loadVerifiedFlashPackage(await buildWithManifest({ omit: ["partitions.bin"] }), "Web-Serial"),
    /kein vollständiges ESP32-Web-Serial-Flashpaket/,
  );
  assert.deepEqual(fetchImpl.calls, []);
});

test("the flash order carries the build it came from, so an unattributed one fails", async () => {
  const terminal = [];
  const fetchImpl = serveArtifacts();
  const { loadVerifiedFlashPackage } = loadBuildController(loadExecutor(fetchImpl), terminal);
  const build = await buildWithManifest();
  delete build.build_job_id;

  await assert.rejects(loadVerifiedFlashPackage(build, "USB"), /Kennung des Builds/);
  assert.deepEqual(fetchImpl.calls, []);
});

test("the IDE assembles no flash bytes of its own", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../public/app/app-device-build-controller.js"),
    "utf8",
  );
  /*
   * Beide Uebertragungswege holen ihre Dateien aus derselben geprueften Ladung.
   * Ein eigener arrayBuffer() im Controller waere ein zweiter, ungepruefter Weg
   * -- genau der Zustand, den diese Aenderung beseitigt hat.
   */
  assert.doesNotMatch(source, /arrayBuffer\(\)/);
  assert.match(source, /async function flashBuildViaSerialService[\s\S]*?await loadVerifiedFlashPackage\(build, "USB"\)/);
  assert.match(source, /async function flashBuildViaWebSerial[\s\S]*?await loadVerifiedFlashPackage\(build, "Web-Serial"\)/);
});
