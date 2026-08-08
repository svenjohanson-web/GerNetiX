"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "leistungen", "index.html"), "utf8");
const pricingPage = fs.readFileSync(path.join(root, "public", "tarife", "index.html"), "utf8");
const publicNavigation = fs.readFileSync(path.join(root, "public", "landing.js"), "utf8");
const appHtml = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const webRoutes = fs.readFileSync(path.join(root, "src", "dev", "server", "web-routes.js"), "utf8");

test("serves a public services overview without requiring a session", () => {
  assert.match(webRoutes, /\["\/leistungen", "\/leistungen\/"\][\s\S]*serveStatic\(res, publicDir, "\/leistungen\/index\.html"\)/);
  assert.doesNotMatch(webRoutes, /path: "\/leistungen"[\s\S]{0,240}requireSession/);
  assert.match(page, /GerNetiX Leistungen/);
  assert.match(page, /href="\/leistungen\/" aria-current="page">Leistungen/);
  assert.match(page, /Noch ohne Preisversprechen/);
});

test("separates learning purchases from development account tiers", () => {
  const learning = page.slice(page.indexOf('id="lernen"'), page.indexOf('id="entwicklung"'));
  const development = page.slice(page.indexOf('id="entwicklung"'), page.indexOf('class="services-extra-grid"'));

  assert.match(learning, /Kostenlose Grundlagen/);
  assert.match(learning, /Einzelkurse/);
  assert.match(learning, /Messtechnik und Fehlersuche/);
  assert.match(learning, /Embedded- und Mikrocontroller-Grundlagen/);
  assert.match(learning, /Dauerhafter Zugriff/);
  assert.match(learning, /Vorhandene Einzelkäufe sollen angerechnet/);
  assert.match(learning, /Kostenlose Inhalte erhöhen den Vergleichspreis nicht/);

  assert.match(development, /Ein Konto, drei mögliche Entwicklungsstufen/);
  assert.match(development, /Kostenlos/);
  assert.match(development, /Basic\+/);
  assert.match(development, /Premium/);
  assert.match(development, /Keine externe Entwicklungs-\/Community-KI enthalten/);
  assert.match(development, /Kleines Monatskontingent geplant/);
  assert.match(development, /Höheres Monatskontingent geplant/);
  assert.match(development, /konkrete Tokenmenge ist noch nicht festgelegt/);
  assert.match(development, /KI-Credits[\s\S]*vom Konto-Tarif getrennt/);
});

test("does not publish invented course prices or AI quotas", () => {
  assert.doesNotMatch(page, /\b\d+[,.]?\d*\s*(?:€|Euro|Tokens?)\b/i);
  assert.match(page, /Preis:.*noch nicht festgelegt/);
  assert.match(page, /Preise und konkrete KI-Kontingente werden erst veröffentlicht/);
});

test("places services beside the webshop in public and authenticated hamburger menus", () => {
  assert.match(publicNavigation, /\["\/leistungen\/", "Leistungen"\][\s\S]*\["\/tarife\/", "Konten & Tarife"\][\s\S]*\["\/shop\/", "Webshop"\]/);
  assert.match(publicNavigation, /createNavigationGroup\("Service & Shop"[\s\S]*\["\/leistungen\/", "Leistungen", "nav\.services"\][\s\S]*\["\/shop\/", "Webshop", "nav\.shop"\]/);
  const serviceMenu = appHtml.slice(appHtml.indexOf('data-i18n="platform.menu.service_shop"'), appHtml.indexOf("</details>", appHtml.indexOf('data-i18n="platform.menu.service_shop"')));
  assert.match(serviceMenu, /href="\/leistungen\/"[\s\S]*>Leistungen<\/a>/);
  assert.match(serviceMenu, /href="\/shop\/">Webshop<\/a>/);
});

test("keeps the detailed pricing page aligned with permanent course purchases", () => {
  assert.match(pricingPage, /Dauerhaft gekaufte Courses und Pakete bleiben unabhängig/);
  assert.match(pricingPage, /kein Ersatz für dauerhafte Käufe/);
  assert.doesNotMatch(pricingPage, /Vollständige Premium-Lern- und Erweiterungsbibliothek/);
  assert.doesNotMatch(pricingPage, /Breite Bibliothek getesteter Standardprojekte/);
});
