#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { parseEnvFile } = require("./staging-deploy");

const repoRoot = path.resolve(__dirname, "..");

function loadRemoteDevConfig(environment = process.env, options = {}) {
  const localPath = options.localPath || path.join(repoRoot, ".env.remote-dev.local");
  const fileValues = options.readFile === false ? {} : fs.existsSync(localPath)
    ? parseEnvFile(fs.readFileSync(localPath, "utf8"))
    : {};
  const config = { ...fileValues, ...environment };
  if (!String(config.IDENTITY_POSTGRES_PASSWORD || "").trim()) {
    throw new Error("IDENTITY_POSTGRES_PASSWORD fehlt in .env.remote-dev.local.");
  }
  const runtimeStateKey = Buffer.from(String(config.RUNTIME_STATE_ENCRYPTION_KEY || ""), "base64");
  if (runtimeStateKey.length !== 32) {
    throw new Error("RUNTIME_STATE_ENCRYPTION_KEY muss als Base64-kodierter 32-Byte-Schluessel in .env.remote-dev.local stehen.");
  }
  return {
    ...config,
    HOST: "127.0.0.1",
    PORT: "4300",
    IDENTITY_REMOTE_DEV: "1",
    IDENTITY_APP_BASE_URL: config.IDENTITY_APP_BASE_URL || "http://localhost:4300",
    IDENTITY_PERSISTENCE_BACKEND: "postgres",
    IDENTITY_POSTGRES_HOST: config.IDENTITY_POSTGRES_HOST || "127.0.0.1",
    IDENTITY_POSTGRES_PORT: config.IDENTITY_POSTGRES_PORT || "25432",
    IDENTITY_POSTGRES_DATABASE: config.IDENTITY_POSTGRES_DATABASE || "gernetix_runtime",
    IDENTITY_POSTGRES_USER: config.IDENTITY_POSTGRES_USER || "gernetix_runtime",
    PROJECT_SERVER_BASE_URL: config.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800",
    BUILD_DEPLOY_BASE_URL: config.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400",
    DEVICE_MANAGEMENT_BASE_URL: config.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700",
    HARDWARE_SHOP_BASE_URL: config.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900",
    HARDWARE_CATALOG_BASE_URL: config.HARDWARE_CATALOG_BASE_URL || "http://10.77.0.1:4910",
    AI_USAGE_BASE_URL: config.AI_USAGE_BASE_URL || "http://127.0.0.1:5001",
    AI_CONTEXT_BASE_URL: config.AI_CONTEXT_BASE_URL || "http://127.0.0.1:5500",
    COMMUNITY_PLATFORM_BASE_URL: config.COMMUNITY_PLATFORM_BASE_URL || "http://127.0.0.1:5200",
    TELEMETRY_SERVER_BASE_URL: config.TELEMETRY_SERVER_BASE_URL || "http://127.0.0.1:5600",
  };
}

function main() {
  const env = loadRemoteDevConfig();
  const child = spawn(process.execPath, ["src/dev-server.js"], {
    cwd: path.join(repoRoot, "services", "identity-server"),
    env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exitCode = code ?? 1;
  });
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Remote-Dev-Start fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { loadRemoteDevConfig };
