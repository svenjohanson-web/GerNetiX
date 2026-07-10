const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { runAuthoringCli } = require("./graph-authoring");

function openExistingDatabase(dbPath, importGraph) {
  if (!fs.existsSync(dbPath)) {
    const summary = importGraph(dbPath);
    console.error(`SQLite graph was missing and has been imported: ${summary.dbPath}`);
  }
  return new DatabaseSync(dbPath);
}

function printRows(rows) {
  console.log(JSON.stringify(rows, null, 2));
}

function commandSummary(dbPath, importGraph) {
  const db = openExistingDatabase(dbPath, importGraph);
  printRows(db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM artifact_types) AS artifact_types,
      (SELECT COUNT(*) FROM artifacts) AS artifacts,
      (SELECT COUNT(*) FROM relationship_types) AS relationship_types,
      (SELECT COUNT(*) FROM relationships) AS relationships,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'error') AS errors,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'warning') AS warnings
  `).all());
  db.close();
}

function commandRelations(dbPath, importGraph, direction, id) {
  const db = openExistingDatabase(dbPath, importGraph);
  const sql = direction === "outgoing"
    ? `SELECT r.source_artifact_id AS source, r.relationship_type_id AS relation, r.target_artifact_id AS target, t.artifact_type_id AS target_type, t.title AS target_title, r.source_file, r.source_line, r.origin, r.confidence
       FROM relationships r LEFT JOIN artifacts t ON t.id = r.target_artifact_id
       WHERE r.source_artifact_id = ? ORDER BY r.relationship_type_id, r.target_artifact_id`
    : `SELECT r.source_artifact_id AS source, r.relationship_type_id AS relation, r.target_artifact_id AS target, s.artifact_type_id AS source_type, s.title AS source_title, r.source_file, r.source_line, r.origin, r.confidence
       FROM relationships r LEFT JOIN artifacts s ON s.id = r.source_artifact_id
       WHERE r.target_artifact_id = ? ORDER BY r.relationship_type_id, r.source_artifact_id`;
  printRows(db.prepare(sql).all(id));
  db.close();
}

function commandTrace(dbPath, importGraph, id) {
  const db = openExistingDatabase(dbPath, importGraph);
  const allowed = new Set([
    "belongs_to",
    "contains",
    "targets",
    "realized_by",
    "supports",
    "realizes",
    "requires",
    "derives_from",
    "uses",
    "provides",
    "enabled_by",
    "enables",
    "is_view_of",
    "refines"
  ]);
  const visions = new Set(db.prepare("SELECT id FROM artifacts WHERE artifact_type_id = 'vision'").all().map((row) => row.id));
  const rows = db.prepare(`
    SELECT source_artifact_id AS source, relationship_type_id AS relation, target_artifact_id AS target
    FROM relationships
    WHERE relationship_type_id IN (${Array.from(allowed).map(() => "?").join(",")})
  `).all(...allowed);
  const byNode = new Map();
  const edgeKeys = new Set();
  function add(node, edge) {
    const key = `${node}|${edge.next}|${edge.text}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    if (!byNode.has(node)) byNode.set(node, []);
    byNode.get(node).push(edge);
  }
  for (const row of rows) {
    add(row.source, { next: row.target, text: `-[${row.relation}]-> ${row.target}` });
    add(row.target, { next: row.source, text: `<-[${row.relation}]- ${row.source}` });
  }
  const queue = [{ node: id, path: id, depth: 0, seen: new Set([id]) }];
  const found = [];
  const foundPaths = new Set();
  const bestDepth = new Map([[id, 0]]);
  while (queue.length > 0 && found.length < 50) {
    const current = queue.shift();
    if (current.depth > 0 && visions.has(current.node)) {
      if (!foundPaths.has(current.path)) {
        foundPaths.add(current.path);
        found.push({ path: current.path, depth: current.depth });
      }
      continue;
    }
    if (current.depth >= 8) continue;
    const nextEdges = byNode.get(current.node) || [];
    for (const edge of nextEdges.slice(0, 120)) {
      if (current.seen.has(edge.next)) continue;
      const nextDepth = current.depth + 1;
      if ((bestDepth.get(edge.next) ?? Infinity) < nextDepth - 1) continue;
      bestDepth.set(edge.next, Math.min(bestDepth.get(edge.next) ?? Infinity, nextDepth));
      const nextSeen = new Set(current.seen);
      nextSeen.add(edge.next);
      queue.push({
        node: edge.next,
        path: `${current.path} ${edge.text}`,
        depth: nextDepth,
        seen: nextSeen
      });
    }
  }
  printRows(found.sort((a, b) => a.depth - b.depth));
  db.close();
}

function commandIsolated(dbPath, importGraph) {
  const db = openExistingDatabase(dbPath, importGraph);
  printRows(db.prepare(`
    SELECT a.id, a.artifact_type_id AS type, a.title, a.source_file, a.source_line
    FROM artifacts a
    WHERE NOT EXISTS (SELECT 1 FROM relationships r WHERE r.source_artifact_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.target_artifact_id = a.id)
    ORDER BY a.artifact_type_id, a.id
  `).all());
  db.close();
}

function commandClusters(dbPath, importGraph) {
  const db = openExistingDatabase(dbPath, importGraph);
  const roots = db.prepare(`
    SELECT id, artifact_type_id AS type, title
    FROM artifacts
    WHERE artifact_type_id IN ('business_goal', 'business_strategy', 'business_capability', 'system_capability')
    ORDER BY artifact_type_id, id
  `).all();
  const stmt = db.prepare(`
    WITH RECURSIVE cluster(root_id, artifact_id, depth) AS (
      SELECT ?, ?, 0
      UNION
      SELECT cluster.root_id, r.source_artifact_id, cluster.depth + 1
      FROM cluster
      JOIN relationships r ON r.target_artifact_id = cluster.artifact_id
      WHERE cluster.depth < 6
      UNION
      SELECT cluster.root_id, r.target_artifact_id, cluster.depth + 1
      FROM cluster
      JOIN relationships r ON r.source_artifact_id = cluster.artifact_id
      WHERE cluster.depth < 6
    )
    SELECT COUNT(DISTINCT artifact_id) AS size FROM cluster
  `);
  printRows(roots.map((root) => ({ ...root, cluster_size: stmt.get(root.id, root.id).size })));
  db.close();
}

function commandErrors(dbPath, importGraph) {
  const db = openExistingDatabase(dbPath, importGraph);
  printRows(db.prepare(`
    SELECT severity, code, message, source_file, source_line, artifact_id, relationship_id
    FROM validation_errors
    ORDER BY CASE severity WHEN 'error' THEN 0 ELSE 1 END, code, source_file, source_line
  `).all());
  db.close();
}

function parseDbPath(args, defaultDbPath, repoRoot) {
  const index = args.indexOf("--db");
  if (index === -1) return defaultDbPath;
  return path.resolve(repoRoot, args[index + 1]);
}

function runCli({ args, defaultDbPath, repoRoot, importGraph }) {
  const command = args[0] || "import";
  const dbPath = parseDbPath(args, defaultDbPath, repoRoot);

  if (command === "import") {
    console.log(JSON.stringify(importGraph(dbPath), null, 2));
    return;
  }
  if (command === "upsert-artifact" || command === "upsert-relationship" || command === "delete-relationship") {
    return runAuthoringCli({ args, defaultDbPath: dbPath });
  }
  if (command === "summary") return commandSummary(dbPath, importGraph);
  if (command === "outgoing") return commandRelations(dbPath, importGraph, "outgoing", args[1]);
  if (command === "incoming") return commandRelations(dbPath, importGraph, "incoming", args[1]);
  if (command === "trace") return commandTrace(dbPath, importGraph, args[1]);
  if (command === "isolated") return commandIsolated(dbPath, importGraph);
  if (command === "clusters") return commandClusters(dbPath, importGraph);
  if (command === "errors") return commandErrors(dbPath, importGraph);

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

module.exports = {
  runCli
};
