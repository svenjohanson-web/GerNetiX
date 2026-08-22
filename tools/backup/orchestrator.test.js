"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createScriptedRunner } = require("./command-runner");
const { MEMBER_NAMES, createBackupSet, loadLedger, saveLedger } = require("./orchestrator");
const { readBackupSet, verifyBackupSetIntegrity } = require("./backup-set");
const { generateRecoveryKeyPair, parsePrivateKeyFile } = require("./recovery-key");

const RUNTIME_DUMP = crypto.randomBytes(2048);
const RUNTIME_ROLES = "CREATE ROLE gernetix_runtime;\n";
const FORGEJO_DUMP = crypto.randomBytes(1024);
const FORGEJO_DATA = crypto.randomBytes(1024);
const OBJECT_A = "a".repeat(64);
const OBJECT_B = "b".repeat(64);

function workspace(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `gernetix-orchestrator-${label}-`));
}

function joined(descriptor) {
  return descriptor.args.join(" ");
}

function defaultHandlers(overrides = {}) {
  const objects = overrides.objects || [`objects/${OBJECT_A.slice(0, 2)}/${OBJECT_A}`];
  return [
    { matches: (d) => joined(d).includes("_migrations"), output: overrides.schemaVersion ?? `17-${"c".repeat(32)}\n` },
    { matches: (d) => joined(d).includes("forgejo --version"), output: "Forgejo version 15.0.6+gitea-1.22.0\n" },
    { matches: (d) => joined(d).includes("ps --status running"), output: overrides.running ?? "forgejo\nruntime-postgres\n" },
    { matches: (d) => joined(d).includes('--dbname "$POSTGRES_DB"'), output: RUNTIME_DUMP },
    { matches: (d) => joined(d).includes("pg_dumpall"), output: RUNTIME_ROLES },
    { matches: (d) => joined(d).includes("--dbname forgejo"), output: FORGEJO_DUMP },
    { matches: (d) => joined(d).includes("tar -C /var/lib/gitea"), output: FORGEJO_DATA },
    { matches: (d) => joined(d).includes("find objects -type f"), output: `${objects.join("\n")}\n` },
    {
      matches: (d) => joined(d).includes("tar -cf - -T -"),
      output: (d) => `artifact-archiv:${d.input || ""}`,
    },
    { matches: (d) => joined(d).includes("stop -t 60 forgejo"), output: "" },
    { matches: (d) => joined(d).includes("up -d --no-deps forgejo"), output: "" },
    ...(overrides.extra || []),
  ];
}

async function runOrchestrator(options = {}) {
  const keyPair = options.keyPair || generateRecoveryKeyPair();
  const runner = createScriptedRunner(options.handlers || defaultHandlers(options));
  const result = await createBackupSet({
    mode: options.mode || "hourly",
    workDirectory: options.workDirectory || workspace("run"),
    rawPublicKey: keyPair.rawPublicKey,
    recoveryKeyId: keyPair.keyId,
    sourceInstance: "gernetix-vps",
    applicationVersion: "2026.08.20",
    composeFile: "compose.vps.yaml",
    envFile: ".env.vps",
    now: new Date("2026-08-20T10:15:00.000Z"),
    backupSuffix: "0123456789abcdef",
    chunkSize: 1024,
    ledger: options.ledger,
    runner,
  });
  return { result, runner, keyPair };
}

test("erzeugt einen vollstaendigen, gepruefen Satz aus allen Pflichtbereichen", async () => {
  const { result, keyPair } = await runOrchestrator();
  assert.equal(result.backupId, "20260820T101500Z-hourly-0123456789abcdef");
  assert.equal(result.manifest.forgejo_version, "15.0.6");
  assert.deepEqual(
    result.manifest.members.map((member) => member.area).sort(),
    ["artifact_store", "forgejo_data", "forgejo_database", "runtime_database", "runtime_database"],
  );
  assert.equal(result.objectCount, 6);

  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  const targetDirectory = path.join(workspace("restore"), "inhalt");
  const restored = await readBackupSet(result.directory, privateKey, { targetDirectory });
  assert.deepEqual(await fsp.readFile(path.join(targetDirectory, MEMBER_NAMES.runtimeDatabase)), RUNTIME_DUMP);
  assert.equal(await fsp.readFile(path.join(targetDirectory, MEMBER_NAMES.runtimeRoles), "utf8"), RUNTIME_ROLES);
  assert.deepEqual(await fsp.readFile(path.join(targetDirectory, MEMBER_NAMES.forgejoData)), FORGEJO_DATA);
  assert.equal(restored.manifest.backup_id, result.backupId);
});

test("haelt die Schemaversion aus der Datenbank im Manifest fest", async () => {
  const { result } = await runOrchestrator();
  assert.equal(result.manifest.schema_versions.gernetix_runtime, `17-${"c".repeat(32)}`);
});

test("bricht ab, wenn die Schemaversion nicht bestimmbar ist", async () => {
  const workDirectory = workspace("schema");
  await assert.rejects(
    runOrchestrator({ schemaVersion: "FEHLER: Verbindung verweigert\n", workDirectory }),
    /Schemaversion von gernetix_runtime konnte nicht bestimmt werden/,
  );
  assert.deepEqual(await fsp.readdir(workDirectory), []);
});

test("stoppt Forgejo taeglich und niemals stuendlich", async () => {
  const hourly = await runOrchestrator({ mode: "hourly" });
  assert.equal(hourly.runner.calls.some((call) => joined(call).includes("stop -t 60 forgejo")), false);
  assert.equal(hourly.result.manifest.forgejo_consistency, "online_snapshot");

  const daily = await runOrchestrator({ mode: "daily" });
  const calls = daily.runner.calls.map(joined);
  const stopIndex = calls.findIndex((call) => call.includes("stop -t 60 forgejo"));
  const dumpIndex = calls.findIndex((call) => call.includes("--dbname forgejo"));
  const startIndex = calls.findIndex((call) => call.includes("up -d --no-deps forgejo"));
  assert.ok(stopIndex >= 0 && stopIndex < dumpIndex, "Forgejo muss vor dem Dump gestoppt sein");
  assert.ok(startIndex > dumpIndex, "Forgejo muss nach dem Dump wieder starten");
  assert.equal(daily.result.manifest.forgejo_consistency, "stopped_service_snapshot");
});

test("stoppt einen ohnehin gestoppten Dienst nicht und startet ihn nicht ungefragt", async () => {
  const { runner } = await runOrchestrator({ mode: "daily", running: "runtime-postgres\n" });
  const calls = runner.calls.map(joined);
  assert.equal(calls.some((call) => call.includes("stop -t 60 forgejo")), false);
  assert.equal(calls.some((call) => call.includes("up -d --no-deps forgejo")), false);
});

test("startet das gestoppte Forgejo auch nach einem gescheiterten Lauf wieder", async () => {
  const failing = defaultHandlers().map((handler) =>
    handler.matches({ args: ["tar", "-C", "/var/lib/gitea", "-czf", "-", "."] }) ? { ...handler, fails: true } : handler,
  );
  const runner = createScriptedRunner(failing);
  const keyPair = generateRecoveryKeyPair();
  const workDirectory = workspace("failure");
  await assert.rejects(
    createBackupSet({
      mode: "daily",
      workDirectory,
      rawPublicKey: keyPair.rawPublicKey,
      recoveryKeyId: keyPair.keyId,
      sourceInstance: "gernetix-vps",
      applicationVersion: "2026.08.20",
      composeFile: "compose.vps.yaml",
      envFile: ".env.vps",
      now: new Date("2026-08-20T10:15:00.000Z"),
      backupSuffix: "0123456789abcdef",
      chunkSize: 1024,
      runner,
    }),
    /fehlgeschlagen/,
  );
  const calls = runner.calls.map(joined);
  assert.ok(calls.some((call) => call.includes("stop -t 60 forgejo")));
  assert.ok(
    calls.some((call) => call.includes("up -d --no-deps forgejo")),
    "Forgejo muss nach einem Fehlschlag wieder gestartet werden",
  );
  assert.deepEqual(await fsp.readdir(workDirectory), [], "Ein unvollstaendiger Satz darf nicht liegen bleiben");
});

test("sichert nur neue Artefakte und nennt uebernommene mit ihrem Satz", async () => {
  const objects = [`objects/${OBJECT_A.slice(0, 2)}/${OBJECT_A}`, `objects/${OBJECT_B.slice(0, 2)}/${OBJECT_B}`];
  const ledger = { backup_id: "20260819T101500Z-daily-0123456789abcdef", artifacts: { [OBJECT_A]: "20260819T101500Z-daily-0123456789abcdef" } };
  const { result, runner, keyPair } = await runOrchestrator({ objects, ledger });

  assert.deepEqual(result.artifacts, { added: 1, carriedForward: 1 });
  assert.deepEqual(result.manifest.carried_forward_artifacts, [
    { sha256: OBJECT_A, backup_id: "20260819T101500Z-daily-0123456789abcdef" },
  ]);

  const archiveCall = runner.calls.find((call) => joined(call).includes("tar -cf - -T -"));
  assert.equal(archiveCall.input, `objects/${OBJECT_B.slice(0, 2)}/${OBJECT_B}\n`);

  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  const targetDirectory = path.join(workspace("artifacts"), "inhalt");
  await readBackupSet(result.directory, privateKey, { targetDirectory });
  const archive = await fsp.readFile(path.join(targetDirectory, MEMBER_NAMES.artifactObjects), "utf8");
  assert.ok(archive.includes(OBJECT_B));
  assert.ok(!archive.includes(OBJECT_A));

  assert.equal(result.ledger.artifacts[OBJECT_A], "20260819T101500Z-daily-0123456789abcdef");
  assert.equal(result.ledger.artifacts[OBJECT_B], result.backupId);
});

test("weist einen Artifact Store mit unerwarteten Pfaden ab", async () => {
  const objects = ["objects/ab/nicht-content-addressed"];
  const workDirectory = workspace("badpath");
  await assert.rejects(runOrchestrator({ objects, workDirectory }), /unerwarteten Objektpfad/);
  assert.deepEqual(await fsp.readdir(workDirectory), []);
});

test("bricht ab, wenn ein Dump mitten im Stream scheitert", async () => {
  const handlers = defaultHandlers().map((handler) =>
    handler.matches({ args: ["pg_dumpall"] }) ? { ...handler, fails: true } : handler,
  );
  const workDirectory = workspace("dumpfail");
  await assert.rejects(runOrchestrator({ handlers, workDirectory }), /fehlgeschlagen/);
  assert.deepEqual(await fsp.readdir(workDirectory), []);
});

test("der Satz bleibt ohne Recovery-Key unlesbar, ist aber pruefbar", async () => {
  const { result } = await runOrchestrator();
  const integrity = await verifyBackupSetIntegrity(result.directory);
  assert.equal(integrity.objectCount, 6);
  for (const name of await fsp.readdir(result.directory)) {
    if (name === "SHA256SUMS") continue;
    const content = await fsp.readFile(path.join(result.directory, name));
    assert.ok(!content.includes(RUNTIME_DUMP));
    assert.ok(!content.includes(Buffer.from(RUNTIME_ROLES)));
  }
});

test("schreibt und liest den Ledger fuer den naechsten inkrementellen Lauf", async () => {
  const directory = workspace("ledger");
  assert.deepEqual(await loadLedger(directory), { backup_id: "", artifacts: {} });
  const ledger = { backup_id: "20260820T101500Z-hourly-0123456789abcdef", artifacts: { [OBJECT_A]: "20260820T101500Z-hourly-0123456789abcdef" } };
  await saveLedger(directory, ledger);
  assert.deepEqual(await loadLedger(directory), ledger);
});

test("weist einen Ledger mit unbrauchbaren Eintraegen ab", async () => {
  const workDirectory = workspace("badledger");
  await assert.rejects(
    runOrchestrator({ ledger: { backup_id: "x", artifacts: { "kein-hash": "irgendwas" } }, workDirectory }),
    /ungueltigen Hash/,
  );
});
