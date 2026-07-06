const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryRecoveryRepository } = require("./in-memory-recovery-repository");

class SqliteBackedRecoveryRepository extends InMemoryRecoveryRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    this.store.ensureSchema?.(recoverySchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedRecoveryRepository(new SqliteStateStore(sqlitePath, "recovery-tool", {
      defaultState: { sessions: [] },
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

  persist() {
    const state = { sessions: Array.from(this.sessions.values()) };
    this.store.save(state);
    this.store.replaceCollection?.("sessions", state.sessions, "recovery_session_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("recovery_sessions", state.sessions, sessionColumns());
    }
  }
}

function recoverySchema() {
  return [
    `CREATE TABLE IF NOT EXISTS recovery_sessions (recovery_session_id TEXT PRIMARY KEY, account_id TEXT, device_id TEXT, status TEXT, recovery_type TEXT, detected_board_json TEXT, capabilities_json TEXT, steps_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function sessionColumns() {
  return {
    recovery_session_id: "recovery_session_id",
    account_id: "account_id",
    device_id: "device_id",
    status: "status",
    recovery_type: "recovery_type",
    detected_board_json: jsonColumn("detected_board"),
    capabilities_json: jsonColumn("capabilities"),
    steps_json: jsonColumn("steps"),
    created_at: "created_at",
    updated_at: "updated_at",
    raw_json: jsonColumn((row) => row),
  };
}

module.exports = { SqliteBackedRecoveryRepository };
