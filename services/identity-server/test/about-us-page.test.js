const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const publicAbout = fs.readFileSync(path.join(root, "public", "ueber-uns", "index.html"), "utf8");
const landing = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const appHtml = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "public", "app", "app.js"), "utf8");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");
const httpUtils = fs.readFileSync(path.join(root, "src", "dev", "http-utils.js"), "utf8");

test("serves a dedicated public About us chapter", () => {
  assert.match(server, /\["\/ueber-uns", "\/ueber-uns\/"\][\s\S]*serveStatic\(res, path\.join\(publicDir, "ueber-uns"\), "\/index\.html"\)/);
  assert.match(publicAbout, /Wir sind ein Ehepaar/);
  assert.match(publicAbout, /Lehramt und pädagogische Erfahrung/);
  assert.match(publicAbout, /Diplom-Ingenieur der Elektrotechnik/);
  assert.match(publicAbout, /Die KI nimmt Arbeit ab – aber nicht das Denken/);
});

test("offers the chapter in public and authenticated navigation", () => {
  assert.match(landing, /href="\/ueber-uns\/">Über uns/);
  assert.match(appHtml, /href="\/app\/about\/"[^>]*data-route="about"/);
  assert.match(appHtml, /id="aboutView"/);
  assert.match(appJs, /about: "aboutView"/);
  assert.match(appJs, /about: \[[\s\S]*Über uns/);
  assert.match(httpUtils, /account-setup\|about/);
});

test("keeps the public and internal core message consistent", () => {
  for (const phrase of [
    "Pädagogik trifft Elektrotechnik.",
    "Wir sind ein Ehepaar.",
    "Diplom-Ingenieur der Elektrotechnik",
    "Menschen lernen unterschiedlich.",
    "Die KI nimmt Arbeit ab – aber nicht das Denken.",
    "Denn wer versteht, kann entwickeln. Und wer entwickeln kann, kann erschaffen.",
  ]) {
    assert.match(publicAbout, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(appHtml, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
