const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryRecoveryRepository } = require("./in-memory-recovery-repository");

class SqliteBackedRecoveryRepository extends InMemoryRecoveryRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
  }

  static create(sqlitePath) {
    return new SqliteBackedRecoveryRepository(new SqliteSnapshotStore(sqlitePath, "recovery-tool", {
      defaultState: { sessions: [] },
    }));
  }

  saveSession(session) {
    const result = super.saveSession(session);
    this.persist();
    return result;
  }

  persist() {
    this.store.save({ sessions: Array.from(this.sessions.values()) });
  }
}

module.exports = { SqliteBackedRecoveryRepository };
