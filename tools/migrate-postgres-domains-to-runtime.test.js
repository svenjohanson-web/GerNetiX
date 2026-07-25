const assert = require("node:assert/strict");
const test = require("node:test");
const {
  domains,
  identifier,
  poolOptions,
  targetPoolOptions,
} = require("./migrate-postgres-domains-to-runtime");

test("legacy PostgreSQL domains are skipped unless their old secret is present", () => {
  assert.equal(poolOptions("identity", {}), null);
  assert.deepEqual(poolOptions("identity", { LEGACY_IDENTITY_POSTGRES_PASSWORD: "secret" }), {
    host: "identity-postgres",
    port: 5432,
    database: "gernetix_identity",
    user: "gernetix_identity",
    password: "secret",
  });
});

test("central migration target defaults to gernetix_runtime", () => {
  const target = targetPoolOptions({});
  assert.equal(target.database, "gernetix_runtime");
  assert.equal(target.user, "gernetix_runtime");
  assert.ok(domains.some(([name]) => name === "ai_context"));
});

test("dynamic migration SQL only accepts safe identifiers", () => {
  assert.equal(identifier("identity_user_accounts"), '"identity_user_accounts"');
  assert.throws(() => identifier("identity_user_accounts; DROP TABLE x"), /Unsicherer SQL-Bezeichner/);
});
