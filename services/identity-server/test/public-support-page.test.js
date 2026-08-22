"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { authenticatedItem, navigationModel } = require("../test-support/navigation-model");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "support", "index.html"), "utf8");
const server = ["dev-server.js", path.join("dev", "server", "web-routes.js")]
  .map((file) => fs.readFileSync(path.join(root, "src", file), "utf8"))
  .join("\n");

test("serves Support as a dedicated public page", () => {
  assert.match(server, /\["\/support", "\/support\/"\][\s\S]*serveStatic\(res, publicDir, "\/support\/index\.html"\)/);
  assert.match(page, /GerNetiX Support/);
  assert.match(page, /href="\/support\/" aria-current="page">Support/);
  assert.match(page, /href="\/hilfe\/"/);
  assert.match(page, /href="\/community\/"/);
});

test("sends private support requests into the authenticated support mailbox flow", () => {
  assert.match(page, /Supportanfrage senden/);
  assert.match(page, /href="\/app\/auth\/\?next=%2Fapp%2Fcommunity%2F%3Fsupport%3D1"/);
  assert.match(page, /private GerNetiX-Support-Postfach/);
  assert.match(page, /keinen 24\/7-Notfall-Support/);
});

test("links Support from every public hamburger menu", () => {
  const menuPages = [
    "index.html",
    "community/index.html",
    "flashbox-einrichten/index.html",
    "nachbauprojekte/index.html",
    "shop/index.html",
    "app/auth/index.html",
    "app/index.html",
  ];
  for (const relativePath of menuPages) {
    const html = fs.readFileSync(path.join(root, "public", relativePath), "utf8");
    // Ohne Version festzunageln: die pflegt scripts/update-asset-versions.js.
    assert.match(html, /navigation-model\.js\?v=/, relativePath);
  }
  assert.ok(navigationModel.anonymous.some((item) => item.href === "/support/"));
  assert.equal(authenticatedItem("/support/").label, "Support");
});
