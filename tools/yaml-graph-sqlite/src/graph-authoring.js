const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { createAuthoringSchema } = require("./database");

function openAuthoringDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  createAuthoringSchema(db);
  return db;
}

function upsertAuthoredArtifact(db, input) {
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT properties_json, created_at FROM graph_authored_artifacts WHERE id = ?").get(input.id);
  const properties = {
    ...safeJson(existing?.properties_json),
    ...(input.properties || {})
  };
  db.prepare(`
    INSERT INTO graph_authored_artifacts
      (id, artifact_type_id, title, status, owner_domain, summary, source, properties_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      artifact_type_id = excluded.artifact_type_id,
      title = excluded.title,
      status = excluded.status,
      owner_domain = excluded.owner_domain,
      summary = excluded.summary,
      source = excluded.source,
      properties_json = excluded.properties_json,
      updated_at = excluded.updated_at
  `).run(
    required(input.id, "id"),
    required(input.type || input.artifact_type_id, "type"),
    input.title || input.id,
    input.status || "",
    input.owner_domain || input.ownerDomain || "",
    input.summary || "",
    input.source || "graph_authoring",
    JSON.stringify(properties),
    existing?.created_at || now,
    now
  );
}

function upsertAuthoredRelationship(db, input) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO graph_authored_relationships
      (source_artifact_id, relationship_type_id, target_artifact_id, confidence, source_field, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_artifact_id, relationship_type_id, target_artifact_id, source_field) DO UPDATE SET
      confidence = excluded.confidence,
      updated_at = excluded.updated_at
  `).run(
    required(input.from || input.source_artifact_id, "from"),
    required(input.relation || input.relationship_type_id, "relation"),
    required(input.to || input.target_artifact_id, "to"),
    input.confidence || "high",
    input.source_field || "graph_authoring",
    now,
    now
  );
}

function deleteAuthoredRelationship(db, input) {
  const result = db.prepare(`
    DELETE FROM graph_authored_relationships
    WHERE source_artifact_id = ?
      AND relationship_type_id = ?
      AND target_artifact_id = ?
      AND source_field = ?
  `).run(
    required(input.from || input.source_artifact_id, "from"),
    required(input.relation || input.relationship_type_id, "relation"),
    required(input.to || input.target_artifact_id, "to"),
    input.source_field || "graph_authoring"
  );
  return result.changes;
}

function readJsonInput(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function required(value, name) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`missing_${name}`);
  return result;
}

function option(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1] || "";
}

function parseProperties(args) {
  const properties = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--property") continue;
    const [key, ...rest] = String(args[index + 1] || "").split("=");
    if (!key) continue;
    const raw = rest.join("=");
    try {
      properties[key] = JSON.parse(raw);
    } catch {
      properties[key] = raw;
    }
  }
  const propertiesJson = option(args, "--properties-json");
  if (propertiesJson) Object.assign(properties, JSON.parse(propertiesJson));
  return properties;
}

function runAuthoringCli({ args, defaultDbPath }) {
  const command = args[0] || "help";
  const dbPath = path.resolve(option(args, "--db", defaultDbPath));
  const db = openAuthoringDatabase(dbPath);
  try {
    if (command === "upsert-artifact") {
      const jsonFile = option(args, "--json");
      const input = jsonFile ? readJsonInput(jsonFile) : {
        id: option(args, "--id"),
        type: option(args, "--type"),
        title: option(args, "--title"),
        status: option(args, "--status"),
        ownerDomain: option(args, "--owner-domain"),
        summary: option(args, "--summary"),
        properties: parseProperties(args)
      };
      upsertAuthoredArtifact(db, input);
      console.log(JSON.stringify({ ok: true, artifact_id: input.id }, null, 2));
      return;
    }
    if (command === "upsert-relationship") {
      const jsonFile = option(args, "--json");
      const input = jsonFile ? readJsonInput(jsonFile) : {
        from: option(args, "--from"),
        relation: option(args, "--relation"),
        to: option(args, "--to"),
        confidence: option(args, "--confidence", "high"),
        source_field: option(args, "--source-field", "graph_authoring")
      };
      upsertAuthoredRelationship(db, input);
      console.log(JSON.stringify({ ok: true, from: input.from, relation: input.relation, to: input.to }, null, 2));
      return;
    }
    if (command === "delete-relationship") {
      const input = {
        from: option(args, "--from"),
        relation: option(args, "--relation"),
        to: option(args, "--to"),
        source_field: option(args, "--source-field", "graph_authoring")
      };
      const changes = deleteAuthoredRelationship(db, input);
      console.log(JSON.stringify({ ok: true, deleted: changes }, null, 2));
      return;
    }
    console.error("Usage: graph-authoring upsert-artifact|upsert-relationship --db <path> ...");
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

module.exports = {
  openAuthoringDatabase,
  deleteAuthoredRelationship,
  runAuthoringCli,
  upsertAuthoredArtifact,
  upsertAuthoredRelationship
};
