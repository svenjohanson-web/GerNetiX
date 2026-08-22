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
  const config = normalizeIdentityInternalApiConfig(mergeRemoteDevConfiguration(fileValues, environment));
  if (!String(config.IDENTITY_POSTGRES_PASSWORD || "").trim()) {
    throw new Error("IDENTITY_POSTGRES_PASSWORD fehlt in .env.remote-dev.local.");
  }
  const runtimeStateKey = Buffer.from(String(config.RUNTIME_STATE_ENCRYPTION_KEY || ""), "base64");
  if (runtimeStateKey.length !== 32) {
    throw new Error("RUNTIME_STATE_ENCRYPTION_KEY muss als Base64-kodierter 32-Byte-Schluessel in .env.remote-dev.local stehen.");
  }
  const internalApiVariables = [
    "INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON",
    "INTERNAL_API_SIGNING_KEY_ID",
    "INTERNAL_API_SIGNING_PRIVATE_KEY_B64",
  ];
  if (internalApiVariables.some((name) => !String(config[name] || "").trim())) {
    throw new Error("Die Identity-Dienstidentitaet fehlt in .env.remote-dev.local. INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON, INTERNAL_API_SIGNING_KEY_ID und INTERNAL_API_SIGNING_PRIVATE_KEY_B64 muessen aus der geschuetzten Staging-Konfiguration hinterlegt sein.");
  }
  return {
    ...config,
    HOST: "127.0.0.1",
    PORT: "4300",
    IDENTITY_RUNTIME_LOCATION: "local-development",
    IDENTITY_REMOTE_DEV: "1",
    IDENTITY_APP_BASE_URL: config.IDENTITY_APP_BASE_URL || "http://localhost:4300",
    IDENTITY_PERSISTENCE_BACKEND: "postgres",
    IDENTITY_POSTGRES_HOST: config.IDENTITY_POSTGRES_HOST || "127.0.0.1",
    IDENTITY_POSTGRES_PORT: config.IDENTITY_POSTGRES_PORT || "25432",
    IDENTITY_POSTGRES_DATABASE: config.IDENTITY_POSTGRES_DATABASE || "gernetix_runtime",
    IDENTITY_POSTGRES_USER: config.IDENTITY_POSTGRES_USER || "gernetix_runtime",
    PROJECT_SERVER_BASE_URL: config.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800",
    BUILD_DEPLOY_BASE_URL: config.BUILD_DEPLOY_BASE_URL || "http://127.0.0.1:4400",
    BUILD_WORKER_POOL_BASE_URL: config.BUILD_WORKER_POOL_BASE_URL || "http://127.0.0.1:14400",
    DEVICE_MANAGEMENT_BASE_URL: config.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700",
    HARDWARE_SHOP_BASE_URL: config.HARDWARE_SHOP_BASE_URL || "http://127.0.0.1:4900",
    PUBLIC_DEMO_BASE_URL: config.PUBLIC_DEMO_BASE_URL || "http://127.0.0.1:4920",
    HARDWARE_CATALOG_BASE_URL: config.HARDWARE_CATALOG_BASE_URL || "http://10.77.0.1:4910",
    AI_USAGE_BASE_URL: config.AI_USAGE_BASE_URL || "http://127.0.0.1:5001",
    AI_CONTEXT_BASE_URL: config.AI_CONTEXT_BASE_URL || "http://127.0.0.1:5500",
    COMMUNITY_PLATFORM_BASE_URL: config.COMMUNITY_PLATFORM_BASE_URL || "http://127.0.0.1:5200",
    TELEMETRY_SERVER_BASE_URL: config.TELEMETRY_SERVER_BASE_URL || "http://127.0.0.1:5600",
  };
}

function mergeRemoteDevConfiguration(fileValues = {}, environment = {}) {
  const merged = { ...fileValues, ...environment };
  // Die lokale Datei ist die bewusst eingerichtete Vertrauensgrenze fuer
  // Remote-Dev. Vom aufrufenden Prozess geerbte Werte duerfen insbesondere
  // keine andere Dienstidentitaet einschleusen oder die Datei ueberstimmen.
  for (const name of [
    "INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON",
    "INTERNAL_API_SIGNING_KEY_ID",
    "INTERNAL_API_SIGNING_PRIVATE_KEY_B64",
    "IDENTITY_INTERNAL_API_SIGNING_KEY_ID",
    "IDENTITY_INTERNAL_API_SIGNING_PRIVATE_KEY_B64",
  ]) {
    if (String(fileValues[name] || "").trim()) merged[name] = fileValues[name];
  }
  return merged;
}

function normalizeIdentityInternalApiConfig(config) {
  const normalized = { ...config };
  const aliases = {
    INTERNAL_API_SIGNING_KEY_ID: "IDENTITY_INTERNAL_API_SIGNING_KEY_ID",
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "IDENTITY_INTERNAL_API_SIGNING_PRIVATE_KEY_B64",
  };
  for (const [target, source] of Object.entries(aliases)) {
    if (!String(normalized[target] || "").trim() && String(normalized[source] || "").trim()) {
      normalized[target] = normalized[source];
    }
  }
  return normalized;
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

module.exports = { loadRemoteDevConfig, main, mergeRemoteDevConfiguration, normalizeIdentityInternalApiConfig };
