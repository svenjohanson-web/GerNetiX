const { SqliteSnapshotStore } = require("../../shared");
const { PersistenceServerError } = require("./errors");

class PersistenceService {
  constructor(options) {
    this.dbPath = options.dbPath;
  }

  getSnapshot(serviceKey) {
    const store = this.openStore(serviceKey);
    try {
      return {
        service_key: serviceKey,
        state: store.load(),
      };
    } finally {
      store.close();
    }
  }

  putSnapshot(serviceKey, input = {}) {
    if (!input || typeof input.state !== "object" || Array.isArray(input.state)) {
      throw new PersistenceServerError("invalid_snapshot_state", "Snapshot muss ein JSON-Objekt unter state enthalten.");
    }
    const store = this.openStore(serviceKey);
    try {
      store.save(input.state);
      return {
        service_key: serviceKey,
        saved: true,
      };
    } finally {
      store.close();
    }
  }

  openStore(serviceKey) {
    const normalized = String(serviceKey || "").trim();
    if (!/^[a-z0-9._-]+$/i.test(normalized)) {
      throw new PersistenceServerError("invalid_service_key", "Service-Key ist ungueltig.");
    }
    return new SqliteSnapshotStore(this.dbPath, normalized, { defaultState: {} });
  }
}

module.exports = { PersistenceService };
