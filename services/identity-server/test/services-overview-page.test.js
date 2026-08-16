"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { authenticatedGroup, navigationModel } = require("../test-support/navigation-model");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "leistungen", "index.html"), "utf8");
const coursePage = fs.readFileSync(path.join(root, "public", "kurse", "index.html"), "utf8");
const courseSalesClient = fs.readFileSync(path.join(root, "public", "course-sales.js"), "utf8");
const pricingPage = fs.readFileSync(path.join(root, "public", "tarife", "index.html"), "utf8");
const catalogClient = fs.readFileSync(path.join(root, "public", "app", "app-project-controller.js"), "utf8");
const learningProjectService = fs.readFileSync(path.join(root, "src", "dev", "learning", "learning-project-service.js"), "utf8");
const webRoutes = fs.readFileSync(path.join(root, "src", "dev", "server", "web-routes.js"), "utf8");

test("serves a compact public services overview without requiring a session", () => {
  assert.match(webRoutes, /\["\/leistungen", "\/leistungen\/"\][\s\S]*serveStatic\(res, publicDir, "\/leistungen\/index\.html"\)/);
  assert.doesNotMatch(webRoutes, /path: "\/leistungen"[\s\S]{0,240}requireSession/);
  assert.match(page, /GerNetiX Leistungen/);
  assert.match(page, /href="\/leistungen\/" aria-current="page">Leistungen/);
  assert.match(page, /Lernen und entwickeln – auf einen Blick/);
});

test("shows learning and development together with only the three access modes", () => {
  const overview = page.slice(page.indexOf('class="services-area-grid"'), page.indexOf('class="panel services-followup"'));
  const learning = overview.slice(overview.indexOf('id="lernen"'), overview.indexOf('id="entwicklung"'));
  const development = overview.slice(overview.indexOf('id="entwicklung"'));

  assert.match(overview, /id="lernen"[\s\S]*id="entwicklung"/);
  for (const area of [learning, development]) {
    assert.match(area, />Kostenlos</);
    assert.match(area, />Abo</);
    assert.match(area, />Kaufen</);
  }
  assert.match(learning, /Kurse ansehen/);
  assert.match(development, /Abos vergleichen/);
  assert.doesNotMatch(page, /Paket 01|Messtechnik und Fehlersuche|Embedded- und Mikrocontroller-Grundlagen/);
});

test("serves course purchases and bundles on a separate public page", () => {
  assert.match(webRoutes, /\["\/kurse", "\/kurse\/"\][\s\S]*serveStatic\(res, publicDir, "\/kurse\/index\.html"\)/);
  assert.doesNotMatch(webRoutes, /path: "\/kurse"[\s\S]{0,240}requireSession/);
  assert.match(coursePage, /Kurse und Lernpakete/);
  assert.match(coursePage, /Grundlagen frei lernen/);
  assert.match(coursePage, /Bibliothek während der Laufzeit/);
  assert.match(coursePage, /Einzelkurs dauerhaft behalten/);
  assert.match(coursePage, /Messtechnik und Fehlersuche/);
  assert.match(coursePage, /Embedded- und Mikrocontroller-Grundlagen/);
  assert.match(coursePage, /Vorhandene Einzelkäufe|bereits gekaufter enthaltener Course/i);
  assert.match(coursePage, /data-selected-course/);
  assert.match(courseSalesClient, /URLSearchParams\(window\.location\.search\)/);
  assert.match(courseSalesClient, /"chicken-coop-door-smartphone-app": "Eigene Smartphone-App für die Hühnerstalltür"/);
  assert.match(courseSalesClient, /\/app\/learn\/\?catalog=/);
});

test("routes locked learning projects to course sales and enforces access on start", () => {
  assert.match(catalogClient, /function learningProjectDestination/);
  assert.match(catalogClient, /hasLearningProjectAccess\(project\)/);
  assert.match(catalogClient, /learning_course:\$\{project\.courseId\}/);
  assert.match(catalogClient, /learning_project:\$\{project\.slug\}/);
  assert.match(catalogClient, /window\.location\.assign\(destination\)/);
  assert.match(catalogClient, /href="\$\{escapeAttribute\(learningProjectPurchaseUrl\(project\)\)\}">Zugang auswählen/);
  assert.match(learningProjectService, /if \(!hasLearningProjectCatalogAccess\(definition, accountSubscription\(session\)\.entitlements\)\)/);
  assert.match(learningProjectService, /error: "learning_project_access_required"/);
  assert.match(learningProjectService, /purchase_url: learningProjectPurchaseUrl\(definition\)/);
});

test("does not publish invented course prices or AI quotas", () => {
  assert.doesNotMatch(`${page}\n${coursePage}`, /\b\d+[,.]?\d*\s*(?:€|Euro|Tokens?)\b/i);
  assert.match(coursePage, /Preis noch nicht festgelegt/);
  assert.match(page, /Noch nicht veröffentlichte Preise und Kontingente bleiben als geplant markiert/);
});

test("places services beside the webshop in public and authenticated hamburger menus", () => {
  const publicPaths = navigationModel.anonymous.map((item) => item.href);
  assert.ok(publicPaths.indexOf("/leistungen/") < publicPaths.indexOf("/tarife/"));
  assert.ok(publicPaths.indexOf("/tarife/") < publicPaths.indexOf("/shop/"));
  const servicePaths = authenticatedGroup("platform.menu.service_shop").items.map((item) => item.href);
  assert.ok(servicePaths.indexOf("/leistungen/") < servicePaths.indexOf("/shop/"));
});

test("keeps the detailed pricing page aligned with permanent course purchases", () => {
  assert.match(pricingPage, /Dauerhaft gekaufte Courses und Pakete bleiben unabhängig/);
  assert.match(pricingPage, /kein Ersatz für dauerhafte Käufe/);
  assert.doesNotMatch(pricingPage, /Vollständige Premium-Lern- und Erweiterungsbibliothek/);
  assert.doesNotMatch(pricingPage, /Breite Bibliothek getesteter Standardprojekte/);
});
