"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "support", "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");

test("serves Support as a dedicated public page", () => {
  assert.match(server, /url\.pathname === "\/support"[\s\S]*serveStatic\(res, publicDir, "\/support\/index\.html"\)/);
  assert.match(page, /GerNetiX Support/);
  assert.match(page, /href="\/support\/" aria-current="page">Support/);
  assert.match(page, /href="\/hilfe\/"/);
  assert.match(page, /href="\/community\/"/);
});

test("sends own public or private requests through authenticated Community", () => {
  assert.match(page, /Öffentlich oder privat anfragen/);
  assert.match(page, /href="\/app\/auth\/\?next=%2Fapp%2Fcommunity%2F"/);
  assert.match(page, /keinen 24\/7-Notfall-Support/);
});

test("links Support from every public hamburger menu", () => {
  const menuPages = [
    "index.html",
    "community/index.html",
    "downloads/index.html",
    "flashbox-einrichten/index.html",
    "nachbauprojekte/index.html",
    "produkte/index.html",
    "shop/index.html",
    "app/auth/index.html",
    "app/index.html",
  ];
  for (const relativePath of menuPages) {
    const html = fs.readFileSync(path.join(root, "public", relativePath), "utf8");
    assert.match(html, /href="\/support\/">Support<\/a>/, relativePath);
  }
});
