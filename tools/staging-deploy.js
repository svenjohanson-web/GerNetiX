#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
  const result = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") result.dryRun = true;
    else if (["--host", "--remote-dir", "--branch"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} benoetigt einen Wert.`);
      result[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else {
      throw new Error(`Unbekanntes Argument: ${argument}`);
    }
  }
  return result;
}

function assertSafeGitRef(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value) || value.includes("..") || value.endsWith("/")) {
    throw new Error(`Unsicherer Git-Branch: ${value}`);
  }
  return value;
}

function assertSafeSshTarget(value) {
  if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(value)) throw new Error(`Ungueltiges SSH-Ziel: ${value}`);
  return value;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function remoteDeployCommand({ branch, commit, remoteDir }) {
  return [
    `cd ${shellQuote(remoteDir)}`,
    "test -z \"$(git status --porcelain --untracked-files=no)\"",
    `git fetch origin ${shellQuote(branch)}`,
    `git switch --detach ${shellQuote(commit)}`,
    "./scripts/staging/remote-deploy.sh",
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
  if (result.status !== 0) throw new Error(`${command} wurde mit Exit-Code ${result.status} beendet.`);
  return options.capture ? result.stdout.trim() : "";
}

function loadConfig() {
  const localPath = path.join(repoRoot, ".env.staging.local");
  const fileValues = fs.existsSync(localPath) ? parseEnvFile(fs.readFileSync(localPath, "utf8")) : {};
  return { ...fileValues, ...process.env };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
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

  const command = remoteDeployCommand({ branch, commit, remoteDir });
  process.stdout.write(`Staging-Deploy: ${branch} @ ${commit.slice(0, 12)} -> ${host}:${remoteDir}\n`);
  if (args.dryRun) {
    process.stdout.write(`[dry-run] ssh ${host} ${command}\n`);
    return;
  }
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
  parseArgs,
  parseEnvFile,
  remoteDeployCommand,
  shellQuote,
};
