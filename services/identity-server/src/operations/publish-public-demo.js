"use strict";

const { issueInternalToken } = require("../../../shared/internal-api-auth");

const MAX_PAYLOAD_BYTES = 24 * 1024 * 1024;

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_missing`);
  return normalized;
}

function identitySigningConfig(env = process.env) {
  const keyId = required(env.INTERNAL_API_SIGNING_KEY_ID, "internal_api_signing_key_id");
  const privateKey = Buffer.from(required(env.INTERNAL_API_SIGNING_PRIVATE_KEY_B64, "internal_api_signing_private_key"), "base64");
  return { activeKid: keyId, signingKeys: { [keyId]: { key: privateKey, algorithm: "Ed25519" } } };
}

async function publishPublicDemo(payload, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const baseUrl = new URL(required(env.PUBLIC_DEMO_BASE_URL, "public_demo_base_url"));
  if (!["http:", "https:"].includes(baseUrl.protocol)) throw new Error("public_demo_base_url_invalid");
  const token = issueInternalToken(
    { iss: "identity-server", sub: "identity-server", aud: "public-demo-server", scopes: ["public_demo.publish"] },
    options.signingConfig || identitySigningConfig(env),
    { ttlSeconds: 60 },
  );
  const response = await fetchImpl(new URL("/api/internal/public-demos", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`public_demo_publish_failed_${response.status}:${JSON.stringify(responseBody)}`);
  return responseBody;
}

async function readPayload(input = process.stdin) {
  const chunks = [];
  let length = 0;
  for await (const chunk of input) {
    length += chunk.length;
    if (length > MAX_PAYLOAD_BYTES) throw new Error("public_demo_payload_too_large");
    chunks.push(chunk);
  }
  if (!length) throw new Error("public_demo_payload_missing");
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  const payload = await readPayload();
  const published = await publishPublicDemo(payload);
  process.stdout.write(`${JSON.stringify({
    published: true,
    demo_id: payload.demo_id,
    version: payload.version,
    release_count: Array.isArray(published.releases) ? published.releases.length : undefined,
  })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Serverseitige Public-Demo-Veroeffentlichung fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { identitySigningConfig, publishPublicDemo, readPayload };
