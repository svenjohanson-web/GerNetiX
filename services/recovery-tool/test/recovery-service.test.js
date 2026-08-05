const assert = require("node:assert/strict");
const test = require("node:test");

const { createConfig, createDefaultRecoveryTool } = require("../src");

function createService(overrides = {}) {
  return createDefaultRecoveryTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    REGISTER_RECOVERED_DEVICES: "false",
  }), overrides);
}

function hardwareLabOverrides() {
  return {
    sourceReader: {
      async readAll(urls) {
        return urls.map((source_url) => ({ source_url, final_url: source_url, content_type: "text/html", kind: "text", byte_length: 120, text: "ESP32-S3 with 16 MB flash" }));
      },
    },
    hardwareLabAi: {
      async analyze(input) {
        return {
          provider: "openai-responses",
          model: "gpt-test",
          response_id: "resp-test",
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
          profile: {
            board_name: input.board_name,
            manufacturer: input.manufacturer || null,
            processor_family: "esp32",
            mcu_variant: "ESP32-S3",
            module_name: "ESP32-S3-WROOM-1",
            flash_bytes: 16777216,
            psram_bytes: 8388608,
            ram_bytes: 524288,
            platformio: { platform: "espressif32", board: "esp32-s3-devkitc-1", framework: "arduino", environment: "hardware_lab_test", build_flags: ["-DBOARD_HAS_PSRAM"] },
            capabilities: ["wifi", "bluetooth"],
            integrated_peripherals: [],
            pin_candidates: [],
            evidence: [{ property: "flash_bytes", value: "16 MB", source_url: input.sources[0].source_url, confidence: "documented" }],
            unresolved_questions: [],
            discovery_expectations: { passive_checks: ["flash size", "psram size"], active_checks_requiring_confirmation: [], safety_notes: [] },
          },
        };
      },
      async chat(input) {
        return {
          answer: "GPIO 8 und 9 sind als I2C-Kandidaten dokumentiert. Vor einem aktiven Scan brauche ich deine Bestätigung.",
          profile_updates: {
            facts: [], capabilities: [], peripherals: [],
            pins: [
              { function: "i2c_sda", gpio: 8, direction: "bus", active_test_allowed: false, source_url: input.source_urls[0], confidence: "documented" },
              { function: "i2c_scl", gpio: 9, direction: "bus", active_test_allowed: false, source_url: input.source_urls[0], confidence: "documented" },
            ],
            resolved_questions: [], open_questions: [],
          },
          next_step: "complete",
          next_question: null,
          completed: true,
          suggested_actions: ["build_discovery_firmware"],
          proposed_tests: [{ id: "i2c-scan", title: "Passiver I2C-Scan", description: "Erkannte Adressen lesen", risk: "passive", requires_confirmation: true }],
          model: "gpt-test",
          response_id: "resp-chat",
          usage: { total_tokens: 80 },
        };
      },
    },
    buildDeployClient: {
      async submit(request) { return { job_id: request.job_id, status: "running" }; },
      async get(jobId) {
        return {
          job_id: jobId,
          status: "succeeded",
          finished_at: "2026-08-04T12:00:00.000Z",
          result: { build: { build_id: "c".repeat(64), primary_firmware: { file_name: "firmware.bin", sha256: "c".repeat(64) } } },
        };
      },
      artifactUrl(jobId, fileName) { return `http://build.test/artifacts/${jobId}/${fileName}`; },
    },
  };
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

test("creates hardware lab session with mandatory physical discovery", () => {
  const service = createService();
  const session = service.createHardwareLabSession({
    account_id: "acct-lab",
    board_name: "Example ESP32-S3 Board",
    manufacturer: "Example Devices",
    source_urls: ["https://example.test/boards/esp32-s3", "https://example.test/esp32-s3.pdf"],
  });

  assert.equal(session.recovery_type, "ai_guided_hardware_lab");
  assert.equal(session.status, "source_submitted");
  assert.equal(session.discovery.mandatory, true);
  assert.equal(session.discovery.verification_status, "discovery_pending");
  assert.equal(session.candidate_profile.board_origin, "customer_purchased_community_board");
  assert.equal(session.candidate_profile.source_evidence.length, 2);
  assert.equal(session.lab_chat.assistant_state.step, "sources");
  assert.match(session.lab_chat.assistant_state.current_question, /Herstellerquelle/);
});

test("starts a hardware-lab session from one natural-language message without requiring form fields", () => {
  const service = createService();
  const session = service.createHardwareLabSession({
    account_id: "acct-lab",
    initial_message: "Ich habe hier ein ESP32-S3-Board mit Display, weiß aber noch nicht von welchem Hersteller.",
  });

  assert.equal(session.candidate_profile.board_name, "Noch unbekanntes Board");
  assert.match(session.candidate_profile.notes, /ESP32-S3-Board mit Display/);
  assert.deepEqual(session.candidate_profile.source_evidence, []);
});

test("requires successful discovery build and all examination phases", async () => {
  const service = createService(hardwareLabOverrides());
  const session = service.createHardwareLabSession({
    account_id: "acct-lab",
    board_name: "Example Board",
    source_urls: ["https://example.test/board"],
  });

  assert.throws(
    () => service.recordHardwareExamination(session.recovery_session_id, { result: "passed" }),
    (error) => error.code === "successful_discovery_build_required",
  );

  await service.analyzeHardwareLabSources(session.recovery_session_id);
  await assert.rejects(
    () => service.requestDiscoveryFirmwareBuild(session.recovery_session_id),
    (error) => error.code === "hardware_lab_dialog_incomplete",
  );
  await service.chatHardwareLab(session.recovery_session_id, { message: "Die erkannten Angaben stimmen. Einrichtung abschließen." });
  await service.requestDiscoveryFirmwareBuild(session.recovery_session_id);
  const built = await service.synchronizeDiscoveryFirmwareBuild(session.recovery_session_id);

  assert.throws(
    () => service.recordHardwareExamination(session.recovery_session_id, {
      result: "passed",
      safe_detection_complete: true,
      report_id: "report-incomplete",
      firmware_build_id: built.discovery.firmware_build.build_id,
      firmware_sha256: built.discovery.firmware_build.firmware_sha256,
      completed_phases: ["chip_and_memory"],
    }),
    (error) => error.code === "hardware_examination_incomplete" && error.details.missing_phases.length === 4,
  );
});

test("persists the OpenAI hardware-lab conversation and updates the structured board profile", async () => {
  const service = createService(hardwareLabOverrides());
  const session = service.createHardwareLabSession({ account_id: "acct-lab", board_name: "Example Board", source_urls: ["https://example.test/board"] });
  await service.analyzeHardwareLabSources(session.recovery_session_id);
  const chatted = await service.chatHardwareLab(session.recovery_session_id, { message: "Kannst du SDA und SCL bestimmen?" });

  assert.deepEqual(chatted.lab_chat.messages.map((message) => message.role), ["user", "assistant"]);
  assert.equal(chatted.lab_chat.proposed_tests[0].requires_confirmation, true);
  assert.deepEqual(chatted.candidate_profile.pin_candidates.map((pin) => pin.gpio), [8, 9]);
  assert.equal(chatted.lab_chat.assistant_state.completed, true);
  assert.equal(chatted.lab_chat.assistant_state.step, "complete");
  assert.equal(chatted.actions.at(-1).type, "hardware_lab_ai_chat_completed");
});

test("recognizes a manufacturer link inside the chat and analyzes it without a URL form", async () => {
  const service = createService(hardwareLabOverrides());
  const session = service.createHardwareLabSession({ account_id: "acct-lab", initial_message: "Ich möchte ein unbekanntes Board anlegen." });
  const chatted = await service.chatHardwareLab(session.recovery_session_id, { message: "Das könnte dieses Board sein: https://example.test/board" });

  assert.deepEqual(chatted.candidate_profile.source_evidence, [{ source_url: "https://example.test/board", review_status: "analyzed" }]);
  assert.equal(chatted.ai_analysis.status, "completed");
  assert.match(chatted.lab_chat.messages[1].content, /GPIO 8 und 9/);
});

test("allows GerNetiX verification request only after examined hardware and consent", async () => {
  const service = createService(hardwareLabOverrides());
  const session = service.createHardwareLabSession({
    account_id: "acct-lab",
    board_name: "Example Board",
    source_urls: ["https://example.test/board"],
  });

  assert.throws(
    () => service.requestGerNetiXVerification(session.recovery_session_id, {
      consent_to_share_profile: true,
    }),
    (error) => error.code === "hardware_examination_required",
  );

  await service.analyzeHardwareLabSources(session.recovery_session_id);
  await service.chatHardwareLab(session.recovery_session_id, { message: "Die Board-Akte ist vollständig. Einrichtung abschließen." });
  await service.requestDiscoveryFirmwareBuild(session.recovery_session_id);
  const built = await service.synchronizeDiscoveryFirmwareBuild(session.recovery_session_id);
  const examined = service.recordHardwareExamination(session.recovery_session_id, {
    result: "passed",
    safe_detection_complete: true,
    report_id: "report-2",
    firmware_build_id: built.discovery.firmware_build.build_id,
    firmware_sha256: built.discovery.firmware_build.firmware_sha256,
    completed_phases: built.discovery.required_phases,
    capabilities: ["capability.processor_esp32", "capability.wifi"],
    findings: [{ property: "flash_size", observed_value: "16 MB", source_value: "16 MB", status: "confirmed" }],
  });

  assert.equal(examined.status, "hardware_examined");
  assert.throws(
    () => service.requestGerNetiXVerification(session.recovery_session_id, {
      consent_to_share_profile: false,
    }),
    (error) => error.code === "verification_consent_required",
  );

  const requested = service.requestGerNetiXVerification(session.recovery_session_id, {
    consent_to_share_profile: true,
    customer_message: "Bitte dieses selbst gekaufte Board gegenpruefen.",
  });
  assert.equal(requested.status, "gernetix_verification_requested");
  assert.equal(requested.gernetix_verification_request.board_origin, "customer_purchased_community_board");
  assert.equal(requested.gernetix_verification_request.follow_up_required, true);
  assert.equal(requested.gernetix_verification_request.shipping_details_collected, false);
  assert.equal(requested.gernetix_verification_request.shared_scope.includes("hardware_examination_report"), true);
});
