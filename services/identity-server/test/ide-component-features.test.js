const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("IDE exposes component properties and an embedded device webserver view", () => {
  assert.match(html, /id="ideComponentFeaturesView"/);
  assert.match(html, /id="ideDeviceWebView"/);
  assert.match(app, /Komponentenkonfiguration/);
  assert.match(app, /Webserver des Entwicklungsprojekts/);
  assert.match(app, /<iframe title="Device-Webserver"/);
});

test("basis features are visibly immutable and project web extensions remain configurable", () => {
  assert.match(app, /\["wifi", "mqtt", "ota", "http", "webserver"\]/);
  assert.match(app, /Basissoftware · unveränderlich/);
  assert.match(app, /Messwertdiagramm/);
  assert.match(server, /component-features/);
  assert.match(server, /handleProjectComponentFeatures/);
});
