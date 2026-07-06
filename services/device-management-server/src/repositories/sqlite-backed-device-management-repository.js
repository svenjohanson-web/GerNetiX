const { SqliteStateStore } = require("../../../shared");
const { FileBackedDeviceManagementRepository } = require("./file-backed-device-management-repository");

class SqliteBackedDeviceManagementRepository extends FileBackedDeviceManagementRepository {
  static create(sqlitePath) {
    return new SqliteBackedDeviceManagementRepository(new SqliteStateStore(sqlitePath, "device-management-server", {
      defaultState: {
        devices: [],
        credentials: [],
        challenges: [],
        pairingSessions: [],
        accountDevices: [],
        purchaseContexts: [],
        consents: [],
        auditEvents: [],
      },
      collectionMap: {
        devices: "devices",
        credentials: "credentials",
        challenges: "challenges",
        pairingSessions: "pairing_sessions",
        accountDevices: "account_devices",
        purchaseContexts: "purchase_contexts",
        consents: "consents",
        auditEvents: "audit_events",
      },
    }));
  }
}

module.exports = { SqliteBackedDeviceManagementRepository };
