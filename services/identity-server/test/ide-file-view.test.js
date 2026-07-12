const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");

test("IDE view is selected automatically from the opened file", () => {
  assert.doesNotMatch(html, /data-ide-view-mode|saveSourceButton|ideToolbar/);
  assert.match(app, /const plantUml = \/\\\.\(puml\|plantuml\)\$\/i/);
  assert.match(app, /PlantUML · Quelle und Grafik/);
  assert.match(app, /const image = \/\\\.\(svg\|png\|jpe\?g\|gif\|webp\)\$\/i/);
});

test("Ctrl or Command S saves and build or flash persists first", () => {
  assert.match(app, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(app, /event\.key\.toLowerCase\(\) !== "s"/);
  assert.match(app, /async function persistCurrentSource/);
  assert.ok((app.match(/await persistCurrentSource\(project\)/g) || []).length >= 3);
});
