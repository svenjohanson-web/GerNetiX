"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { BackupSetWriter, CHECKSUM_FILE, readBackupSet, verifyBackupSetIntegrity } = require("./backup-set");
const { generateRecoveryKeyPair, parsePrivateKeyFile } = require("./recovery-key");
const { MANIFEST_MEMBER_NAME } = require("./backup-manifest");

const BACKUP_ID = "20260820T101500Z-daily-0123456789abcdef";

function workspace(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gernetix-backup-set-${label}-`));
}

const RUNTIME_DUMP = crypto.randomBytes(5000);
const FORGEJO_DUMP = Buffer.from("forgejo-datenbank");
const FORGEJO_DATA = crypto.randomBytes(3000);
const ARTIFACTS = Buffer.from("artefakt-objekte");

async function writeCompleteSet(directory, keyPair, overrides = {}) {
  const writer = new BackupSetWriter({ directory, rawPublicKey: keyPair.rawPublicKey, chunkSize: 1024 });
  await writer.open();
  await writer.addMember({
    name: "runtime-database.dump",
    area: "runtime_database",
    consistency: "transactional_dump",
    source: RUNTIME_DUMP,
  });
  await writer.addMember({
    name: "forgejo-database.dump",
    area: "forgejo_database",
    consistency: "stopped_service_snapshot",
    source: FORGEJO_DUMP,
  });
  await writer.addMember({
    name: "forgejo-data.tar.gz",
    area: "forgejo_data",
    consistency: "stopped_service_snapshot",
    source: FORGEJO_DATA,
  });
  await writer.addMember({
    name: "artifact-objects.tar",
    area: "artifact_store",
    consistency: "content_addressed",
    source: ARTIFACTS,
  });
  const manifest = await writer.finalize({
    backupId: BACKUP_ID,
    createdAt: "2026-08-20T10:15:00.000Z",
    mode: "daily",
    sourceInstance: "gernetix-vps",
    applicationVersion: "2026.08.20",
    schemaVersions: { gernetix_runtime: "0421" },
    forgejoVersion: "15.0.6",
    recoveryKeyId: keyPair.keyId,
    ...overrides,
  });
  return manifest;
}

test("schreibt einen vollstaendigen Satz und stellt ihn identisch wieder her", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("roundtrip"), BACKUP_ID);
  const manifest = await writeCompleteSet(setDirectory, keyPair);
  assert.equal(manifest.backup_id, BACKUP_ID);
  assert.equal(manifest.members.length, 4);

  const { objectCount } = await verifyBackupSetIntegrity(setDirectory);
  assert.equal(objectCount, 5);

  const targetDirectory = path.join(workspace("restore"), "wiederhergestellt");
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  const result = await readBackupSet(setDirectory, privateKey, { targetDirectory });
  assert.deepEqual(result.manifest, manifest);
  assert.deepEqual(await fsp.readFile(path.join(targetDirectory, "runtime-database.dump")), RUNTIME_DUMP);
  assert.deepEqual(await fsp.readFile(path.join(targetDirectory, "forgejo-data.tar.gz")), FORGEJO_DATA);
  assert.deepEqual(await fsp.readFile(path.join(targetDirectory, "artifact-objects.tar")), ARTIFACTS);
});

test("legt auf dem VPS keinen lesbaren Klartext ab", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("opaque"), BACKUP_ID);
  await writeCompleteSet(setDirectory, keyPair);
  for (const name of await fsp.readdir(setDirectory)) {
    const content = await fsp.readFile(path.join(setDirectory, name));
    assert.ok(!content.includes(FORGEJO_DUMP), `${name} enthaelt Klartext`);
    assert.ok(!content.includes(ARTIFACTS), `${name} enthaelt Klartext`);
    if (name !== CHECKSUM_FILE) assert.ok(!content.includes(Buffer.from("gernetix_runtime")), `${name} enthaelt Manifesttext`);
  }
});

test("das Manifest liegt nur verschluesselt im Satz", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("manifest"), BACKUP_ID);
  await writeCompleteSet(setDirectory, keyPair);
  const entries = await fsp.readdir(setDirectory);
  assert.ok(entries.includes(`${MANIFEST_MEMBER_NAME}.gxb`));
  assert.ok(!entries.includes(MANIFEST_MEMBER_NAME));
  const raw = await fsp.readFile(path.join(setDirectory, `${MANIFEST_MEMBER_NAME}.gxb`), "utf8");
  assert.ok(!raw.includes("backup_id"));
});

test("erkennt ein veraendertes Objekt schon ohne Recovery-Key", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("tampered"), BACKUP_ID);
  await writeCompleteSet(setDirectory, keyPair);
  const objectPath = path.join(setDirectory, "runtime-database.dump.gxb");
  const content = await fsp.readFile(objectPath);
  content[content.length - 1] ^= 0x01;
  await fsp.writeFile(objectPath, content);
  await assert.rejects(verifyBackupSetIntegrity(setDirectory), /Pruefsummenfehler/);
});

test("erkennt ein fehlendes und ein zusaetzliches Objekt", async () => {
  const keyPair = generateRecoveryKeyPair();
  const incomplete = path.join(workspace("incomplete"), BACKUP_ID);
  await writeCompleteSet(incomplete, keyPair);
  await fsp.rm(path.join(incomplete, "forgejo-data.tar.gz.gxb"));
  await assert.rejects(verifyBackupSetIntegrity(incomplete), /stimmen nicht ueberein/);

  const extended = path.join(workspace("extended"), BACKUP_ID);
  await writeCompleteSet(extended, keyPair);
  await fsp.writeFile(path.join(extended, "zusaetzlich.gxb"), "fremd");
  await assert.rejects(verifyBackupSetIntegrity(extended), /stimmen nicht ueberein/);
});

test("weist einen Satz ab, dessen Pruefsummenliste manipuliert wurde", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("checksums"), BACKUP_ID);
  await writeCompleteSet(setDirectory, keyPair);
  const checksumPath = path.join(setDirectory, CHECKSUM_FILE);
  const original = await fsp.readFile(checksumPath, "utf8");
  await fsp.writeFile(checksumPath, original.replace(/^[a-f0-9]{64}/m, "0".repeat(64)));
  await assert.rejects(verifyBackupSetIntegrity(setDirectory), /Pruefsummenfehler/);
});

test("ein fremder Recovery-Key kann den Satz nicht oeffnen", async () => {
  const keyPair = generateRecoveryKeyPair();
  const stranger = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("stranger"), BACKUP_ID);
  await writeCompleteSet(setDirectory, keyPair);
  const { privateKey } = parsePrivateKeyFile(stranger.privateKeyFile);
  await assert.rejects(readBackupSet(setDirectory, privateKey), /anderen Recovery-Key/);
});

test("ueberschreibt niemals ein bestehendes Ziel", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("existing"), BACKUP_ID);
  await writeCompleteSet(setDirectory, keyPair);
  const writer = new BackupSetWriter({ directory: setDirectory, rawPublicKey: keyPair.rawPublicKey });
  await assert.rejects(writer.open(), /EEXIST/);
});

test("verlangt alle Pflichtbereiche, bevor ein Satz abgeschlossen wird", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("partial"), BACKUP_ID);
  const writer = new BackupSetWriter({ directory: setDirectory, rawPublicKey: keyPair.rawPublicKey });
  await writer.open();
  await writer.addMember({
    name: "runtime-database.dump",
    area: "runtime_database",
    consistency: "transactional_dump",
    source: RUNTIME_DUMP,
  });
  await assert.rejects(
    writer.finalize({
      backupId: BACKUP_ID,
      createdAt: "2026-08-20T10:15:00.000Z",
      mode: "daily",
      sourceInstance: "gernetix-vps",
      applicationVersion: "2026.08.20",
      schemaVersions: { gernetix_runtime: "0421" },
      forgejoVersion: "15.0.6",
      recoveryKeyId: keyPair.keyId,
    }),
    /Pflichtbereiche nicht ab/,
  );
  assert.ok(!fs.existsSync(path.join(setDirectory, CHECKSUM_FILE)));
});

test("laesst keinen Bestandteil aus dem Satz oder dem Restore-Ziel ausbrechen", async () => {
  const keyPair = generateRecoveryKeyPair();
  const setDirectory = path.join(workspace("escape"), BACKUP_ID);
  const writer = new BackupSetWriter({ directory: setDirectory, rawPublicKey: keyPair.rawPublicKey });
  await writer.open();
  await assert.rejects(
    writer.addMember({
      name: "../ausbruch",
      area: "runtime_database",
      consistency: "transactional_dump",
      source: RUNTIME_DUMP,
    }),
    /verlaesst den Sicherungssatz/,
  );
});
