const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const clients = fs.readFileSync(path.resolve(__dirname, "../src/dev/service-clients.js"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const assistant = fs.readFileSync(path.resolve(__dirname, "../src/dev/development-assistant.js"), "utf8");
const telemetry = fs.readFileSync(path.resolve(__dirname, "../../shared/persistence/interface-call-telemetry.js"), "utf8");

test("identity records outbound service calls in shared sqlite telemetry", () => {
  assert.match(clients, /createInterfaceCallTelemetry/);
  assert.match(server, /INTERFACE_TELEMETRY_SQLITE_PATH/);
  assert.match(server, /PERSISTENCE_SQLITE_PATH/);
  assert.match(clients, /sourceService: "identity-server"/);
  assert.match(clients, /targetService: "project-server"/);
  assert.match(clients, /targetService: "device-management-server"/);
  assert.match(clients, /targetService: "ai-usage-server"/);
  assert.match(clients, /durationMs: Date\.now\(\) - startedAt/);
  assert.match(telemetry, /CREATE TABLE IF NOT EXISTS gernetix_external_interface_calls/);
  assert.match(telemetry, /Telemetrie darf den eigentlichen Schnittstellenaufruf nie blockieren/);
  assert.match(assistant, /trackedFetch\("openai-api"/);
  assert.match(assistant, /trackedFetch\("anthropic-api"/);
  assert.match(assistant, /trackedFetch\("ollama"/);
});
