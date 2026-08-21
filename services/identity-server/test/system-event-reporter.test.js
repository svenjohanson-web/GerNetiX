const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createSystemEventReporter } = require("../src/services/system-event-reporter");
const { readInternalApiAuthConfig, verifyInternalToken } = require("../../shared/internal-api-auth");

function ed25519Keyring(serviceId, kid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return readInternalApiAuthConfig({
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({
      [kid]: { issuer: serviceId, publicKeyB64: publicKey.export({ format: "der", type: "spki" }).toString("base64") },
    }),
    INTERNAL_API_SIGNING_KEY_ID: kid,
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
  }, { serviceId });
}

test("reports identity events through the token-protected internal Admin Tool endpoint", async () => {
  const requests = [];
  const warnings = [];
  const report = createSystemEventReporter({
    baseUrl: "http://admin-tool:4600/",
    internalApiSigningKey: "event-signing-key",
    logger: { warn(value) { warnings.push(value); } },
    async fetchImpl(url, options) {
      requests.push({ url, options });
      return { ok: true, status: 201 };
    },
  });

  const delivered = await report({
    severity: "warning",
    source_service: "identity_server",
    event_type: "passkey_login_failed",
    message: "Passkey-Login fehlgeschlagen.",
    details: { stage: "verification", error_code: "bad_signature" },
  });

  assert.equal(delivered, true);
  assert.equal(requests[0].url, "http://admin-tool:4600/api/internal/system-events");
  verifyInternalToken(requests[0].options.headers.Authorization.replace(/^Bearer\s+/, ""), "event-signing-key", { audience: "admin-tool", requiredScopes: ["operations.system_events.write"] });
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.event_type, "passkey_login_failed");
  assert.equal(body.details.error_code, "bad_signature");
  assert.ok(body.occurred_at);
  assert.equal(warnings[0], "GerNetiX system event");
});

test("signs system events with the active key id instead of a legacy token", async () => {
  const signingKey = ed25519Keyring("identity-server", "identity-server-test");
  const requests = [];
  const report = createSystemEventReporter({
    baseUrl: "http://admin-tool:4600",
    internalApiSigningKey: signingKey,
    logger: { warn() {} },
    async fetchImpl(url, options) {
      requests.push({ url, options });
      return { ok: true, status: 201 };
    },
  });

  assert.equal(await report({ source_service: "identity_server", event_type: "passkey_login_failed", message: "Passkey-Login fehlgeschlagen." }), true);
  const token = requests[0].options.headers.Authorization.replace(/^Bearer\s+/, "");
  const claims = verifyInternalToken(token, signingKey, { audience: "admin-tool", requiredScopes: ["operations.system_events.write"] });
  assert.equal(claims.kid, "identity-server-test");
  assert.equal(claims.alg, "Ed25519");
});

test("names the rejection reason when the Admin Tool refuses a system event", async () => {
  const warnings = [];
  const report = createSystemEventReporter({
    baseUrl: "http://admin-tool:4600",
    internalApiSigningKey: "event-signing-key",
    logger: { warn(value) { warnings.push(String(value)); } },
    async fetchImpl() {
      return new Response(JSON.stringify({ error: "internal_token_invalid", message: "Interner API-Zugriff ist nicht berechtigt." }), { status: 403 });
    },
  });

  assert.equal(await report({ source_service: "identity_server", event_type: "passkey_login_failed", message: "Passkey-Login fehlgeschlagen." }), false);
  assert.ok(warnings.some((entry) => entry.includes("HTTP 403") && entry.includes("internal_token_invalid")), warnings.join(" | "));
});

test("keeps login failure handling available when Admin Tool delivery fails", async () => {
  const warnings = [];
  const report = createSystemEventReporter({
    baseUrl: "http://admin-tool:4600",
    internalApiSigningKey: "event-signing-key",
    logger: { warn(value) { warnings.push(String(value)); } },
    async fetchImpl() { throw new Error("connect ECONNREFUSED"); },
  });

  assert.equal(await report({
    source_service: "identity_server",
    event_type: "passkey_login_failed",
    message: "Passkey-Login fehlgeschlagen.",
  }), false);
  assert.ok(warnings.some((entry) => entry.includes("System event delivery failed")));
});
