"use strict";

// Der backup-orchestrator erzeugt einen vollstaendigen, verschluesselten
// Sicherungssatz aus gernetix_runtime, Forgejo und dem Artifact Store.
// Er schreibt ausschliesslich in ein lokales Arbeitsverzeichnis und beendet
// einen Lauf erst nach einem Integritaetscheck.

const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const path = require("node:path");

const { BackupSetWriter, verifyBackupSetIntegrity } = require("./backup-set");
const { captureCommand, runCommand, streamCommand } = require("./command-runner");

const RUNTIME_SERVICE = "runtime-postgres";
const FORGEJO_SERVICE = "forgejo";
// Der Artifact Store liegt im Volume build_state; dieser Dienst mountet es.
const ARTIFACT_SERVICE = "public-demo-server";
const ARTIFACT_ROOT = "/var/lib/gernetix/build/artifacts";
const FORGEJO_DATA_ROOT = "/var/lib/gitea";
const FORGEJO_STOP_TIMEOUT_SECONDS = 60;
const LEDGER_FILE = "last-confirmed-backup.json";
const OBJECT_PATH_PATTERN = /^objects\/[a-f0-9]{2}\/([a-f0-9]{64})$/;

const MEMBER_NAMES = {
  runtimeDatabase: "runtime-database.dump",
  runtimeRoles: "runtime-roles.sql",
  forgejoDatabase: "forgejo-database.dump",
  forgejoData: "forgejo-data.tar.gz",
  artifactObjects: "artifact-objects.tar",
};

async function createBackupSet(options) {
  const mode = options.mode;
  if (mode !== "hourly" && mode !== "daily") throw new Error(`Unbekannter Sicherungsmodus: ${mode}`);
  const runner = options.runner || { captureCommand, runCommand, streamCommand };
  const now = options.now || new Date();
  const backupId = buildBackupId(now, mode, options.backupSuffix);
  const directory = path.join(path.resolve(options.workDirectory), backupId);
  const ledger = normalizeLedger(options.ledger);

  const compose = (...args) => ({
    command: options.dockerCommand || "docker",
    args: ["compose", "--env-file", options.envFile, "-f", options.composeFile, ...args],
  });

  // Die Forgejo-Version wird vor einem moeglichen Stopp gelesen; ein Restore
  // muss exakt dieselbe Patchversion verwenden.
  const forgejoVersion = extractForgejoVersion(
    await runner.captureCommand(compose("exec", "-T", FORGEJO_SERVICE, "forgejo", "--version")),
  );
  const forgejoWasRunning = (await runner.captureCommand(compose("ps", "--status", "running", "--services")))
    .split("\n")
    .map((line) => line.trim())
    .includes(FORGEJO_SERVICE);
  const schemaVersions = options.schemaVersions || {
    gernetix_runtime: await readRuntimeSchemaVersion(runner, compose),
  };

  const writer = new BackupSetWriter({ directory, rawPublicKey: options.rawPublicKey, chunkSize: options.chunkSize });
  await writer.open();

  let stopped = false;
  try {
    await addStreamedMember(writer, runner, {
      name: MEMBER_NAMES.runtimeDatabase,
      area: "runtime_database",
      consistency: "transactional_dump",
      descriptor: compose(
        "exec",
        "-T",
        RUNTIME_SERVICE,
        "sh",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" ' +
          "--format custom --no-owner --no-acl",
      ),
    });

    // Rollen liegen ausserhalb der Datenbank und muessen gemeinsam mit ihr
    // wiederherstellbar sein.
    await addStreamedMember(writer, runner, {
      name: MEMBER_NAMES.runtimeRoles,
      area: "runtime_database",
      consistency: "transactional_dump",
      descriptor: compose(
        "exec",
        "-T",
        RUNTIME_SERVICE,
        "sh",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dumpall --username "$POSTGRES_USER" --roles-only --no-role-passwords',
      ),
    });

    // Stuendlich laeuft Forgejo weiter; der garantiert gemeinsam konsistente
    // Punkt entsteht taeglich mit kontrolliertem Stopp.
    if (mode === "daily" && forgejoWasRunning) {
      await runner.runCommand(compose("stop", "-t", String(FORGEJO_STOP_TIMEOUT_SECONDS), FORGEJO_SERVICE));
      stopped = true;
    }
    const forgejoConsistency = mode === "daily" ? "stopped_service_snapshot" : "online_snapshot";

    await addStreamedMember(writer, runner, {
      name: MEMBER_NAMES.forgejoDatabase,
      area: "forgejo_database",
      consistency: forgejoConsistency,
      descriptor: compose(
        "exec",
        "-T",
        RUNTIME_SERVICE,
        "sh",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump --username "$POSTGRES_USER" --dbname forgejo ' +
          "--format custom --no-owner --no-acl",
      ),
    });

    await addStreamedMember(writer, runner, {
      name: MEMBER_NAMES.forgejoData,
      area: "forgejo_data",
      consistency: forgejoConsistency,
      descriptor: compose(
        "run",
        "--rm",
        "-T",
        "--no-deps",
        "--entrypoint",
        "sh",
        FORGEJO_SERVICE,
        "-c",
        `tar -C ${FORGEJO_DATA_ROOT} -czf - .`,
      ),
    });

    if (stopped) {
      await runner.runCommand(compose("up", "-d", "--no-deps", FORGEJO_SERVICE));
      stopped = false;
    }

    const artifacts = await addArtifactObjects(writer, runner, compose, ledger);

    const manifest = await writer.finalize({
      backupId,
      createdAt: toIsoTimestamp(now),
      mode,
      sourceInstance: options.sourceInstance,
      applicationVersion: options.applicationVersion,
      schemaVersions,
      forgejoVersion,
      recoveryKeyId: options.recoveryKeyId,
      carriedForwardArtifacts: artifacts.carriedForward,
    });

    // Ein Lauf gilt erst nach dem Integritaetscheck als beendet.
    const integrity = await verifyBackupSetIntegrity(directory);
    return {
      backupId,
      directory,
      manifest,
      objectCount: integrity.objectCount,
      artifacts: { added: artifacts.added.length, carriedForward: artifacts.carriedForward.length },
      ledger: buildLedger(backupId, artifacts),
    };
  } catch (error) {
    await fsp.rm(directory, { recursive: true, force: true }).catch(() => {});
    // Forgejo muss auch dann wieder laufen, wenn der Lauf gescheitert ist.
    // Bleibt es unten, ist das die dringendere Meldung; der urspruengliche
    // Fehler bleibt als Ursache erhalten.
    if (stopped) {
      try {
        await runner.runCommand(compose("up", "-d", "--no-deps", FORGEJO_SERVICE));
      } catch (restartError) {
        throw new Error(
          `Forgejo konnte nach einem fehlgeschlagenen Sicherungslauf nicht wieder gestartet werden: ${restartError.message}`,
          { cause: error },
        );
      }
    }
    throw error;
  }
}

// Die Schemaversion ist die Menge aller angewandten Migrationen. Sie gehoert in
// jedes Manifest, damit ein Restore die dazu passende Anwendungsversion nutzt
// und eine Abweichung beim Restore sofort auffaellt.
const SCHEMA_VERSION_QUERY =
  "SELECT coalesce(count(*)::text || '-' || md5(string_agg(t.table_name || ':' || " +
  "coalesce((xpath('/row/v/text()', query_to_xml(format('SELECT max(migration_id) AS v FROM %I.%I', " +
  "t.table_schema, t.table_name), false, true, '')))[1]::text, ''), ',' ORDER BY t.table_name)), 'leer') " +
  "FROM information_schema.tables t " +
  "WHERE t.table_schema = 'public' AND t.table_name LIKE '%\\_migrations'";

async function readRuntimeSchemaVersion(runner, compose) {
  const output = await runner.captureCommand(
    compose(
      "exec",
      "-T",
      RUNTIME_SERVICE,
      "sh",
      "-c",
      'PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" ' +
        `--tuples-only --no-align --command "${SCHEMA_VERSION_QUERY.replace(/"/g, '\\"')}"`,
    ),
  );
  const version = output.trim();
  if (!/^(?:leer|\d+-[a-f0-9]{32})$/.test(version)) {
    throw new Error(`Schemaversion von gernetix_runtime konnte nicht bestimmt werden: ${version.slice(0, 120)}`);
  }
  return version;
}

async function addStreamedMember(writer, runner, { name, area, consistency, descriptor }) {
  await runner.streamCommand(descriptor, async (stdout) => {
    await writer.addMember({ name, area, consistency, source: stdout });
  });
}

// Der Artifact Store ist content-addressed. Gesichert werden nur die Objekte,
// die seit dem letzten bestaetigten Punkt hinzugekommen sind; alle uebrigen
// nennt das Manifest mit dem Satz, der sie fuehrt.
async function addArtifactObjects(writer, runner, compose, ledger) {
  const listing = await runner.captureCommand(
    compose(
      "run",
      "--rm",
      "-T",
      "--no-deps",
      "--entrypoint",
      "sh",
      ARTIFACT_SERVICE,
      "-c",
      `cd ${ARTIFACT_ROOT} 2>/dev/null && find objects -type f | LC_ALL=C sort || true`,
    ),
    { maxBytes: 64 * 1024 * 1024 },
  );

  const present = [];
  for (const line of listing.split("\n")) {
    const entry = line.trim();
    if (!entry) continue;
    const match = OBJECT_PATH_PATTERN.exec(entry);
    if (!match) throw new Error(`Artifact Store enthaelt einen unerwarteten Objektpfad: ${entry}`);
    present.push({ objectPath: entry, sha256: match[1] });
  }

  const added = present.filter((object) => !ledger.has(object.sha256));
  const carriedForward = present
    .filter((object) => ledger.has(object.sha256))
    .map((object) => ({ sha256: object.sha256, backupId: ledger.get(object.sha256) }));

  await addStreamedMember(writer, runner, {
    name: MEMBER_NAMES.artifactObjects,
    area: "artifact_store",
    consistency: "content_addressed",
    descriptor: {
      // Die Objektliste geht ueber stdin in den Container, damit kein Pfad ueber
      // die Kommandozeile eingeschleust werden kann.
      ...compose(
        "run",
        "--rm",
        "-T",
        "--no-deps",
        "--entrypoint",
        "sh",
        ARTIFACT_SERVICE,
        "-c",
        `cd ${ARTIFACT_ROOT} && tar -cf - -T -`,
      ),
      input: added.map((object) => `${object.objectPath}\n`).join(""),
    },
  });

  return { added, carriedForward, present };
}

function buildLedger(backupId, artifacts) {
  const entries = {};
  for (const object of artifacts.added) entries[object.sha256] = backupId;
  for (const object of artifacts.carriedForward) entries[object.sha256] = object.backupId;
  return { backup_id: backupId, artifacts: entries };
}

function normalizeLedger(ledger) {
  const entries = new Map();
  const source = ledger?.artifacts;
  if (!source) return entries;
  for (const [sha256, backupId] of Object.entries(source)) {
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`Artifact-Ledger enthaelt einen ungueltigen Hash: ${sha256}`);
    entries.set(sha256, String(backupId));
  }
  return entries;
}

async function loadLedger(workDirectory) {
  try {
    const content = await fsp.readFile(path.join(path.resolve(workDirectory), LEDGER_FILE), "utf8");
    const parsed = JSON.parse(content);
    normalizeLedger(parsed);
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return { backup_id: "", artifacts: {} };
    throw error;
  }
}

async function saveLedger(workDirectory, ledger) {
  const target = path.join(path.resolve(workDirectory), LEDGER_FILE);
  const temporary = `${target}.neu`;
  await fsp.writeFile(temporary, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(temporary, target);
}

function buildBackupId(now, mode, suffix) {
  const stamp = toIsoTimestamp(now).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const tail = suffix || crypto.randomBytes(8).toString("hex");
  if (!/^[a-f0-9]{16}$/.test(tail)) throw new Error("Backup-Suffix muss 16 Hexzeichen lang sein.");
  return `${stamp}-${mode}-${tail}`;
}

function toIsoTimestamp(now) {
  const value = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(value.getTime())) throw new Error("Ungueltiger Zeitpunkt fuer den Sicherungssatz.");
  return value.toISOString();
}

function extractForgejoVersion(output) {
  const match = /(\d+\.\d+\.\d+)/.exec(String(output || ""));
  if (!match) throw new Error("Forgejo-Version konnte nicht bestimmt werden.");
  return match[1];
}

module.exports = {
  ARTIFACT_ROOT,
  ARTIFACT_SERVICE,
  FORGEJO_SERVICE,
  LEDGER_FILE,
  MEMBER_NAMES,
  RUNTIME_SERVICE,
  createBackupSet,
  loadLedger,
  saveLedger,
};
