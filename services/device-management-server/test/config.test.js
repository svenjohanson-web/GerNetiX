const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { createConfig } = require("../src/config");

test("Device Management uses PostgreSQL by default", () => {
  const config = createConfig({});

  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.database, "gernetix_runtime");
});

test("Device Management resolves an explicitly configured SQLite path", () => {
  const config = createConfig({ DEVICE_MANAGEMENT_SQLITE_PATH: "./custom-device.sqlite" });

  assert.equal(config.sqlitePath, path.resolve("./custom-device.sqlite"));
});
