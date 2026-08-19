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
  const server = read("src/dev/projects/project-platform-mapper.js");
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

test("keeps every project application widget readable in the shared dark theme", () => {
  const css = read("public/app/app.css");
  const html = read("public/app/index.html");
  assert.match(css, /\.project-app-widget \{[^}]*background: var\(--panel\);[^}]*color: var\(--text\);/);
  assert.doesNotMatch(css, /\.project-app-widget \{[^}]*var\(--surface, #fff\)/);
  assert.match(css, /\.project-app-widget p,[\s\S]*\.project-app-page > header p \{ color: var\(--muted\); \}/);
});

test("lets one application manage several account devices without duplicating shared settings", () => {
  const controller = read("public/app/project-app-controller.js");
  const projectController = read("public/app/app-project-controller.js");
  const server = read("src/dev/projects/project-platform-mapper.js");
  assert.match(controller, /data-project-app-device/);
  assert.match(controller, /project-app\/devices/);
  assert.match(controller, /Familienregeln und Limits gelten gemeinsam/);
  assert.match(projectController, /project\.linkedDeviceIds/);
  assert.match(server, /linkedDeviceIds: project\.linked_device_ids/);
});

test("shows and enforces Nexi hardware minimum requirements", () => {
  const controller = read("public/app/project-app-controller.js");
  const shell = read("public/app/app-shell-controller.js");
  const manifest = JSON.parse(read("src/dev/project-models/nexi-project-app-manifest.json"));
  assert.equal(manifest.hardware_requirements.processor_variant, "ESP32-S3");
  assert.deepEqual(manifest.hardware_requirements.features.map((item) => item.id), ["audio_driver", "buttons", "microphones"]);
  assert.match(controller, /Hardware-Mindestanforderungen/);
  assert.match(controller, /device\.compatible === false[\s\S]*disabled/);
  assert.match(controller, /Nicht geeignet:/);
});
