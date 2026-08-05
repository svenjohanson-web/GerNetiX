"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { platformAppFiles, readPlatformAppSource, routeLazyPlatformAppFiles } = require("../test-support/platform-app-source");

const appRoot = path.resolve(__dirname, "../public/app");

test("platform app keeps state composition separate from domain behavior and startup bindings", () => {
  const compositionRoot = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
  const source = readPlatformAppSource();

  assert.ok(compositionRoot.split("\n").length < 250);
  assert.match(compositionRoot, /const state = \{/);
  assert.match(compositionRoot, /function deviceOnboarding\(\)/);
  assert.doesNotMatch(compositionRoot, /bootstrap\(\);/);
  assert.match(source, /async function bootstrap\(\)/);
  assert.match(source, /function renderIdeShell\(\)/);
  assert.match(source, /async function startBuild\(\)/);

  let previousIndex = -1;
  for (const file of platformAppFiles) {
    if (routeLazyPlatformAppFiles.has(file)) {
      assert.doesNotMatch(html, new RegExp(`/app/${file.replaceAll(".", "\\.")}\\?v=`));
      continue;
    }
    const currentIndex = html.indexOf(`/app/${file}?v=`);
    assert.ok(currentIndex > previousIndex, `${file} must be loaded in module order`);
    previousIndex = currentIndex;
  }
});
