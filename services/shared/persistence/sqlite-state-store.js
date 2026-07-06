const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

class SqliteStateStore {
  constructor(dbPath, serviceKey, options = {}) {
    this.dbPath = dbPath;
    this.serviceKey = serviceKey;
    this.defaultState = options.defaultState || {};
    this.collectionMap = options.collectionMap || {};
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        namespace TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_documents (
        service_key TEXT NOT NULL,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        document_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (service_key, collection_name, document_id)
      );

      CREATE INDEX IF NOT EXISTS idx_service_documents_collection
        ON service_documents (service_key, collection_name);
    `);
  }

  load() {
    return this.loadFromCollections();
  }

  save(state) {
    this.saveStateCollections(state);
    return state;
  }

  saveStateCollections(state) {
    const keys = Array.from(new Set([
      ...Object.keys(state || {}),
      ...Object.keys(this.collectionMap || {}),
    ]));
    for (const stateKey of keys) {
      const value = state[stateKey];
      const collectionName = this.collectionMap[stateKey] || stateKey;
      if (Array.isArray(value)) {
        this.replaceCollection(collectionName, value, (document, index) => documentIdFor(stateKey, document, index));
      } else if (value && typeof value === "object") {
        this.replaceCollection(collectionName, [{ document_id: stateKey, value }], "document_id");
      }
    }
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
    for (const [index, document] of (documents || []).entries()) {
      const documentId = String(selectId(document, index) || "").trim();
      if (!documentId) {
        throw new Error(`Missing document id for ${this.serviceKey}/${collectionName}.`);
      }
      insertStatement.run(this.serviceKey, collectionName, documentId, JSON.stringify(document), updatedAt);
    }
    return documents;
  }

  ensureSchema(statements, options = {}) {
    const normalized = Array.isArray(statements)
      ? { statements, namespace: options.namespace || this.serviceKey, version: options.version || statements.length || 1 }
      : { statements: statements.statements || [], namespace: statements.namespace || this.serviceKey, version: statements.version || 1 };
    for (const statement of normalized.statements || []) {
      this.db.exec(statement);
    }
    this.recordSchemaVersion(normalized.namespace, normalized.version);
  }

  ensureMigrations(namespace, migrations) {
    const current = this.schemaVersion(namespace);
    for (const migration of migrations || []) {
      if (migration.version <= current) continue;
      for (const statement of migration.statements || []) {
        this.db.exec(statement);
      }
      this.recordSchemaVersion(namespace, migration.version);
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

  loadFromCollections() {
    const state = clone(this.defaultState);
    const entries = Object.entries(effectiveCollectionMap(this.defaultState, this.collectionMap, this.listCollectionNames()));
    for (const [stateKey, collectionName] of entries) {
      const items = this.loadCollection(collectionName);
      if (items.length > 0) {
        state[stateKey] = isSingletonCollection(state[stateKey], items)
          ? items[0].value
          : items;
      }
    }
    return state;
  }

  listCollectionNames() {
    return this.db.prepare(`
      SELECT DISTINCT collection_name
      FROM service_documents
      WHERE service_key = ?
      ORDER BY collection_name
    `).all(this.serviceKey).map((row) => row.collection_name);
  }

  schemaVersion(namespace = this.serviceKey) {
    const row = this.db.prepare("SELECT version FROM schema_migrations WHERE namespace = ?").get(namespace);
    return row ? row.version : 0;
  }

  recordSchemaVersion(namespace, version) {
    this.db.prepare(`
      INSERT INTO schema_migrations (namespace, version, applied_at)
      VALUES (?, ?, ?)
      ON CONFLICT(namespace) DO UPDATE SET
        version = MAX(schema_migrations.version, excluded.version),
        applied_at = excluded.applied_at
    `).run(namespace, version, new Date().toISOString());
  }

  backupTo(targetPath) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    this.db.exec("PRAGMA wal_checkpoint(FULL);");
    fs.copyFileSync(this.dbPath, targetPath);
    return { source_path: this.dbPath, backup_path: targetPath };
  }

  exportJson() {
    return {
      db_path: this.dbPath,
      exported_at: new Date().toISOString(),
      schema_migrations: this.db.prepare("SELECT * FROM schema_migrations ORDER BY namespace").all(),
      service_documents: this.db.prepare("SELECT service_key, collection_name, document_id, document_json, updated_at FROM service_documents ORDER BY service_key, collection_name, document_id").all()
        .map(({ document_json, ...row }) => ({ ...row, document: redactSensitiveJson(JSON.parse(document_json)) })),
    };
  }

  static restoreBackup(sourcePath, targetPath) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    return { source_path: sourcePath, restored_path: targetPath };
  }

  close() {
    this.db.close();
  }
}

function defaultDocumentId(document, index = 0) {
  return document.id || document.document_id || document[0] || `item_${index}`;
}

function documentIdFor(stateKey, document, index) {
  if (!document || typeof document !== "object" || Array.isArray(document)) return `item_${index}`;
  return document.id
    || document.document_id
    || document[`${stateKey.slice(0, -1)}_id`]
    || document[`${stateKey}_id`]
    || document[knownIdField(stateKey)]
    || `item_${index}`;
}

function knownIdField(stateKey) {
  return {
    userAccounts: "id",
    localCredentials: "id",
    externalIdentities: "id",
    verificationTokens: "id",
    passwordResetTokens: "id",
    creditAccounts: "account_id",
    ledgerEntries: "ledger_entry_id",
    usageEvents: "event_id",
    adminAuditEvents: "admin_audit_event_id",
    hardwareItems: "hardware_item_id",
    accountDevices: "account_device_id",
    purchaseContexts: "purchase_context_id",
    pairingSessions: "pairing_session_id",
    buildJobs: "build_job_id",
    knowledgeDocuments: "document_id",
    aiUsageEvents: "event_id",
    adminActions: "action_id",
  }[stateKey] || "id";
}

function effectiveCollectionMap(defaultState, collectionMap, existingCollectionNames = []) {
  return {
    ...Object.fromEntries(existingCollectionNames.map((key) => [key, key])),
    ...Object.fromEntries(Object.keys(defaultState || {}).map((key) => [key, key])),
    ...(collectionMap || {}),
  };
}

function isSingletonCollection(defaultValue, items) {
  return !Array.isArray(defaultValue) && items.length === 1 && Object.hasOwn(items[0], "value");
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

function redactSensitiveJson(value) {
  if (Array.isArray(value)) return value.map(redactSensitiveJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    isSensitiveKey(key) ? "[redacted]" : redactSensitiveJson(entry),
  ]));
}

function isSensitiveKey(key) {
  return /(secret|password_hash|token_hash|pairing_code|private_key)/i.test(key);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { SqliteStateStore, jsonColumn };
