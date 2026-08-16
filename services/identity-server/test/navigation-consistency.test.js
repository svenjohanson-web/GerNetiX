"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { authenticatedGroup, authenticatedItem, navigationModel } = require("../test-support/navigation-model");

const serviceRoot = path.join(__dirname, "..");
const publicRoot = path.join(serviceRoot, "public");
const version = "20260816-unified-navigation-1";
const sharedScripts = `<script src="/navigation-model.js?v=${version}"></script><script src="/landing.js?v=${version}"></script>`;

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(target);
    return entry.name.endsWith(".html") ? [target] : [];
  });
}

test("all customer-facing public headers use one versioned navigation model", () => {
  const identityPages = htmlFiles(publicRoot).filter((file) => {
    if (file.includes(`${path.sep}app${path.sep}index.html`)) return false;
    return fs.readFileSync(file, "utf8").includes('class="site-header"');
  });
  const demoPage = path.join(serviceRoot, "..", "public-demo-server", "public", "index.html");

  for (const file of [...identityPages, demoPage]) {
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /id="publicMenuButton"/, file);
    assert.match(html, /id="publicMenu"/, file);
    assert.ok(html.includes(sharedScripts), `${file} must load the shared model directly before landing.js`);
  }
});

test("authenticated app and public pages derive every group from the same model", () => {
  const landing = fs.readFileSync(path.join(publicRoot, "landing.js"), "utf8");
  const appRenderer = fs.readFileSync(path.join(publicRoot, "app", "app-navigation.js"), "utf8");
  const appHtml = fs.readFileSync(path.join(publicRoot, "app", "index.html"), "utf8");

  assert.match(landing, /const navigationModel = window\.GerNetiXNavigationModel/);
  assert.match(landing, /authenticated\.groups\.map/);
  assert.match(appRenderer, /window\.GerNetiXNavigationModel\?\.authenticated/);
  assert.match(appRenderer, /model\.groups\.map/);
  assert.match(appHtml, new RegExp(`/navigation-model\\.js\\?v=${version}`));
  assert.match(appHtml, new RegExp(`/app/app-navigation\\.js\\?v=${version}`));
  assert.match(appHtml, /<nav id="mainMenu"[^>]*><\/nav>/);
});

test("the shared learning group includes the reference library in every authenticated header", () => {
  const learning = authenticatedGroup("platform.menu.learn_develop");
  assert.ok(learning.items.includes(authenticatedItem("/app/nachschlagewerke/")));
  assert.equal(authenticatedItem("/app/nachschlagewerke/").label, "Nachschlagewerke");
  assert.equal(navigationModel.authenticated.groups.length, 4);
});
