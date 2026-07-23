#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const workspaceRoot = path.resolve(__dirname, "..");
const logRoot = path.join(workspaceRoot, ".runtime", "process-logs");

const PLATFORM_SERVICES = [
  service("project-server", "Project Server", 4800),
  service("build-deploy-server", "Build & Deploy Server", 4400),
  service("device-management-server", "Device Management Server", 4700),
  service("hardware-catalog", "Hardware Catalog", 4910),
  service("hardware-shop", "Hardware Shop", 4900),
  service("ai-usage-server", "AI Usage Server", 5000),
  service("ai-context-server", "AI Context Server", 5500),
  service("admin-tool", "Admin Tool", 4600),
  service("community-platform", "Community Platform", 5200),
  service("identity-server", "Identity Server", 4300),
];

function service(id, name, port) {
  return {
    id,
    name,
    port,
    cwd: path.join(workspaceRoot, "services", id),
    entry: "src/dev-server.js",
    healthUrl: `http://127.0.0.1:${port}/health`,
  };
}

async function checkService(target, options = {}) {
  const requestHealth = options.requestHealth || healthRequest;
  try {
    const result = await requestHealth(target.healthUrl, options.timeoutMs || 1200);
    return { ...target, healthy: result.statusCode >= 200 && result.statusCode < 300, statusCode: result.statusCode };
  } catch (error) {
    return { ...target, healthy: false, statusCode: 0, error: error.message };
  }
}

async function checkServices(services = PLATFORM_SERVICES, options = {}) {
  return Promise.all(services.map((target) => checkService(target, options)));
}

async function wakeServices(services = PLATFORM_SERVICES, options = {}) {
  const initial = await checkServices(services, options);
  const results = [];
  for (const status of initial) {
    if (status.healthy) {
      results.push({ ...status, action: "already_running" });
      continue;
    }
    const started = await startService(status, options);
    results.push(started);
  }
  return results;
}

async function startService(target, options = {}) {
  const spawnProcess = options.spawnProcess || spawnDetached;
  const waitForHealth = options.waitForHealth || waitUntilHealthy;
  try {
    const child = spawnProcess(target);
    const health = await waitForHealth(target, options);
    return {
      ...target,
      healthy: health.healthy,
      statusCode: health.statusCode,
      action: health.healthy ? "started" : "start_failed",
      pid: child?.pid || null,
      error: health.healthy ? "" : health.error || "Healthcheck blieb erfolglos.",
    };
  } catch (error) {
    return { ...target, healthy: false, action: "start_failed", statusCode: 0, error: error.message };
  }
}

function spawnDetached(target) {
  fs.mkdirSync(logRoot, { recursive: true });
  const logPath = path.join(logRoot, `${target.id}.log`);
  const output = fs.openSync(logPath, "a");
  const child = spawn(process.execPath, [target.entry], {
    cwd: target.cwd,
    detached: true,
    windowsHide: true,
    env: { ...process.env, PORT: String(target.port) },
    stdio: ["ignore", output, output],
  });
  child.unref();
  fs.closeSync(output);
  return child;
}

async function waitUntilHealthy(target, options = {}) {
  const attempts = options.attempts || 32;
  const intervalMs = options.intervalMs || 250;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await checkService(target, options);
    if (status.healthy) return status;
    await delay(intervalMs);
  }
  return checkService(target, options);
}

function healthRequest(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      response.on("end", () => resolve({ statusCode: response.statusCode || 0 }));
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function selectServices(args) {
  const serviceOption = args.find((argument) => argument.startsWith("--service="));
  if (!serviceOption) return PLATFORM_SERVICES;
  const requested = new Set(serviceOption.slice("--service=".length).split(",").map((value) => value.trim()).filter(Boolean));
  return PLATFORM_SERVICES.filter((target) => requested.has(target.id));
}

function printResults(results) {
  for (const result of results) {
    const state = result.healthy ? "OK" : "FEHLER";
    const action = {
      already_running: "laeuft bereits",
      started: `gestartet${result.pid ? ` (PID ${result.pid})` : ""}`,
      start_failed: "Start fehlgeschlagen",
    }[result.action] || (result.healthy ? "erreichbar" : "nicht erreichbar");
    const detail = result.error ? ` - ${result.error}` : result.statusCode ? ` - HTTP ${result.statusCode}` : "";
    console.log(`[${state}] ${result.name.padEnd(28)} :${result.port} ${action}${detail}`);
  }
}

async function main(args = process.argv.slice(2), options = {}) {
  const command = args[0] || "wake";
  if (!["check", "wake"].includes(command)) {
    console.error("Verwendung: node tools/check-and-wake-processes.js [wake|check] [--service=id,id]");
    return 2;
  }
  const services = selectServices(args);
  if (!services.length) {
    console.error("Keine bekannten Services ausgewaehlt.");
    return 2;
  }
  const results = command === "wake" ? await wakeServices(services, options) : await checkServices(services, options);
  printResults(results);
  if (command === "wake") console.log(`Logs: ${logRoot}`);
  return results.every((result) => result.healthy) ? 0 : 1;
}

if (require.main === module) {
  main().then((exitCode) => { process.exitCode = exitCode; }).catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = { PLATFORM_SERVICES, checkService, checkServices, main, selectServices, startService, wakeServices };
