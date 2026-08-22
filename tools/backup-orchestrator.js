"use strict";

// Erzeugt einen verschluesselten Sicherungssatz aus gernetix_runtime, Forgejo
// und dem Artifact Store.
//
//   node tools/backup-orchestrator.js --mode hourly --work-dir /var/backups/gernetix
//   node tools/backup-orchestrator.js --mode daily  --work-dir /var/backups/gernetix
//
// Stuendlich laeuft Forgejo weiter, taeglich wird es fuer den gemeinsam
// konsistenten Punkt kontrolliert gestoppt und danach garantiert wieder
// gestartet. Der Lauf schreibt ausschliesslich lokal; der Upload in den
// externen unveraenderbaren Speicher ist ein eigener, nachgelagerter Schritt.

const fs = require("node:fs");
const path = require("node:path");

const { parsePublicKeyFile } = require("./backup/recovery-key");
const { createBackupSet, loadLedger, saveLedger } = require("./backup/orchestrator");

const REPOSITORY_ROOT = path.resolve(__dirname, "..");

const FLAGS = {
  "--mode": "mode",
  "--work-dir": "workDirectory",
  "--public-key": "publicKeyPath",
  "--compose-file": "composeFile",
  "--env-file": "envFile",
  "--source-instance": "sourceInstance",
  "--application-version": "applicationVersion",
};

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!Object.hasOwn(FLAGS, flag)) throw new Error(`Unbekannte Option: ${flag}`);
    if (!value || value.startsWith("--")) throw new Error(`Fehlender Wert fuer ${flag}`);
    options[FLAGS[flag]] = value;
  }
  if (!options.mode || !options.workDirectory) {
    throw new Error("Verwendung: --mode <hourly|daily> --work-dir <verzeichnis> [--public-key <pfad>]");
  }
  return {
    mode: options.mode,
    workDirectory: options.workDirectory,
    publicKeyPath: options.publicKeyPath || process.env.BACKUP_RECOVERY_PUBLIC_KEY_PATH || "",
    composeFile: options.composeFile || process.env.COMPOSE_FILE || path.join(REPOSITORY_ROOT, "compose.vps.yaml"),
    envFile: options.envFile || process.env.ENV_FILE || path.join(REPOSITORY_ROOT, ".env.vps"),
    sourceInstance: options.sourceInstance || process.env.BACKUP_SOURCE_INSTANCE || "gernetix-vps",
    applicationVersion: options.applicationVersion || process.env.GERNETIX_IMAGE_TAG || "unbekannt",
  };
}

async function main(argv) {
  const options = parseArguments(argv);
  if (!options.publicKeyPath) {
    throw new Error("Der oeffentliche Recovery-Key fehlt: --public-key <pfad> oder BACKUP_RECOVERY_PUBLIC_KEY_PATH setzen.");
  }
  const recoveryKey = parsePublicKeyFile(fs.readFileSync(options.publicKeyPath, "utf8"));
  fs.mkdirSync(path.resolve(options.workDirectory), { recursive: true, mode: 0o700 });

  const ledger = await loadLedger(options.workDirectory);
  const result = await createBackupSet({
    mode: options.mode,
    workDirectory: options.workDirectory,
    rawPublicKey: recoveryKey.rawPublicKey,
    recoveryKeyId: recoveryKey.keyId,
    sourceInstance: options.sourceInstance,
    applicationVersion: options.applicationVersion,
    composeFile: options.composeFile,
    envFile: options.envFile,
    ledger,
  });

  // Der Ledger wird erst nach dem bestandenen Integritaetscheck fortgeschrieben,
  // damit ein gescheiterter Lauf keine Artefakte als gesichert markiert.
  await saveLedger(options.workDirectory, result.ledger);

  process.stdout.write(
    [
      `Sicherungssatz erstellt: ${result.backupId}`,
      `Verzeichnis: ${result.directory}`,
      `Modus: ${result.manifest.mode} (Forgejo: ${result.manifest.forgejo_consistency})`,
      `Objekte: ${result.objectCount}`,
      `Artefakte: ${result.artifacts.added} neu, ${result.artifacts.carriedForward} uebernommen`,
      `Recovery-Key-ID: ${result.manifest.recovery_key_id}`,
      "",
    ].join("\n"),
  );
  return result;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArguments };
