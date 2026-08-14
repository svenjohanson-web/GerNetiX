"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const {
  issueInternalToken,
  verifyInternalToken,
  verifyDelegation,
  assertDelegatedResource,
  createInMemoryReplayGuard,
  readInternalApiAuthConfig,
} = require("../internal-api-auth");

const secret = "test-secret";
const now = Date.UTC(2026, 7, 14, 12, 0, 0);

test("internal token restricts audience, scope and expiry", () => {
  const token = issueInternalToken({ iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] }, secret, { now, ttlSeconds: 30 });
  assert.equal(verifyInternalToken(token, secret, { audience: "project-server", requiredScopes: ["project.read"], now }).sub, "identity");
  assert.throws(() => verifyInternalToken(token, secret, { audience: "ai-usage-server", now }), { code: "internal_token_wrong_audience" });
  assert.throws(() => verifyInternalToken(token, secret, { audience: "project-server", requiredScopes: ["project.write"], now }), { code: "internal_token_scope_denied" });
  assert.throws(() => verifyInternalToken(token, secret, { audience: "project-server", now: now + 31_000 }), { code: "internal_token_expired" });
});

test("delegation is tied to its account, project and entitlement", () => {
  const token = issueInternalToken({ iss: "identity", sub: "identity", aud: "ai-usage-server", kind: "delegated_user_action", scopes: ["ai.usage.consume"], context: { account_id: "acct-1", project_ids: ["project-1"], entitlements: ["ai_assistant"] } }, secret, { now });
  const claims = verifyDelegation(token, secret, { audience: "ai-usage-server", requiredScopes: ["ai.usage.consume"], now });
  assert.doesNotThrow(() => assertDelegatedResource(claims, { accountId: "acct-1", projectId: "project-1", entitlement: "ai_assistant" }));
  assert.throws(() => assertDelegatedResource(claims, { accountId: "acct-2" }), { code: "delegated_account_access_denied" });
});

test("keyring tokens carry the active key id and verify during a rotation overlap", () => {
  const oldSecret = "old-service-key";
  const newSecret = "new-service-key";
  const oldToken = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] },
    { activeKid: "identity-2026-07", keys: { "identity-2026-07": oldSecret } },
    { now },
  );
  const newToken = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] },
    { activeKid: "identity-2026-08", keys: { "identity-2026-07": oldSecret, "identity-2026-08": newSecret } },
    { now },
  );
  const verificationKeyring = {
    verificationKeys: new Map([
      ["identity-2026-07", oldSecret],
      ["identity-2026-08", newSecret],
    ]),
  };

  assert.equal(decodePayload(oldToken).kid, "identity-2026-07");
  assert.equal(decodePayload(oldToken).alg, "HS256");
  assert.equal(decodePayload(newToken).kid, "identity-2026-08");
  assert.equal(verifyInternalToken(oldToken, verificationKeyring, { now }).kid, "identity-2026-07");
  assert.equal(verifyInternalToken(newToken, verificationKeyring, { now }).kid, "identity-2026-08");
});

test("Ed25519 keyrings keep signing private and allow public-key rotation overlap", () => {
  const oldPair = crypto.generateKeyPairSync("ed25519");
  const currentPair = crypto.generateKeyPairSync("ed25519");
  const claims = { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] };
  const oldToken = issueInternalToken(claims, {
    activeKid: "identity-ed25519-2026-07",
    algorithm: "Ed25519",
    signingKeys: { "identity-ed25519-2026-07": oldPair.privateKey },
  }, { now });
  const currentToken = issueInternalToken(claims, {
    activeKid: "identity-ed25519-2026-08",
    algorithm: "EdDSA",
    signingKeys: { "identity-ed25519-2026-08": currentPair.privateKey },
  }, { now });
  const publicKeyring = {
    verificationKeys: {
      "identity-ed25519-2026-07": { algorithm: "Ed25519", key: oldPair.publicKey },
      "identity-ed25519-2026-08": { alg: "EdDSA", key: currentPair.publicKey },
    },
  };

  assert.deepEqual(
    { kid: decodePayload(currentToken).kid, alg: decodePayload(currentToken).alg },
    { kid: "identity-ed25519-2026-08", alg: "Ed25519" },
  );
  assert.equal(verifyInternalToken(oldToken, publicKeyring, { expectedIssuer: "identity", now }).kid, "identity-ed25519-2026-07");
  assert.equal(verifyInternalToken(currentToken, publicKeyring, { expectedIssuer: "identity", now }).kid, "identity-ed25519-2026-08");
  assert.throws(
    () => verifyInternalToken(currentToken, {
      verificationKeys: {
        "identity-ed25519-2026-08": {
          algorithm: "Ed25519",
          key: currentPair.privateKey.export({ type: "pkcs8", format: "pem" }),
        },
      },
    }, { now }),
    { code: "internal_auth_not_configured", status: 503 },
  );
  assert.throws(
    () => issueInternalToken(claims, {
      activeKid: "identity-ed25519-2026-08",
      algorithm: "Ed25519",
      signingKeys: { "identity-ed25519-2026-08": currentPair.publicKey },
    }, { now }),
    { code: "internal_auth_not_configured", status: 503 },
  );
});

test("verification rejects algorithm confusion and the wrong Ed25519 public key", () => {
  const signer = crypto.generateKeyPairSync("ed25519");
  const attacker = crypto.generateKeyPairSync("ed25519");
  const token = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] },
    { activeKid: "identity-current", algorithm: "Ed25519", signingKeys: { "identity-current": signer.privateKey } },
    { now },
  );

  assert.throws(
    () => verifyInternalToken(token, {
      verificationKeys: { "identity-current": { algorithm: "HS256", key: "not-a-public-key" } },
    }, { now }),
    { code: "internal_token_invalid" },
  );
  const confusedToken = signPayload({ ...decodePayload(token), alg: "HS256" }, "legacy-secret");
  assert.throws(
    () => verifyInternalToken(confusedToken, "legacy-secret", { now }),
    { code: "internal_token_invalid" },
  );
  assert.throws(
    () => verifyInternalToken(token, {
      verificationKeys: { "identity-current": { algorithm: "Ed25519", key: attacker.publicKey } },
    }, { now }),
    { code: "internal_token_invalid" },
  );
});

test("keyring verification fails closed for unknown, removed and malformed key ids", () => {
  const token = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] },
    { activeKid: "identity-current", keys: { "identity-current": "current-secret" } },
    { now },
  );

  assert.throws(
    () => verifyInternalToken(token, { verificationKeys: { "identity-other": "other-secret" } }, { now }),
    { code: "internal_token_invalid" },
  );
  assert.throws(
    () => issueInternalToken(
      { iss: "identity", sub: "identity", aud: "project-server", scopes: [] },
      { activeKid: "missing", keys: { current: "secret" } },
      { now },
    ),
    { code: "internal_auth_not_configured", status: 503 },
  );
  assert.throws(
    () => issueInternalToken(
      { iss: "identity", sub: "identity", aud: "project-server", scopes: [] },
      { activeKid: "bad key id", keys: { "bad key id": "secret" } },
      { now },
    ),
    { code: "internal_auth_not_configured", status: 503 },
  );
});

test("legacy tokens require an explicit compatibility mode on a keyring verifier", () => {
  const legacyToken = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] },
    secret,
    { now },
  );
  assert.equal(decodePayload(legacyToken).kid, undefined);
  assert.throws(
    () => verifyInternalToken(legacyToken, { verificationKeys: { current: secret } }, { now }),
    { code: "internal_token_invalid" },
  );
  assert.equal(
    verifyInternalToken(legacyToken, {
      verificationKeys: { current: "new-secret" },
      allowLegacyTokens: true,
      legacySecret: secret,
    }, { now }).iss,
    "identity",
  );
  const malformedKidToken = signPayload({ ...decodePayload(legacyToken), kid: "bad key id" }, secret);
  assert.throws(
    () => verifyInternalToken(malformedKidToken, {
      verificationKeys: { current: "new-secret" },
      allowLegacyTokens: true,
      legacySecret: secret,
    }, { now }),
    { code: "internal_token_invalid" },
  );
});

test("verification can bind tokens to allowed issuers and subjects", () => {
  const token = issueInternalToken(
    { iss: "identity", sub: "identity-worker", aud: "project-server", scopes: ["project.read"] },
    { activeKid: "identity-current", keys: { "identity-current": secret } },
    { now },
  );
  const verifier = { verificationKeys: { "identity-current": secret } };

  assert.equal(verifyInternalToken(token, verifier, {
    expectedIssuer: "identity",
    expectedSubjects: ["identity", "identity-worker"],
    now,
  }).sub, "identity-worker");
  assert.throws(() => verifyInternalToken(token, verifier, { issuer: "admin-access", now }), { code: "internal_token_wrong_issuer" });
  assert.throws(() => verifyInternalToken(token, verifier, { subject: "identity", now }), { code: "internal_token_wrong_subject" });
  assert.throws(() => verifyInternalToken(token, verifier, { expectedIssuers: [], now }), { code: "internal_token_wrong_issuer" });
});

test("keyring issuance rejects empty material and invalid lifetimes", () => {
  const claims = { iss: "identity", sub: "identity", aud: "project-server", scopes: [] };
  assert.throws(() => issueInternalToken(claims, { activeKid: "current", keys: {} }, { now }), { code: "internal_auth_not_configured" });
  assert.throws(() => issueInternalToken(claims, { activeKid: "current", keys: { current: "secret" } }, { now, ttlSeconds: 0 }), { code: "internal_auth_invalid_ttl" });
});

test("optional replay guard consumes a token once and releases expired entries", () => {
  let guardNow = now;
  const replayGuard = createInMemoryReplayGuard({ clock: () => guardNow, maxEntries: 1 });
  const firstToken = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.write"] },
    secret,
    { now, ttlSeconds: 30 },
  );
  assert.equal(verifyInternalToken(firstToken, secret, { audience: "project-server", replayGuard, now }).sub, "identity");
  assert.throws(
    () => verifyInternalToken(firstToken, secret, { audience: "project-server", replayGuard, now }),
    { code: "internal_token_replayed" },
  );

  guardNow += 31_000;
  const secondToken = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.write"] },
    secret,
    { now: guardNow, ttlSeconds: 30 },
  );
  assert.equal(verifyInternalToken(secondToken, secret, { replayGuard, now: guardNow }).sub, "identity");
});

test("replay guard is opt-in, synchronous and fail-closed when misconfigured", () => {
  const token = issueInternalToken(
    { iss: "identity", sub: "identity", aud: "project-server", scopes: ["project.read"] },
    secret,
    { now },
  );
  assert.doesNotThrow(() => verifyInternalToken(token, secret, { now }));
  assert.doesNotThrow(() => verifyInternalToken(token, secret, { now }));
  assert.throws(() => verifyInternalToken(token, secret, { replayGuard: {}, now }), { code: "internal_auth_replay_guard_invalid", status: 503 });
  assert.throws(
    () => verifyInternalToken(token, secret, { replayGuard: { consume: async () => true }, now }),
    { code: "internal_auth_replay_guard_invalid", status: 503 },
  );
});

test("environment config loads Ed25519 signing and issuer-bound verification keys", () => {
  assert.equal(require("../index").readInternalApiAuthConfig, readInternalApiAuthConfig);
  const identityPair = crypto.generateKeyPairSync("ed25519");
  const config = readInternalApiAuthConfig({
    INTERNAL_API_SIGNING_KEY_ID: "identity-2026-08",
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: exportDerBase64(identityPair.privateKey, "pkcs8"),
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({
      "identity-2026-08": {
        issuer: "identity-server",
        publicKeyB64: exportDerBase64(identityPair.publicKey, "spki"),
      },
    }),
    INTERNAL_API_SIGNING_KEY: "must-not-be-read",
  }, { serviceId: "identity-server" });
  const token = issueInternalToken(
    { iss: "identity-server", sub: "identity-server", aud: "project-server", scopes: ["project.read"] },
    config,
    { now },
  );

  assert.equal(decodePayload(token).kid, "identity-2026-08");
  assert.equal(verifyInternalToken(token, config, { now }).iss, "identity-server");
  assert.throws(
    () => issueInternalToken(
      { iss: "other-service", sub: "identity-server", aud: "project-server", scopes: [] },
      config,
      { now },
    ),
    { code: "internal_token_wrong_issuer" },
  );
});

test("environment config accepts the provisioner's versioned public trust ring", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const config = readInternalApiAuthConfig({
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({
      version: 1,
      keys: [{
        kid: "identity-server-2026-08",
        issuer: "identity-server",
        algorithm: "Ed25519",
        publicKeyB64: exportDerBase64(pair.publicKey, "spki"),
      }],
    }),
  }, { serviceId: "project-server" });
  assert.ok(config.verificationKeys["identity-server-2026-08"]);
});

test("verification key issuer metadata is enforced automatically", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const attackerToken = issueInternalToken(
    { iss: "attacker-service", sub: "attacker-service", aud: "project-server", scopes: ["project.read"] },
    { activeKid: "shared-kid", algorithm: "Ed25519", signingKeys: { "shared-kid": pair.privateKey } },
    { now },
  );
  assert.throws(
    () => verifyInternalToken(attackerToken, {
      verificationKeys: {
        "shared-kid": { algorithm: "Ed25519", key: pair.publicKey, issuer: "identity-server" },
      },
    }, { now }),
    { code: "internal_token_wrong_issuer" },
  );
});

test("environment config supports verifier-only services and rejects malformed material", () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const trusted = JSON.stringify({
    current: { issuers: ["identity-server", "admin-access-server"], publicKeyB64: exportDerBase64(pair.publicKey, "spki") },
  });
  const verifierOnly = readInternalApiAuthConfig({
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: trusted,
    INTERNAL_API_SIGNING_KEY: "legacy-value-must-not-enable-signing",
  }, { serviceId: "project-server" });
  assert.equal(verifierOnly.activeKid, undefined);
  assert.throws(
    () => issueInternalToken(
      { iss: "project-server", sub: "project-server", aud: "identity-server", scopes: [] },
      verifierOnly,
      { now },
    ),
    { code: "internal_auth_not_configured", status: 503 },
  );

  const invalidCases = [
    [{}, { serviceId: "project-server" }],
    [{ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: trusted }, {}],
    [{ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: "{}" }, { serviceId: "project-server" }],
    [{ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: "not-json" }, { serviceId: "project-server" }],
    [{ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: trusted, INTERNAL_API_SIGNING_KEY_ID: "orphan" }, { serviceId: "project-server" }],
    [{ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: trusted, INTERNAL_API_SIGNING_KEY_ID: "current", INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "%%%" }, { serviceId: "project-server" }],
    [{ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({ current: { publicKeyB64: exportDerBase64(pair.publicKey, "spki") } }) }, { serviceId: "project-server" }],
    [{ INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({ current: { issuer: "identity-server", publicKeyB64: "%%%" } }) }, { serviceId: "project-server" }],
  ];
  for (const [env, options] of invalidCases) {
    assert.throws(() => readInternalApiAuthConfig(env, options), { code: "internal_auth_not_configured", status: 503 });
  }
});

function decodePayload(token) {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
}

function signPayload(payload, signingSecret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signed = crypto.createHmac("sha256", signingSecret).update(encoded).digest("base64url");
  return `${encoded}.${signed}`;
}

function exportDerBase64(key, type) {
  return key.export({ format: "der", type }).toString("base64");
}
