const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");
const { SqliteDeviceOtaSigner, SqliteOtaAcknowledgementStore } = require("../src/modules/ota-security");

test("signs OTA commands with the active device credential and stores acknowledgements", async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-ota-")), "state.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE device_management_credentials (device_id TEXT PRIMARY KEY, status TEXT, secret TEXT)");
  db.prepare("INSERT INTO device_management_credentials VALUES (?,?,?)").run("device-1", "active", "secret-1");
  db.close();
  const signer = new SqliteDeviceOtaSigner(dbPath);
  assert.equal(await signer.sign({ deviceId: "device-1", canonical: "deploy" }), crypto.createHmac("sha256", "secret-1").update("deploy").digest("hex"));

  const store = new SqliteOtaAcknowledgementStore(dbPath);
  await store.record({ deploy_id: "deploy-1", device_id: "device-1", status: "published" });
  await store.receive("gernetix/devices/device-1/status/deployment", JSON.stringify({ deploy_id: "deploy-1", status: "verified" }));
  assert.equal(store.get("deploy-1").status, "verified");
  const check = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(check.prepare("SELECT status FROM build_deploy_ota_acknowledgements WHERE deploy_id=?").get("deploy-1").status, "verified");
  check.close();
});
