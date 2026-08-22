const assert = require("node:assert/strict");
const test = require("node:test");
const { passkeyClientError } = require("../src/services/passkey-client-errors");

test("reports central persistence failures instead of blaming the passkey", () => {
  assert.deepEqual(passkeyClientError("options", Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" })), {
    status: 503,
    error: "identity_persistence_unavailable",
    message: "Die zentrale Kontodatenbank ist momentan nicht erreichbar.",
  });
  for (const error of [
    new Error("Connection terminated unexpectedly"),
    Object.assign(new Error("PostgreSQL connection failed"), { code:"08006" }),
    new Error("Passkey lookup failed", { cause:Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:25432"), { code:"ECONNREFUSED" }) }),
  ]) {
    assert.equal(passkeyClientError("verification", error).error, "identity_persistence_unavailable");
  }
});

test("keeps account errors actionable and hides unknown verification details", () => {
  assert.equal(passkeyClientError("options", { code: "invalid_credentials", status: 401 }).error, "invalid_credentials");
  assert.equal(passkeyClientError("verification", new Error("Credential secret-id is not registered")).error, "passkey_verification_failed");
});
