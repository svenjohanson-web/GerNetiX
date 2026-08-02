#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const composeFile = path.join(repoRoot, "compose.build-worker.yaml");
const defaultEnvFile = path.join(repoRoot, ".env.build-worker.local");

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of String(content).split(/\r?\n/)) {
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
  const result = { action: "doctor", envFile: defaultEnvFile, skipNetwork: false };
  let actionSeen = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["doctor", "start", "stop", "status", "logs"].includes(argument) && !actionSeen) {
      result.action = argument;
      actionSeen = true;
    } else if (argument === "--env") {
      const value = argv[index + 1];
      if (!value) throw new Error("--env benoetigt einen Dateipfad.");
      result.envFile = path.resolve(value);
      index += 1;
    } else if (argument === "--skip-network") {
      result.skipNetwork = true;
    } else {
      throw new Error(`Unbekanntes Argument: ${argument}`);
    }
  }
  return result;
}

function isPrivateIpv4(value) {
  const parts = String(value).split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function supportsWorkerHost(platform) {
  return platform === "linux" || platform === "darwin";
}

function dockerExecutable({ env = process.env, platform = process.platform, existsSync = fs.existsSync } = {}) {
  if (String(env.GERNETIX_DOCKER_COMMAND || "").trim()) return env.GERNETIX_DOCKER_COMMAND.trim();
  if (platform === "darwin") {
    const candidates = [
      "/usr/local/bin/docker",
      "/opt/homebrew/bin/docker",
      "/Applications/Docker.app/Contents/Resources/bin/docker",
    ];
    return candidates.find((candidate) => existsSync(candidate)) || "docker";
  }
  return "docker";
}

function validateConfig(config) {
  const errors = [];
  const required = [
    "BUILD_WORKER_ID",
    "BUILD_WORKER_BIND_ADDRESS",
    "BUILD_POSTGRES_HOST",
    "BUILD_POSTGRES_PASSWORD",
  ];
  for (const key of required) {
    if (!String(config[key] || "").trim()) errors.push(`${key} fehlt.`);
  }
  if (config.BUILD_WORKER_ID && !/^[a-z0-9][a-z0-9._-]{2,62}$/.test(config.BUILD_WORKER_ID)) {
    errors.push("BUILD_WORKER_ID muss 3 bis 63 Kleinbuchstaben, Zahlen, Punkte, Minus- oder Unterstriche enthalten.");
  }
  if (config.BUILD_WORKER_BIND_ADDRESS && !isPrivateIpv4(config.BUILD_WORKER_BIND_ADDRESS)) {
    errors.push("BUILD_WORKER_BIND_ADDRESS muss eine private IPv4-Adresse des WireGuard-Netzes sein.");
  }
  for (const key of ["BUILD_WORKER_PORT", "BUILD_POSTGRES_PORT"]) {
    if (config[key] && (!/^\d+$/.test(config[key]) || Number(config[key]) < 1 || Number(config[key]) > 65535)) {
      errors.push(`${key} muss ein gueltiger TCP-Port sein.`);
    }
  }
  if (/replace-with|change-me/i.test(String(config.BUILD_POSTGRES_PASSWORD || ""))) {
    errors.push("BUILD_POSTGRES_PASSWORD enthaelt noch den Beispielwert.");
  }
  const publicBaseUrl = config.BUILD_PUBLIC_BASE_URL || "https://build.gernetix.com";
  if (!/^https:\/\//i.test(publicBaseUrl)) errors.push("BUILD_PUBLIC_BASE_URL muss HTTPS verwenden.");
  return errors;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} wurde mit Exit-Code ${result.status} beendet.`);
  return options.capture ? result.stdout.trim() : "";
}

function composeArgs(envFile, args) {
  return ["compose", "--env-file", envFile, "-f", composeFile, ...args];
}

function checkTcp(host, port, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port) });
    const timeout = setTimeout(() => socket.destroy(new Error("Zeitueberschreitung")), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function doctor({ envFile, skipNetwork = false, platform = process.platform } = {}) {
  if (!supportsWorkerHost(platform)) throw new Error("Das Build-Worker-Paket wird auf Linux und macOS mit Docker unterstuetzt.");
  if (!fs.existsSync(envFile)) {
    throw new Error(`Konfiguration fehlt: ${envFile}\nZuerst .env.build-worker.example nach .env.build-worker.local kopieren.`);
  }
  const config = parseEnvFile(fs.readFileSync(envFile, "utf8"));
  const errors = validateConfig(config);
  if (errors.length) throw new Error(`Build-Worker-Konfiguration ungueltig:\n- ${errors.join("\n- ")}`);
  const docker = dockerExecutable({ platform });
  run(docker, ["--version"], { capture: true });
  run(docker, ["compose", "version"], { capture: true });
  const dockerOsType = run(docker, ["info", "--format", "{{.OSType}}"], { capture: true });
  if (dockerOsType !== "linux") throw new Error("Der Build-Worker benoetigt eine laufende Linux-Docker-Engine.");
  run(docker, composeArgs(envFile, ["config", "--quiet"]));
  if (!skipNetwork) {
    await checkTcp(config.BUILD_POSTGRES_HOST, config.BUILD_POSTGRES_PORT || 25432);
  }
  return {
    workerId: config.BUILD_WORKER_ID,
    bindAddress: config.BUILD_WORKER_BIND_ADDRESS,
    postgresHost: config.BUILD_POSTGRES_HOST,
    postgresPort: Number(config.BUILD_POSTGRES_PORT || 25432),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const docker = dockerExecutable();
  if (["doctor", "start"].includes(args.action)) {
    const result = await doctor(args);
    process.stdout.write(`Build-Worker-Pruefung erfolgreich: ${result.workerId} auf ${result.bindAddress}\n`);
  }
  if (args.action === "start") {
    run(docker, composeArgs(args.envFile, ["up", "-d", "--build", "--wait"]));
    process.stdout.write("GerNetiX Build-Worker ist gestartet.\n");
  } else if (args.action === "stop") {
    run(docker, composeArgs(args.envFile, ["down"]));
  } else if (args.action === "status") {
    run(docker, composeArgs(args.envFile, ["ps"]));
  } else if (args.action === "logs") {
    run(docker, composeArgs(args.envFile, ["logs", "--tail", "200", "build-worker"]));
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Build-Worker: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  composeArgs,
  dockerExecutable,
  isPrivateIpv4,
  parseArgs,
  parseEnvFile,
  supportsWorkerHost,
  validateConfig,
};
