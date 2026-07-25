const assert = require("node:assert/strict");
const test = require("node:test");
const { createConfig } = require("../src/config");

test("Admin Tool uses the central runtime PostgreSQL database by default", () => {
  const config = createConfig({});
  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.database, "gernetix_runtime");
});
