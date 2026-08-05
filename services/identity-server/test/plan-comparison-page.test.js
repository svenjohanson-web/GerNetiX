"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const serviceRoot = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(serviceRoot, "public", "tarife", "index.html"), "utf8");
const homepage = fs.readFileSync(path.join(serviceRoot, "public", "index.html"), "utf8");
const shop = fs.readFileSync(path.join(serviceRoot, "public", "shop", "index.html"), "utf8");
const app = fs.readFileSync(path.join(serviceRoot, "public", "app", "index.html"), "utf8");
const billing = fs.readFileSync(path.join(serviceRoot, "public", "app", "app-billing-controller.js"), "utf8");
const css = fs.readFileSync(path.join(serviceRoot, "public", "landing.css"), "utf8");
const routes = fs.readFileSync(path.join(serviceRoot, "src", "dev", "server", "web-routes.js"), "utf8");

test("serves one public account and plan comparison from all relevant entry points", () => {
  assert.match(routes, /\["\/tarife", "\/tarife\/"\][\s\S]*\/tarife\/index\.html/);
  assert.match(homepage, /href="\/tarife\/">Konten &amp; Tarife/);
  assert.match(shop, /href="\/tarife\/">Konten und Tarife vergleichen/);
  assert.match(app, /href="\/tarife\/">Konten und Tarife vergleichen/);
  assert.match(billing, /href="\/tarife\/">Tarifübersicht öffnen/);
});

test("separates account access, cloud plans, AI credits, recovery and Home licensing", () => {
  assert.match(page, /Nicht alles ist eine Kontoart/);
  for (const term of ["Zugang", "Cloud-Tarif", "KI-Credits", "Recovery", "Home-Lizenz"]) assert.match(page, new RegExp(term));
  assert.match(page, /Credits ersetzen keinen Tarif/);
  assert.match(page, /Wiederherstellungswege – keine Premiumstufen/);
});

test("compares free, Basic Plus and Premium without pretending proposed offers are purchasable", () => {
  assert.match(page, /Cloud Kostenlos[\s\S]*Cloud Basic\+[\s\S]*Cloud Premium/);
  assert.match(page, /Basic\+ soll zusätzliche Lernwege/);
  assert.match(page, /Solange diese Angebote noch nicht buchbar sind, musst du nichts freischalten/);
  assert.match(page, /Grundlage vorhanden/);
  assert.match(page, /Geplant/);
  assert.match(page, /Teilweise vorbereitet/);
  assert.match(page, /Bis zu 5 eigene Entwicklungsprojekte/);
  assert.match(page, /technisch bis 200 als Schutzgrenze/);
  assert.doesNotMatch(page, /\b\d+[,.]\d{2}\s*€|unbegrenzt/i);
});

test("explains Nexi progression and protects local hardware from subscription lock-in", () => {
  assert.match(page, /So wächst Nexi vom Nachbau zum persönlichen Assistenten/);
  assert.match(page, /Nachbauprojekt · ohne Konto[\s\S]*Kostenloses Konto[\s\S]*Optionale Sprach-KI/);
  assert.match(page, /Stimme per Taste aufnehmen[\s\S]*persönliche Nexi-Anwendung anlegen[\s\S]*Fragen, Geschichten und Sprachspiele ergänzen/);
  assert.match(page, /Dafür müssen drei Dinge vorliegen:[\s\S]*ausdrückliche Aktivierung[\s\S]*freigegebener KI-Anbieter[\s\S]*Kontingent oder KI-Credits/);
  assert.match(page, /Warum heute noch nicht vollständig nutzbar\?[\s\S]*Was du jetzt tun kannst:/);
  assert.match(page, /Kein Abo schaltet deine lokale Hardware ab/);
  assert.match(page, /Bereits geflashte Geräte, lokale Grundfunktionen und der Export eigener Daten bleiben erhalten/);
});

test("keeps the comparison compact and responsive", () => {
  assert.ok(page.indexOf('id="nexi-weg"') < page.indexOf('id="vergleich"'));
  assert.match(css, /\.plan-use-path \{ display: grid; grid-template-columns: repeat\(3/);
  assert.match(css, /\.plan-tier-grid \{ display: grid; grid-template-columns: repeat\(3/);
  assert.match(css, /\.plan-table-scroll \{ overflow-x: auto/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.plan-hero, \.plan-use-path, \.plan-tier-grid, \.plan-detail-grid, \.rebuild-account-grid \{ grid-template-columns: 1fr; \}/);
});
