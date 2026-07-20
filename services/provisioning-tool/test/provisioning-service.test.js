const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createConfig,
  createDefaultProvisioningTool,
  UsbFlashRunner,
} = require("../src");

const TEST_DEVICE_KEYS = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const TEST_DEVICE_PUBLIC_KEY = TEST_DEVICE_KEYS.publicKey.export({ type: "spki", format: "pem" }).toString();

function configureAsymmetricDevice(service, onRequest = () => {}) {
  service.certificateIssuer = {
    isConfigured: () => true,
    async issue() {
      return {
        certificate_pem: "-----BEGIN CERTIFICATE-----\nTEST-DEVICE-CERTIFICATE\n-----END CERTIFICATE-----\n",
        certificate_serial_number: "01",
        certificate_fingerprint_sha256: "ab".repeat(32),
        issued_at: new Date().toISOString(),
        expires_at: "2099-01-01T00:00:00.000Z",
      };
    },
  };
  service.fetchImpl = async (url, options = {}) => {
    const payload = options.body ? JSON.parse(options.body) : {};
    onRequest(url, payload);
    if (String(url).endsWith("/auth/challenge")) {
      const signature = crypto.sign("sha256", Buffer.from(payload.canonical), {
        key: TEST_DEVICE_KEYS.privateKey,
        dsaEncoding: "ieee-p1363",
      }).toString("base64url");
      return { ok: true, status: 200, async text() { return JSON.stringify({ signature }); } };
    }
    const body = payload.mqtt_client_certificate_pem
      ? { status: "certificate_stored" }
      : { status: "provisioned", public_key_pem: TEST_DEVICE_PUBLIC_KEY };
    return { ok: true, status: 200, async text() { return JSON.stringify(body); } };
  };
}

function createService() {
  return createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    REGISTER_DEVICE_ON_COMPLETE: "false",
  }));
}

function createServiceWithGeneratedHeader(headerPath) {
  return createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    REGISTER_DEVICE_ON_COMPLETE: "false",
    PROVISIONING_GENERATED_HEADER_PATH: headerPath,
  }));
}

function validInput(overrides = {}) {
  return {
    serial_number: "GNX-ESP32-0001",
    hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
    provisioning_batch_id: "batch-2026-07",
    firmware_version: "0.1.0",
    provisioned_by: "support@sven.local",
    capabilities: ["ota", "wifi"],
    service_endpoints: {
      device_management: "https://devices.gernetix.test/api/device-management",
      build_deploy: "https://build.gernetix.test",
      mqtt_broker: "mqtts://mqtt.gernetix.test:8883",
    },
    flash: {
      requested: true,
      port: "COM3",
    },
    ...overrides,
  };
}

test("creates provisioning session without shared secret", async () => {
  const service = createService();
  const created = await service.createSession(validInput());

  assert.equal(created.status, "prepared");
  assert.ok(created.device.device_id.startsWith("device_"));
  assert.equal(created.device.processor_board_id, "hardware.processor_board.generic_esp_wroom32");
  assert.ok(created.credential.credential_id.startsWith("cred_"));
  assert.equal(created.one_time_device_secret, undefined);
  assert.equal(created.flash_plan.status, "planned");
  assert.equal(created.flash_plan.transport, "usb");
  assert.equal(created.flash_plan.provisioning_transport, "usb_flash_image");
  assert.equal(created.usb_flash_package.transport, "usb");
  assert.equal(created.usb_flash_package.target_runtime, "server_firmware_artifact");
  assert.equal(created.usb_flash_package.firmware_artifact.source, "sqlite");
  assert.equal(created.usb_flash_package.generated_files[0].path, "basissoftware/esp32/include/basissoftware/generated_provisioning_payload.h");
  assert.equal(created.usb_flash_package.generated_files[0].contains_secret, false);
  assert.match(created.usb_flash_package.generated_files[0].content, /GERNETIX_FACTORY_PROVISIONING_PAYLOAD/);
  assert.doesNotMatch(created.usb_flash_package.generated_files[0].content, /one_time_device_secret/);

  const fetched = service.getSession(created.session_id);
  assert.equal(fetched.one_time_device_secret, undefined);
  assert.equal(fetched.usb_flash_package, undefined);
  assert.equal(fetched.credential.one_time_device_secret, undefined);
  assert.equal(fetched.credential.key_reference, created.credential.key_reference);
  assert.equal(fetched.credential.algorithm, "ECDSA_P256_SHA256");
});

test("manifest contains endpoint and credential reference but no raw secret", async () => {
  const service = createService();
  const created = await service.createSession(validInput());
  const manifest = service.getManifest(created.session_id);

  assert.equal(manifest.device_id, created.device.device_id);
  assert.equal(manifest.processor_board.hardware_item_id, "hardware.processor_board.generic_esp_wroom32");
  assert.equal(manifest.processor_board.basissoftware_profile_id, "basissoftware.profile.esp32_factory");
  assert.equal(manifest.firmware.ota_preserved, true);
  assert.equal(manifest.firmware.artifact.source, "sqlite");
  assert.equal(manifest.firmware.artifact.artifact_id, "firmware_artifact.esp32_basissoftware_factory.latest");
  assert.equal(manifest.service_endpoints.build_deploy, "https://build.gernetix.test");
  assert.equal(manifest.service_endpoints.mqtt_broker, "mqtts://mqtt.gernetix.test:8883");
  assert.equal(manifest.credential.key_reference, created.credential.key_reference);
  assert.equal(manifest.credential.one_time_device_secret, undefined);
});

test("accepts a local private IPv4 MQTT broker", async () => {
  const service = createService();
  const input = validInput({ mqtt_mode: "local" });
  input.serial_number = "GNX-ESP32-LOCAL";
  input.service_endpoints.mqtt_broker = "mqtt://192.168.50.20:1883";
  const created = await service.createSession(input);

  assert.equal(service.getManifest(created.session_id).service_endpoints.mqtt_broker, "mqtt://192.168.50.20:1883");
});

test("lists GerNetiX Flashbox as purchase-only provisioning target", async () => {
  const service = createService();
  const result = await service.listFlashboxes();

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].hardware_class, "flashbox");
  assert.equal(result.items[0].purchase_policy, "gernetix_purchase_only");
  assert.equal(result.items[0].self_creation_allowed, false);
  assert.ok(result.items[0].capabilities.includes("flashbox.target_flash"));
  assert.equal(result.items[0].factory_firmware_artifact.artifact_id, "firmware_artifact.flashbox_factory.latest");
  assert.equal(result.items[0].factory_firmware_artifact.source, "public_signed_manifest");
});

test("creates flashbox register session without treating it as processor board", async () => {
  const service = createService();
  const created = await service.createSession(validInput({
    hardware_class: "flashbox",
    serial_number: "GNX-FLASHBOX-0001",
    hardware_profile_id: "hardware.flashbox.esp32_s3_28_otg",
    flashbox_id: "hardware.flashbox.esp32_s3_28_otg",
    capabilities: ["flashbox.self_update", "flashbox.target_flash"],
    flash: {
      requested: false,
      write_factory_header: false,
    },
  }));
  const manifest = service.getManifest(created.session_id);

  assert.equal(created.device.hardware_class, "flashbox");
  assert.equal(created.device.processor_board_id, "");
  assert.equal(created.device.flashbox_id, "hardware.flashbox.esp32_s3_28_otg");
  assert.equal(created.device.purchase_policy, "gernetix_purchase_only");
  assert.equal(created.device.factory_claim_mode, "wlan_visible_challenge");
  assert.equal(created.device.device_key_policy, "device_private_key_non_exportable");
  assert.equal(created.device.release_trust_anchor_id, "gernetix_flashbox_release_key.v1");
  assert.equal(created.manufacturer_registration.public_key_registration, "factory_public_key_required");
  assert.equal(created.manufacturer_registration.private_key_policy, "generated_or_injected_non_exportable_on_device");
  assert.equal(manifest.hardware_class, "flashbox");
  assert.equal(manifest.processor_board, null);
  assert.equal(manifest.flashbox.hardware_item_id, "hardware.flashbox.esp32_s3_28_otg");
  assert.equal(manifest.flashbox.self_creation_allowed, false);
  assert.deepEqual(manifest.flashbox.claim_modes, ["wlan_visible_challenge", "manual_purchase_code_fallback"]);
  assert.equal(manifest.flashbox.copy_protection.proof, "challenge_signature");
  assert.equal(manifest.flashbox.copy_protection.device_key_policy, "device_private_key_non_exportable");
  assert.equal(manifest.flashbox.copy_protection.claim_primary_path, "wlan_visible_flashbox");
  assert.equal(manifest.flashbox.copy_protection.fallback_path, "manual_purchase_code");
  assert.equal(manifest.firmware.basis, "gernetix-flashbox-firmware");
  assert.equal(manifest.firmware.artifact.artifact_id, "firmware_artifact.flashbox_factory.latest");
  assert.equal(manifest.firmware.artifact.source, "public_signed_manifest");
  assert.equal(JSON.stringify(manifest).includes("PRIVATE KEY"), false);
  assert.equal(created.flash_plan.requested, false);
});

test("rejects a public plaintext MQTT broker", async () => {
  const service = createService();
  const input = validInput({ mqtt_mode: "local" });
  input.serial_number = "GNX-ESP32-PUBLIC";
  input.service_endpoints.mqtt_broker = "mqtt://8.8.8.8:1883";

  await assert.rejects(() => service.createSession(input), (error) => error.code === "invalid_mqtt_broker");
});

test("exposes firmware artifact content for browser USB flash", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-artifact-"));
  const firmwarePath = path.join(tempRoot, "merged-firmware.bin");
  fs.writeFileSync(firmwarePath, "test firmware");
  const service = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    REGISTER_DEVICE_ON_COMPLETE: "false",
    PROVISIONING_FIRMWARE_FILE_PATH: firmwarePath,
  }));
  const created = await service.createSession(validInput());
  const content = service.getFirmwareArtifactContent(created.usb_flash_package.firmware_artifact.artifact_id);

  assert.equal(content.artifact.artifact_id, "firmware_artifact.esp32_basissoftware_factory.latest");
  assert.ok(content.bytes.length > 0);
  assert.equal(content.sha256, content.artifact.sha256);
});

test("records browser Web Serial flash result without server runner", async () => {
  const service = createService();
  const created = await service.createSession(validInput({
    flash: {
      requested: true,
      write_factory_header: true,
    },
  }));

  const flashed = service.recordBrowserUsbFlashResult(created.session_id, {
    status: "flashed",
    actor: "factory@sven.local",
    port: "WebSerial 1A86:7523",
    chip_name: "ESP32",
    stdout: "browser flash ok",
  });

  assert.equal(flashed.flash_plan.status, "usb_flashed");
  assert.equal(flashed.usb_flash_result.runner, "web_serial");
  assert.equal(flashed.usb_flash_result.transport, "web_serial");
  assert.equal(flashed.usb_flash_result.port, "WebSerial 1A86:7523");
  assert.equal(flashed.audit_events.at(-1).runner, "web_serial");
});

test("persists provisioning identifier on board through local device endpoint", async () => {
  const service = createService();
  const created = await service.createSession(validInput());
  let capturedUrl = "";
  let capturedPayload = null;
  configureAsymmetricDevice(service, (url, payload) => {
    if (!String(url).endsWith("/auth/challenge") && !payload.mqtt_client_certificate_pem) {
      capturedUrl = url;
      capturedPayload = payload;
    }
  });

  const stored = await service.persistDeviceProvisioning(created.session_id, {
    actor: "factory@sven.local",
    device_url: "http://192.168.4.1/provisioning",
  });

  assert.equal(capturedUrl, "http://192.168.4.1/provisioning");
  assert.equal(capturedPayload.serial_number, "GNX-ESP32-0001");
  assert.equal(capturedPayload.device_id, created.device.device_id);
  assert.equal(capturedPayload.one_time_device_secret, undefined);
  assert.match(stored.credential.public_key_pem, /BEGIN PUBLIC KEY/);
  assert.equal(stored.credential.proof_of_possession, "verified");
  assert.equal(stored.device.local_provisioning_state, "stored_on_board");
  assert.equal(stored.device_provisioning.status, "stored_on_board");
  assert.equal(stored.audit_events.at(-1).type, "device_provisioning_stored_on_board");
});

test("discovers device provisioning target from GerNetiX status endpoint", async () => {
  const service = createService();
  service.fetchImpl = async (url) => {
    if (url !== "http://gernetix-esp32/status") {
      return { ok: false, status: 404, async json() { return {}; } };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          device: "gernetix-esp32",
          runtime: "gernetix-runtime-basissoftware",
          serialNumber: "GNX-ESP32-0001",
          deviceId: "device_test",
        };
      },
    };
  };

  const result = await service.discoverDeviceProvisioningTargets({
    candidates: ["gernetix-esp32"],
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].status_url, "http://gernetix-esp32/status");
  assert.equal(result.items[0].provisioning_url, "http://gernetix-esp32/provisioning");
  assert.equal(result.items[0].serial_number, "GNX-ESP32-0001");
});

test("suggests setup AP provisioning URL when connected SSID starts with gernetix prefix", async () => {
  const service = createService();
  service.wifiSsidProvider = async () => "gernetix-factory-7";
  service.fetchImpl = async () => ({ ok: false, status: 404, async json() { return {}; } });

  const result = await service.discoverDeviceProvisioningTargets();

  assert.equal(result.setup_ap_detected, true);
  assert.equal(result.current_wifi_ssid, "gernetix-factory-7");
  assert.equal(result.suggested_provisioning_url, "http://192.168.4.1/provisioning");
});

test("writes factory provisioning header only for explicit USB flash package request", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-"));
  const headerPath = path.join(tempRoot, "include", "basissoftware", "generated_provisioning_payload.h");
  const service = createServiceWithGeneratedHeader(headerPath);
  const created = await service.createSession(validInput({
    flash: {
      requested: true,
      port: "COM3",
      write_factory_header: true,
    },
  }));

  assert.equal(created.usb_flash_package.written_file.path, headerPath);
  assert.equal(created.usb_flash_package.written_file.contains_secret, false);
  assert.equal(fs.existsSync(headerPath), true);

  const content = fs.readFileSync(headerPath, "utf8");
  assert.match(content, /GERNETIX_FACTORY_PROVISIONING_PAYLOAD/);
  assert.doesNotMatch(content, /one_time_device_secret/);
  assert.match(content, new RegExp(created.device.device_id));
});

test("executes USB flash step after factory header was written", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-flash-"));
  const headerPath = path.join(tempRoot, "include", "basissoftware", "generated_provisioning_payload.h");
  const service = createServiceWithGeneratedHeader(headerPath);
  const created = await service.createSession(validInput({
    flash: {
      requested: true,
      port: "COM7",
      write_factory_header: true,
    },
  }));

  const flashed = await service.executeUsbFlash(created.session_id, {
    actor: "factory@sven.local",
  });

  assert.equal(flashed.flash_plan.status, "usb_flash_mocked");
  assert.equal(flashed.usb_flash_result.status, "mock_flash_completed");
  assert.equal(flashed.usb_flash_result.transport, "usb");
  assert.equal(flashed.usb_flash_result.port, "COM7");
  assert.equal(flashed.usb_flash_result.firmware_artifact.source, "sqlite");
  assert.equal(flashed.audit_events.at(-1).type, "usb_flash_executed");
});

test("blocks real USB flash when server did not explicitly allow it", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-real-blocked-"));
  const headerPath = path.join(tempRoot, "include", "basissoftware", "generated_provisioning_payload.h");
  const service = createServiceWithGeneratedHeader(headerPath);
  const created = await service.createSession(validInput({
    flash: {
      requested: true,
      port: "COM7",
      write_factory_header: true,
    },
  }));

  await assert.rejects(
    () => service.executeUsbFlash(created.session_id, { flash_runner: "esptool" }),
    /Echter USB-Flash ist serverseitig deaktiviert/,
  );
});

test("exposes flash modes for the UI", () => {
  const service = createService();
  const mode = service.getFlashMode();

  assert.equal(mode.default_runner, "mock");
  assert.equal(mode.allow_real_usb_flash, false);
  assert.equal(mode.modes.find((item) => item.id === "mock").enabled, true);
  assert.equal(mode.modes.find((item) => item.id === "esptool").enabled, false);
});

test("uses configured python executable for esptool.py on Windows", () => {
  const invocation = UsbFlashRunner.createEsptoolInvocation
    ? UsbFlashRunner.createEsptoolInvocation({
        esptoolExecutable: "C:\\tools\\esptool.py",
        esptoolPythonExecutable: "C:\\Python\\python.exe",
      })
    : null;

  assert.deepEqual(invocation, {
    command: "C:\\Python\\python.exe",
    args: ["C:\\tools\\esptool.py"],
  });
});

test("parses esptool writing progress lines", () => {
  const parsed = UsbFlashRunner.parseEsptoolProgressLine("Writing at 0x000a0000... (42 %)");

  assert.deepEqual(parsed, {
    phase: "writing",
    percent: 42,
    message: "Writing at 0x000a0000... (42 %)",
  });
});

test("starts USB flash as pollable job", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-flash-job-"));
  const headerPath = path.join(tempRoot, "include", "basissoftware", "generated_provisioning_payload.h");
  const service = createServiceWithGeneratedHeader(headerPath);
  const created = await service.createSession(validInput({
    flash: {
      requested: true,
      port: "COM7",
      write_factory_header: true,
    },
  }));

  const started = service.startUsbFlashJob(created.session_id, {
    actor: "factory@sven.local",
    flash_runner: "mock",
  });
  const completed = await waitForFlashJob(service, started.job_id);

  assert.equal(started.status, "running");
  assert.equal(completed.status, "completed");
  assert.equal(completed.percent, 100);
  assert.equal(completed.result.usb_flash_result.status, "mock_flash_completed");
});

test("failed USB flash job exposes concrete stderr and exit code", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-flash-error-"));
  const headerPath = path.join(tempRoot, "include", "basissoftware", "generated_provisioning_payload.h");
  const firmwarePath = path.join(tempRoot, "merged-firmware.bin");
  fs.writeFileSync(firmwarePath, Buffer.from("server firmware"));
  const service = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "esptool",
    ESPTOOL_EXE: process.execPath,
    ALLOW_REAL_USB_FLASH: "true",
    REGISTER_DEVICE_ON_COMPLETE: "false",
    PROVISIONING_GENERATED_HEADER_PATH: headerPath,
    PROVISIONING_FIRMWARE_FILE_PATH: firmwarePath,
  }));
  const created = await service.createSession(validInput({
    flash: {
      requested: true,
      port: "COM99",
      write_factory_header: true,
    },
  }));

  const started = service.startUsbFlashJob(created.session_id, {
    actor: "factory@sven.local",
    flash_runner: "esptool",
  });
  const failed = await waitForFlashJob(service, started.job_id);

  assert.equal(failed.status, "failed");
  assert.equal(failed.error.exit_code, 9);
  assert.match(failed.message, /Exit-Code 9/);
  assert.match(failed.message, /bad option: --chip/);
  assert.ok(failed.logs.some((entry) => /bad option: --chip/.test(entry.line)));
});

test("registers firmware artifact and exposes real flash readiness when allowed", () => {
  const service = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    ALLOW_REAL_USB_FLASH: "true",
    ESPTOOL_EXE: process.execPath,
    REGISTER_DEVICE_ON_COMPLETE: "false",
  }));
  const artifact = service.upsertFirmwareArtifact({
    artifact_id: "firmware_artifact.esp32_basissoftware_factory.latest",
    file_name: "merged-firmware.bin",
    content_base64: Buffer.from("fake firmware").toString("base64"),
  });
  const mode = service.getFlashMode();

  assert.equal(artifact.source, "sqlite");
  assert.equal(artifact.file_name, "merged-firmware.bin");
  assert.equal(mode.allow_real_usb_flash, true);
  assert.equal(mode.artifact_ready, true);
  assert.equal(mode.modes.find((item) => item.id === "esptool").enabled, true);
});

test("keeps real flash disabled when the runtime toolchain contract is missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-no-toolchain-"));
  const service = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    ALLOW_REAL_USB_FLASH: "true",
    REGISTER_DEVICE_ON_COMPLETE: "false",
    PROVISIONING_TOOLCHAIN_ROOT: tempRoot,
    PROVISIONING_TOOLCHAIN_MANIFEST: path.join(tempRoot, "toolchain.json"),
  }));
  service.upsertFirmwareArtifact({
    artifact_id: "firmware_artifact.esp32_basissoftware_factory.latest",
    file_name: "merged-firmware.bin",
    content_base64: Buffer.from("fake firmware").toString("base64"),
  });
  const mode = service.getFlashMode();

  assert.equal(mode.allow_real_usb_flash, true);
  assert.equal(mode.artifact_ready, true);
  assert.equal(mode.modes.find((item) => item.id === "esptool").enabled, false);
  assert.match(mode.toolchain.esptool.message, /Toolchain ist nicht konfiguriert/);
});

async function waitForFlashJob(service, jobId) {
  for (let index = 0; index < 80; index += 1) {
    const job = service.getUsbFlashJob(jobId);
    if (job.status !== "running") return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return service.getUsbFlashJob(jobId);
}

test("persists registered firmware artifacts in sqlite", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-artifacts-"));
  const sqlitePath = path.join(tempRoot, "state.sqlite");
  const first = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    ALLOW_REAL_USB_FLASH: "true",
    ESPTOOL_EXE: process.execPath,
    REGISTER_DEVICE_ON_COMPLETE: "false",
    PERSISTENCE_BACKEND: "sqlite",
    PROVISIONING_SQLITE_PATH: sqlitePath,
  }));

  first.upsertFirmwareArtifact({
    artifact_id: "firmware_artifact.esp32_basissoftware_factory.latest",
    file_name: "merged-firmware.bin",
    content_base64: Buffer.from("persist me").toString("base64"),
  });

  const second = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    ALLOW_REAL_USB_FLASH: "true",
    ESPTOOL_EXE: process.execPath,
    REGISTER_DEVICE_ON_COMPLETE: "false",
    PERSISTENCE_BACKEND: "sqlite",
    PROVISIONING_SQLITE_PATH: sqlitePath,
  }));
  const artifacts = second.listFirmwareArtifacts();
  const mode = second.getFlashMode();

  assert.equal(artifacts.items.length, 1);
  assert.equal(artifacts.items[0].artifact_id, "firmware_artifact.esp32_basissoftware_factory.latest");
  assert.equal(mode.artifact_ready, true);
  assert.equal(mode.modes.find((item) => item.id === "esptool").enabled, true);
});

test("loads server-side firmware artifact from configured file path", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-server-artifact-"));
  const sqlitePath = path.join(tempRoot, "state.sqlite");
  const firmwarePath = path.join(tempRoot, "esp32-basissoftware-merged.bin");
  fs.writeFileSync(firmwarePath, Buffer.from("server firmware"));

  const service = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    ALLOW_REAL_USB_FLASH: "true",
    ESPTOOL_EXE: process.execPath,
    REGISTER_DEVICE_ON_COMPLETE: "false",
    PERSISTENCE_BACKEND: "sqlite",
    PROVISIONING_SQLITE_PATH: sqlitePath,
    PROVISIONING_FIRMWARE_FILE_PATH: firmwarePath,
  }));
  const artifacts = service.listFirmwareArtifacts();
  const mode = service.getFlashMode();

  assert.equal(artifacts.items.length, 1);
  assert.equal(artifacts.items[0].artifact_id, "firmware_artifact.esp32_basissoftware_factory.latest");
  assert.equal(artifacts.items[0].file_name, "esp32-basissoftware-merged.bin");
  assert.equal(mode.artifact_ready, true);
  assert.equal(mode.modes.find((item) => item.id === "esptool").enabled, true);
});

test("default generated factory header path is runtime staging, not project source", () => {
  const config = createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    REGISTER_DEVICE_ON_COMPLETE: "false",
  });

  assert.match(config.generatedProvisioningHeaderPath, /factory-payload/);
  assert.equal(config.firmwareRoot, "");
  assert.equal(config.firmwareArtifact.source, "sqlite");
  assert.equal(config.firmwareArtifact.local_staging_path, "");
});

test("refuses USB flash when factory header is missing", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-provisioning-missing-"));
  const headerPath = path.join(tempRoot, "include", "basissoftware", "generated_provisioning_payload.h");
  const service = createServiceWithGeneratedHeader(headerPath);
  const created = await service.createSession(validInput({
    flash: {
      requested: true,
      port: "COM7",
    },
  }));

  await assert.rejects(
    () => service.executeUsbFlash(created.session_id),
    /Factory-Provisioning-Header fehlt/,
  );
});

test("rejects second active credential for same serial number", async () => {
  const service = createService();
  await service.createSession(validInput());

  await assert.rejects(
    () => service.createSession(validInput()),
    /bereits ein aktives Credential/,
  );
});

test("resets active credential and allows reprovisioning same serial number", async () => {
  const service = createService();
  const first = await service.createSession(validInput());

  const reset = service.resetActiveCredential({
    serial_number: "GNX-ESP32-0001",
    actor: "factory@sven.local",
  });
  const second = await service.createSession(validInput());
  const previous = service.getSession(first.session_id);

  assert.equal(reset.status, "active_credential_reset");
  assert.equal(reset.credential_id, first.credential.credential_id);
  assert.equal(reset.affected_sessions.length, 1);
  assert.equal(previous.status, "credential_reset");
  assert.equal(previous.credential.status, "revoked_by_factory_reset");
  assert.notEqual(second.credential.credential_id, first.credential.credential_id);
});

test("complete marks manufacturer registration and device lifecycle", async () => {
  const service = createService();
  const created = await service.createSession(validInput({ flash: { requested: false } }));
  configureAsymmetricDevice(service);
  await service.persistDeviceProvisioning(created.session_id, {
    actor: "qa@sven.local",
    device_url: "http://192.168.4.1/provisioning",
  });
  const completed = await service.completeSession(created.session_id, {
    completed_by: "qa@sven.local",
    quality_check_state: "passed",
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.device.lifecycle_state, "provisioned_by_gernetix");
  assert.equal(completed.manufacturer_registration.quality_check_state, "passed");
  assert.equal(completed.audit_events.at(-1).type, "provisioning_completed");
});

test("rejects unknown processor board from hardware catalog", async () => {
  const service = createService();

  await assert.rejects(
    () => service.createSession(validInput({ hardware_profile_id: "hardware.processor_board.unknown" })),
    /ProcessorBoard wurde im Hardware-Katalog nicht gefunden/,
  );
});
