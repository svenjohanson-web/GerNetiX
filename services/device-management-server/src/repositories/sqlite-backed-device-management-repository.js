const { SqliteSnapshotStore } = require("../../../shared");
const { FileBackedDeviceManagementRepository } = require("./file-backed-device-management-repository");

class SqliteBackedDeviceManagementRepository extends FileBackedDeviceManagementRepository {
  static create(sqlitePath) {
    return new SqliteBackedDeviceManagementRepository(new SqliteSnapshotStore(sqlitePath, "device-management-server", {
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
    }));
  }
}

module.exports = { SqliteBackedDeviceManagementRepository };
