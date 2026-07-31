const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/app/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "public/app/app.js"), "utf8");
const development = fs.readFileSync(path.join(root, "public/app/development-platform.js"), "utf8");
const server = fs.readFileSync(path.join(root, "src/dev-server.js"), "utf8");

test("development platform exposes general software units and an IDE target selection", () => {
  assert.match(html, /id="ideSoftwareUnitSelect"/);
  assert.match(development, /value="desktop_app"/);
  assert.match(development, /Getrennte Quellen und Build-Ziele/);
  assert.match(app, /software_unit_id: softwareUnit\?\.software_unit_id \|\| ""/);
  assert.match(server, /function developmentSoftwareUnits/);
  assert.match(server, /runner_status: "not_connected"/);
});
