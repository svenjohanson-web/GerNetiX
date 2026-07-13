const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const { createDefaultDeviceManagementServer, FileBackedDeviceManagementRepository, SqliteBackedDeviceManagementRepository } = require("../src");
const { DeviceManagementService } = require("../src/services/device-management-service");

function registerVerified(service, overrides = {}) {
  return service.registerDevice({
    serial_number: "GNX-ESP32-0001",
    hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
    gernetix_verified: true,
    firmware_version: "0.1.0",
    provisioning_batch_id: "batch-1",
    provisioned_by: "provisioning-tool",
    connectivity_status: "online",
    ota_status: "ready",
    one_time_device_secret: "top-secret-device-key",
    credential: {
      credential_id: "cred-1",
      key_reference: "device-key://device/cred-1",
    },
    ...overrides,
  });
}

test("registers provisioned device and never exposes raw credential", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  const credentials = service.adminCredentials(device.device_id);

  assert.equal(device.authenticity_status, "gernetix_verified");
  assert.equal(credentials.credentials[0].credential_id, "cred-1");
  assert.equal(credentials.credentials[0].secret, undefined);
});

test("verifies HMAC challenge for GerNetiX device", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  const challenge = service.createChallenge(device.device_id);
  const hmac = crypto.createHmac("sha256", "top-secret-device-key").update(challenge.challenge).digest("hex");

  const result = service.verifyChallenge(device.device_id, {
    challenge_id: challenge.challenge_id,
    hmac,
  });

  assert.equal(result.verification_state, "verified");
  assert.equal(result.authenticity_status, "gernetix_verified");
});

test("pairing creates account device and OTA target discovery marks selectable device", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  const session = service.createPairingSession({
    account_id: "acct-1",
    device_id: device.device_id,
    pairing_channel: "ide_pairing_code",
  });

  const completed = service.completePairing(session.pairing_session_id, {
    pairing_code: session.pairing_code,
    display_name: "Sven ESP32",
    technical_capability_ids: ["wifi", "ota", "flash_firmware"],
  });
  const targets = service.otaTargets("acct-1", { requiredCapabilities: "wifi,ota" });

  assert.equal(completed.account_device.ownership_status, "paired_to_account");
  assert.equal(targets[0].selectable, true);
});

test("connectivity checks refresh the account inventory projection", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service, { connectivity_status: "unknown" });
  service.addAccountDevice("acct-1", {
    device_id: device.device_id,
    display_name: "Sven ESP32",
    technical_capability_ids: ["wifi", "ota"],
  });

  service.updateConnectivity(device.device_id, { connectivity_status: "online", ota_status: "ready" });

  const inventoryDevice = service.listAccountDevices("acct-1")[0];
  assert.equal(inventoryDevice.connectivity_status, "online");
  assert.equal(inventoryDevice.ota_status, "ready");
  assert.equal(service.otaTargets("acct-1", { requiredCapabilities: "wifi,ota" })[0].selectable, true);
});

test("community hardware remains usable but not support eligible", () => {
  const service = createDefaultDeviceManagementServer();
  const device = service.registerDevice({
    serial_number: "COMM-1",
    hardware_profile_id: "hardware.processor_board.esp32_unknown",
    connectivity_status: "offline",
    ota_status: "unknown",
  });

  const entitlement = service.supportEntitlement(device.device_id);
  assert.equal(device.authenticity_status, "community_unverified");
  assert.equal(entitlement.entitlement_status, "not_eligible");
});

test("purchase context links sold hardware to support entitlement after authenticity proof", () => {
  const service = createDefaultDeviceManagementServer();
  service.registerPurchaseContext("acct-1", {
    order_id: "order-1",
    hardware_item_ids: ["hardware.processor_board.generic_esp_wroom32"],
    capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.ota"],
    support_basis: "gernetix_purchase_context",
    provisioning_profile_ids: ["provisioning_profile.esp32_ota_bootstrap"],
  });
  const device = registerVerified(service, { serial_number: "GNX-ESP32-0002" });
  const accountDevice = service.addAccountDevice("acct-1", {
    device_id: device.device_id,
    display_name: "Gekauftes ESP32",
  });
  const entitlement = service.supportEntitlement(device.device_id);

  assert.equal(accountDevice.purchase_context_id, "order-1");
  assert.equal(entitlement.entitlement_status, "eligible");
  assert.equal(entitlement.source, "gernetix_purchase_context");
});

test("purchase context alone does not make community hardware support eligible", () => {
  const service = createDefaultDeviceManagementServer();
  service.registerPurchaseContext("acct-1", {
    order_id: "order-1",
    hardware_item_ids: ["hardware.processor_board.generic_esp_wroom32"],
    support_basis: "gernetix_purchase_context",
  });
  const device = service.registerDevice({
    serial_number: "COMM-2",
    hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
  });
  service.addAccountDevice("acct-1", { device_id: device.device_id });

  const entitlement = service.supportEntitlement(device.device_id);
  assert.equal(entitlement.entitlement_status, "not_eligible");
  assert.equal(entitlement.source, "purchase_context_requires_authenticity");
});

test("removes account device without deleting registered device", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  const accountDevice = service.addAccountDevice("acct-1", {
    device_id: device.device_id,
    display_name: "Sven ESP32",
  });

  const removed = service.removeAccountDevice("acct-1", accountDevice.account_device_id);

  assert.equal(removed.removed, true);
  assert.equal(removed.device_id, device.device_id);
  assert.equal(service.listAccountDevices("acct-1").length, 0);
  assert.equal(service.getStatus(device.device_id).device_id, device.device_id);
});

test("removing unknown account device returns not found", () => {
  const service = createDefaultDeviceManagementServer();

  assert.throws(
    () => service.removeAccountDevice("acct-1", "account_device_missing"),
    /AccountDevice wurde nicht gefunden/,
  );
});

test("admin device detail is masked without consent and full with consent", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  service.addAccountDevice("acct-1", {
    device_id: device.device_id,
    display_name: "Sven ESP32",
    technical_capability_ids: ["wifi", "ota"],
  });

  const masked = service.adminDevice(device.device_id, {
    actor_id: "support-1",
    role: "support",
    purpose: "support_case",
  });
  assert.equal(masked.access.decision, "masked");
  assert.equal(masked.device.serial_number, undefined);

  service.createConsent({
    account_id: "acct-1",
    granted_to_role: "support",
    purpose: "support_case",
    valid_until: "2099-01-01T00:00:00.000Z",
  });
  const full = service.adminDevice(device.device_id, {
    actor_id: "support-1",
    role: "support",
    purpose: "support_case",
  });
  assert.equal(full.access.decision, "full");
  assert.equal(full.device.serial_number, "GNX-ESP32-0001");
  assert.equal(service.auditEvents().length, 2);
});

test("json repository persists device inventory across reload", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gnx-device-management-"));
  const service = new DeviceManagementService({
    repository: FileBackedDeviceManagementRepository.create(runtimeRoot),
  });
  const device = registerVerified(service, { serial_number: "GNX-PERSIST-001" });
  service.addAccountDevice("acct-1", { device_id: device.device_id });

  const reloaded = new DeviceManagementService({
    repository: FileBackedDeviceManagementRepository.create(runtimeRoot),
  });

  assert.equal(reloaded.getStatus(device.device_id).serial_number, "GNX-PERSIST-001");
  assert.equal(reloaded.listAccountDevices("acct-1").length, 1);
});

test("sqlite repository persists device inventory across reload", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-device-management-sqlite-")), "state.sqlite");
  const service = new DeviceManagementService({
    repository: SqliteBackedDeviceManagementRepository.create(dbPath),
  });
  const device = registerVerified(service, { serial_number: "GNX-SQLITE-001" });
  service.addAccountDevice("acct-1", { device_id: device.device_id });

  const reloaded = new DeviceManagementService({
    repository: SqliteBackedDeviceManagementRepository.create(dbPath),
  });

  assert.equal(reloaded.getStatus(device.device_id).serial_number, "GNX-SQLITE-001");
  assert.equal(reloaded.listAccountDevices("acct-1").length, 1);

  const db = new DatabaseSync(dbPath);
  assert.equal(collectionCount(db, "device-management-server", "devices"), 1);
  assert.equal(collectionCount(db, "device-management-server", "account_devices"), 1);
  assert.equal(tableCount(db, "device_management_devices"), 1);
  assert.equal(tableCount(db, "device_management_account_devices"), 1);
  assert.equal(
    db.prepare("SELECT serial_number FROM device_management_devices WHERE device_id = ?").get(device.device_id).serial_number,
    "GNX-SQLITE-001",
  );
  db.close();
});

function collectionCount(db, serviceKey, collectionName) {
  return db.prepare(`
    SELECT COUNT(*) AS count
    FROM service_documents
    WHERE service_key = ? AND collection_name = ?
  `).get(serviceKey, collectionName).count;
}

function tableCount(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}
