const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

test("resource limits show understandable units and explain zero", () => {
  assert.match(html, /Speicher <span class="table-unit">\(MiB\)<\/span>/);
  assert.match(html, /Warnung <span class="table-unit">\(%\)<\/span>/);
  assert.match(html, /Monatlicher Traffic <span class="table-unit">\(MiB\)<\/span>/);
  assert.match(html, /Debug-Inaktivität <span class="table-unit">\(Stunden\)<\/span>/);
  assert.match(html, /0 bedeutet bei Speicher und Traffic: unbegrenzt/);
  assert.match(client, /bytesToMebibytes\(policy\.max_storage_bytes\)/);
  assert.match(client, /mebibytesToBytes\(input\.value\)/);
  assert.match(html, /Begruendung/);
  assert.match(client, /policy\.policy_version/);
  assert.match(client, /Bitte begruende die Policy-Aenderung/);
  assert.match(html, /Wirksame serverseitige Aufbewahrung/);
  assert.match(client, /build_policy/);
  assert.match(client, /artifact\.retention_days/);
  assert.match(client, /incremental_cache\?\.ttl_ms/);
  assert.match(client, /storage_warning_threshold_percent/);
  assert.match(client, /debug_session_idle_hours/);
  assert.match(client, /renderResourceAccountRow/);
  assert.match(client, /über Kontingent/);
  assert.match(html, /<th>Limit<\/th><th>Auslastung<\/th><th>Status<\/th>/);
});
