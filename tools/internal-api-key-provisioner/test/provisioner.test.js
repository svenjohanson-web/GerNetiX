"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { SIGNERS, generateProvisioningBundle, main } = require("../index");

function freshTarget(name = "bundle") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-key-provisioner-"));
  return { parent, target: path.join(parent, name) };
}

test("generates one valid isolated Ed25519 keypair per fixed signer", () => {
  const { target } = freshTarget();
  const result = generateProvisioningBundle({
    output: target,
    version: "2026-09",
    repoRoot: path.join(target, "unrelated-repository"),
    now: new Date("2026-08-14T10:00:00.000Z"),
  });
  assert.equal(result.signerCount, SIGNERS.length);
  assert.deepEqual(result.trustRing.keys.map((entry) => entry.issuer), SIGNERS);
  assert.equal(new Set(result.trustRing.keys.map((entry) => entry.kid)).size, SIGNERS.length);

  for (const publicEntry of result.trustRing.keys) {
    assert.equal(publicEntry.kid, `${publicEntry.issuer}-2026-09`);
    const privateDer = Buffer.from(fs.readFileSync(path.join(target, "private", `${publicEntry.issuer}.pkcs8.der.b64`), "utf8").trim(), "base64");
    const publicDer = Buffer.from(publicEntry.publicKeyB64, "base64");
    const privateKey = crypto.createPrivateKey({ key: privateDer, format: "der", type: "pkcs8" });
    const publicKey = crypto.createPublicKey({ key: publicDer, format: "der", type: "spki" });
    const signature = crypto.sign(null, Buffer.from("contract"), privateKey);
    assert.equal(crypto.verify(null, Buffer.from("contract"), publicKey, signature), true);
  }
});

test("manifest and console summary do not contain private key material", () => {
  const { target } = freshTarget();
  const lines = [];
  const result = main(["--output", target, "--version", "rotation-2"], { log: (line) => lines.push(line) });
  const privateValue = fs.readFileSync(path.join(target, result.manifest.signers[0].file), "utf8").trim();
  const manifestText = fs.readFileSync(path.join(target, "manifest.json"), "utf8");
  const output = lines.join("\n");
  assert.doesNotMatch(manifestText, new RegExp(privateValue));
  assert.doesNotMatch(output, new RegExp(privateValue));
  assert.match(output, /nicht ausgegeben/);
});

test("builds a rotation-overlap ring from a validated previous public ring", () => {
  const oldBundle = freshTarget("old");
  generateProvisioningBundle({ output: oldBundle.target, version: "2026-09", repoRoot: path.join(oldBundle.target, "repo") });
  const nextBundle = freshTarget("next");
  const result = generateProvisioningBundle({
    output: nextBundle.target,
    version: "2026-10",
    previousTrustRing: path.join(oldBundle.target, "public-trust-ring.json"),
    repoRoot: path.join(nextBundle.target, "repo"),
  });
  assert.equal(result.manifest.previousPublicKeyCount, SIGNERS.length);
  assert.equal(result.trustRing.keys.length, SIGNERS.length * 2);
  assert.equal(new Set(result.trustRing.keys.map((entry) => entry.kid)).size, SIGNERS.length * 2);
});

test("rejects malformed, foreign and colliding previous trust rings", () => {
  const malformed = freshTarget("malformed.json");
  fs.writeFileSync(malformed.target, JSON.stringify({ version: 1, algorithm: "HS256", keys: [] }));
  assert.throws(() => generateProvisioningBundle({ output: freshTarget().target, version: "next", previousTrustRing: malformed.target, repoRoot: path.join(malformed.parent, "repo") }), /Ed25519-v1/);

  const oldBundle = freshTarget("old");
  generateProvisioningBundle({ output: oldBundle.target, version: "same", repoRoot: path.join(oldBundle.target, "repo") });
  assert.throws(() => generateProvisioningBundle({ output: freshTarget().target, version: "same", previousTrustRing: path.join(oldBundle.target, "public-trust-ring.json"), repoRoot: path.join(oldBundle.parent, "repo") }), /bereits/);
});

test("copies only allowlisted public metadata from a previous ring", () => {
  const oldBundle = freshTarget("old");
  const old = generateProvisioningBundle({ output: oldBundle.target, version: "old", repoRoot: path.join(oldBundle.target, "repo") });
  const injected = JSON.parse(JSON.stringify(old.trustRing));
  injected.keys[0].privateKeyB64 = "must-not-survive";
  fs.writeFileSync(path.join(oldBundle.target, "public-trust-ring.json"), JSON.stringify(injected));
  const nextBundle = freshTarget("next");
  generateProvisioningBundle({ output: nextBundle.target, version: "new", previousTrustRing: path.join(oldBundle.target, "public-trust-ring.json"), repoRoot: path.join(nextBundle.target, "repo") });
  assert.doesNotMatch(fs.readFileSync(path.join(nextBundle.target, "public-trust-ring.json"), "utf8"), /must-not-survive|privateKeyB64/);
});

test("refuses a non-empty target and preserves its content", () => {
  const { target } = freshTarget();
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "keep.txt"), "keep");
  assert.throws(
    () => generateProvisioningBundle({ output: target, version: "2026-09", repoRoot: path.join(target, "repo") }),
    /muss leer sein/,
  );
  assert.equal(fs.readFileSync(path.join(target, "keep.txt"), "utf8"), "keep");
});

test("accepts an existing empty directory", () => {
  const { target } = freshTarget();
  fs.mkdirSync(target);
  generateProvisioningBundle({ output: target, version: "2026.09", repoRoot: path.join(target, "repo") });
  assert.equal(fs.existsSync(path.join(target, "public-trust-ring.json")), true);
});

test("refuses repository destinations and unsafe versions before writing keys", () => {
  const { parent } = freshTarget();
  const repoRoot = path.join(parent, "repo");
  fs.mkdirSync(repoRoot);
  const insideRepo = path.join(repoRoot, "generated-keys");
  assert.throws(() => generateProvisioningBundle({ output: insideRepo, version: "2026-09", repoRoot }), /ausserhalb/);
  assert.equal(fs.existsSync(insideRepo), false);
  assert.throws(() => generateProvisioningBundle({ output: path.join(parent, "bad"), version: "../bad", repoRoot }), /sichere Zeichen/);
  assert.equal(fs.existsSync(path.join(parent, "bad")), false);
});

test("requires values for CLI options", () => {
  assert.throws(() => main(["--output", "--version", "2026-09"]), /benoetigt einen Wert/);
  assert.throws(() => main(["--output", "somewhere", "--version"]), /benoetigt einen Wert/);
});

test("writes restrictive modes where the platform exposes POSIX mode bits", () => {
  const { target } = freshTarget();
  generateProvisioningBundle({ output: target, version: "2026-09", repoRoot: path.join(target, "repo") });
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(target).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(target, "private", `${SIGNERS[0]}.pkcs8.der.b64`)).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.join(target, "public-trust-ring.json")).mode & 0o777, 0o644);
  }
});
