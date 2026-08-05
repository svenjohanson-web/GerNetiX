"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { normalizeAppPath } = require("../src/dev/http-utils");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("wires the generic Project-App into the authenticated platform shell", () => {
  const app = read("public/app/app.js");
  const shell = read("public/app/app-shell-controller.js");
  const html = read("public/app/index.html");
  assert.match(app, /"project-app": "projectAppView"/);
  assert.match(shell, /projectApp\(\)\.render/);
  assert.match(html, /id="projectAppView"/);
  assert.doesNotMatch(html, /<script[^>]+project-app-renderer\.js/);
  assert.doesNotMatch(html, /<script[^>]+project-app-controller\.js/);
  assert.match(shell, /async function loadProjectAppAssets\(\)/);
  assert.match(shell, /loadPlatformScript\("\/app\/project-app-renderer\.js/);
  assert.match(shell, /loadPlatformScript\("\/app\/project-app-controller\.js/);
  assert.match(read("public/app/project-app-controller.js"), /bindings: snapshot\.bindings \|\| \{\}/);
  assert.match(read("public/app/project-app-controller.js"), /project-app\?refresh=\$\{cacheKey\}/);
});

test("serves the Project-App as a direct authenticated SPA entry point", () => {
  assert.equal(normalizeAppPath("/app/project-app/"), "/index.html");
});

test("offers the Project-App only for personal projects that contain its manifest", () => {
  const controller = read("public/app/app-project-controller.js");
  const server = read("src/dev-server.js");
  assert.match(controller, /source\.path === "project-app\/manifest\.json"/);
  assert.match(controller, /data-open-project-app/);
  assert.match(controller, /\/app\/project-app\/\?project=/);
  assert.match(server, /source_files: project\.source_files \|\| learningDefinition\.source_files/);
  assert.match(server, /source_files: project\.source_files \|\| \[\{ path: primarySourcePath/);
});
