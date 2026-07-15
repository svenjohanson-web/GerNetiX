const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const { createDefaultDeviceManagementServer, FileBackedDeviceManagementRepository, SqliteBackedDeviceManagementRepository } = require("../src");
const { DeviceManagementService } = require("../src/services/device-management-service");

const TEST_DEVICE_KEYS = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const TEST_DEVICE_PUBLIC_KEY = TEST_DEVICE_KEYS.publicKey.export({ type: "spki", format: "pem" }).toString();

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
    credential: {
      credential_id: "cred-1",
      key_reference: "device-key://device/cred-1",
      public_key_pem: TEST_DEVICE_PUBLIC_KEY,
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

test("verifies ECDSA P-256 challenge for GerNetiX device", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  const challenge = service.createChallenge(device.device_id);
  const signature = crypto.sign("sha256", Buffer.from(challenge.canonical), {
    key: TEST_DEVICE_KEYS.privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  const result = service.verifyChallenge(device.device_id, {
    challenge_id: challenge.challenge_id,
    signature,
  });

  assert.equal(result.verification_state, "verified");
  assert.equal(result.authenticity_status, "gernetix_verified");
});

test("issues only a hashed, short-lived, one-time provisioning token", () => {
  const service = createDefaultDeviceManagementServer();
  const issued = service.createProvisioningToken({ account_id: "acct-1", provisioning_binding: "usb-board-1" });

  assert.match(issued.provisioning_token, /^[A-Za-z0-9_-]{32,}$/);
  assert.equal(service.repository.provisioningTokens.size, 1);
  const stored = Array.from(service.repository.provisioningTokens.values())[0];
  assert.notEqual(stored.token_hash_sha256, issued.provisioning_token);
  assert.equal(stored.status, "issued");

  const consumed = service.consumeProvisioningToken({
    provisioning_token: issued.provisioning_token,
    provisioning_binding: "usb-board-1",
  });
  assert.equal(consumed.account_id, "acct-1");
  assert.throws(() => service.consumeProvisioningToken({
    provisioning_token: issued.provisioning_token,
    provisioning_binding: "usb-board-1",
  }), /ungueltig|abgelaufen|verwendet/);
});

test("sqlite repository persists only the provisioning token hash", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-provisioning-token-")), "state.sqlite");
  const service = new DeviceManagementService({
    repository: SqliteBackedDeviceManagementRepository.create(dbPath),
  });
  const issued = service.createProvisioningToken({ account_id: "acct-1", provisioning_binding: "usb-board-1" });

  const database = new DatabaseSync(dbPath);
  const row = database.prepare("SELECT token_hash_sha256, raw_json FROM device_management_provisioning_tokens").get();
  database.close();
  assert.notEqual(row.token_hash_sha256, issued.provisioning_token);
  assert.doesNotMatch(row.raw_json, new RegExp(issued.provisioning_token));

  const reloaded = new DeviceManagementService({
    repository: SqliteBackedDeviceManagementRepository.create(dbPath),
  });
  assert.equal(reloaded.consumeProvisioningToken({
    provisioning_token: issued.provisioning_token,
    provisioning_binding: "usb-board-1",
  }).account_id, "acct-1");
});

test("rejects a challenge signature from another device key", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  const challenge = service.createChallenge(device.device_id);
  const other = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const signature = crypto.sign("sha256", Buffer.from(challenge.canonical), {
    key: other.privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  const result = service.verifyChallenge(device.device_id, { challenge_id: challenge.challenge_id, signature });
  assert.equal(result.verification_state, "failed");
  assert.equal(result.authenticity_status, "community_unverified");
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

test("resolves push recipients from the current account-device ownership", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  service.addAccountDevice("acct-owner", { device_id: device.device_id });
  service.addAccountDevice("acct-second-device", { device_id: device.device_id });

  assert.deepEqual(service.pushRecipients(device.device_id), {
    device_id: device.device_id,
    account_ids: ["acct-owner", "acct-second-device"],
  });
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

test("basissoftware profile can be changed later and exposes required USB migration", () => {
  const service = createDefaultDeviceManagementServer();
  const device = registerVerified(service);
  const accountDevice = service.addAccountDevice("acct-1", {
    device_id: device.device_id,
    display_name: "Display Board",
    technical_capability_ids: ["wifi", "ota", "flash_firmware"],
    instance_configuration: {
      basissoftware_profile: {
        class: "full",
        partition_profile_id: "partition.profile.esp32.ota_ab",
      },
    },
  });

  const result = service.updateAccountDeviceBasissoftwareProfile("acct-1", accountDevice.account_device_id, {
    profile: "low",
  });

  assert.equal(result.requires_usb_reflash, true);
  assert.equal(result.account_device.instance_configuration.basissoftware_profile.profile_id, "basissoftware.profile.esp32.low");
  assert.equal(result.account_device.instance_configuration.basissoftware_profile.change_state, "usb_reflash_required");
  assert.equal(result.account_device.technical_capability_ids.includes("ota"), false);
  assert.equal(result.account_device.ota_status, "unsupported");
});

test("repository migration removes legacy shared device secrets", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gnx-device-secret-migration-"));
  const statePath = path.join(runtimeRoot, "device-management-state.json");
  fs.writeFileSync(statePath, JSON.stringify({
    devices: [],
    credentials: [{
      device_id: "device-legacy",
      credential_id: "cred-legacy",
      secret: "legacy-shared-secret",
      device_secret: "legacy-shared-secret",
      one_time_device_secret: "legacy-shared-secret",
      secret_sha256: "obsolete-hash",
    }],
  }));

  FileBackedDeviceManagementRepository.create(runtimeRoot);
  const migrated = fs.readFileSync(statePath, "utf8");
  assert.doesNotMatch(migrated, /legacy-shared-secret|obsolete-hash|device_secret|one_time_device_secret/);
});

test("sqlite migration clears legacy normalized credential secrets", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-device-secret-sqlite-")), "state.sqlite");
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`CREATE TABLE device_management_credentials (
    device_id TEXT PRIMARY KEY, credential_id TEXT, credential_type TEXT, key_reference TEXT,
    status TEXT, created_at TEXT, secret TEXT, raw_json TEXT NOT NULL
  )`);
  legacy.prepare("INSERT INTO device_management_credentials VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "device-legacy", "cred-legacy", "HMAC_SHA256", "legacy", "active", new Date().toISOString(),
    "legacy-shared-secret", JSON.stringify({ device_id: "device-legacy", secret: "legacy-shared-secret" }),
  );
  legacy.close();

  SqliteBackedDeviceManagementRepository.create(dbPath);
  const migrated = new DatabaseSync(dbPath);
  const row = migrated.prepare("SELECT secret, raw_json FROM device_management_credentials WHERE device_id = ?").get("device-legacy");
  assert.equal(row.secret, null);
  assert.doesNotMatch(row.raw_json, /legacy-shared-secret|secret/);
  migrated.close();
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
