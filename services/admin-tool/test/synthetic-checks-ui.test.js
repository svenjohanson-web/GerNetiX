"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");
const scheduler = fs.readFileSync(path.join(__dirname, "..", "scripts", "run-synthetic-checks.js"), "utf8");
const service = fs.readFileSync(path.join(__dirname, "..", "src", "services", "admin-service.js"), "utf8");

test("admin monitoring exposes persisted read-only synthetic core preflights", () => {
  assert.match(html, /id="syntheticChecksTitle">Synthetische Kernablaeufe/);
  assert.match(html, /id="runSyntheticChecksButton"/);
  assert.match(html, /ohne Konten, Projekte, Builds oder Geraete zu veraendern/);
  assert.match(client, /\/api\/admin\/synthetic-checks\/run/);
  for (const checkId of ["login_ui", "project_storage", "build_coordination", "flash_catalog"]) {
    assert.match(service, new RegExp(checkId));
  }
  assert.match(scheduler, /\/api\/internal\/synthetic-checks\/run/);
  assert.match(scheduler, /readOptionalInternalApiAuthConfig\(process\.env, "admin-tool"\)/);
  assert.match(scheduler, /operations\.synthetic_checks\.run/);
});
