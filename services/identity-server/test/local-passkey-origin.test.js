const assert = require("node:assert/strict");
const test = require("node:test");
const { canonicalLocalPasskeyLocation } = require("../src/services/local-passkey-origin");

test("local browser pages use localhost because WebAuthn rejects an IP RP ID", () => {
  assert.equal(canonicalLocalPasskeyLocation({
    method: "GET",
    url: "/app/auth/?mode=register",
    headers: { host: "127.0.0.1:4300" },
  }), "http://localhost:4300/app/auth/?mode=register");
});

test("health, API, localhost and public-domain requests are not redirected", () => {
  assert.equal(canonicalLocalPasskeyLocation({ method: "GET", url: "/health", headers: { host: "127.0.0.1:4300" } }), "");
  assert.equal(canonicalLocalPasskeyLocation({ method: "POST", url: "/api/passkeys/authentication/options", headers: { host: "127.0.0.1:4300" } }), "");
  assert.equal(canonicalLocalPasskeyLocation({ method: "GET", url: "/app/auth/", headers: { host: "localhost:4300" } }), "");
  assert.equal(canonicalLocalPasskeyLocation({ method: "GET", url: "/app/auth/", headers: { host: "app.gernetix.test" } }), "");
});
