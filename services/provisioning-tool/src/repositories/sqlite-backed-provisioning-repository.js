const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryProvisioningRepository } = require("./in-memory-provisioning-repository");

class SqliteBackedProvisioningRepository extends InMemoryProvisioningRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
  }

  static create(sqlitePath) {
    return new SqliteBackedProvisioningRepository(new SqliteSnapshotStore(sqlitePath, "provisioning-tool", {
      defaultState: { sessions: [], activeCredentialByDevice: [] },
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
    this.store.save({
      sessions: Array.from(this.sessions.values()),
      activeCredentialByDevice: Array.from(this.activeCredentialByDevice.entries()),
    });
  }
}

module.exports = { SqliteBackedProvisioningRepository };
