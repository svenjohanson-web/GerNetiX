"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const repoRoot = path.resolve(__dirname, "..", "..");
const graphPath = path.join(repoRoot, "tools", "yaml-graph-sqlite", "out", "model-graph.sqlite");
const baselinePath = path.join(__dirname, "graph-baseline.json");

function count(db, table) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

function inspectGraph() {
  const bytes = fs.readFileSync(graphPath);
  const db = new DatabaseSync(graphPath, { readOnly: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").all().map((row) => row.integrity_check);
    if (integrity.length !== 1 || integrity[0] !== "ok") {
      throw new Error(`SQLite integrity check failed: ${integrity.join(", ")}`);
    }
    const validationErrors = Object.fromEntries(
      db.prepare("SELECT severity, COUNT(*) AS count FROM validation_errors GROUP BY severity ORDER BY severity")
        .all()
        .map((row) => [row.severity, row.count]),
    );
    return {
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      artifacts: count(db, "artifacts"),
      relationships: count(db, "relationships"),
      graph_authored_artifacts: count(db, "graph_authored_artifacts"),
      graph_authored_relationships: count(db, "graph_authored_relationships"),
      validation_errors: validationErrors,
    };
  } finally {
    db.close();
  }
}

const actual = inspectGraph();
const expected = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error("Canonical graph differs from tools/ci/graph-baseline.json.");
  console.error(`Expected: ${JSON.stringify(expected, null, 2)}`);
  console.error(`Actual:   ${JSON.stringify(actual, null, 2)}`);
  process.exit(1);
}
console.log(`Graph baseline valid: ${actual.artifacts} artifacts, ${actual.relationships} relationships`);
