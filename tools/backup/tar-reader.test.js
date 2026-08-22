"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { Readable } = require("node:stream");
const { spawnSync } = require("node:child_process");

const { BLOCK_BYTES, readTarEntries } = require("./tar-reader");

// Minimaler ustar-Schreiber, damit die Tests ohne System-tar auskommen.
function tarHeader(entryPath, size, type = "0") {
  const header = Buffer.alloc(BLOCK_BYTES);
  header.write(entryPath, 0, 100, "utf8");
  header.write("000644 \0", 100, 8, "utf8");
  header.write("000000 \0", 108, 8, "utf8");
  header.write("000000 \0", 116, 8, "utf8");
  header.write(`${size.toString(8).padStart(11, "0")} `, 124, 12, "utf8");
  header.write("00000000000 ", 136, 12, "utf8");
  header.write(type, 156, 1, "utf8");
  header.write("ustar\0", 257, 6, "utf8");
  header.write("00", 263, 2, "utf8");
  header.fill(0x20, 148, 156);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  return header;
}

function buildTar(entries, options = {}) {
  const pieces = [];
  for (const entry of entries) {
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content || "");
    pieces.push(tarHeader(entry.path, content.length, entry.type));
    pieces.push(content);
    const padding = (BLOCK_BYTES - (content.length % BLOCK_BYTES)) % BLOCK_BYTES;
    if (padding) pieces.push(Buffer.alloc(padding));
  }
  if (!options.omitEndBlocks) pieces.push(Buffer.alloc(BLOCK_BYTES * 2));
  return Buffer.concat(pieces);
}

async function collect(archive, pieceSize = 0) {
  const entries = [];
  const source = pieceSize ? Readable.from(split(archive, pieceSize)) : Readable.from([archive]);
  await readTarEntries(source, (entry) => {
    entries.push(entry);
  });
  return entries;
}

function split(buffer, size) {
  const pieces = [];
  for (let offset = 0; offset < buffer.length; offset += size) pieces.push(buffer.subarray(offset, offset + size));
  return pieces;
}

test("liest Pfad, Groesse und Inhaltshash jedes Eintrags", async () => {
  const content = crypto.randomBytes(1500);
  const archive = buildTar([
    { path: "objects/ab/eins", content },
    { path: "objects/cd/zwei", content: "kurz" },
  ]);
  const entries = await collect(archive);
  assert.deepEqual(entries.map((entry) => entry.path), ["objects/ab/eins", "objects/cd/zwei"]);
  assert.equal(entries[0].sizeBytes, content.length);
  assert.equal(entries[0].sha256, crypto.createHash("sha256").update(content).digest("hex"));
  assert.equal(entries[1].sha256, crypto.createHash("sha256").update("kurz").digest("hex"));
});

test("liefert dasselbe Ergebnis, egal wie der Stream zerteilt ankommt", async () => {
  const archive = buildTar([
    { path: "objects/ab/eins", content: crypto.randomBytes(2049) },
    { path: "objects/cd/zwei", content: crypto.randomBytes(7) },
  ]);
  const inEinemStueck = await collect(archive);
  for (const pieceSize of [1, 7, 512, 513, 1024]) {
    assert.deepEqual(await collect(archive, pieceSize), inEinemStueck, `Zerteilung ${pieceSize}`);
  }
});

test("kommt mit leeren Dateien und einem leeren Archiv zurecht", async () => {
  assert.deepEqual(await collect(buildTar([])), []);
  const entries = await collect(buildTar([{ path: "objects/ab/leer", content: "" }]));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sizeBytes, 0);
  assert.equal(entries[0].sha256, crypto.createHash("sha256").digest("hex"));
});

test("lehnt Verzeichnisse, Links und andere Sondertypen ab", async () => {
  for (const type of ["5", "2", "1", "L", "K"]) {
    const archive = buildTar([{ path: "objects/ab/eins", content: "", type }]);
    await assert.rejects(collect(archive), /nicht erlaubten Eintragstyp/);
  }
});

test("lehnt unsichere Pfade ab", async () => {
  for (const entryPath of ["/etc/passwd", "objects/../../ausbruch", "../ausbruch"]) {
    await assert.rejects(collect(buildTar([{ path: entryPath, content: "x" }])), /unsicheren Pfad/);
  }
});

test("erkennt ein abgeschnittenes Archiv statt Teildaten zu melden", async () => {
  const archive = buildTar([{ path: "objects/ab/eins", content: crypto.randomBytes(1000) }]);
  await assert.rejects(collect(archive.subarray(0, archive.length - BLOCK_BYTES * 3)), /mitten in einem Eintrag/);
  await assert.rejects(
    collect(buildTar([{ path: "objects/ab/eins", content: "x" }], { omitEndBlocks: true })),
    /Endblock fehlt/,
  );
});

test("erkennt einen beschaedigten Eintragskopf", async () => {
  const archive = buildTar([{ path: "objects/ab/eins", content: "inhalt" }]);
  archive[10] ^= 0x01;
  await assert.rejects(collect(archive), /beschaedigten Eintragskopf/);
});

test("erkennt Daten nach dem Ende des Archivs", async () => {
  const archive = Buffer.concat([
    buildTar([{ path: "objects/ab/eins", content: "inhalt" }]),
    buildTar([{ path: "objects/cd/zwei", content: "angehaengt" }]),
  ]);
  await assert.rejects(collect(archive), /nach seinem Ende/);
});

test("liest ein Archiv, das das System-tar erzeugt hat", async (t) => {
  const probe = spawnSync("tar", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) return t.skip("System-tar ist auf dieser Plattform nicht verfuegbar");

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-tar-reader-"));
  const content = crypto.randomBytes(3000);
  fs.mkdirSync(path.join(directory, "objects", "ab"), { recursive: true });
  fs.writeFileSync(path.join(directory, "objects", "ab", "eins"), content);
  fs.writeFileSync(path.join(directory, "objects", "ab", "zwei"), "kurz");
  const archivePath = path.join(directory, "archiv.tar");
  const created = spawnSync("tar", ["-cf", archivePath, "-C", directory, "objects/ab/eins", "objects/ab/zwei"], {
    encoding: "utf8",
  });
  assert.equal(created.status, 0, created.stderr);

  const entries = await collect(fs.readFileSync(archivePath));
  const eins = entries.find((entry) => entry.path.endsWith("eins"));
  assert.ok(eins, `Eintrag fehlt in ${JSON.stringify(entries.map((entry) => entry.path))}`);
  assert.equal(eins.sizeBytes, content.length);
  assert.equal(eins.sha256, crypto.createHash("sha256").update(content).digest("hex"));
});
