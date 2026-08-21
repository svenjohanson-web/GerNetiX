"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { BackupSetWriter } = require("./backup-set");
const { MEMBER_NAMES } = require("./orchestrator");
const { generateRecoveryKeyPair, parsePrivateKeyFile } = require("./recovery-key");
const { restoreBackupSet } = require("./restore");
const { BLOCK_BYTES } = require("./tar-reader");

function store(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gernetix-restore-${label}-`));
}

// Minimaler ustar-Schreiber fuer synthetische Artefaktarchive.
function tarHeader(entryPath, size) {
  const header = Buffer.alloc(BLOCK_BYTES);
  header.write(entryPath, 0, 100, "utf8");
  header.write("000644 \0", 100, 8, "utf8");
  header.write(`${size.toString(8).padStart(11, "0")} `, 124, 12, "utf8");
  header.write("0", 156, 1, "utf8");
  header.write("ustar\0", 257, 6, "utf8");
  header.write("00", 263, 2, "utf8");
  header.fill(0x20, 148, 156);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  return header;
}

function artifactArchive(contents) {
  const pieces = [];
  for (const content of contents) {
    const payload = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const sha256 = crypto.createHash("sha256").update(payload).digest("hex");
    pieces.push(tarHeader(`objects/${sha256.slice(0, 2)}/${sha256}`, payload.length), payload);
    const padding = (BLOCK_BYTES - (payload.length % BLOCK_BYTES)) % BLOCK_BYTES;
    if (padding) pieces.push(Buffer.alloc(padding));
  }
  pieces.push(Buffer.alloc(BLOCK_BYTES * 2));
  return Buffer.concat(pieces);
}

function hashOf(content) {
  return crypto.createHash("sha256").update(Buffer.from(content)).digest("hex");
}

async function writeSet(storeDirectory, keyPair, { backupId, mode, archive, carriedForward = [] }) {
  const directory = path.join(storeDirectory, backupId);
  const writer = new BackupSetWriter({ directory, rawPublicKey: keyPair.rawPublicKey, chunkSize: 4096 });
  await writer.open();
  const consistency = mode === "daily" ? "stopped_service_snapshot" : "online_snapshot";
  await writer.addMember({
    name: MEMBER_NAMES.runtimeDatabase,
    area: "runtime_database",
    consistency: "transactional_dump",
    source: Buffer.from("runtime-dump"),
  });
  await writer.addMember({
    name: MEMBER_NAMES.forgejoDatabase,
    area: "forgejo_database",
    consistency,
    source: Buffer.from("forgejo-dump"),
  });
  await writer.addMember({
    name: MEMBER_NAMES.forgejoData,
    area: "forgejo_data",
    consistency,
    source: Buffer.from("forgejo-data"),
  });
  await writer.addMember({
    name: MEMBER_NAMES.artifactObjects,
    area: "artifact_store",
    consistency: "content_addressed",
    source: archive,
  });
  await writer.finalize({
    backupId,
    createdAt: "2026-08-20T10:15:00.000Z",
    mode,
    sourceInstance: "gernetix-vps",
    applicationVersion: "2026.08.20",
    schemaVersions: { gernetix_runtime: "17-abc" },
    forgejoVersion: "15.0.6",
    recoveryKeyId: keyPair.keyId,
    carriedForwardArtifacts: carriedForward,
  });
  return directory;
}

const EARLIER_ID = "20260819T101500Z-daily-0123456789abcdef";
const CURRENT_ID = "20260820T101500Z-hourly-0123456789abcdef";

async function buildIncrementalStore(keyPair, overrides = {}) {
  const storeDirectory = store(overrides.label || "inkrementell");
  await writeSet(storeDirectory, keyPair, {
    backupId: EARLIER_ID,
    mode: "daily",
    archive: artifactArchive(["altes-artefakt"]),
  });
  const currentDirectory = await writeSet(storeDirectory, keyPair, {
    backupId: CURRENT_ID,
    mode: "hourly",
    archive: artifactArchive(["neues-artefakt"]),
    carriedForward: [{ sha256: hashOf("altes-artefakt"), backupId: EARLIER_ID }],
  });
  return { storeDirectory, currentDirectory };
}

test("stellt einen Satz her und weist alle Artefakte ueber beide Saetze nach", async () => {
  const keyPair = generateRecoveryKeyPair();
  const { storeDirectory, currentDirectory } = await buildIncrementalStore(keyPair);
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  const targetDirectory = path.join(store("ziel"), "inhalt");

  const result = await restoreBackupSet({ setDirectory: currentDirectory, storeDirectory, privateKey, targetDirectory });
  assert.equal(result.manifest.backup_id, CURRENT_ID);
  assert.deepEqual(result.artifacts, {
    total: 2,
    fromCurrentSet: 1,
    fromEarlierSets: 1,
    earlierSets: [EARLIER_ID],
  });
  assert.equal(await fsp.readFile(path.join(targetDirectory, MEMBER_NAMES.runtimeDatabase), "utf8"), "runtime-dump");
});

test("legt die Archive aller beteiligten Saetze zum Einspielen ab", async () => {
  const keyPair = generateRecoveryKeyPair();
  const { storeDirectory, currentDirectory } = await buildIncrementalStore(keyPair, { label: "archive" });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  const artifactsDirectory = path.join(store("archive-ziel"), "artefakte");

  const result = await restoreBackupSet({
    setDirectory: currentDirectory,
    storeDirectory,
    privateKey,
    artifactsDirectory,
  });
  assert.equal(result.artifacts.total, 2);
  assert.deepEqual((await fsp.readdir(artifactsDirectory)).sort(), [
    `artifact-objects-${EARLIER_ID}.tar`,
    `artifact-objects-${CURRENT_ID}.tar`,
  ].sort());

  // Die abgelegten Archive sind echte tar-Dateien mit den erwarteten Objekten.
  const alt = await fsp.readFile(path.join(artifactsDirectory, `artifact-objects-${EARLIER_ID}.tar`), "utf8");
  assert.ok(alt.includes(hashOf("altes-artefakt")));
  const neu = await fsp.readFile(path.join(artifactsDirectory, `artifact-objects-${CURRENT_ID}.tar`), "utf8");
  assert.ok(neu.includes(hashOf("neues-artefakt")));
});

test("lehnt einen Wiederherstellungspunkt ab, dessen frueherer Satz fehlt", async () => {
  const keyPair = generateRecoveryKeyPair();
  const { storeDirectory, currentDirectory } = await buildIncrementalStore(keyPair, { label: "fehlend" });
  await fsp.rm(path.join(storeDirectory, EARLIER_ID), { recursive: true });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(
    restoreBackupSet({ setDirectory: currentDirectory, storeDirectory, privateKey }),
    new RegExp(`fehlen die Sicherungssaetze: ${EARLIER_ID}`),
  );
});

test("lehnt einen frueheren Satz ab, der das uebernommene Artefakt gar nicht enthaelt", async () => {
  const keyPair = generateRecoveryKeyPair();
  const storeDirectory = store("luecke");
  await writeSet(storeDirectory, keyPair, {
    backupId: EARLIER_ID,
    mode: "daily",
    archive: artifactArchive(["etwas-ganz-anderes"]),
  });
  const currentDirectory = await writeSet(storeDirectory, keyPair, {
    backupId: CURRENT_ID,
    mode: "hourly",
    archive: artifactArchive(["neues-artefakt"]),
    carriedForward: [{ sha256: hashOf("altes-artefakt"), backupId: EARLIER_ID }],
  });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(
    restoreBackupSet({ setDirectory: currentDirectory, storeDirectory, privateKey }),
    /fehlen 1 gesicherte Objekte/,
  );
});

test("erkennt ein Artefakt, dessen Inhalt nicht zu seinem Hash passt", async () => {
  const keyPair = generateRecoveryKeyPair();
  const storeDirectory = store("verfaelscht");
  // Ein Objekt unter einem Pfad ablegen, der nicht seinem Inhalt entspricht.
  const echterHash = hashOf("erwarteter-inhalt");
  const payload = Buffer.from("anderer-inhalt");
  const pieces = [tarHeader(`objects/${echterHash.slice(0, 2)}/${echterHash}`, payload.length), payload];
  pieces.push(Buffer.alloc((BLOCK_BYTES - (payload.length % BLOCK_BYTES)) % BLOCK_BYTES));
  pieces.push(Buffer.alloc(BLOCK_BYTES * 2));
  const currentDirectory = await writeSet(storeDirectory, keyPair, {
    backupId: CURRENT_ID,
    mode: "hourly",
    archive: Buffer.concat(pieces),
  });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(
    restoreBackupSet({ setDirectory: currentDirectory, storeDirectory, privateKey }),
    /hat den Inhaltshash/,
  );
});

test("erkennt einen beschaedigten frueheren Satz beim Nachziehen", async () => {
  const keyPair = generateRecoveryKeyPair();
  const { storeDirectory, currentDirectory } = await buildIncrementalStore(keyPair, { label: "beschaedigt" });
  const objectPath = path.join(storeDirectory, EARLIER_ID, `${MEMBER_NAMES.artifactObjects}.gxb`);
  const content = await fsp.readFile(objectPath);
  content[content.length - 20] ^= 0x01;
  await fsp.writeFile(objectPath, content);
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(
    restoreBackupSet({ setDirectory: currentDirectory, storeDirectory, privateKey }),
    /Pruefsummenfehler/,
  );
});

test("kommt ohne uebernommene Artefakte aus", async () => {
  const keyPair = generateRecoveryKeyPair();
  const storeDirectory = store("voll");
  const currentDirectory = await writeSet(storeDirectory, keyPair, {
    backupId: "20260820T101500Z-daily-0123456789abcdef",
    mode: "daily",
    archive: artifactArchive(["eins", "zwei", "drei"]),
  });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  const result = await restoreBackupSet({ setDirectory: currentDirectory, storeDirectory, privateKey });
  assert.deepEqual(result.artifacts, { total: 3, fromCurrentSet: 3, fromEarlierSets: 0, earlierSets: [] });
});
