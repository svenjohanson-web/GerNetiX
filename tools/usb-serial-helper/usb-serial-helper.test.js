const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = __dirname;

test("helper is isolated and grants only GerNetiX serial access", () => {
  const source = fs.readFileSync(path.join(root, "main.js"), "utf8");
  assert.match(source, /contextIsolation: true/);
  assert.match(source, /nodeIntegration: false/);
  assert.match(source, /permission === "serial"/);
  assert.match(source, /String\(requestingOrigin \|\| ""\)\.startsWith\(platformOrigin\(\)\)/);
});
