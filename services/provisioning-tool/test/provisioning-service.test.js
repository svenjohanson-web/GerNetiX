const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createConfig,
  createDefaultProvisioningTool,
} = require("../src");

function createService() {
  return createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    REGISTER_DEVICE_ON_COMPLETE: "false",
  }));
}

function validInput(overrides = {}) {
  return {
    serial_number: "GNX-ESP32-0001",
    hardware_profile_id: "hardware.processor_board.esp32_devkit",
    provisioning_batch_id: "batch-2026-07",
    firmware_version: "0.1.0",
    provisioned_by: "support@sven.local",
    capabilities: ["ota", "wifi"],
    service_endpoints: {
      device_management: "https://devices.gernetix.test/api/device-management",
      build_deploy: "https://build.gernetix.test",
    },
    flash: {
      requested: true,
      port: "COM3",
    },
    ...overrides,
  };
}

test("creates provisioning session with one-time secret and redacted later status", () => {
  const service = createService();
  const created = service.createSession(validInput());

  assert.equal(created.status, "prepared");
  assert.ok(created.device.device_id.startsWith("device_"));
  assert.ok(created.credential.credential_id.startsWith("cred_"));
  assert.ok(created.one_time_device_secret);
  assert.equal(created.flash_plan.status, "planned");

  const fetched = service.getSession(created.session_id);
  assert.equal(fetched.one_time_device_secret, undefined);
  assert.equal(fetched.credential.one_time_device_secret, undefined);
  assert.equal(fetched.credential.key_reference, created.credential.key_reference);
  assert.ok(fetched.credential.secret_sha256);
});

test("manifest contains endpoint and credential reference but no raw secret", () => {
  const service = createService();
  const created = service.createSession(validInput());
  const manifest = service.getManifest(created.session_id);

  assert.equal(manifest.device_id, created.device.device_id);
  assert.equal(manifest.firmware.ota_preserved, true);
  assert.equal(manifest.service_endpoints.build_deploy, "https://build.gernetix.test");
  assert.equal(manifest.credential.key_reference, created.credential.key_reference);
  assert.equal(manifest.credential.one_time_device_secret, undefined);
});

test("rejects second active credential for same serial number", () => {
  const service = createService();
  service.createSession(validInput());

  assert.throws(
    () => service.createSession(validInput()),
    /bereits ein aktives Credential/,
  );
});

test("complete marks manufacturer registration and device lifecycle", async () => {
  const service = createService();
  const created = service.createSession(validInput({ flash: { requested: false } }));
  const completed = await service.completeSession(created.session_id, {
    completed_by: "qa@sven.local",
    quality_check_state: "passed",
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.device.lifecycle_state, "provisioned_by_gernetix");
  assert.equal(completed.manufacturer_registration.quality_check_state, "passed");
  assert.equal(completed.audit_events.at(-1).type, "provisioning_completed");
});
