"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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
  assert.match(html, /project-app-renderer\.js/);
  assert.match(html, /project-app-controller\.js/);
});

test("offers the Project-App only for personal projects that contain its manifest", () => {
  const controller = read("public/app/app-project-controller.js");
  assert.match(controller, /source\.path === "project-app\/manifest\.json"/);
  assert.match(controller, /data-open-project-app/);
  assert.match(controller, /\/app\/project-app\/\?project=/);
});

