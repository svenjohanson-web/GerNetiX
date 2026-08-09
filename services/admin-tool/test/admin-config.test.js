const assert = require("node:assert/strict");
const test = require("node:test");
const { createConfig } = require("../src/config");

test("Admin Tool uses the central runtime PostgreSQL database by default", () => {
  const config = createConfig({});
  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.database, "gernetix_runtime");
});

test("Admin Tool forwards only the dedicated Project Server read token", () => {
  const config = createConfig({ PROJECT_ADMIN_READ_TOKEN: "read-token" });
  assert.equal(config.projectAdminReadToken, "read-token");
});
