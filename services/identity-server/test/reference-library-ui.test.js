"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { normalizeAppPath } = require("../src/dev/http-utils");

const appRoot = path.resolve(__dirname, "../public/app");
const read = (file) => fs.readFileSync(path.join(appRoot, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const shell = read("app-shell-controller.js");
const fragment = read("fragments/reference-library.html");
const controller = read("reference-library-controller.js");
const css = read("reference-library-route.css");

test("offers Nachschlagewerke as a dedicated authenticated menu route", () => {
  assert.match(html, /href="\/app\/nachschlagewerke\/" data-route="nachschlagewerke"/);
  // routeMap liegt seit der Entflechtung bei den Routing-Primitiven.
  assert.match(read("platform-routing.js"), /nachschlagewerke: "referenceLibraryView"/);
  assert.match(shell, /nachschlagewerke:[\s\S]*label: "Nachschlagewerke"/);
  assert.equal(normalizeAppPath("/app/nachschlagewerke/"), "/index.html");
});

test("loads the reference library view, styles and controller only on demand", () => {
  assert.doesNotMatch(html, /reference-library-controller\.js|reference-library-route\.css|id="referenceLibraryView"/);
  assert.match(shell, /route === "nachschlagewerke"[\s\S]*loadRouteFragment\("referenceLibraryView"[\s\S]*reference-library-route\.css[\s\S]*reference-library-controller\.js/);
  assert.match(fragment, /^<section id="referenceLibraryView"/);
  assert.doesNotMatch(fragment, /<script/);
});

test("provides searchable, filterable and copyable quick references", () => {
  assert.match(fragment, /id="referenceLibrarySearch"/);
  assert.match(fragment, /id="referenceLibraryCategories"/);
  assert.match(controller, /const categories = \[/);
  assert.match(controller, /const entries = \[/);
  assert.match(controller, /navigator\.clipboard\.writeText\(entry\.syntax\)/);
  assert.match(controller, /toLocaleLowerCase\("de"\)\.includes\(searchValue\)/);
  assert.match(css, /\.reference-library-entry-grid/);
  assert.match(css, /@media \(max-width: 680px\)/);
});
