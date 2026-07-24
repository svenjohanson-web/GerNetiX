const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const publicRoot = path.join(root, "public");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

test("removes the public product page, route and navigation links", () => {
  assert.equal(fs.existsSync(path.join(publicRoot, "produkte", "index.html")), false);
  assert.doesNotMatch(server, /url\.pathname === "\/produkte"/);

  for (const htmlPath of htmlFiles(publicRoot)) {
    const html = fs.readFileSync(htmlPath, "utf8");
    assert.doesNotMatch(html, /href="\/produkte\/"/, path.relative(publicRoot, htmlPath));
  }

  const publicDemo = fs.readFileSync(
    path.join(root, "..", "public-demo-server", "public", "index.html"),
    "utf8",
  );
  assert.doesNotMatch(publicDemo, /href="\/produkte\/"/);
});
