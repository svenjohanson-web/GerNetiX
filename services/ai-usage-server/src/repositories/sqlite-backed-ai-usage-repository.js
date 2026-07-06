const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryAiUsageRepository, defaultPolicy } = require("./in-memory-ai-usage-repository");

class SqliteBackedAiUsageRepository extends InMemoryAiUsageRepository {
  constructor(store) {
    super({ policy: defaultPolicy(), ...store.load() });
    this.store = store;
  }

  static create(sqlitePath) {
    return new SqliteBackedAiUsageRepository(new SqliteSnapshotStore(sqlitePath, "ai-usage-server", {
      defaultState: {
        creditAccounts: [],
        ledgerEntries: [],
        usageEvents: [],
        adminAuditEvents: [],
        policy: defaultPolicy(),
      },
    }));
  }

  saveCreditAccount(account) {
    const result = super.saveCreditAccount(account);
    this.persist();
    return result;
  }

  addLedgerEntry(entry) {
    const result = super.addLedgerEntry(entry);
    this.persist();
    return result;
  }

  addUsageEvent(event) {
    const result = super.addUsageEvent(event);
    this.persist();
    return result;
  }

  updateUsageEvent(eventId, patch) {
    const result = super.updateUsageEvent(eventId, patch);
    this.persist();
    return result;
  }

  savePolicy(policy) {
    const result = super.savePolicy(policy);
    this.persist();
    return result;
  }

  addAdminAuditEvent(event) {
    const result = super.addAdminAuditEvent(event);
    this.persist();
    return result;
  }

  persist() {
    this.store.save({
      creditAccounts: Array.from(this.creditAccounts.values()),
      ledgerEntries: this.ledgerEntries,
      usageEvents: this.usageEvents,
      adminAuditEvents: this.adminAuditEvents,
      policy: this.policy,
    });
  }
}

module.exports = { SqliteBackedAiUsageRepository };
