"use strict";

// Lokale Vorab-Pruefung: prueft denselben Stand wie die Test-CI, bevor
// committet oder gepusht wird.
//
//   node tools/ci/verify.js --quick     nur Repo-Pruefungen, keine Tests
//   node tools/ci/verify.js --changed   nur Bereiche mit lokalen Aenderungen
//   node tools/ci/verify.js             alles, wie die CI
//
// Bewusst rein statisch: kein Dienst wird gestartet, gestoppt oder abgefragt.
// Die Laufzeitsicht (Prozesse, Health, VPN/Tunnel, Runtime-Alerts) gehoert dem
// Prozess-Monitor unter tools/process-monitor und wird hier nicht dupliziert.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { repoRoot, resolveServiceMatrix } = require("./service-test-matrix");
const { resolveToolsTests } = require("./run-tools-tests");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

// E2E-Jobs der CI, die Linux-Container brauchen und lokal nicht nachgestellt
// werden. Wird am Ende ausgewiesen, damit die Pruefung keine Vollstaendigkeit
// vortaeuscht, die sie nicht hat.
const CI_ONLY_JOBS = [
  "Customer data backup and restore E2E (tools/backup-restore-e2e.sh)",
  "Forgejo container and restore E2E (tools/forgejo-integration/run.sh)",
  "Forgejo repository card UI E2E (tools/forgejo-ui-e2e/run.sh)",
];

const results = [];

function seconds(startedAt) {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

function record(group, label, ok, detail) {
  results.push({ group, label, ok, detail });
  const status = ok ? "ok  " : "FAIL";
  console.log(`  ${status}  ${label.padEnd(38)} ${detail}`);
}

function runStep(group, label, command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
    // npm ist auf Windows eine .cmd; Node startet die seit Version 20 nur ueber
    // die Shell. Ohne das schlaegt jeder npm-Aufruf sofort und stumm fehl.
    shell: options.shell === true && process.platform === "win32",
    // Ausgabe einsammeln statt durchreichen: bei 21 Services waere die
    // Rohausgabe unlesbar. Fehlertexte werden am Ende gezielt gezeigt.
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ok = !result.error && result.status === 0;
  record(group, label, ok, seconds(startedAt));
  if (!ok) {
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    results[results.length - 1].output = result.error ? result.error.message : output;
  }
  return ok;
}

function changedPaths() {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const entry = line.slice(3).trim().replace(/^"|"$/g, "");
      return entry.includes(" -> ") ? entry.split(" -> ")[1].replace(/^"|"$/g, "") : entry;
    });
}

function selectServices(matrix, mode) {
  if (mode !== "changed") return { services: matrix.include, note: "" };
  const changed = changedPaths();
  // services/shared wird von fast jedem Service importiert. Eine Aenderung dort
  // kann ueberall brechen, also wird dann alles geprueft.
  if (changed.some((entry) => entry.startsWith("services/shared/"))) {
    return { services: matrix.include, note: "services/shared ist geaendert, deshalb alle Services." };
  }
  const touched = new Set(
    changed
      .filter((entry) => entry.startsWith("services/"))
      .map((entry) => entry.split("/")[1]),
  );
  return { services: matrix.include.filter((entry) => touched.has(entry.label)), note: "" };
}

// Ein Service ohne Abhaengigkeiten hat auch nach npm ci kein node_modules.
// Nur wenn welche deklariert sind, ist ein fehlendes Verzeichnis ein Befund.
function dependenciesMissing(serviceDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(serviceDir, "package.json"), "utf8"));
  const declared = Object.keys(manifest.dependencies || {}).length
    + Object.keys(manifest.devDependencies || {}).length;
  return declared > 0 && !fs.existsSync(path.join(serviceDir, "node_modules"));
}

function main() {
  const argv = process.argv.slice(2);
  const quick = argv.includes("--quick");
  const mode = quick ? "quick" : argv.includes("--changed") ? "changed" : "full";
  const labels = { quick: "nur Repo-Pruefungen", changed: "nur geaenderte Bereiche", full: "alles wie die CI" };

  console.log(`\nGerNetiX Vorab-Pruefung  (${labels[mode]})\n`);

  console.log("Repo-Pruefungen");
  runStep("repo", "JavaScript-Syntax", process.execPath, ["tools/ci/check-javascript-syntax.js"]);
  runStep("repo", "Compose-Modelle", process.execPath, ["tools/ci/check-compose.js"]);
  runStep("repo", "Groessen-Sperrklinke", process.execPath, ["tools/ci/check-file-sizes.js"]);
  runStep("repo", "Eingecheckte Zugangsdaten", process.execPath, ["tools/ci/check-committed-secrets.js"]);
  runStep("repo", "HTTP-Routenklassifizierung", process.execPath, ["tools/internal-api-route-guard/index.js"]);
  runStep("repo", "Graph-Baseline", process.execPath, ["tools/ci/check-graph-baseline.js"]);

  // Die CI baut die Architektur-Doku und prueft, ob dist/ dazu passt. Lokal
  // genauso, damit ein vergessener Rebuild hier auffaellt und nicht erst dort.
  if (runStep("repo", "Architektur-Doku bauen", process.execPath, ["tools/architecture-docs/build.js"])) {
    const diff = spawnSync("git", ["diff", "--exit-code", "--", "tools/architecture-docs/dist"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const ok = diff.status === 0;
    record("repo", "Architektur-Doku aktuell", ok, ok ? "-" : "neu gebaut");
    if (!ok) {
      results[results.length - 1].output =
        "tools/architecture-docs/dist wurde neu erzeugt und weicht vom Commit ab.\n"
        + "Die Dateien gehoeren mit in den Commit, sonst schlaegt der CI-Job fehl.";
    }
  }

  const matrix = resolveServiceMatrix();
  if (matrix.problems.length) {
    console.log("\nService-Matrix");
    for (const problem of matrix.problems) record("matrix", problem, false, "-");
  }

  if (!quick) {
    const { services, note } = selectServices(matrix, mode);
    console.log(`\nServices (${services.length}${mode === "changed" ? " ausgewaehlt" : ""})`);
    if (note) console.log(`  ${note}`);
    if (!services.length) {
      console.log("  keine");
    }
    for (const service of services) {
      const cwd = path.join(repoRoot, service.workspace);
      if (dependenciesMissing(cwd)) {
        record("service", service.label, false, "node_modules fehlt");
        results[results.length - 1].output =
          `Abhaengigkeiten fehlen. Einmalig: npm ci --ignore-scripts --prefix ${service.workspace}`;
        continue;
      }
      if (!runStep("service", `${service.label} (check)`, npmCommand, ["run", "check"], { cwd, shell: true })) continue;
      const testArgs = service.skipPattern
        ? ["--test", `--test-skip-pattern=${service.skipPattern}`]
        : ["--test"];
      runStep("service", `${service.label} (test)`, process.execPath, testArgs, { cwd });
    }

    const tools = resolveToolsTests();
    const toolsChanged = mode !== "changed" || changedPaths().some((entry) => entry.startsWith("tools/"));
    console.log("\ntools-Tests");
    if (toolsChanged) {
      runStep("tools", `${tools.selected.length} von ${tools.all.length} Dateien`, process.execPath, [
        "tools/ci/run-tools-tests.js",
      ]);
      for (const entry of tools.skipped) console.log(`        uebersprungen: ${entry.file}`);
    } else {
      console.log("  uebersprungen, keine Aenderung unter tools/");
    }
  }

  const failures = results.filter((entry) => !entry.ok);
  console.log("");
  if (failures.length) {
    console.log(`Ergebnis: ${failures.length} Befund(e)\n`);
    for (const failure of failures) {
      console.log(`--- ${failure.label}`);
      const output = (failure.output || "").trim();
      const lines = output.split("\n");
      // Nur den Schluss zeigen: dort steht bei node --test die Zusammenfassung
      // und bei den Pruefskripten die eigentliche Meldung.
      for (const line of lines.slice(-25)) console.log(`    ${line}`);
      console.log("");
    }
  } else {
    console.log("Ergebnis: alles gruen.\n");
  }

  console.log("Nicht enthalten, laeuft nur in der CI (braucht Linux-Container):");
  for (const job of CI_ONLY_JOBS) console.log(`  - ${job}`);
  console.log("");

  process.exit(failures.length ? 1 : 0);
}

main();
