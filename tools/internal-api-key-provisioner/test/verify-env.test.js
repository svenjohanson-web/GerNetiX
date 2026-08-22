"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DEPLOYMENT_SIGNERS, generateProvisioningBundle, main, verifyEnvironmentKeyset } = require("../index");

const VERSION = "2026-09";

function generateBundle() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-verify-env-"));
  const target = path.join(parent, "bundle");
  generateProvisioningBundle({ output: target, version: VERSION, repoRoot: path.join(parent, "unrelated-repository") });
  return { parent, target };
}

function privateKeyOf(target, issuer) {
  return fs.readFileSync(path.join(target, "private", `${issuer}.pkcs8.der.b64`), "utf8").trim();
}

// Baut die Konfigurationsdatei genauso auf wie das Staging-Deployment: der
// Trust-Ring als einzeiliges JSON, je Aussteller Key-ID und privater Schluessel.
function writeEnvironment(target, overrides = {}) {
  const trustRing = fs.readFileSync(path.join(target, "public-trust-ring.json"), "utf8").replace(/[\r\n]/g, "");
  const values = { INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: trustRing };
  for (const { prefix, issuer } of DEPLOYMENT_SIGNERS) {
    values[`${prefix}_INTERNAL_API_SIGNING_KEY_ID`] = `${issuer}-${VERSION}`;
    values[`${prefix}_INTERNAL_API_SIGNING_PRIVATE_KEY_B64`] = privateKeyOf(target, issuer);
  }
  Object.assign(values, overrides);
  const file = path.join(path.dirname(target), `env-${crypto.randomUUID()}`);
  fs.writeFileSync(file, `${Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n")}\n`, "utf8");
  return file;
}

test("eine vollstaendig zusammengehoerige Konfiguration wird akzeptiert", () => {
  const { target } = generateBundle();
  const result = verifyEnvironmentKeyset({ envFile: writeEnvironment(target) });
  assert.equal(result.verifiedSigners.length, DEPLOYMENT_SIGNERS.length);
  assert.equal(result.trustRingKeyCount >= DEPLOYMENT_SIGNERS.length, true);
});

test("ein vorhandener, aber ungueltiger Platzhalter wird nicht als gueltig akzeptiert", () => {
  const { target } = generateBundle();
  // Genau der Fall, der bisher unbemerkt blieb: nicht leer, aber kein Schluessel.
  const envFile = writeEnvironment(target, {
    IDENTITY_INTERNAL_API_SIGNING_PRIVATE_KEY_B64: crypto.randomBytes(48).toString("base64"),
  });
  assert.throws(() => verifyEnvironmentKeyset({ envFile }), /identity-server: Der private Schluessel ist kein lesbares PKCS8-DER\./);
});

test("eine Key-ID ausserhalb des Trust-Rings wird abgelehnt", () => {
  const { target } = generateBundle();
  const envFile = writeEnvironment(target, { TELEMETRY_INTERNAL_API_SIGNING_KEY_ID: "telemetry-server-2099-01" });
  assert.throws(() => verifyEnvironmentKeyset({ envFile }), /telemetry-server: Die aktive Key-ID fehlt im oeffentlichen Trust-Ring\./);
});

test("ein privater Schluessel eines fremden Ausstellers wird erkannt", () => {
  const { target } = generateBundle();
  const envFile = writeEnvironment(target, {
    IDENTITY_INTERNAL_API_SIGNING_PRIVATE_KEY_B64: privateKeyOf(target, "admin-tool"),
  });
  assert.throws(() => verifyEnvironmentKeyset({ envFile }), /identity-server: Privater Schluessel und Trust-Ring-Eintrag gehoeren nicht zusammen\./);
});

test("ein fehlender oder unlesbarer Trust-Ring stoppt die Pruefung", () => {
  const { target } = generateBundle();
  assert.throws(() => verifyEnvironmentKeyset({ envFile: writeEnvironment(target, { INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: "" }) }),
    /Der oeffentliche Trust-Ring fehlt in der Konfiguration\./);
  assert.throws(() => verifyEnvironmentKeyset({ envFile: writeEnvironment(target, { INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON: "{kein-json" }) }),
    /Der oeffentliche Trust-Ring ist kein gueltiges JSON\./);
});

test("die Pruefausgabe enthaelt keine Schluesselwerte", () => {
  const { target } = generateBundle();
  const envFile = writeEnvironment(target);
  const messages = [];
  main(["--verify-env", envFile], { log: (message) => messages.push(String(message)) });
  const output = messages.join("\n");
  assert.match(output, /Interne API-Schluessel geprueft/);
  for (const { issuer } of DEPLOYMENT_SIGNERS) {
    assert.equal(output.includes(privateKeyOf(target, issuer)), false);
  }
});

test("Pruefmodus und Erzeugung schliessen sich aus", () => {
  assert.throws(() => main(["--verify-env", "irgendwo", "--output", "/tmp/x"]),
    /--verify-env prueft nur eine vorhandene Konfiguration/);
});
