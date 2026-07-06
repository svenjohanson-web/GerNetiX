const { SqliteStateStore } = require("../../shared");
const { PersistenceServerError } = require("./errors");

class PersistenceService {
  constructor(options) {
    this.dbPath = options.dbPath;
  }

  getState(serviceKey) {
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

  putState(serviceKey, input = {}) {
    if (!input || typeof input.state !== "object" || Array.isArray(input.state)) {
      throw new PersistenceServerError("invalid_service_state", "State muss ein JSON-Objekt unter state enthalten.");
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

  exportDatabase() {
    const store = this.openStore("persistence-server");
    try {
      return store.exportJson();
    } finally {
      store.close();
    }
  }

  backupDatabase(targetPath) {
    const normalized = String(targetPath || "").trim();
    if (!normalized) {
      throw new PersistenceServerError("invalid_backup_path", "Backup-Pfad fehlt.");
    }
    const store = this.openStore("persistence-server");
    try {
      return store.backupTo(normalized);
    } finally {
      store.close();
    }
  }

  openStore(serviceKey) {
    const normalized = String(serviceKey || "").trim();
    if (!/^[a-z0-9._-]+$/i.test(normalized)) {
      throw new PersistenceServerError("invalid_service_key", "Service-Key ist ungueltig.");
    }
    return new SqliteStateStore(this.dbPath, normalized, { defaultState: {} });
  }
}

module.exports = { PersistenceService };
