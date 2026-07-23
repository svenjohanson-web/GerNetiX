const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
test("does not expose a dedicated vision page in the internal app", () => {
  assert.doesNotMatch(html, /href="\/app\/vision\/"/);
  assert.doesNotMatch(html, /id="visionView"/);
  assert.doesNotMatch(app, /vision: "visionView"/);
  assert.doesNotMatch(app, /route: "\/app\/vision\/"/);
  assert.match(app, /return routeMap\[route\] \? route : "dashboard"/);
});
