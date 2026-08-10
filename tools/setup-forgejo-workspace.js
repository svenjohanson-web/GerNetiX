#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { SYSTEM_REPOSITORY_DEFINITIONS } = require("../services/project-server/src/system-repository-catalog");
const { assertSafeSshTarget, parseEnvFile, shellQuote } = require("./staging-deploy");

const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--directory", "--username"].includes(argument)) throw new Error(`Unbekanntes Argument: ${argument}`);
    result[argument.slice(2)] = argv[index + 1];
    index += 1;
  }
  const username = String(result.username || process.env.USERNAME || process.env.USER || "developer").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(username)) throw new Error("forgejo_developer_username_invalid");
  return {
    username,
    directory: path.resolve(result.directory || path.join(repoRoot, "..", "GerNetiX-Projekte")),
  };
}

function loadConfig() {
  const localPath = path.join(repoRoot, ".env.staging.local");
  const fileValues = fs.existsSync(localPath) ? parseEnvFile(fs.readFileSync(localPath, "utf8")) : {};
  return { ...fileValues, ...process.env };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    input: options.input,
    stdio: options.capture === false ? "inherit" : "pipe",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0] || ""} fehlgeschlagen: ${String(result.stderr || "").trim()}`);
  return String(result.stdout || "").trim();
}

async function ensureTunnel({ host, localPort, remotePort }) {
  if (await isForgejoHealthy(localPort)) return { started: false };
  const child = spawn("ssh", [
    "-N", "-o", "BatchMode=yes", "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=3",
    "-L", `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    host,
  ], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
  fs.mkdirSync(path.join(repoRoot, ".runtime"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, ".runtime", "forgejo-tunnel.pid"), `${child.pid}\n`, { mode: 0o600 });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (await isForgejoHealthy(localPort)) return { started: true, pid: child.pid };
  }
  throw new Error("Der private Forgejo-Tunnel wurde nicht rechtzeitig erreichbar.");
}

async function isForgejoHealthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/healthz`, { signal: AbortSignal.timeout(750) });
    return response.ok;
  } catch {
    return false;
  }
}

function provisionAccess({ host, remoteDir, envFile, username }) {
  const command = [
    `cd ${shellQuote(remoteDir)}`,
    `./scripts/staging/provision-forgejo-developer-access.sh ${shellQuote(envFile)} ${shellQuote(username)}`,
  ].join(" && ");
  const output = run("ssh", ["-o", "BatchMode=yes", host, command]);
  const [token, ...jsonLines] = output.split(/\r?\n/);
  if (!/^[A-Za-z0-9_-]{20,}$/.test(String(token || ""))) throw new Error("Forgejo hat keinen gueltigen Entwickler-Token geliefert.");
  const access = JSON.parse(jsonLines.join("\n"));
  return { token, access };
}

function storeCredential({ port, username, token }) {
  const input = [
    "protocol=http",
    `host=127.0.0.1:${port}`,
    `username=${username}`,
    `password=${token}`,
    "",
    "",
  ].join("\n");
  run("git", ["credential", "approve"], { input });
}

function checkoutRepositories({ directory, port, username, repositories }) {
  fs.mkdirSync(directory, { recursive: true });
  const results = [];
  for (const repository of repositories) {
    const target = path.join(directory, repository.local_directory || repository.repository_name);
    const remote = `http://${encodeURIComponent(username)}@127.0.0.1:${port}/${repository.organization}/${repository.repository_name}.git`;
    if (!fs.existsSync(target)) {
      run("git", ["clone", "--origin", "origin", remote, target]);
    } else {
      if (!fs.existsSync(path.join(target, ".git"))) throw new Error(`Zielordner ist kein Git-Checkout: ${target}`);
      if (run("git", ["status", "--porcelain"], { cwd: target })) throw new Error(`Arbeitskopie enthaelt lokale Aenderungen: ${target}`);
      run("git", ["remote", "set-url", "origin", remote], { cwd: target });
      run("git", ["fetch", "origin", "--prune"], { cwd: target });
      run("git", ["merge", "--ff-only", `origin/${repository.default_branch || "main"}`], { cwd: target });
    }
    const headSha = run("git", ["rev-parse", "HEAD"], { cwd: target });
    run("git", ["fsck", "--no-dangling"], { cwd: target });
    results.push({ title: repository.title, directory: target, head_sha: headSha });
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const host = assertSafeSshTarget(config.GERNETIX_STAGING_SSH || "");
  const remoteDir = String(config.GERNETIX_STAGING_DIR || "/opt/gernetix");
  const envFile = String(config.GERNETIX_STAGING_ENV_FILE || ".env.vps");
  const localPort = Number(config.GERNETIX_STAGING_LOCAL_FORGEJO_PORT || 13300);
  const remotePort = Number(config.GERNETIX_STAGING_REMOTE_FORGEJO_PORT || 3300);
  if (!Number.isInteger(localPort) || !Number.isInteger(remotePort)) throw new Error("Forgejo-Portkonfiguration ist ungueltig.");
  await ensureTunnel({ host, localPort, remotePort });
  const provisioned = provisionAccess({ host, remoteDir, envFile, username: args.username });
  storeCredential({ port: localPort, username: args.username, token: provisioned.token });
  const repositories = provisioned.access.repositories || SYSTEM_REPOSITORY_DEFINITIONS;
  const checkouts = checkoutRepositories({ directory: args.directory, port: localPort, username: args.username, repositories });
  process.stdout.write(`${JSON.stringify({ workspace: args.directory, username: args.username, repositories: checkouts }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Forgejo-Arbeitsbereich konnte nicht eingerichtet werden: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { checkoutRepositories, parseArgs, storeCredential };
