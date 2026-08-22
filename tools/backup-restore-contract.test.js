"use strict";

// Vertragspruefungen fuer die Kundendaten-Sicherung auf CLI-Ebene: Was darf ein
// Werkzeug ohne Recovery-Key, was verweigert es, und richtet es sich niemals
// versehentlich gegen den produktiven Stand?

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const { BackupSetWriter } = require("./backup/backup-set");
const { MEMBER_NAMES } = require("./backup/orchestrator");
const { generateRecoveryKeyPair } = require("./backup/recovery-key");
const { BLOCK_BYTES } = require("./backup/tar-reader");
const checkRestoredRuntime = require("./check-restored-runtime");
const generateRecoveryKey = require("./generate-backup-recovery-key");
const restoreBackupSetCli = require("./restore-backup-set");

const BACKUP_ID = "20260820T101500Z-daily-0123456789abcdef";

function workspace(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gernetix-backup-contract-${label}-`));
}

function emptyArtifactArchive() {
  return Buffer.alloc(BLOCK_BYTES * 2);
}

async function writeBackupSet(storeDirectory, keyPair) {
  const directory = path.join(storeDirectory, BACKUP_ID);
  const writer = new BackupSetWriter({ directory, rawPublicKey: keyPair.rawPublicKey, chunkSize: 4096 });
  await writer.open();
  await writer.addMember({
    name: MEMBER_NAMES.runtimeDatabase,
    area: "runtime_database",
    consistency: "transactional_dump",
    source: Buffer.from("kundendaten-dump"),
  });
  await writer.addMember({
    name: MEMBER_NAMES.forgejoDatabase,
    area: "forgejo_database",
    consistency: "stopped_service_snapshot",
    source: Buffer.from("forgejo-dump"),
  });
  await writer.addMember({
    name: MEMBER_NAMES.forgejoData,
    area: "forgejo_data",
    consistency: "stopped_service_snapshot",
    source: Buffer.from("forgejo-data"),
  });
  await writer.addMember({
    name: MEMBER_NAMES.artifactObjects,
    area: "artifact_store",
    consistency: "content_addressed",
    source: emptyArtifactArchive(),
  });
  await writer.finalize({
    backupId: BACKUP_ID,
    createdAt: "2026-08-20T10:15:00.000Z",
    mode: "daily",
    sourceInstance: "gernetix-vps",
    applicationVersion: "2026.08.20",
    schemaVersions: { gernetix_runtime: "17-abc" },
    forgejoVersion: "15.0.6",
    recoveryKeyId: keyPair.keyId,
  });
  return directory;
}

test("der Schluesselgenerator legt den privaten Schluessel nie im Repository ab", () => {
  const { assertPrivateKeyTargetIsOutsideRepository } = generateRecoveryKey;
  for (const inside of [
    path.join(root, "recovery.key"),
    path.join(root, "tools", "backup", "recovery.key"),
    path.join(root, ".runtime", "recovery.key"),
  ]) {
    assert.throws(() => assertPrivateKeyTargetIsOutsideRepository(inside), /nicht im Repository liegen/);
  }
  assert.doesNotThrow(() => assertPrivateKeyTargetIsOutsideRepository(path.join(os.tmpdir(), "recovery.key")));
});

test("der Schluesselgenerator schreibt den privaten Schluessel nur in die Datei", () => {
  const directory = workspace("schluessel");
  const privateKeyPath = path.join(directory, "recovery.key");
  const publicKeyPath = path.join(directory, "recovery.pub");
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "tools", "generate-backup-recovery-key.js"),
      "--private-key-out",
      privateKeyPath,
      "--public-key-out",
      publicKeyPath,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);

  const privateContent = fs.readFileSync(privateKeyPath, "utf8");
  const privateMaterial = privateContent.split(/\s+/)[1];
  assert.ok(privateMaterial && privateMaterial.length === 43);
  assert.ok(!result.stdout.includes(privateMaterial), "Der private Schluessel darf nicht nach stdout gelangen");
  assert.ok(!fs.readFileSync(publicKeyPath, "utf8").includes(privateMaterial));
  assert.match(result.stdout, /zwei getrennte, verschluesselte Offline-Verwahrorte/);
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(privateKeyPath).mode & 0o777, 0o600);
  }
});

test("ein Sicherungssatz ist ohne den passenden Recovery-Key nicht lesbar", async () => {
  const keyPair = generateRecoveryKeyPair();
  const stranger = generateRecoveryKeyPair();
  const storeDirectory = workspace("fremd");
  const setDirectory = await writeBackupSet(storeDirectory, keyPair);
  const strangerKeyPath = path.join(storeDirectory, "fremd.key");
  fs.writeFileSync(strangerKeyPath, stranger.privateKeyFile);

  await assert.rejects(
    restoreBackupSetCli.main([
      setDirectory,
      "--private-key",
      strangerKeyPath,
      "--target-dir",
      path.join(storeDirectory, "ziel"),
    ]),
    /anderen Recovery-Key/,
  );
});

test("der Restore schreibt nie ueber ein bereits belegtes Zielverzeichnis", async () => {
  const keyPair = generateRecoveryKeyPair();
  const storeDirectory = workspace("belegt");
  const setDirectory = await writeBackupSet(storeDirectory, keyPair);
  const keyPath = path.join(storeDirectory, "recovery.key");
  fs.writeFileSync(keyPath, keyPair.privateKeyFile);
  const targetDirectory = path.join(storeDirectory, "ziel");
  fs.mkdirSync(targetDirectory);
  fs.writeFileSync(path.join(targetDirectory, "vorhandenes"), "wichtig");

  await assert.rejects(
    restoreBackupSetCli.main([setDirectory, "--private-key", keyPath, "--target-dir", targetDirectory]),
    /Zielverzeichnis ist nicht leer/,
  );
  assert.equal(fs.readFileSync(path.join(targetDirectory, "vorhandenes"), "utf8"), "wichtig");
});

test("der Restore protokolliert Wiederherstellungspunkt, Dauer und Konsistenzart", async () => {
  const keyPair = generateRecoveryKeyPair();
  const storeDirectory = workspace("protokoll");
  const setDirectory = await writeBackupSet(storeDirectory, keyPair);
  const keyPath = path.join(storeDirectory, "recovery.key");
  fs.writeFileSync(keyPath, keyPair.privateKeyFile);
  const reportPath = path.join(storeDirectory, "protokoll.json");

  await restoreBackupSetCli.main([
    setDirectory,
    "--private-key",
    keyPath,
    "--target-dir",
    path.join(storeDirectory, "ziel"),
    "--report",
    reportPath,
  ]);

  const report = JSON.parse(await fsp.readFile(reportPath, "utf8"));
  assert.equal(report.backup_id, BACKUP_ID);
  assert.equal(report.jointly_consistent_restore_point, true);
  assert.equal(report.forgejo_consistency, "stopped_service_snapshot");
  assert.equal(report.forgejo_version, "15.0.6");
  assert.ok(Number.isInteger(report.duration_ms));
  assert.ok(report.members.some((member) => member.area === "runtime_database"));
});

test("ein stuendlicher Satz wird ausdruecklich nicht als gemeinsam konsistent ausgegeben", async () => {
  const keyPair = generateRecoveryKeyPair();
  const storeDirectory = workspace("stuendlich");
  const directory = path.join(storeDirectory, "20260820T101500Z-hourly-0123456789abcdef");
  const writer = new BackupSetWriter({ directory, rawPublicKey: keyPair.rawPublicKey, chunkSize: 4096 });
  await writer.open();
  for (const [name, area, consistency, source] of [
    [MEMBER_NAMES.runtimeDatabase, "runtime_database", "transactional_dump", "dump"],
    [MEMBER_NAMES.forgejoDatabase, "forgejo_database", "online_snapshot", "dump"],
    [MEMBER_NAMES.forgejoData, "forgejo_data", "online_snapshot", "daten"],
  ]) {
    await writer.addMember({ name, area, consistency, source: Buffer.from(source) });
  }
  await writer.addMember({
    name: MEMBER_NAMES.artifactObjects,
    area: "artifact_store",
    consistency: "content_addressed",
    source: emptyArtifactArchive(),
  });
  await writer.finalize({
    backupId: "20260820T101500Z-hourly-0123456789abcdef",
    createdAt: "2026-08-20T10:15:00.000Z",
    mode: "hourly",
    sourceInstance: "gernetix-vps",
    applicationVersion: "2026.08.20",
    schemaVersions: { gernetix_runtime: "17-abc" },
    forgejoVersion: "15.0.6",
    recoveryKeyId: keyPair.keyId,
  });

  const keyPath = path.join(storeDirectory, "recovery.key");
  fs.writeFileSync(keyPath, keyPair.privateKeyFile);
  const reportPath = path.join(storeDirectory, "protokoll.json");
  await restoreBackupSetCli.main([
    directory,
    "--private-key",
    keyPath,
    "--target-dir",
    path.join(storeDirectory, "ziel"),
    "--report",
    reportPath,
  ]);
  const report = JSON.parse(await fsp.readFile(reportPath, "utf8"));
  assert.equal(report.jointly_consistent_restore_point, false);
  assert.equal(report.forgejo_consistency, "online_snapshot");
});

test("die fachliche Pruefung richtet sich niemals gegen den produktiven Stand", () => {
  for (const project of ["gernetix-vps", "gernetix", "produktion", "gernetix-restore", "../gernetix-restore-x"]) {
    assert.throws(
      () =>
        checkRestoredRuntime.parseArguments([
          "--compose-project",
          project,
          "--compose-file",
          "compose.test.yaml",
          "--env-file",
          ".env.test",
        ]),
      /Unsicherer Restore-Projektname/,
      `Projektname ${project} muss abgelehnt werden`,
    );
  }
  const accepted = checkRestoredRuntime.parseArguments([
    "--compose-project",
    "gernetix-restore-probe1",
    "--compose-file",
    "compose.test.yaml",
    "--env-file",
    ".env.test",
  ]);
  assert.equal(accepted.composeProject, "gernetix-restore-probe1");
  assert.equal(accepted.service, "runtime-postgres");
});

test("die fachliche Pruefung schickt SQL nur ueber stdin an das isolierte Projekt", async () => {
  const seen = [];
  const counts = {
    identity_user_accounts: 5,
    project_projects: 8,
    project_artifacts: 3,
    device_management_devices: 2,
    device_management_account_devices: 2,
    hardware_catalog_items: 11,
    hardware_shop_orders: 1,
  };
  const fakeRunner = async (descriptor) => {
    seen.push(descriptor);
    const simple = /^SELECT count\(\*\) FROM (\w+);$/.exec(descriptor.input.trim());
    return simple ? String(counts[simple[1]] ?? 0) : "0";
  };

  const result = await checkRestoredRuntime.main(
    [
      "--compose-project",
      "gernetix-restore-probe1",
      "--compose-file",
      "compose.test.yaml",
      "--env-file",
      ".env.test",
    ],
    { captureCommand: fakeRunner },
  );

  assert.equal(result.passed, true);
  assert.ok(seen.length > 0);
  for (const descriptor of seen) {
    assert.equal(descriptor.command, "docker");
    assert.ok(descriptor.args.includes("gernetix-restore-probe1"));
    assert.ok(
      descriptor.args.some((argument) => argument.includes("psql") && argument.includes("--file -")),
      "SQL muss ueber stdin gelesen werden",
    );
    assert.match(descriptor.input, /^SELECT count\(\*\)/);
    assert.ok(
      !descriptor.args.some((argument) => argument.includes("SELECT")),
      "SQL darf nicht ueber die Kommandozeile laufen",
    );
  }
});

test("die fachliche Pruefung scheitert sichtbar bei verwaisten Beziehungen", async () => {
  const fakeRunner = async (descriptor) => {
    const sql = descriptor.input.trim();
    if (sql.includes("LEFT JOIN identity_user_accounts a ON a.id = p.user_id")) return "4";
    if (/^SELECT count\(\*\) FROM \w+;$/.test(sql)) return "7";
    return "0";
  };
  await assert.rejects(
    checkRestoredRuntime.main(
      ["--compose-project", "gernetix-restore-probe1", "--compose-file", "c.yaml", "--env-file", ".env"],
      { captureCommand: fakeRunner },
    ),
    /projekte_haben_accounts/,
  );
});

test("die Werkzeuge fassen weder compose.vps.yaml noch .env.vps zum Restore an", () => {
  for (const file of ["restore-backup-set.js", "check-restored-runtime.js"]) {
    const source = fs.readFileSync(path.join(root, "tools", file), "utf8");
    assert.doesNotMatch(source, /compose\.vps\.yaml|\.env\.vps/, `${file} darf den produktiven Stand nicht kennen`);
  }
});

test("der Sicherungssatz enthaelt auf dem VPS keinen lesbaren Kundendatenklartext", async () => {
  const keyPair = generateRecoveryKeyPair();
  const storeDirectory = workspace("klartext");
  const setDirectory = await writeBackupSet(storeDirectory, keyPair);
  const marker = Buffer.from("kundendaten-dump");
  for (const name of await fsp.readdir(setDirectory)) {
    const content = await fsp.readFile(path.join(setDirectory, name));
    assert.ok(!content.includes(marker), `${name} enthaelt Klartext`);
  }
  // Auch der oeffentliche Schluessel allein hilft einem Angreifer nicht weiter.
  assert.ok(!keyPair.publicKeyFile.includes(keyPair.rawPrivateKey.toString("base64url")));
  assert.equal(crypto.createHash("sha256").update(keyPair.rawPublicKey).digest("hex"), keyPair.keyId);
});
