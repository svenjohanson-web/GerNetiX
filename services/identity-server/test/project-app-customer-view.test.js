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
  assert.equal(normalizeAppPath("/app/applications/"), "/index.html");
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

test("presents personal application instances as their own main area", () => {
  const app = read("public/app/app.js");
  const html = read("public/app/index.html");
  const controller = read("public/app/app-project-controller.js");
  const shell = read("public/app/app-shell-controller.js");
  assert.match(app, /applications: "applicationsView"/);
  assert.match(html, /data-route="applications"[^>]*>Meine Anwendungen<\/a>/);
  assert.match(html, /id="applicationsView"[\s\S]*id="applicationList"/);
  assert.match(html, /data-open-route="\/app\/applications\/"[\s\S]*Meine Anwendungen/);
  assert.match(controller, /function personalApplications\(\)[\s\S]*projectOrigin === "account_project"[\s\S]*hasProjectApp\(project\)/);
  assert.match(controller, /data-open-application/);
  assert.match(controller, /data-develop-application/);
  assert.match(shell, /if \(route === "applications"\) return \["devices"\]/);
  assert.match(shell, /"dashboard", "applications", "development-platform"/);
  assert.match(shell, /if \(route === "project-app"\) return "applications"/);
});
