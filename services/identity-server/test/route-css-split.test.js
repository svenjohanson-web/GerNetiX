"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const sharedCss = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const hardwareCss = fs.readFileSync(path.join(appRoot, "hardware-lab-route.css"), "utf8");
const communityCss = fs.readFileSync(path.join(appRoot, "community-routes.css"), "utf8");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const shell = fs.readFileSync(path.join(appRoot, "app-shell-controller.js"), "utf8");

function assertBalancedBraces(source, fileName) {
  let depth = 0;
  for (const character of source) {
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    assert.ok(depth >= 0, `${fileName} contains an unmatched closing brace`);
  }
  assert.equal(depth, 0, `${fileName} contains an unmatched opening brace`);
}

test("keeps the extracted route styles complete and syntactically balanced", () => {
  assertBalancedBraces(hardwareCss, "hardware-lab-route.css");
  assertBalancedBraces(communityCss, "community-routes.css");

  for (const selector of [
    ".hardware-lab-view",
    "html.initial-hardware-lab-route #hardwareLabView.hidden",
    ".hardware-lab-chat-messages",
    ".hardware-lab-profile-section",
    ".hardware-lab-send-button",
  ]) assert.match(hardwareCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const selector of [
    ".community-layout",
    ".messages-shell",
    ".message-compose-dialog",
    ".community-marketplace-grid",
    ".project-ideas-layout",
    ".community-portal-nav",
    ".project-showcase-layout",
  ]) assert.match(communityCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(hardwareCss, /@media \(max-width: 620px\)/);
  assert.match(communityCss, /@media \(max-width: 760px\)/);
  assert.match(communityCss, /@media \(max-width: 520px\)/);
});

test("does not duplicate route-exclusive selectors in the global stylesheet", () => {
  for (const selector of [
    ".hardware-lab-view",
    ".hardware-lab-layout",
    ".hardware-lab-chat-messages",
    ".hardware-lab-profile-section",
    ".community-layout",
    ".messages-shell",
    ".message-compose-dialog",
    ".community-marketplace-grid",
    ".marketplace-publish-panel",
    ".project-ideas-layout",
    ".community-portal-nav",
    ".project-showcase-layout",
  ]) assert.doesNotMatch(sharedCss, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(sharedCss, /\.dashboard-community-summary/);
  assert.match(sharedCss, /\/\* Standard AI chat pattern:/);
  assert.match(sharedCss, /\.ai-chat \.ai-chat__message/);
  assert.doesNotMatch(sharedCss, /\.ai-chat \.hardware-lab-message(?:\.is-error)? > p/);
  assert.match(hardwareCss, /\.ai-chat \.hardware-lab-message > p/);
});

test("loads route styles only with their matching route assets", () => {
  assert.doesNotMatch(html, /hardware-lab-route\.css|community-routes\.css/);
  assert.match(shell, /loadPlatformStyle\(`\/app\/hardware-lab-route\.css\?v=\$\{version\}`\)/);
  assert.match(shell, /loadPlatformStyle\(`\/app\/community-routes\.css\?v=\$\{version\}`\)/);
  assert.match(shell, /link\.rel = "stylesheet"/);
  assert.match(shell, /link\.dataset\.lazyHref = href/);
});
