"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const controller = fs.readFileSync(path.join(__dirname, "../public/app/development-platform.js"), "utf8");

test("component list leaves relationships to the architecture diagram", () => {
  assert.doesNotMatch(controller, /Verbunden mit/);
  assert.match(controller, /<small>\$\{escapeHtml\(templateComponentTypeLabel\(component\.abstract_type\)\)\}<\/small>/);
  assert.match(controller, /architectureDiagramForProject/);
});
