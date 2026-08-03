"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { staticCacheControl } = require("../src/dev/http-utils");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const webRoutes = fs.readFileSync(path.join(root, "src", "dev", "server", "web-routes.js"), "utf8");
const ide = fs.readFileSync(path.join(root, "public", "app", "app-ide-controller.js"), "utf8");
const builds = fs.readFileSync(path.join(root, "public", "app", "app-device-build-controller.js"), "utf8");
const devServer = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");

test("platform scripts download in parallel and use versioned immutable URLs", () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)src="([^"]+)"[^>]*><\/script>/g)];
  assert.ok(scripts.length >= 50);
  assert.equal(scripts.every((match) => /\bdefer\b/.test(match[1])), true);
  assert.equal(scripts.every((match) => match[2].includes("?v=")), true);
  assert.match(webRoutes, /versioned: url\.searchParams\.has\("v"\)/);
  assert.equal(staticCacheControl("/app/app.js", { versioned: true }), "public, max-age=31536000, immutable");
  assert.equal(staticCacheControl("/app/app.js"), "no-store");
  assert.equal(staticCacheControl("/app/index.html", { versioned: true }), "no-store");
});

test("IDE contents do not wait for USB discovery or start a duplicate route load", () => {
  const loadStart = ide.indexOf("async function loadIdeProject()");
  const loadEnd = ide.indexOf("\nfunction ideLayoutStorageKey", loadStart);
  const loadBody = ide.slice(loadStart, loadEnd);
  assert.match(loadBody, /void refreshUsbPorts\(false\)/);
  assert.doesNotMatch(loadBody, /await refreshUsbPorts\(false\)/);
  assert.match(loadBody, /const sources = await loadProjectSources\(project\)/);
  assert.match(ide, /const projectSourceListLoads = new Map\(\)/);
  assert.match(ide, /projectSourceListLoads\.has\(project\.id\)/);
  assert.match(ide, /const projectSourceContentLoads = new Map\(\)/);

  const openStart = builds.indexOf("async function openProjectInIde(projectId)");
  const openEnd = builds.indexOf("\nfunction continueLastProject", openStart);
  const openBody = builds.slice(openStart, openEnd);
  assert.match(openBody, /navigate\(`\/app\/ide\//);
  assert.doesNotMatch(openBody, /loadIdeProject\(/);
});

test("generated architecture and hardware files use one repository commit", () => {
  const helperStart = devServer.indexOf("async function persistGeneratedProjectSources");
  const helperEnd = devServer.indexOf("\nasync function createCommunityProjectSnapshot", helperStart);
  const helper = devServer.slice(helperStart, helperEnd);
  assert.match(helper, /\/repository\/commits/);
  assert.match(helper, /expected_head_sha: binding\.head_sha/);
  assert.match(helper, /changes: sources\.map/);
  assert.match(devServer, /persistGeneratedProjectSources\(project, sources, "Architekturansichten aktualisiert"\)/);
  assert.match(devServer, /persistGeneratedProjectSources\(project, sources, "Hardwareansichten aktualisiert"\)/);
  assert.match(devServer, /expected_head_sha: expectedHeadSha/);
});
