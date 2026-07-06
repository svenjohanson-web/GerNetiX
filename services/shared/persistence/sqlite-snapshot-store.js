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

  close() {
    this.db.close();
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { SqliteSnapshotStore };
