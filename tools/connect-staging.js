#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { assertSafeSshTarget, parseEnvFile } = require("./staging-deploy");

const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const result = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") result.dryRun = true;
    else if (["--host", "--local-port", "--remote-port", "--platform-port", "--remote-platform-port"].includes(argument)) {
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

function parsePort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${label} ist kein gueltiger TCP-Port: ${value}`);
  return port;
}

function loadConfig() {
  const localPath = path.join(repoRoot, ".env.staging.local");
  const fileValues = fs.existsSync(localPath) ? parseEnvFile(fs.readFileSync(localPath, "utf8")) : {};
  return { ...fileValues, ...process.env };
}

function sshTunnelArgs({ host, localPort, remotePort, platformPort, remotePlatformPort }) {
  return [
    "-N",
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-L", `${platformPort}:127.0.0.1:${remotePlatformPort}`,
    "-L", `${localPort}:127.0.0.1:${remotePort}`,
    host,
  ];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const host = assertSafeSshTarget(args.host || config.GERNETIX_STAGING_SSH || "");
  const localPort = parsePort(args.localPort || config.GERNETIX_STAGING_LOCAL_ADMIN_PORT || 14600, "Lokaler Port");
  const remotePort = parsePort(args.remotePort || config.GERNETIX_STAGING_REMOTE_ADMIN_PORT || 4600, "Remote-Port");
  const platformPort = parsePort(args.platformPort || config.GERNETIX_STAGING_LOCAL_PLATFORM_PORT || 14300, "Lokaler Plattform-Port");
  const remotePlatformPort = parsePort(args.remotePlatformPort || config.GERNETIX_STAGING_REMOTE_PLATFORM_PORT || 8080, "Remote-Plattform-Port");
  const sshArgs = sshTunnelArgs({ host, localPort, remotePort, platformPort, remotePlatformPort });
  const adminUrl = `http://127.0.0.1:${localPort}/admin/`;
  const platformUrl = `http://127.0.0.1:${platformPort}/app/dashboard/`;

  process.stdout.write(`Staging-Plattform: ${platformUrl}\n`);
  process.stdout.write(`Staging-Admin: ${adminUrl}\n`);
  process.stdout.write("Dieses Terminal offen lassen. Verbindung mit Strg+C beenden.\n");
  if (args.dryRun) {
    process.stdout.write(`[dry-run] ssh ${sshArgs.join(" ")}\n`);
    return;
  }

  const result = spawnSync("ssh", sshArgs, { cwd: repoRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.signal !== "SIGINT") {
    throw new Error(`SSH-Tunnel wurde mit Exit-Code ${result.status} beendet.`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Staging-Verbindung fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, parsePort, sshTunnelArgs };
