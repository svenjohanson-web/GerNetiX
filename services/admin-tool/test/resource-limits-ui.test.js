const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

test("resource limits show understandable units and explain zero", () => {
  assert.match(html, /Speicher <span class="table-unit">\(MiB\)<\/span>/);
  assert.match(html, /Monatlicher Traffic <span class="table-unit">\(MiB\)<\/span>/);
  assert.match(html, /0 bedeutet bei Speicher und Traffic: unbegrenzt/);
  assert.match(client, /bytesToMebibytes\(policy\.max_storage_bytes\)/);
  assert.match(client, /mebibytesToBytes\(input\.value\)/);
});
