const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  createAuthoringSchema(db);
  resetGeneratedSchema(db);
  return db;
}

function resetGeneratedSchema(db) {
  db.exec(`
    DROP TABLE IF EXISTS validation_errors;
    DROP TABLE IF EXISTS relationships;
    DROP TABLE IF EXISTS relationship_type_rules;
    DROP TABLE IF EXISTS relationship_types;
    DROP TABLE IF EXISTS artifact_occurrences;
    DROP TABLE IF EXISTS artifacts;
    DROP TABLE IF EXISTS artifact_types;
  `);
}

function createAuthoringSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_authored_artifacts (
      id TEXT PRIMARY KEY,
      artifact_type_id TEXT NOT NULL,
      title TEXT,
      status TEXT,
      owner_domain TEXT,
      summary TEXT,
      source TEXT NOT NULL DEFAULT 'graph_authoring',
      properties_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graph_authored_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_artifact_id TEXT NOT NULL,
      relationship_type_id TEXT NOT NULL,
      target_artifact_id TEXT NOT NULL,
      confidence TEXT,
      source_field TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_artifact_id, relationship_type_id, target_artifact_id, source_field)
    );
  `);
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE artifact_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL,
      is_allowed INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE artifacts (
      id TEXT PRIMARY KEY,
      artifact_type_id TEXT NOT NULL,
      title TEXT,
      status TEXT,
      owner_domain TEXT,
      summary TEXT,
      source_file TEXT NOT NULL,
      source_line INTEGER NOT NULL,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      is_valid INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (artifact_type_id) REFERENCES artifact_types(id)
    );

    CREATE TABLE artifact_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artifact_id TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_line INTEGER NOT NULL
    );

    CREATE TABLE relationship_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_hierarchical INTEGER NOT NULL DEFAULT 0,
      allows_cycles INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      is_allowed INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE relationship_type_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relationship_type_id TEXT NOT NULL,
      source_artifact_type_id TEXT NOT NULL,
      target_artifact_type_id TEXT NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY (relationship_type_id) REFERENCES relationship_types(id)
    );

    CREATE TABLE relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_artifact_id TEXT NOT NULL,
      relationship_type_id TEXT NOT NULL,
      target_artifact_id TEXT NOT NULL,
      confidence TEXT,
      source_file TEXT NOT NULL,
      source_line INTEGER NOT NULL,
      source_field TEXT,
      origin TEXT NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (relationship_type_id) REFERENCES relationship_types(id)
    );

    CREATE TABLE validation_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity TEXT NOT NULL,
      code TEXT NOT NULL,
      message TEXT NOT NULL,
      source_file TEXT,
      source_line INTEGER,
      artifact_id TEXT,
      relationship_id INTEGER
    );

    CREATE INDEX idx_relationships_source ON relationships(source_artifact_id);
    CREATE INDEX idx_relationships_target ON relationships(target_artifact_id);
    CREATE INDEX idx_relationships_type ON relationships(relationship_type_id);
    CREATE INDEX idx_validation_errors_code ON validation_errors(code);
  `);
}

function insertValidationError(db, error) {
  db.prepare(`
    INSERT INTO validation_errors
      (severity, code, message, source_file, source_line, artifact_id, relationship_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    error.severity || "error",
    error.code,
    error.message,
    error.sourceFile || null,
    error.sourceLine || null,
    error.artifactId || null,
    error.relationshipId || null
  );
}

module.exports = {
  createAuthoringSchema,
  createSchema,
  insertValidationError,
  openDatabase
};
