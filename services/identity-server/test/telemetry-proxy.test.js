const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("identity proxies telemetry only after its session-bound project check", () => {
  const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
  const clients = fs.readFileSync(path.resolve(__dirname, "../src/dev/service-clients.js"), "utf8");
  assert.match(server, /telemetryProjectRoute/);
  assert.match(server, /await requireSessionProject\(session, projectId\)/);
  assert.match(server, /accounts\/\$\{encodeURIComponent\(accountId\)\}\/projects/);
  assert.match(clients, /X-GerNetiX-Telemetry-Token/);
});
