const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { importGraph } = require("../import-yaml-graph");
const {
  openAuthoringDatabase,
  upsertAuthoredArtifact,
  upsertAuthoredRelationship
} = require("../src/graph-authoring");

test("authored sqlite graph artifacts survive yaml bootstrap import", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-graph-authoring-")), "model-graph.sqlite");
  const db = openAuthoringDatabase(dbPath);
  upsertAuthoredArtifact(db, {
    id: "architecture.test_graph_first_rule",
    type: "architecture_decision",
    title: "Graph-first Testregel",
    status: "approved",
    ownerDomain: "CrossDomain",
    summary: "Diese Regel wurde direkt im SQLite-Graphen gepflegt.",
    properties: {
      rules: ["YAML ist nicht die Pflegequelle fuer diese Testregel."]
    }
  });
  upsertAuthoredRelationship(db, {
    from: "architecture.test_graph_first_rule",
    relation: "references",
    to: "requirement.architecture_discovery_guided_by_llm"
  });
  db.close();

  const summary = importGraph(dbPath);
  assert.equal(summary.error_count, 0);

  const imported = new DatabaseSync(dbPath);
  const artifact = imported.prepare("SELECT * FROM artifacts WHERE id = ?").get("architecture.test_graph_first_rule");
  const relation = imported.prepare(`
      SELECT * FROM relationships
      WHERE source_artifact_id = ?
      AND relationship_type_id = 'references'
      AND target_artifact_id = 'requirement.architecture_discovery_guided_by_llm'
  `).get("architecture.test_graph_first_rule");
  const authored = imported.prepare("SELECT * FROM graph_authored_artifacts WHERE id = ?").get("architecture.test_graph_first_rule");
  imported.close();

  assert.equal(artifact.artifact_type_id, "architecture_decision");
  assert.equal(artifact.source_file, "sqlite://graph_authored_artifacts");
  assert.equal(relation.origin, "graph_authoring");
  assert.ok(authored.properties_json.includes("YAML ist nicht"));
});
