const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryAdminRepository } = require("./in-memory-admin-repository");

class SqliteBackedAdminRepository extends InMemoryAdminRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
  }

  static create(sqlitePath) {
    return new SqliteBackedAdminRepository(new SqliteSnapshotStore(sqlitePath, "admin-tool", {
      defaultState: {
        devices: [],
        feedback: [],
        aiUsageEvents: [],
        consents: [],
        auditEvents: [],
        adminActions: [],
      },
    }));
  }

  createConsent(input) {
    const result = super.createConsent(input);
    this.persist();
    return result;
  }

  revokeConsent(consentId) {
    const result = super.revokeConsent(consentId);
    this.persist();
    return result;
  }

  addAuditEvent(event) {
    const result = super.addAuditEvent(event);
    this.persist();
    return result;
  }

  addAdminAction(action) {
    const result = super.addAdminAction(action);
    this.persist();
    return result;
  }

  persist() {
    this.store.save({
      devices: Array.from(this.devices.values()),
      feedback: this.feedback,
      aiUsageEvents: this.aiUsageEvents,
      consents: Array.from(this.consents.values()),
      auditEvents: this.auditEvents,
      adminActions: this.adminActions,
    });
  }
}

module.exports = { SqliteBackedAdminRepository };
