const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "produkte", "index.html"), "utf8");
const homepage = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const shop = fs.readFileSync(path.join(root, "public", "shop", "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");
const landingCss = fs.readFileSync(path.join(root, "public", "landing.css"), "utf8");

test("serves a public learning and development product page", () => {
  assert.match(server, /url\.pathname === "\/produkte"[\s\S]*serveStatic\(res, publicDir, "\/produkte\/index\.html"\)/);
  assert.match(page, /Von der Idee zum eigenen Projekt\./);
  assert.match(page, /Kostenlos lernen/);
  assert.match(page, /Basic\+ oder Premium/);
  assert.match(page, /Projekt-Bundles/);
  assert.match(page, /FlashBox/);
  assert.match(page, /Home Small/);
  assert.match(page, /Unterst&uuml;tzung nach Absprache/);
  assert.match(landingCss, /\.product-learning-path \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
  assert.match(landingCss, /\.product-learning-path \.product-path-intro[\s\S]*grid-column: 1 \/ -1/);
  assert.match(landingCss, /@media \(max-width: 1040px\)[\s\S]*\.product-learning-path \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
});

test("links public home and webshop navigation to the product page", () => {
  assert.match(homepage, /href="\/produkte\/">Produkte<\/a>/);
  assert.match(shop, /href="\/produkte\/">Produkte<\/a>/);
  assert.match(page, /href="\/shop\/">Zum Webshop →<\/a>/);
});
