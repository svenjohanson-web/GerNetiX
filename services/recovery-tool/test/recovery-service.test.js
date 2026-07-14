const assert = require("node:assert/strict");
const test = require("node:test");

const { createConfig, createDefaultRecoveryTool } = require("../src");

function createService() {
  return createDefaultRecoveryTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    REGISTER_RECOVERED_DEVICES: "false",
  }));
}

test("creates recovery session from USB detection", () => {
  const service = createService();
  const session = service.createSession({
    account_id: "acct-1",
    detection: {
      usb_path: "COM7",
      vendor_id: "10c4",
      product_id: "ea60",
      serial_number: "REC-BOARD-001",
    },
  });

  assert.equal(session.status, "detected");
  assert.equal(session.hardware_profile_id, "hardware.processor_board.generic_esp_wroom32");
  assert.equal(session.capabilities.includes("capability.wifi"), true);
  assert.equal(session.guided_questions.length, 3);
});

test("confirms guided capabilities", () => {
  const service = createService();
  const session = service.createSession({ detection: { usb_path: "COM8" } });
  const confirmed = service.answerCapabilities(session.recovery_session_id, {
    capabilities: ["capability.digital_input"],
    answers: { wifi_available: true },
  });

  assert.equal(confirmed.status, "capabilities_confirmed");
  assert.equal(confirmed.capabilities.includes("capability.digital_input"), true);
  assert.equal(confirmed.guided_answers.wifi_available, true);
});

test("renews public-key credentials without receiving a private key", () => {
  const service = createService();
  const session = service.createSession({ detection: { usb_path: "COM9" } });
  const renewed = service.renewCredentials(session.recovery_session_id, {
    public_key_pem: "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
    certificate_pem: "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
  });
  const fetched = service.getSession(session.recovery_session_id);

  assert.equal(renewed.status, "credentials_renewed");
  assert.equal(renewed.one_time_device_secret, undefined);
  assert.equal(fetched.credential.credential_type, "ECDSA_P256_X509");
  assert.equal(fetched.credential.credential_id, renewed.credential.credential_id);
});

test("dry-run community registration updates recovery state", async () => {
  const service = createService();
  const session = service.createSession({ detection: { usb_path: "COM10" } });
  const registered = await service.registerCommunityDevice(session.recovery_session_id, {
    credential: { credential_id: "cred-1", credential_type: "ECDSA_P256_X509" },
  });

  assert.equal(registered.status, "registered_with_device_management");
  assert.equal(registered.device_management_registration.registration_mode, "dry_run");
  assert.equal(registered.recovery_state.credential, "registered_with_public_key");
});

test("prepares connectivity reset without storing wifi password centrally", () => {
  const service = createService();
  const session = service.createSession({ detection: { usb_path: "COM11" } });
  const reset = service.resetConnectivity(session.recovery_session_id);

  assert.equal(reset.status, "connectivity_repair_prepared");
  assert.equal(reset.connectivity_repair.store_wifi_password_centrally, false);
  assert.equal(reset.recovery_state.connectivity, "ap_mode_ready");
});
