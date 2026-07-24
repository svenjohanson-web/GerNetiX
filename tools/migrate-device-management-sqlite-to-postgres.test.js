const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  readLegacyDeviceManagementState,
  requiredSecret,
} = require("./migrate-device-management-sqlite-to-postgres");

test("reads typed Device Management SQLite documents and removes legacy secrets", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "device-migration-")), "device.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec("CREATE TABLE device_management_credentials (device_id TEXT PRIMARY KEY, raw_json TEXT NOT NULL)");
  db.prepare("INSERT INTO device_management_credentials VALUES (?,?)").run(
    "device-1",
    JSON.stringify({ device_id: "device-1", credential_id: "cred-1", secret: "legacy" }),
  );
  db.close();
  const state = readLegacyDeviceManagementState(sqlitePath);
  assert.equal(state.credentials[0].credential_id, "cred-1");
  assert.equal(state.credentials[0].secret, undefined);
});

test("requires a Device Management PostgreSQL password", () => {
  assert.throws(() => requiredSecret(""), /DEVICE_MANAGEMENT_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});
