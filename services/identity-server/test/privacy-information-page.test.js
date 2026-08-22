"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const privacyHtml = fs.readFileSync(path.join(root, "public/datenschutz/index.html"), "utf8");
const routes = fs.readFileSync(path.join(root, "src/dev/server/web-routes.js"), "utf8");
const navigation = fs.readFileSync(path.join(root, "public/navigation-model.js"), "utf8");
const authHtml = fs.readFileSync(path.join(root, "public/app/auth/index.html"), "utf8");

test("public privacy information covers the account-email transparency structure", () => {
  for (const expected of [
    "Arbeitsstand – noch nicht rechtlich freigegeben",
    "Verantwortlicher",
    "Postanschrift",
    "Rechtsgrundlage",
    "Empfänger und Datenwege",
    "Aufbewahrung und Löschung",
    "Auskunft",
    "Berichtigung",
    "Löschung",
    "Aufsichtsbehörde",
    "Automatisierte Entscheidungen",
    "IONOS Mail",
  ]) assert.match(privacyHtml, new RegExp(expected));

  assert.match(privacyHtml, /nicht für Werbung, Newsletter, Empfehlungen, Profilbildung/);
  assert.match(privacyHtml, /kein Werbe- oder Analyse-Cookie/);
  assert.match(privacyHtml, /Vor Veröffentlichung: vollständiger Name/);
  assert.match(privacyHtml, /konkrete Löschfristen/);
});

test("privacy information is public, linked, and does not demand acknowledgement", () => {
  assert.match(routes, /\["\/datenschutz", "\/datenschutz\/"\][\s\S]*publicDir, "datenschutz"/);
  assert.doesNotMatch(routes.match(/for \(const routePath of \["\/datenschutz"[\s\S]*?\n  \}/)?.[0] || "", /requireSession/);
  assert.match(navigation, /href: "\/datenschutz\/", label: "Datenschutz"/);
  assert.match(authHtml, /href="\/datenschutz\/"[\s\S]*keine Zustimmung erforderlich/);
  assert.doesNotMatch(privacyHtml, /<form|type="checkbox"|zur Kenntnis genommen/i);
});
