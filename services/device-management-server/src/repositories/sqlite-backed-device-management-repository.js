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
        provisioningTokens: [],
        accountDevices: [],
        accountBoardVersions: [],
        purchaseContexts: [],
        consents: [],
        auditEvents: [],
      },
      collectionMap: {
        devices: "devices",
        credentials: "credentials",
        challenges: "challenges",
        pairingSessions: "pairing_sessions",
        provisioningTokens: "provisioning_tokens",
        accountDevices: "account_devices",
        accountBoardVersions: "account_board_versions",
        purchaseContexts: "purchase_contexts",
        consents: "consents",
        auditEvents: "audit_events",
      },
    }));
  }
}

module.exports = { SqliteBackedDeviceManagementRepository };
