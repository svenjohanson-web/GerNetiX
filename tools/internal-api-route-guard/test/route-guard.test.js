"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  discoverRouteSources,
  fingerprintFiles,
  updateReviewedSources,
  validateManifest,
} = require("../index");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-route-guard-"));
  fs.mkdirSync(path.join(root, "services", "alpha", "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "inventory.md"), "# Inventar\n\n## Interne Routen\n");
  const route = "services/alpha/src/http-app.js";
  fs.writeFileSync(path.join(root, route), 'if (req.method === "GET") return true;\n');
  const manifest = {
    version: 1,
    inventory: "docs/inventory.md",
    services: {
      alpha: {
        inventorySection: "Interne Routen",
        classes: ["internal-service"],
        files: [route],
        fingerprint: fingerprintFiles(root, [route]),
      },
    },
  };
  return { root, route, manifest };
}

test("accepts a reviewed and classified route source", () => {
  const { root, manifest } = fixture();
  assert.deepEqual(validateManifest({ repoRoot: root, manifest }).errors, []);
});

test("discovers Identity-style registry routes without treating ordinary clients as routes", () => {
  const { root } = fixture();
  fs.writeFileSync(path.join(root, "services", "alpha", "src", "account-routes.js"), 'registry.register({ method: "GET", path: "/api/account" });\n');
  fs.writeFileSync(path.join(root, "services", "alpha", "src", "client.js"), 'fetch(url, { method: req.method });\n');
  assert.deepEqual(discoverRouteSources(root).get("alpha"), [
    "services/alpha/src/account-routes.js",
    "services/alpha/src/http-app.js",
  ]);
});

test("fails when a route is added inside an already classified file", () => {
  const { root, route, manifest } = fixture();
  fs.appendFileSync(path.join(root, route), 'if (req.method === "POST") return true;\n');
  assert.match(validateManifest({ repoRoot: root, manifest }).errors.join("\n"), /Routeninhalt/);
});

test("fails when a new route source or service has no classification", () => {
  const { root, manifest } = fixture();
  fs.mkdirSync(path.join(root, "services", "beta", "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "services", "beta", "src", "http-app.js"), "module.exports = () => {};\n");
  const errors = validateManifest({ repoRoot: root, manifest }).errors.join("\n");
  assert.match(errors, /Nicht klassifizierter HTTP-Service: beta/);
});

test("rejects invalid classes and missing inventory sections", () => {
  const { root, manifest } = fixture();
  manifest.services.alpha.classes = ["trusted-somehow"];
  manifest.services.alpha.inventorySections = ["Nicht vorhanden"];
  delete manifest.services.alpha.inventorySection;
  const errors = validateManifest({ repoRoot: root, manifest }).errors.join("\n");
  assert.match(errors, /unbekannte Zugriffsklasse/);
  assert.match(errors, /Inventarabschnitt fehlt/);
});

test("review update refreshes known files but refuses unknown services", () => {
  const { root, route, manifest } = fixture();
  fs.appendFileSync(path.join(root, route), "// reviewed\n");
  updateReviewedSources({ repoRoot: root, manifest });
  assert.deepEqual(validateManifest({ repoRoot: root, manifest }).errors, []);

  fs.mkdirSync(path.join(root, "services", "beta", "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "services", "beta", "src", "http-app.js"), "module.exports = () => {};\n");
  assert.throws(() => updateReviewedSources({ repoRoot: root, manifest }), /manuell klassifiziert/);
});
