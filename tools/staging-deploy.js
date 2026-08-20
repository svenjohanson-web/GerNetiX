#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { verifyStagingRuntime } = require("./verify-staging-runtime");

const repoRoot = path.resolve(__dirname, "..");

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`Ungueltige Konfigurationszeile: ${rawLine}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function parseArgs(argv) {
  const result = { dryRun: false, plan: false, publicDemo: false, migrateArtifacts: false, forceFull: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") result.dryRun = true;
    else if (argument === "--plan") result.plan = true;
    else if (argument === "--public-demo") result.publicDemo = true;
    else if (argument === "--migrate-artifacts") result.migrateArtifacts = true;
    else if (argument === "--force-full") result.forceFull = true;
    else if (["--host", "--remote-dir", "--branch"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} benoetigt einen Wert.`);
      result[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else {
      throw new Error(`Unbekanntes Argument: ${argument}`);
    }
  }
  if (result.dryRun && result.plan) throw new Error("--dry-run und --plan koennen nicht gemeinsam verwendet werden.");
  return result;
}

const incrementalServiceByDirectory = new Map([
  ["identity-server", "identity-server"],
  ["project-server", "project-server"],
  ["build-deploy-server", "build-deploy-server"],
  ["compute-control-plane", "compute-control-plane"],
  ["public-demo-server", "public-demo-server"],
  ["device-management-server", "device-management-server"],
  ["telemetry-server", "telemetry-server"],
  ["hardware-catalog", "hardware-catalog"],
  ["hardware-shop", "hardware-shop"],
  ["ai-usage-server", "ai-usage-server"],
  ["device-voice-orchestrator", "device-voice-orchestrator"],
  ["community-platform", "community-platform"],
  ["ai-context-server", "ai-context-server"],
  ["admin-tool", "admin-tool"],
  ["admin-access-server", "admin-access-server"],
  // Identity imports the Hardware Assistant runtime directly from this package.
  ["recovery-tool", "identity-server"],
]);

function isIgnoredDeploymentFile(file) {
  /*
   * .claude/ ist Werkzeugkonfiguration dieses Repositoriums, so wie .github/:
   * Sie beschreibt, wie hier entwickelt wird, und laeuft auf keinem Server.
   *
   * tools/code-dependency-graph/ liest den Quelltext und schreibt einen
   * lokalen Graphen; ausser einem Test verweist nichts darauf, und auf dem
   * Server laeuft es nicht -- dieselbe Art Werkzeug wie tools/architecture-docs
   * daneben.
   *
   * Ohne diese Eintraege zwingt jede Aenderung daran den Plan auf "full".
   */
  return /^(docs|data|model|tools\/architecture-docs|tools\/code-dependency-graph|tools\/yaml-graph-sqlite\/out|\.github|\.claude)\//.test(file)
    || ["README.md", "AGENTS.md"].includes(file)
    || file.endsWith(".test.js")
    || /^services\/[^/]+\/test\//.test(file)
    || /^(tools|scripts)\/[^/]+\.test\.js$/.test(file);
}

function createDeploymentPlan(changedFiles, options = {}) {
  if (!options.historyIsLinear) {
    return {
      mode: "full",
      services: [],
      edge: false,
      firewall: false,
      reasons: ["Vorheriger VPS-Commit fehlt oder ist kein Vorfahr des Ziel-Commits."],
      changedFiles,
    };
  }

  const services = [];
  const reasons = [];
  let edge = false;
  let firewall = false;
  for (const file of changedFiles) {
    if (isIgnoredDeploymentFile(file)) continue;
    if (file === ".dockerignore" || file.startsWith("docker/")) {
      return { mode: "full", services, edge, firewall, reasons: [`Docker-Builddefinition geaendert: ${file}`], changedFiles };
    }
    if (file === "compose.vps.yaml") {
      return { mode: "full", services, edge, firewall, reasons: [`VPS-Compose-Topologie geaendert: ${file}`], changedFiles };
    }
    if (file.startsWith("scripts/staging/") || file === "tools/staging-deploy.js") {
      return { mode: "full", services, edge, firewall, reasons: [`Deploymentlogik geaendert: ${file}`], changedFiles };
    }
    if (file.startsWith("infra/vps/nginx/")) {
      edge = true;
      if (!reasons.includes("Nginx-Konfiguration oder Edge-Assets werden validiert und neu geladen.")) {
        reasons.push("Nginx-Konfiguration oder Edge-Assets werden validiert und neu geladen.");
      }
      continue;
    }
    if (file.startsWith("infra/vps/security/")) {
      firewall = true;
      if (!reasons.includes("Die Host-Firewall wird validiert und gezielt neu geladen.")) {
        reasons.push("Die Host-Firewall wird validiert und gezielt neu geladen.");
      }
      continue;
    }
    const serviceMatch = file.match(/^services\/([^/]+)\//);
    const service = serviceMatch && incrementalServiceByDirectory.get(serviceMatch[1]);
    if (service) {
      if (!services.includes(service)) services.push(service);
      continue;
    }
    return {
      mode: "full",
      services,
      edge,
      firewall,
      reasons: [`Nicht gezielt zugeordnete Runtime-Datei: ${file}`],
      changedFiles,
    };
  }

  if (services.length) reasons.unshift(`Betroffene Dienste: ${services.join(", ")}.`);
  const mode = services.length ? "incremental" : edge || firewall ? "targeted-infrastructure" : "none";
  if (mode === "none") reasons.push("Nur Dokumentation, Modelle, Graph, Tests oder Arbeitsanweisungen wurden geaendert.");
  return { mode, services, edge, firewall, reasons, changedFiles };
}

function formatDeploymentPlan(plan, previousCommit, targetCommit) {
  const lines = [
    `Deployment-Plan: ${plan.mode}`,
    `  VPS:    ${previousCommit.slice(0, 12)}`,
    `  Ziel:   ${targetCommit.slice(0, 12)}`,
  ];
  for (const reason of plan.reasons) lines.push(`  Grund:  ${reason}`);
  if (plan.services.length) lines.push(`  Dienste: ${plan.services.join(", ")}`);
  lines.push(`  Edge:   ${plan.edge ? "validieren + neu laden" : "unveraendert"}`);
  lines.push(`  Firewall: ${plan.firewall ? "validieren + neu laden" : "unveraendert"}`);
  return `${lines.join("\n")}\n`;
}

function assertSafeGitRef(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) || value.includes("..") || value.endsWith("/")) {
    throw new Error(`Unsicherer Git-Branch: ${value}`);
  }
  return value;
}

function assertSafeSshTarget(value) {
  if (!/^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+$/.test(value)) throw new Error(`Ungueltiges SSH-Ziel: ${value}`);
  return value;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function remoteDeployCommand({ branch, commit, remoteDir, publicDemo = false, migrateArtifacts = false, forcedPreviousCommit = "" }) {
  if (forcedPreviousCommit && !/^[0-9a-f]{40}$/.test(forcedPreviousCommit)) {
    throw new Error("Der erzwungene vorherige Commit ist ungueltig.");
  }
  const commands = [
    `cd ${shellQuote(remoteDir)}`,
    "if [ -n \"$(git status --porcelain --untracked-files=no)\" ]; then echo 'Die VPS-Arbeitskopie enthaelt lokale Aenderungen.' >&2; exit 1; fi",
    forcedPreviousCommit ? `previous_commit=${shellQuote(forcedPreviousCommit)}` : "previous_commit=$(git rev-parse HEAD)",
    `git fetch origin ${shellQuote(branch)}`,
    `git switch --detach ${shellQuote(commit)}`,
    publicDemo ? "./scripts/staging/remote-deploy-public-demo.sh" : 'GERNETIX_STAGING_LOCK_HELD=1 ./scripts/staging/remote-deploy.sh "$previous_commit"',
  ];
  if (migrateArtifacts) commands.push(
    `docker compose --env-file .env.vps -f compose.vps.yaml exec -T build-deploy-server node /app/tools/migrate-postgres-binaries-to-artifact-store.js --quarantine-untraceable-artifacts`,
    `docker compose --env-file .env.vps -f compose.vps.yaml exec -T build-deploy-server node /app/tools/audit-postgres-binaries.js`,
  );
  const lockedCommand = commands.join(" && ");
  return [
    "command -v flock >/dev/null 2>&1 || { echo 'flock fehlt auf dem VPS.' >&2; exit 1; }",
    `flock -E 75 -n /var/lock/gernetix-staging-deploy.lock sh -lc ${shellQuote(lockedCommand)}`,
    "deploy_status=$?",
    "if [ \"$deploy_status\" -eq 75 ]; then echo 'Ein anderes Staging-Deployment laeuft bereits.' >&2; fi",
    "exit \"$deploy_status\"",
  ].join("; ");
}

function remoteHeadCommand(remoteDir) {
  return [
    `cd ${shellQuote(remoteDir)}`,
    "if [ -n \"$(git status --porcelain --untracked-files=no)\" ]; then echo 'Die VPS-Arbeitskopie enthaelt lokale Aenderungen.' >&2; exit 1; fi",
    "command -v flock >/dev/null 2>&1 || { echo 'flock fehlt auf dem VPS.' >&2; exit 1; }",
    "command -v docker >/dev/null 2>&1 || { echo 'Docker fehlt auf dem VPS.' >&2; exit 1; }",
    "docker info >/dev/null 2>&1 || { echo 'Docker ist auf dem VPS nicht bereit.' >&2; exit 1; }",
    "docker compose version >/dev/null 2>&1 || { echo 'Docker Compose fehlt auf dem VPS.' >&2; exit 1; }",
    "test -f .env.vps || { echo 'Die VPS-Konfiguration .env.vps fehlt.' >&2; exit 1; }",
    "git rev-parse HEAD",
  ].join(" && ");
}

function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  if (!options.quiet) process.stdout.write(`> ${printable}\n`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} wurde mit Exit-Code ${result.status} beendet.`);
  }
  return options.capture ? result.stdout.trim() : "";
}

function loadConfig() {
  const localPath = path.join(repoRoot, ".env.staging.local");
  const fileValues = fs.existsSync(localPath) ? parseEnvFile(fs.readFileSync(localPath, "utf8")) : {};
  return { ...fileValues, ...process.env };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const preflight = verifyStagingRuntime();
  process.stdout.write(`Lokale Runtime-Vorpruefung: bestanden (${preflight.requiredPaths.length} Identity-Pfade).\n`);
  const config = loadConfig();
  const host = assertSafeSshTarget(args.host || config.GERNETIX_STAGING_SSH || "");
  const remoteDir = args.remoteDir || config.GERNETIX_STAGING_DIR || "/opt/gernetix";
  if (!remoteDir.startsWith("/")) throw new Error("GERNETIX_STAGING_DIR muss ein absoluter Pfad sein.");

  const branch = assertSafeGitRef(args.branch || run("git", ["branch", "--show-current"], { capture: true, quiet: true }));
  const status = run("git", ["status", "--porcelain"], { capture: true, quiet: true });
  if (status) throw new Error("Der Arbeitsbaum ist nicht sauber. Bitte zuerst committen oder Aenderungen sichern.");

  const commit = run("git", ["rev-parse", "HEAD"], { capture: true, quiet: true });
  const upstream = run("git", ["rev-parse", "@{upstream}"], { capture: true, quiet: true });
  if (commit !== upstream) throw new Error("Der aktuelle Commit ist noch nicht zum Upstream-Branch gepusht.");

  const forcedPreviousCommit = args.forceFull ? run("git", ["rev-parse", "HEAD^"], { capture: true, quiet: true }) : "";
  const command = remoteDeployCommand({ branch, commit, remoteDir, publicDemo: args.publicDemo, migrateArtifacts: args.migrateArtifacts, forcedPreviousCommit });
  process.stdout.write(`Staging-Deploy: ${branch} @ ${commit.slice(0, 12)} -> ${host}:${remoteDir}\n`);
  if (args.dryRun) {
    process.stdout.write(`[dry-run] ssh ${host} ${command}\n`);
    return;
  }

  const previousCommit = run("ssh", ["-o", "BatchMode=yes", host, remoteHeadCommand(remoteDir)], { capture: true, quiet: true });
  if (!/^[0-9a-f]{40}$/.test(previousCommit)) throw new Error("Der VPS hat keine gueltige Commit-ID geliefert.");
  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", previousCommit, commit], { cwd: repoRoot });
  const historyIsLinear = ancestry.status === 0;
  const changedFiles = historyIsLinear
    ? run("git", ["diff", "--name-only", previousCommit, commit], { capture: true, quiet: true }).split(/\r?\n/).filter(Boolean)
    : [];
  const plan = args.forceFull
    ? { mode: "full", services: [], edge: false, firewall: false, reasons: ["Ausdrueckliche Wiederaufnahme eines abgebrochenen vollstaendigen Deployments."], changedFiles }
    : createDeploymentPlan(changedFiles, { historyIsLinear });
  process.stdout.write(formatDeploymentPlan(plan, previousCommit, commit));
  if (args.plan) return;

  run("ssh", ["-o", "BatchMode=yes", host, command]);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Staging-Deploy abgebrochen: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  assertSafeGitRef,
  assertSafeSshTarget,
  createDeploymentPlan,
  formatDeploymentPlan,
  isIgnoredDeploymentFile,
  parseArgs,
  parseEnvFile,
  remoteDeployCommand,
  remoteHeadCommand,
  shellQuote,
};
