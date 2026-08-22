"use strict";

// Liest einen verschluesselten Sicherungssatz mit dem Recovery-Key, prueft ihn
// vollstaendig und legt die Bestandteile in einem isolierten Arbeitsverzeichnis
// ab.
//
//   node tools/restore-backup-set.js <satz-verzeichnis> \
//     --private-key /pfad/zum/recovery-key \
//     --target-dir  /pfad/zum/isolierten/arbeitsverzeichnis \
//     [--store-dir /pfad/zu/allen/saetzen] [--report /pfad/protokoll.json]
//
// Dieser Schritt schreibt niemals in den produktiven Stand. Er bereitet nur
// vor; das Einspielen in eine isolierte Umgebung und die fachlichen Pruefungen
// sind eigene, nachgelagerte Schritte.

const fs = require("node:fs");
const path = require("node:path");

const { parsePrivateKeyFile } = require("./backup/recovery-key");
const { isJointlyConsistentRestorePoint } = require("./backup/backup-manifest");
const { restoreBackupSet } = require("./backup/restore");

const FLAGS = {
  "--private-key": "privateKeyPath",
  "--target-dir": "targetDirectory",
  "--store-dir": "storeDirectory",
  "--artifacts-dir": "artifactsDirectory",
  "--report": "reportPath",
};

function parseArguments(argv) {
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    if (!Object.hasOwn(FLAGS, token)) throw new Error(`Unbekannte Option: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Fehlender Wert fuer ${token}`);
    options[FLAGS[token]] = value;
    index += 1;
  }
  if (positional.length !== 1 || !options.privateKeyPath || !options.targetDirectory) {
    throw new Error(
      "Verwendung: restore-backup-set.js <satz-verzeichnis> --private-key <pfad> --target-dir <pfad> " +
        "[--store-dir <pfad>] [--artifacts-dir <pfad>] [--report <pfad>]",
    );
  }
  return { setDirectory: positional[0], ...options };
}

async function main(argv) {
  const options = parseArguments(argv);
  const startedAt = Date.now();

  // Das Zielverzeichnis muss neu sein: ein Restore darf nie ueber einen
  // bestehenden Stand schreiben.
  const targetDirectory = path.resolve(options.targetDirectory);
  if (fs.existsSync(targetDirectory) && fs.readdirSync(targetDirectory).length) {
    throw new Error(`Das Zielverzeichnis ist nicht leer: ${targetDirectory}`);
  }

  const { privateKey, keyId } = parsePrivateKeyFile(fs.readFileSync(options.privateKeyPath, "utf8"));
  const result = await restoreBackupSet({
    setDirectory: options.setDirectory,
    storeDirectory: options.storeDirectory,
    privateKey,
    targetDirectory,
    artifactsDirectory: options.artifactsDirectory,
  });

  if (result.manifest.recovery_key_id !== keyId) {
    throw new Error("Der Sicherungssatz nennt eine andere Recovery-Key-ID als der verwendete Schluessel.");
  }

  const durationMs = Date.now() - startedAt;
  const jointlyConsistent = isJointlyConsistentRestorePoint(result.manifest);
  const report = {
    backup_id: result.manifest.backup_id,
    created_at: result.manifest.created_at,
    mode: result.manifest.mode,
    forgejo_consistency: result.manifest.forgejo_consistency,
    jointly_consistent_restore_point: jointlyConsistent,
    forgejo_version: result.manifest.forgejo_version,
    application_version: result.manifest.application_version,
    schema_versions: result.manifest.schema_versions,
    source_instance: result.manifest.source_instance,
    members: result.restored.map((member) => ({ name: member.name, area: member.area, size_bytes: member.sizeBytes })),
    artifacts: result.artifacts,
    target_directory: targetDirectory,
    duration_ms: durationMs,
  };
  if (options.reportPath) {
    fs.writeFileSync(path.resolve(options.reportPath), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }

  process.stdout.write(
    [
      `Sicherungssatz geprueft und entpackt: ${result.manifest.backup_id}`,
      `Erstellt: ${result.manifest.created_at} (${result.manifest.mode}, Forgejo: ${result.manifest.forgejo_consistency})`,
      `Anwendungsversion: ${result.manifest.application_version}, Forgejo ${result.manifest.forgejo_version}`,
      `Schema: ${Object.entries(result.manifest.schema_versions).map(([key, value]) => `${key}=${value}`).join(", ")}`,
      `Artefakte: ${result.artifacts.total} geprueft (${result.artifacts.fromCurrentSet} aus diesem Satz, ` +
        `${result.artifacts.fromEarlierSets} aus ${result.artifacts.earlierSets.length} frueheren)`,
      `Bestandteile: ${targetDirectory}`,
      `Dauer: ${Math.round(durationMs / 1000)} s`,
      jointlyConsistent
        ? "Dies ist ein gemeinsam konsistenter Wiederherstellungspunkt."
        : "Hinweis: Forgejo wurde im laufenden Betrieb gesichert. Fuer den vollstaendigen Wiederaufbau der " +
          "Projektdateien ist der letzte taegliche Satz der belastbare Ausgangspunkt.",
      "",
      "Naechste Schritte: in eine isolierte Umgebung einspielen, danach",
      "node tools/check-restored-runtime.js --compose-project gernetix-restore-<id> ... ausfuehren.",
      "",
    ].join("\n"),
  );
  return report;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments };
