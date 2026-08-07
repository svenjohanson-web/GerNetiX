const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { normalizeAppPath } = require("../src/dev/http-utils");

const publicRoot = path.resolve(__dirname, "../public");
const homepage = fs.readFileSync(path.join(publicRoot, "index.html"), "utf8");
const rebuildPage = fs.readFileSync(path.join(publicRoot, "nachbauprojekte/nexi-sprachassistent/index.html"), "utf8");
const appHtml = fs.readFileSync(path.join(publicRoot, "app/index.html"), "utf8");
const appJs = fs.readFileSync(path.join(publicRoot, "app/app.js"), "utf8");
const shell = fs.readFileSync(path.join(publicRoot, "app/app-shell-controller.js"), "utf8");

test("routes the Nexi account call to a dedicated product entry", () => {
  assert.match(homepage, /next=%2Fapp%2Fnexi%2F/);
  assert.doesNotMatch(homepage, /next=%2Fapp%2Flearning-project-overview[^\"]*/);
  assert.doesNotMatch(rebuildPage, /learning-project-overview\/?\?catalog=nexi-voice-assistant/);
  assert.equal(normalizeAppPath("/app/nexi/"), "/index.html");
  assert.equal(normalizeAppPath("/app/nexi"), "/index.html");
});

test("keeps the Nexi product entry independent from the learning product", () => {
  const view = appHtml.match(/<section id="nexiView"[\s\S]*?<\/section>\s*<\/section>/)?.[0] || "";
  assert.match(appJs, /nexi: "nexiView"/);
  assert.match(view, /Nexi einrichten/);
  assert.match(view, /unabhängig von Lernprojekten/);
  assert.match(view, /href="\/app\/learn\/\?catalog=nexi-voice-assistant"/);
  assert.match(view, /href="\/app\/development-platform\/"/);
  assert.doesNotMatch(view, /learning-project-overview/);
  assert.match(shell, /if \(route === "nexi"\) return "applications"/);
});
