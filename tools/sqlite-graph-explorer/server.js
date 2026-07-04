const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 4318);
const ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_DB = path.join(ROOT, "tools", "yaml-graph-sqlite", "out", "model-graph.sqlite");
const DB_PATH = path.resolve(process.env.GERNETIX_GRAPH_DB || DEFAULT_DB);
const PUBLIC_DIR = path.join(__dirname, "public");

function openDb() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`SQLite graph database not found: ${DB_PATH}`);
  }
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

function sendText(res, status, value, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(value);
}

function decodeId(value) {
  return decodeURIComponent(value || "").trim();
}

function getArtifact(db, id) {
  return db.prepare(`
    SELECT
      a.id,
      a.artifact_type_id AS type,
      at.name AS type_name,
      a.title,
      a.status,
      a.owner_domain,
      a.summary,
      a.source_file,
      a.source_line,
      a.is_valid
    FROM artifacts a
    JOIN artifact_types at ON at.id = a.artifact_type_id
    WHERE a.id = ?
  `).get(id);
}

function getRelationships(db, id, direction) {
  if (direction === "incoming") {
    return db.prepare(`
      SELECT
        r.id,
        r.relationship_type_id AS type,
        rt.name AS type_name,
        r.confidence,
        r.source_field,
        r.origin,
        r.is_valid,
        source.id AS source_id,
        source.artifact_type_id AS source_type,
        COALESCE(source.title, source.id) AS source_title,
        target.id AS target_id,
        target.artifact_type_id AS target_type,
        COALESCE(target.title, target.id) AS target_title
      FROM relationships r
      JOIN relationship_types rt ON rt.id = r.relationship_type_id
      JOIN artifacts source ON source.id = r.source_artifact_id
      JOIN artifacts target ON target.id = r.target_artifact_id
      WHERE r.target_artifact_id = ?
      ORDER BY r.relationship_type_id, source.id
    `).all(id);
  }

  if (direction === "outgoing") {
    return db.prepare(`
      SELECT
        r.id,
        r.relationship_type_id AS type,
        rt.name AS type_name,
        r.confidence,
        r.source_field,
        r.origin,
        r.is_valid,
        source.id AS source_id,
        source.artifact_type_id AS source_type,
        COALESCE(source.title, source.id) AS source_title,
        target.id AS target_id,
        target.artifact_type_id AS target_type,
        COALESCE(target.title, target.id) AS target_title
      FROM relationships r
      JOIN relationship_types rt ON rt.id = r.relationship_type_id
      JOIN artifacts source ON source.id = r.source_artifact_id
      JOIN artifacts target ON target.id = r.target_artifact_id
      WHERE r.source_artifact_id = ?
      ORDER BY r.relationship_type_id, target.id
    `).all(id);
  }

  return [
    ...getRelationships(db, id, "incoming").map((item) => ({ ...item, direction: "incoming" })),
    ...getRelationships(db, id, "outgoing").map((item) => ({ ...item, direction: "outgoing" }))
  ];
}

function getNeighborhood(db, id) {
  const selected = getArtifact(db, id);
  if (!selected) return null;

  const relationships = getRelationships(db, id, "both");
  const nodeIds = new Set([id]);
  for (const relationship of relationships) {
    nodeIds.add(relationship.source_id);
    nodeIds.add(relationship.target_id);
  }

  const nodes = Array.from(nodeIds).map((nodeId) => getArtifact(db, nodeId)).filter(Boolean);
  return { selectedId: id, nodes, relationships };
}

function queryTypes(db) {
  return db.prepare(`
    SELECT
      at.id,
      at.name,
      at.description,
      at.source,
      at.is_allowed,
      COUNT(a.id) AS artifact_count
    FROM artifact_types at
    LEFT JOIN artifacts a ON a.artifact_type_id = at.id
    GROUP BY at.id
    ORDER BY at.id
  `).all();
}

function queryMetamodelTypes(db) {
  return db.prepare(`
    SELECT
      at.id,
      at.name,
      at.description,
      at.source,
      at.is_allowed,
      COUNT(DISTINCT a.id) AS instance_count,
      COUNT(DISTINCT source_rules.id) AS references_rule_count,
      COUNT(DISTINCT target_rules.id) AS referenced_by_rule_count
    FROM artifact_types at
    LEFT JOIN artifacts a ON a.artifact_type_id = at.id
    LEFT JOIN relationship_type_rules source_rules ON source_rules.source_artifact_type_id = at.id
    LEFT JOIN relationship_type_rules target_rules ON target_rules.target_artifact_type_id = at.id
    GROUP BY at.id
    ORDER BY at.id
  `).all();
}

function queryMetamodelType(db, id) {
  const type = db.prepare(`
    SELECT
      at.id,
      at.name,
      at.description,
      at.source,
      at.is_allowed,
      COUNT(a.id) AS instance_count
    FROM artifact_types at
    LEFT JOIN artifacts a ON a.artifact_type_id = at.id
    WHERE at.id = ?
    GROUP BY at.id
  `).get(id);

  if (!type) return null;

  const references = db.prepare(`
    SELECT
      rtr.id,
      rtr.relationship_type_id AS relationship_type,
      rt.name AS relationship_type_name,
      rtr.target_artifact_type_id AS related_type,
      target_type.name AS related_type_name,
      rtr.source
    FROM relationship_type_rules rtr
    JOIN relationship_types rt ON rt.id = rtr.relationship_type_id
    JOIN artifact_types target_type ON target_type.id = rtr.target_artifact_type_id
    WHERE rtr.source_artifact_type_id = ?
    ORDER BY rtr.relationship_type_id, rtr.target_artifact_type_id
  `).all(id);

  const referencedBy = db.prepare(`
    SELECT
      rtr.id,
      rtr.relationship_type_id AS relationship_type,
      rt.name AS relationship_type_name,
      rtr.source_artifact_type_id AS related_type,
      source_type.name AS related_type_name,
      rtr.source
    FROM relationship_type_rules rtr
    JOIN relationship_types rt ON rt.id = rtr.relationship_type_id
    JOIN artifact_types source_type ON source_type.id = rtr.source_artifact_type_id
    WHERE rtr.target_artifact_type_id = ?
    ORDER BY rtr.relationship_type_id, rtr.source_artifact_type_id
  `).all(id);

  const instances = db.prepare(`
    SELECT
      id,
      COALESCE(title, id) AS title,
      status,
      owner_domain
    FROM artifacts
    WHERE artifact_type_id = ?
    ORDER BY id
    LIMIT 50
  `).all(id);

  return { type, references, referencedBy, instances };
}

function queryRelationshipTypes(db) {
  return db.prepare(`
    SELECT
      rt.id,
      rt.name,
      rt.is_hierarchical,
      rt.allows_cycles,
      rt.source,
      rt.is_allowed,
      COUNT(rtr.id) AS rule_count
    FROM relationship_types rt
    LEFT JOIN relationship_type_rules rtr ON rtr.relationship_type_id = rt.id
    GROUP BY rt.id
    ORDER BY rt.id
  `).all();
}

function queryArtifacts(db, searchParams) {
  const type = searchParams.get("type");
  const q = (searchParams.get("q") || "").trim();
  const params = [];
  const where = [];

  if (type) {
    where.push("a.artifact_type_id = ?");
    params.push(type);
  }

  if (q) {
    where.push("(a.id LIKE ? OR a.title LIKE ? OR a.summary LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db.prepare(`
    SELECT
      a.id,
      a.artifact_type_id AS type,
      COALESCE(a.title, a.id) AS title,
      a.status,
      a.owner_domain,
      a.summary,
      a.source_file,
      a.source_line,
      (
        SELECT COUNT(*)
        FROM relationships r
        WHERE r.source_artifact_id = a.id OR r.target_artifact_id = a.id
      ) AS relationship_count
    FROM artifacts a
    ${whereSql}
    ORDER BY a.artifact_type_id, a.id
    LIMIT 500
  `).all(...params);
}

function api(req, res, db, pathname, searchParams) {
  if (pathname === "/api/meta") {
    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM artifact_types) AS artifact_types,
        (SELECT COUNT(*) FROM artifacts) AS artifacts,
        (SELECT COUNT(*) FROM relationship_types) AS relationship_types,
        (SELECT COUNT(*) FROM relationships) AS relationships,
        (SELECT COUNT(*) FROM validation_errors WHERE severity = 'error') AS errors,
        (SELECT COUNT(*) FROM validation_errors WHERE severity = 'warning') AS warnings
    `).get();
    sendJson(res, 200, { dbPath: DB_PATH, counts });
    return;
  }

  if (pathname === "/api/types") {
    sendJson(res, 200, queryTypes(db));
    return;
  }

  if (pathname === "/api/metamodel/types") {
    sendJson(res, 200, queryMetamodelTypes(db));
    return;
  }

  if (pathname.startsWith("/api/metamodel/types/")) {
    const id = decodeId(pathname.slice("/api/metamodel/types/".length));
    const type = queryMetamodelType(db, id);
    if (!type) {
      sendJson(res, 404, { error: "artifact_type_not_found", id });
      return;
    }
    sendJson(res, 200, type);
    return;
  }

  if (pathname === "/api/metamodel/relationship-types") {
    sendJson(res, 200, queryRelationshipTypes(db));
    return;
  }

  if (pathname === "/api/artifacts") {
    sendJson(res, 200, queryArtifacts(db, searchParams));
    return;
  }

  if (pathname.startsWith("/api/artifacts/")) {
    const id = decodeId(pathname.slice("/api/artifacts/".length));
    const artifact = getArtifact(db, id);
    if (!artifact) {
      sendJson(res, 404, { error: "artifact_not_found", id });
      return;
    }
    sendJson(res, 200, {
      artifact,
      incoming: getRelationships(db, id, "incoming"),
      outgoing: getRelationships(db, id, "outgoing")
    });
    return;
  }

  if (pathname.startsWith("/api/neighborhood/")) {
    const id = decodeId(pathname.slice("/api/neighborhood/".length));
    const neighborhood = getNeighborhood(db, id);
    if (!neighborhood) {
      sendJson(res, 404, { error: "artifact_not_found", id });
      return;
    }
    sendJson(res, 200, neighborhood);
    return;
  }

  sendJson(res, 404, { error: "api_not_found" });
}

function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  sendText(res, 200, fs.readFileSync(filePath), contentTypes[ext] || "application/octet-stream");
}

function check() {
  const db = openDb();
  const meta = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM artifact_types) AS artifact_types,
      (SELECT COUNT(*) FROM artifacts) AS artifacts,
      (SELECT COUNT(*) FROM relationship_types) AS relationship_types,
      (SELECT COUNT(*) FROM relationships) AS relationships,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'error') AS errors,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'warning') AS warnings
  `).get();
  console.log(JSON.stringify({ dbPath: DB_PATH, ...meta }, null, 2));
  db.close();
}

function start() {
  const db = openDb();
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) {
        api(req, res, db, url.pathname, url.searchParams);
        return;
      }
      serveStatic(req, res, url.pathname);
    } catch (error) {
      sendJson(res, 500, { error: "server_error", message: error.message });
    }
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`SQLite Graph Explorer: http://localhost:${PORT}`);
    console.log(`DB: ${DB_PATH}`);
  });
}

if (process.argv.includes("--check")) {
  check();
} else {
  start();
}
