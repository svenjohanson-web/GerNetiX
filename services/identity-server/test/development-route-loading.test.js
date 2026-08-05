"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readPlatformAppSource } = require("../test-support/platform-app-source");

const appRoot = path.resolve(__dirname, "../public/app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = readPlatformAppSource();
const development = fs.readFileSync(path.join(appRoot, "development-platform.js"), "utf8");

const developmentAssets = [
  "development-hardware-model.js",
  "development-component-metamodel.js",
  "project-feedback-ui.js",
  "project-repository-card.js",
  "development-platform.js",
];

test("keeps the development package out of the global app shell", () => {
  for (const asset of developmentAssets) {
    assert.doesNotMatch(html, new RegExp(`<script[^>]+${asset.replaceAll(".", "\\.")}`));
    assert.match(app, new RegExp(`loadPlatformScript\\("/app/${asset.replaceAll(".", "\\.")}`));
  }
});

test("loads and initializes the development package only for its two routes", () => {
  assert.match(app, /\["development-platform", "development-hardware"\]\.includes\(route\)/);
  const loader = app.match(/async function loadRouteAssets\(route\)[\s\S]*?\n}\n\nfunction applyDevelopmentSummary/)?.[0] || "";
  assert.match(loader, /Promise\.all\(\[[\s\S]*development-hardware-model\.js[\s\S]*project-repository-card\.js/);
  assert.ok(loader.indexOf("development-platform.js") > loader.indexOf("await Promise.all"));
  assert.match(loader, /developmentPlatform\(\)\.init\(\)/);
  assert.match(app, /function routeAssetsMissing\(route\)[\s\S]*typeof DevelopmentPlatform === "undefined"/);
});

test("preserves direct links and SPA navigation while binding development events once", () => {
  assert.match(app, /Promise\.all\(\[refreshBootstrap\(initialRoute\), loadRouteAssets\(initialRoute\)\]\)/);
  assert.match(app, /function activateCurrentRoute\(\)[\s\S]*routeAssetsMissing\(activeRoute\)[\s\S]*hydrateRouteAfterNavigation/);
  assert.match(app, /async function hydrateRouteAfterNavigation[\s\S]*loadRouteAssets\(activeRoute\)/);
  assert.match(development, /let initialized = false/);
  assert.match(development, /function init\(\) \{\s*if \(initialized\) return;\s*initialized = true;/);
});

test("buffers development bootstrap data until the route package is available", () => {
  assert.match(app, /function applyDevelopmentSummary\(summary = null\)/);
  assert.match(app, /state\.developmentAssistantConfig = summary\.development_assistant/);
  assert.match(app, /state\.developmentProjectTemplates = summary\.development_project_templates/);
  assert.match(app, /if \(typeof DevelopmentPlatform === "undefined"\) return/);
  assert.match(app, /applyDevelopmentSummary\(\);/);
});
