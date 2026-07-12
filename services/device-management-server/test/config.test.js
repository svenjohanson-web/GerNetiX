const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { createConfig } = require("../src/config");

test("Device Management persists inventory in the shared SQLite database by default", () => {
  const config = createConfig({});

  assert.equal(config.persistenceBackend, "sqlite");
  assert.equal(config.sqlitePath, path.resolve(__dirname, "..", "..", "..", ".runtime", "gernetix-services.sqlite"));
});

test("Device Management resolves an explicitly configured SQLite path", () => {
  const config = createConfig({ DEVICE_MANAGEMENT_SQLITE_PATH: "./custom-device.sqlite" });

  assert.equal(config.sqlitePath, path.resolve("./custom-device.sqlite"));
});
