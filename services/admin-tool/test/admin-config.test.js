const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createConfig } = require("../src/config");

test("Admin Tool uses the central runtime PostgreSQL database by default", () => {
  const config = createConfig({});
  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.database, "gernetix_runtime");
});

test("Admin Tool ignores the retired shared key and loads its issuer-bound signing identity", () => {
  assert.equal(createConfig({ INTERNAL_API_SIGNING_KEY: "retired-shared-key" }).internalApiSigningKey, "");
  const pair = crypto.generateKeyPairSync("ed25519");
  const config = createConfig({
    INTERNAL_API_SIGNING_KEY_ID: "admin-tool-current",
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({
      "admin-tool-current": {
        issuer: "admin-tool",
        publicKeyB64: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
      },
    }),
  });
  assert.equal(config.internalApiSigningKey.issuer, "admin-tool");
  assert.equal(config.internalApiSigningKey.activeKid, "admin-tool-current");
});
