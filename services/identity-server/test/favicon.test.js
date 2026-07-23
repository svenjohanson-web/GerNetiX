const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.join(__dirname, "..", "public");
const httpUtils = fs.readFileSync(path.join(__dirname, "..", "src", "dev", "http-utils.js"), "utf8");
const pages = [
  "index.html",
  "app/index.html",
  "app/auth/index.html",
  "community/index.html",
  "downloads/index.html",
  "flashbox-einrichten/index.html",
  "nachbauprojekte/index.html",
  "produkte/index.html",
  "shop/index.html",
  "webserial-test/index.html",
];

test("uses one cache-busted favicon on every public HTML entry point", () => {
  for (const page of pages) {
    const html = fs.readFileSync(path.join(publicRoot, page), "utf8");
    assert.match(html, /rel="icon" href="\/gernetix-gx-browser-32\.png" type="image\/png" sizes="32x32"/, page);
    assert.match(html, /rel="shortcut icon" href="\/gernetix-gx-browser\.ico" type="image\/x-icon"/, page);
    assert.match(html, /rel="apple-touch-icon" href="\/gernetix-gx-apple-touch\.png" sizes="180x180"/, page);
  }
});

test("keeps the favicon asset and installable app manifest aligned", () => {
  const favicon = fs.readFileSync(path.join(publicRoot, "favicon.svg"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(publicRoot, "app", "manifest.webmanifest"), "utf8"));
  assert.match(favicon, /viewBox="0 0 64 64"/);
  assert.deepEqual(manifest.icons.map((icon) => icon.src), [
    "/gernetix-gx-app-192.png",
    "/gernetix-gx-app-512.png",
  ]);
  for (const asset of ["gernetix-gx-browser-32.png", "gernetix-gx-browser.ico", "gernetix-gx-apple-touch.png", "gernetix-gx-app-192.png", "gernetix-gx-app-512.png"]) {
    assert.ok(fs.statSync(path.join(publicRoot, asset)).size > 0, asset);
  }
  assert.match(httpUtils, /"\.ico": "image\/x-icon"/);
});
