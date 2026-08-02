"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  composeArgs,
  dockerExecutable,
  isPrivateIpv4,
  parseArgs,
  parseEnvFile,
  supportsWorkerHost,
  validateConfig,
} = require("./build-worker");

test("Docker Desktop is resolved independently of the macOS GUI PATH", () => {
  const result = dockerExecutable({
    env: { PATH: "/usr/bin:/bin" },
    platform: "darwin",
    existsSync: (candidate) => candidate === "/usr/local/bin/docker",
  });
  assert.equal(result, "/usr/local/bin/docker");
});

test("parses the dedicated worker command without exposing secrets", () => {
  const parsed = parseArgs(["start", "--env", "./worker.env", "--skip-network"]);
  assert.equal(parsed.action, "start");
  assert.equal(parsed.envFile, path.resolve("./worker.env"));
  assert.equal(parsed.skipNetwork, true);
});

test("supports Linux hosts and Docker Desktop on macOS", () => {
  assert.equal(supportsWorkerHost("linux"), true);
  assert.equal(supportsWorkerHost("darwin"), true);
  assert.equal(supportsWorkerHost("win32"), false);
});

test("accepts private WireGuard addresses and rejects public or wildcard binds", () => {
  assert.equal(isPrivateIpv4("10.77.0.20"), true);
  assert.equal(isPrivateIpv4("172.20.1.2"), true);
  assert.equal(isPrivateIpv4("192.168.10.5"), true);
  assert.equal(isPrivateIpv4("0.0.0.0"), false);
  assert.equal(isPrivateIpv4("203.0.113.5"), false);
});

test("validates the minimum safe worker configuration", () => {
  const valid = {
    BUILD_WORKER_ID: "linux-worker-01",
    BUILD_WORKER_BIND_ADDRESS: "10.77.0.20",
    BUILD_WORKER_PORT: "4400",
    BUILD_POSTGRES_HOST: "10.77.0.1",
    BUILD_POSTGRES_PORT: "25432",
    BUILD_POSTGRES_PASSWORD: "a-long-real-password",
    BUILD_PUBLIC_BASE_URL: "https://build.gernetix.com",
  };
  assert.deepEqual(validateConfig(valid), []);
  assert.match(validateConfig({ ...valid, BUILD_WORKER_BIND_ADDRESS: "0.0.0.0" }).join(" "), /private IPv4/);
  assert.match(validateConfig({ ...valid, BUILD_POSTGRES_PASSWORD: "replace-with-runtime-postgres-password" }).join(" "), /Beispielwert/);
});

test("compose invocation always uses the isolated worker definition and env file", () => {
  const args = composeArgs("/tmp/worker.env", ["config", "--quiet"]);
  assert.deepEqual(args.slice(0, 4), ["compose", "--env-file", "/tmp/worker.env", "-f"]);
  assert.match(args[4], /compose\.build-worker\.yaml$/);
});

test("env parser supports comments and quoted values", () => {
  assert.deepEqual(parseEnvFile("# worker\nBUILD_WORKER_ID='worker-01'\nBUILD_WORKER_PORT=4400\n"), {
    BUILD_WORKER_ID: "worker-01",
    BUILD_WORKER_PORT: "4400",
  });
});

test("standalone worker is build-only, PostgreSQL-coordinated and WireGuard-bound", () => {
  const compose = fs.readFileSync(path.resolve(__dirname, "..", "compose.build-worker.yaml"), "utf8");
  assert.match(compose, /BUILD_WORKER_ROLE: build_only/);
  assert.match(compose, /INTERFACE_TELEMETRY_SQLITE_PATH: \/var\/lib\/gernetix\/build\/interface-telemetry\.sqlite/);
  assert.match(compose, /BUILD_ARTIFACT_PERSISTENCE_BACKEND: postgres/);
  assert.match(compose, /BUILD_COORDINATION_BACKEND: postgres/);
  assert.match(compose, /BUILD_DATABASE_SCHEMA_MANAGEMENT: disabled/);
  assert.match(compose, /BUILD_POSTGRES_USER: \$\{BUILD_POSTGRES_USER:-gernetix_build_worker\}/);
  assert.match(compose, /BUILD_WORKER_BIND_ADDRESS:\?BUILD_WORKER_BIND_ADDRESS muss die private WireGuard-Adresse sein/);
  assert.match(compose, /MQTT_BROKER_URL: ""/);
  assert.doesNotMatch(compose, /OTA_SIGNING_PRIVATE_KEY_PATH/);
});
