const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "admin-config.js"), "utf8");

test("admin system-event view exposes safe Passkey investigation context", () => {
  assert.match(source, /Phase: \$\{details\.stage\}/);
  assert.match(source, /Fehlercode: \$\{details\.error_code\}/);
  assert.match(source, /Konto: \$\{item\.account_id\}/);
  assert.match(source, /Korrelation: \$\{item\.correlation_id\}/);
});
