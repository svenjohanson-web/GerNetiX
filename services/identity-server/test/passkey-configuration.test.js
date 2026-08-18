"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createPasskeyConfiguration, normalizeOrigin } = require("../src/services/passkey-configuration");

test("Passkey-Konfiguration bindet WebAuthn an kanonischen Origin und RP-ID", () => {
  const config = createPasskeyConfiguration({
    canonicalOrigin: "https://pwa.gernetix.com/",
    canonicalRpId: "gernetix.com",
    allowedOrigins: ["https://pwa.gernetix.com"],
  });
  assert.deepEqual(config.forRequest({ headers: { origin: "https://pwa.gernetix.com" } }), {
    origin: "https://pwa.gernetix.com",
    rpID: "gernetix.com",
  });
  assert.throws(
    () => config.forRequest({ headers: { origin: "http://localhost:4300" } }),
    (error) => error.code === "passkey_canonical_origin_required" && error.status === 409,
  );
});

test("Remote-Dev darf zentrale Passkeys lesen, aber nicht anlegen oder ersetzen", () => {
  const config = createPasskeyConfiguration({ canonicalOrigin: "https://pwa.gernetix.com", remoteDev: true });
  assert.equal(config.forRequest({ headers: { origin: "https://pwa.gernetix.com" } }).rpID, "pwa.gernetix.com");
  assert.throws(
    () => config.forRequest({ headers: { origin: "https://pwa.gernetix.com" } }, { mutation: true }),
    (error) => error.code === "passkey_remote_dev_mutation_forbidden",
  );
});

test("Fremde RP-IDs und Origins mit Pfad oder Zugangsdaten werden verworfen", () => {
  assert.throws(
    () => createPasskeyConfiguration({ canonicalOrigin: "https://pwa.gernetix.com", canonicalRpId: "example.net" }),
    /muss zur kanonischen Identity-Domain gehoeren/,
  );
  assert.equal(normalizeOrigin("https://user:secret@pwa.gernetix.com"), "");
  assert.equal(normalizeOrigin("https://pwa.gernetix.com/app"), "");
});
