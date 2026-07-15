const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { build, readGraphDecisions } = require("../build");
const { discoverMarkdownDocuments } = require("../catalog");

const toolRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(toolRoot, "..", "..");

test("discovers maintained, generated and reconstructed documentation attempts", () => {
  const documents = discoverMarkdownDocuments(repoRoot);
  assert.ok(documents.length >= 40);
  assert.ok(documents.some((item) => item.sourcePath === "docs/system-process-application-uml.md" && item.category === "system"));
  assert.ok(documents.some((item) => item.sourcePath === "docs/generated/architecture-view.md" && item.status === "generated"));
  assert.ok(documents.some((item) => item.sourcePath === "docs/yaml-first-repository-structure.md" && item.status === "superseded"));
  assert.ok(documents.some((item) => item.sourcePath === "tools/sqlite-graph-explorer/README.md" && item.category === "model"));
});

test("reads architecture decisions from the canonical SQLite graph", () => {
  const graph = readGraphDecisions(path.join(repoRoot, "tools", "yaml-graph-sqlite", "out", "model-graph.sqlite"));
  assert.ok(graph.decisionCount >= 1);
  assert.match(graph.content, /SQLite-Graph/);
});

test("builds a file-based offline browser without a server dependency", () => {
  const result = build();
  assert.ok(result.documents >= 45);
  for (const file of ["index.html", "styles.css", "app.js", "content.js"]) {
    assert.ok(fs.existsSync(path.join(result.outputRoot, file)), `${file} missing`);
  }
  const html = fs.readFileSync(path.join(result.outputRoot, "index.html"), "utf8");
  const content = fs.readFileSync(path.join(result.outputRoot, "content.js"), "utf8");
  assert.match(html, /Offline-Lesesicht/);
  assert.match(content, /graph-architecture-decisions/);
  assert.match(content, /Rekonstruktionsarchiv/);
});
