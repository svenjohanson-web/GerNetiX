"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");
const marketplace = fs.readFileSync(path.join(__dirname, "..", "public", "app", "community-marketplace-controller.js"), "utf8");
const development = fs.readFileSync(path.join(__dirname, "..", "public", "app", "development-platform.js"), "utf8");
const ideas = fs.readFileSync(path.join(__dirname, "..", "public", "app", "community-ideas-controller.js"), "utf8");
const portal = fs.readFileSync(path.join(__dirname, "..", "public", "app", "community-portal-controller.js"), "utf8");

test("shop contains a community marketplace for used electronics", () => {
  const shopStart = html.indexOf('id="shopView"');
  const marketplaceStart = html.indexOf('id="communityMarketplace"');
  const billingStart = html.indexOf('id="billingView"');
  assert.ok(shopStart < marketplaceStart && marketplaceStart < billingStart);
  assert.match(html, /Gebrauchte Elektronik anbieten/);
  assert.match(html, /Zustand/);
  assert.match(html, /Preis in Euro/);
  assert.doesNotMatch(html, /Eigenes Entwicklungsprojekt veröffentlichen/);
  assert.match(marketplace, /Anbieter kontaktieren/);
  assert.match(marketplace, /Als verkauft markieren/);
  assert.match(marketplace, /\/api\/community\/marketplace\/listings/);
});

test("templates and development projects expose ratings and improvement suggestions", () => {
  assert.match(development, /data-feedback-template/);
  assert.match(development, /data-rate-development-project/);
  assert.match(development, /data-suggest-development-project/);
  assert.match(html, /project-feedback-ui\.js/);
});

test("community contains a separate project ideas workshop with discussion", () => {
  const communityStart = html.indexOf('id="communityView"');
  const ideasStart = html.indexOf('id="projectIdeasWorkshop"');
  assert.ok(communityStart < ideasStart);
  assert.match(html, /Projektideen vorstellen/);
  assert.match(html, /Hier wird nichts verkauft/);
  assert.match(html, /Suche Mitstreiter/);
  assert.match(ideas, /\/api\/community\/ideas/);
  assert.match(ideas, /Feedback, Frage oder Angebot zur Mitarbeit/);
});

test("community starts with four clear areas and a separate project showcase", () => {
  assert.match(html, /Forum &amp; Hilfe/);
  assert.match(html, /Ideenwerkstatt/);
  assert.match(html, /Projekt-Showcase/);
  assert.match(html, /Elektronik-Marktplatz/);
  assert.match(html, /Community durchsuchen/);
  assert.match(html, /Neues aus der Community/);
  assert.match(html, /Mein Community-Bereich/);
  assert.match(portal, /\/api\/community\/showcases/);
  assert.match(portal, /project_snapshot/);
  assert.match(portal, /community_unverified/);
});
