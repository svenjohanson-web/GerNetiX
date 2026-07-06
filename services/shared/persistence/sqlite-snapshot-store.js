const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

class SqliteSnapshotStore {
  constructor(dbPath, serviceKey, options = {}) {
    this.dbPath = dbPath;
    this.serviceKey = serviceKey;
    this.defaultState = options.defaultState || {};
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS service_snapshots (
        service_key TEXT PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_documents (
        service_key TEXT NOT NULL,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        document_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (service_key, collection_name, document_id)
      );
    `);
  }

  load() {
    const row = this.db.prepare("SELECT state_json FROM service_snapshots WHERE service_key = ?").get(this.serviceKey);
    if (!row) return clone(this.defaultState);
    return JSON.parse(row.state_json);
  }

  save(state) {
    this.db.prepare(`
      INSERT INTO service_snapshots (service_key, state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(service_key) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run(this.serviceKey, JSON.stringify(state), new Date().toISOString());
    return state;
  }

  replaceCollection(collectionName, documents, idSelector = defaultDocumentId) {
    const updatedAt = new Date().toISOString();
    const selectId = typeof idSelector === "function"
      ? idSelector
      : (document) => document[idSelector];
    const deleteStatement = this.db.prepare(
      "DELETE FROM service_documents WHERE service_key = ? AND collection_name = ?",
    );
    const insertStatement = this.db.prepare(`
      INSERT INTO service_documents (service_key, collection_name, document_id, document_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    deleteStatement.run(this.serviceKey, collectionName);
    for (const document of documents || []) {
      const documentId = String(selectId(document) || "").trim();
      if (!documentId) {
        throw new Error(`Missing document id for ${this.serviceKey}/${collectionName}.`);
      }
      insertStatement.run(this.serviceKey, collectionName, documentId, JSON.stringify(document), updatedAt);
    }
    return documents;
  }

  ensureSchema(statements) {
    for (const statement of statements || []) {
      this.db.exec(statement);
    }
  }

  replaceTable(tableName, rows, columns) {
    assertSqlIdentifier(tableName);
    const columnNames = Object.keys(columns || {});
    for (const columnName of columnNames) assertSqlIdentifier(columnName);

    const placeholders = columnNames.map(() => "?").join(", ");
    const insertStatement = this.db.prepare(`
      INSERT INTO ${tableName} (${columnNames.join(", ")})
      VALUES (${placeholders})
    `);
    this.db.exec("BEGIN");
    try {
      this.db.prepare(`DELETE FROM ${tableName}`).run();
      for (const row of rows || []) {
        insertStatement.run(...columnNames.map((columnName) => columnValue(row, columns[columnName])));
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return rows;
  }

  loadCollection(collectionName) {
    const rows = this.db.prepare(`
      SELECT document_json
      FROM service_documents
      WHERE service_key = ? AND collection_name = ?
      ORDER BY document_id
    `).all(this.serviceKey, collectionName);
    return rows.map((row) => JSON.parse(row.document_json));
  }

  close() {
    this.db.close();
  }
}

function defaultDocumentId(document) {
  return document.id || document.document_id;
}

function columnValue(row, selector) {
  const value = typeof selector === "function" ? selector(row) : row[selector];
  return value === undefined ? null : value;
}

function jsonColumn(selector) {
  return (row) => JSON.stringify(columnValue(row, selector) ?? null);
}

function assertSqlIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQLite identifier: ${value}`);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { SqliteSnapshotStore, jsonColumn };
