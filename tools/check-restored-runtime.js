"use strict";

// Fachliche Pruefung eines wiederhergestellten Standes in einer isolierten
// Umgebung. Ein technisch erfolgreicher pg_restore ist noch kein nutzbarer
// Stand; hier wird geprueft, ob Accounts, Projekte, Repository-Bindungen,
// Pairings, Bestellungen und das Hardware-Inventar wieder zusammenpassen.
//
//   node tools/check-restored-runtime.js \
//     --compose-project gernetix-restore-<id> \
//     --compose-file tools/backup-restore-test.compose.yaml \
//     --env-file <datei> \
//     [--expected-row-counts <json-datei>] [--report <pfad>]
//
// Der Projektname muss mit gernetix-restore- beginnen: die Pruefung darf sich
// niemals versehentlich gegen den produktiven Stand richten.

const fs = require("node:fs");
const path = require("node:path");

const { captureCommand } = require("./backup/command-runner");
const { formatReport, runRestoreContractChecks } = require("./backup/restore-contract-checks");

const RESTORE_PROJECT_PATTERN = /^gernetix-restore-[a-z0-9][a-z0-9-]*$/;

const FLAGS = {
  "--compose-project": "composeProject",
  "--compose-file": "composeFile",
  "--env-file": "envFile",
  "--service": "service",
  "--expected-row-counts": "expectedRowCountsPath",
  "--report": "reportPath",
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
  if (!options.composeProject || !options.composeFile || !options.envFile) {
    throw new Error(
      "Verwendung: --compose-project gernetix-restore-<id> --compose-file <datei> --env-file <datei> " +
        "[--expected-row-counts <datei>] [--report <datei>]",
    );
  }
  if (!RESTORE_PROJECT_PATTERN.test(options.composeProject)) {
    throw new Error(`Unsicherer Restore-Projektname: ${options.composeProject}`);
  }
  return { service: "runtime-postgres", ...options };
}

function createQuery(options, runner) {
  return async (sql) => {
    // Die Abfrage geht ueber stdin an psql, damit kein SQL ueber die
    // Kommandozeile oder eine Shell-Ersetzung laeuft.
    return runner(
      {
        command: "docker",
        args: [
          "compose",
          "--project-name",
          options.composeProject,
          "--env-file",
          options.envFile,
          "-f",
          options.composeFile,
          "exec",
          "-T",
          options.service,
          "sh",
          "-c",
          'PGPASSWORD="$POSTGRES_PASSWORD" psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" ' +
            "--tuples-only --no-align --quiet --no-psqlrc --file -",
        ],
        input: `${sql};\n`,
      },
      { maxBytes: 64 * 1024 },
    );
  };
}

async function main(argv, dependencies = {}) {
  const options = parseArguments(argv);
  const runner = dependencies.captureCommand || captureCommand;
  const startedAt = Date.now();

  let expectedRowCounts;
  if (options.expectedRowCountsPath) {
    expectedRowCounts = JSON.parse(fs.readFileSync(options.expectedRowCountsPath, "utf8"));
  }

  const report = await runRestoreContractChecks(createQuery(options, runner), { expectedRowCounts });
  const durationMs = Date.now() - startedAt;
  const output = { ...report, compose_project: options.composeProject, duration_ms: durationMs };
  if (options.reportPath) {
    fs.writeFileSync(path.resolve(options.reportPath), `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
  }

  process.stdout.write(`${formatReport(report)}\n`);
  if (report.deviations.length) {
    process.stdout.write(`Abweichungen gegenueber dem Sicherungszeitpunkt:\n  ${report.deviations.join("\n  ")}\n`);
  }
  if (!report.passed) {
    throw new Error(`Fachliche Restore-Pruefung fehlgeschlagen: ${report.failed.join(", ")}`);
  }
  process.stdout.write(`Fachliche Restore-Pruefung bestanden (${Math.round(durationMs / 1000)} s).\n`);
  return output;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { RESTORE_PROJECT_PATTERN, createQuery, main, parseArguments };
