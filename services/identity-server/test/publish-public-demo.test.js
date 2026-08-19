const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { identitySigningConfig, publishPublicDemo } = require("../src/operations/publish-public-demo");
const { issueInternalToken, verifyInternalToken } = require("../../shared/internal-api-auth");

const KID = "identity-server-test";

function environment(overrides = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  return {
    INTERNAL_API_SIGNING_KEY_ID: KID,
    INTERNAL_API_SIGNING_PRIVATE_KEY_B64: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: JSON.stringify({
      [KID]: { issuer: "identity-server", publicKeyB64: publicKey.export({ format: "der", type: "spki" }).toString("base64") },
    }),
    PUBLIC_DEMO_BASE_URL: "http://public-demo-server:4920",
    ...overrides,
  };
}

test("die DER-kodierte Staging-Konfiguration erzeugt ein verifizierbares Token", () => {
  const env = environment();
  const configuration = identitySigningConfig(env);
  const token = issueInternalToken(
    { iss: "identity-server", sub: "identity-server", aud: "public-demo-server", scopes: ["public_demo.publish"] },
    configuration,
    { ttlSeconds: 30 },
  );
  const claims = verifyInternalToken(token, configuration, {
    audience: "public-demo-server",
    requiredScopes: ["public_demo.publish"],
  });
  assert.equal(claims.aud, "public-demo-server");
  assert.equal(claims.iss, "identity-server");
  assert.equal(claims.kid, KID);
});

test("ohne Signierschluessel bleibt die Veroeffentlichung blockiert", () => {
  const env = environment({ INTERNAL_API_SIGNING_KEY_ID: "", INTERNAL_API_SIGNING_PRIVATE_KEY_B64: "" });
  assert.throws(() => identitySigningConfig(env), /internal_api_signing_key_missing/);
});

test("die Veroeffentlichung sendet Payload und kurzlebiges Bearer-Token", async () => {
  const env = environment();
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    return { ok: true, json: async () => ({ demo_id: "touch-spielesammlung", releases: [{ version: "1.0.0" }] }) };
  };
  const published = await publishPublicDemo({ demo_id: "touch-spielesammlung", version: "1.0.0" }, { env, fetchImpl });

  assert.equal(published.demo_id, "touch-spielesammlung");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://public-demo-server:4920/api/internal/public-demos");
  assert.equal(requests[0].init.method, "POST");
  const token = String(requests[0].init.headers.Authorization || "").replace(/^Bearer\s+/, "");
  const claims = verifyInternalToken(token, identitySigningConfig(env), {
    audience: "public-demo-server",
    requiredScopes: ["public_demo.publish"],
  });
  assert.equal(claims.iss, "identity-server");
  assert.equal(JSON.parse(requests[0].init.body).demo_id, "touch-spielesammlung");
});

test("ein Fehlerstatus des Katalogs bricht die Veroeffentlichung ab", async () => {
  const env = environment();
  const fetchImpl = async () => ({ ok: false, status: 409, json: async () => ({ error: "release_already_exists" }) });
  await assert.rejects(
    () => publishPublicDemo({ demo_id: "touch-spielesammlung", version: "1.0.0" }, { env, fetchImpl }),
    /public_demo_publish_failed_409/,
  );
});
