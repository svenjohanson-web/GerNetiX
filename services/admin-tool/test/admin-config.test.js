const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { createConfig } = require("../src/config");

test("local Admin Tool persists system events in the shared runtime SQLite by default", () => {
  const config = createConfig({});
  assert.equal(config.persistenceBackend, "sqlite");
  assert.equal(config.sqlitePath, path.resolve(__dirname, "..", "..", "..", ".runtime", "gernetix-services.sqlite"));
});
