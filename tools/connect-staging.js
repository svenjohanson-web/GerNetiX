#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { assertSafeSshTarget, parseEnvFile } = require("./staging-deploy");

const repoRoot = path.resolve(__dirname, "..");
const REMOTE_DEV_SERVICE_FORWARDS = [
  [4400, 4400],
  [4700, 4700],
  [4800, 4800],
  [4900, 4900],
  [4920, 4920],
  [5001, 5000],
  [5200, 5200],
  [5500, 5500],
  [5600, 5600],
  [5800, 5800],
];

function parseArgs(argv) {
  const result = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") result.dryRun = true;
    else if ([
      "--host", "--local-port", "--remote-port", "--platform-port", "--remote-platform-port",
      "--identity-db-port", "--remote-identity-db-port", "--remote-identity-db-host",
      "--build-router-port", "--remote-build-router-host", "--remote-build-router-port",
    ].includes(argument)) {
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

function parseForwardHost(value, label) {
  const host = String(value || "").trim();
  const parts = host.split(".").map(Number);
  const privateIpv4 = parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168));
  if (host !== "127.0.0.1" && !privateIpv4) throw new Error(`${label} muss Loopback oder eine private IPv4-Adresse sein.`);
  return host;
}

function loadConfig() {
  const localPath = path.join(repoRoot, ".env.staging.local");
  const fileValues = fs.existsSync(localPath) ? parseEnvFile(fs.readFileSync(localPath, "utf8")) : {};
  return { ...fileValues, ...process.env };
}

function sshTunnelArgs({
  host, localPort, remotePort, platformPort, remotePlatformPort,
  identityDbPort, remoteIdentityDbHost, remoteIdentityDbPort,
  buildRouterPort, remoteBuildRouterHost, remoteBuildRouterPort,
}) {
  const args = [
    "-N",
    "-o", "BatchMode=yes",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ServerAliveInterval=30",
    "-o", "ServerAliveCountMax=3",
    "-L", `127.0.0.1:${platformPort}:127.0.0.1:${remotePlatformPort}`,
    "-L", `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`,
    "-L", `127.0.0.1:${identityDbPort}:${remoteIdentityDbHost}:${remoteIdentityDbPort}`,
    "-L", `127.0.0.1:${buildRouterPort}:${remoteBuildRouterHost}:${remoteBuildRouterPort}`,
  ];
  for (const [localServicePort, remoteServicePort] of REMOTE_DEV_SERVICE_FORWARDS) {
    args.push("-L", `127.0.0.1:${localServicePort}:127.0.0.1:${remoteServicePort}`);
  }
  args.push(host);
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const host = assertSafeSshTarget(args.host || config.GERNETIX_STAGING_SSH || "");
  const localPort = parsePort(args.localPort || config.GERNETIX_STAGING_LOCAL_ADMIN_PORT || 14600, "Lokaler Port");
  const remotePort = parsePort(args.remotePort || config.GERNETIX_STAGING_REMOTE_ADMIN_PORT || 4610, "Remote-Port");
  const platformPort = parsePort(args.platformPort || config.GERNETIX_STAGING_LOCAL_PLATFORM_PORT || 14300, "Lokaler Plattform-Port");
  const remotePlatformPort = parsePort(args.remotePlatformPort || config.GERNETIX_STAGING_REMOTE_PLATFORM_PORT || 8080, "Remote-Plattform-Port");
  const identityDbPort = parsePort(args.identityDbPort || config.GERNETIX_STAGING_LOCAL_IDENTITY_DB_PORT || 25432, "Lokaler Runtime-PostgreSQL-Port");
  const remoteIdentityDbHost = parseForwardHost(args.remoteIdentityDbHost || config.GERNETIX_STAGING_REMOTE_IDENTITY_DB_HOST || "10.77.0.1", "Remote-Runtime-PostgreSQL-Host");
  const remoteIdentityDbPort = parsePort(args.remoteIdentityDbPort || config.GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT || 25432, "Remote-Runtime-PostgreSQL-Port");
  const buildRouterPort = parsePort(args.buildRouterPort || config.GERNETIX_STAGING_LOCAL_BUILD_ROUTER_PORT || 14400, "Lokaler Build-Router-Port");
  const remoteBuildRouterHost = parseForwardHost(args.remoteBuildRouterHost || config.GERNETIX_STAGING_REMOTE_BUILD_ROUTER_HOST || "127.0.0.1", "Remote-Build-Router-Host");
  const remoteBuildRouterPort = parsePort(args.remoteBuildRouterPort || config.GERNETIX_STAGING_REMOTE_BUILD_ROUTER_PORT || 14400, "Remote-Build-Router-Port");
  const sshArgs = sshTunnelArgs({
    host, localPort, remotePort, platformPort, remotePlatformPort,
    identityDbPort, remoteIdentityDbHost, remoteIdentityDbPort,
    buildRouterPort, remoteBuildRouterHost, remoteBuildRouterPort,
  });
  const adminUrl = `http://127.0.0.1:${localPort}/admin/`;
  const platformUrl = `http://127.0.0.1:${platformPort}/app/dashboard/`;
  const privatePwaUrl = config.GERNETIX_PRIVATE_PWA_URL || "https://pwa.gernetix.com/app/dashboard/";

  process.stdout.write(`Private PWA ueber WireGuard: ${privatePwaUrl}\n`);
  process.stdout.write(`Lokaler Plattform-Diagnosetunnel: ${platformUrl}\n`);
  process.stdout.write(`Lokaler Admin-Diagnosetunnel: ${adminUrl}\n`);
  process.stdout.write(`Identity PostgreSQL fuer lokalen Port 4300: 127.0.0.1:${identityDbPort}\n`);
  process.stdout.write(`Build-Worker-Pool fuer lokale IDE: 127.0.0.1:${buildRouterPort}\n`);
  process.stdout.write(`Remote-Dev-Dienste: ${REMOTE_DEV_SERVICE_FORWARDS.map(([local, remote]) => `${local}->${remote}`).join(", ")}\n`);
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

module.exports = { REMOTE_DEV_SERVICE_FORWARDS, parseArgs, parseForwardHost, parsePort, sshTunnelArgs };
