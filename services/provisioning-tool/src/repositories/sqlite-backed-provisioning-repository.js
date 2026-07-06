const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryProvisioningRepository } = require("./in-memory-provisioning-repository");

class SqliteBackedProvisioningRepository extends InMemoryProvisioningRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    this.store.ensureSchema?.(provisioningSchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedProvisioningRepository(new SqliteStateStore(sqlitePath, "provisioning-tool", {
      defaultState: { sessions: [], activeCredentialByDevice: [] },
      collectionMap: {
        sessions: "sessions",
      },
    }));
  }

  saveSession(session) {
    const result = super.saveSession(session);
    this.persist();
    return result;
  }

  updateSession(sessionId, patch) {
    const result = super.updateSession(sessionId, patch);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      sessions: Array.from(this.sessions.values()),
      activeCredentialByDevice: Array.from(this.activeCredentialByDevice.entries()),
    };
    this.store.save(state);
    this.store.replaceCollection?.("sessions", state.sessions, "session_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("provisioning_sessions", state.sessions, sessionColumns());
      this.store.replaceTable("provisioning_active_credentials", state.activeCredentialByDevice.map(([device_id, credential_id]) => ({ device_id, credential_id })), {
        device_id: "device_id",
        credential_id: "credential_id",
      });
    }
  }
}

function provisioningSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS provisioning_sessions (session_id TEXT PRIMARY KEY, status TEXT, created_at TEXT, updated_at TEXT, completed_at TEXT, device_id TEXT, serial_number TEXT, credential_id TEXT, device_json TEXT, credential_json TEXT, audit_events_json TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS provisioning_active_credentials (device_id TEXT PRIMARY KEY, credential_id TEXT);`,
  ];
}

function sessionColumns() {
  return {
    session_id: "session_id",
    status: "status",
    created_at: "created_at",
    updated_at: "updated_at",
    completed_at: "completed_at",
    device_id: (row) => row.device?.device_id,
    serial_number: (row) => row.device?.serial_number,
    credential_id: (row) => row.credential?.credential_id,
    device_json: jsonColumn("device"),
    credential_json: jsonColumn("credential"),
    audit_events_json: jsonColumn("audit_events"),
    raw_json: jsonColumn((row) => row),
  };
}

module.exports = { SqliteBackedProvisioningRepository };
