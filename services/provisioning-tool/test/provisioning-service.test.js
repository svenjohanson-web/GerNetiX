const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createConfig,
  createDefaultProvisioningTool,
  UsbFlashRunner,
} = require("../src");

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

test("creates provisioning session with one-time secret and redacted later status", async () => {
  const service = createService();
  const created = await service.createSession(validInput());

  assert.equal(created.status, "prepared");
  assert.ok(created.device.device_id.startsWith("device_"));
  assert.equal(created.device.processor_board_id, "hardware.processor_board.esp32_devkit");
  assert.ok(created.credential.credential_id.startsWith("cred_"));
  assert.ok(created.one_time_device_secret);
  assert.equal(created.flash_plan.status, "planned");
  assert.equal(created.flash_plan.transport, "usb");
  assert.equal(created.flash_plan.provisioning_transport, "usb_flash_image");
  assert.equal(created.usb_flash_package.transport, "usb");
  assert.equal(created.usb_flash_package.target_runtime, "server_firmware_artifact");
  assert.equal(created.usb_flash_package.firmware_artifact.source, "sqlite");
  assert.equal(created.usb_flash_package.generated_files[0].path, "basissoftware/esp32/include/basissoftware/generated_provisioning_payload.h");
  assert.equal(created.usb_flash_package.generated_files[0].contains_secret, true);
  assert.match(created.usb_flash_package.generated_files[0].content, /GERNETIX_FACTORY_PROVISIONING_PAYLOAD/);
  assert.match(created.usb_flash_package.generated_files[0].content, /one_time_device_secret/);

  const fetched = service.getSession(created.session_id);
  assert.equal(fetched.one_time_device_secret, undefined);
  assert.equal(fetched.usb_flash_package, undefined);
  assert.equal(fetched.credential.one_time_device_secret, undefined);
  assert.equal(fetched.credential.key_reference, created.credential.key_reference);
  assert.ok(fetched.credential.secret_sha256);
});

test("manifest contains endpoint and credential reference but no raw secret", async () => {
  const service = createService();
  const created = await service.createSession(validInput());
  const manifest = service.getManifest(created.session_id);

  assert.equal(manifest.device_id, created.device.device_id);
  assert.equal(manifest.processor_board.hardware_item_id, "hardware.processor_board.esp32_devkit");
  assert.equal(manifest.processor_board.basissoftware_profile_id, "basissoftware.profile.esp32_factory");
  assert.equal(manifest.firmware.ota_preserved, true);
  assert.equal(manifest.firmware.artifact.source, "sqlite");
  assert.equal(manifest.firmware.artifact.artifact_id, "firmware_artifact.esp32_basissoftware_factory.latest");
  assert.equal(manifest.service_endpoints.build_deploy, "https://build.gernetix.test");
  assert.equal(manifest.credential.key_reference, created.credential.key_reference);
  assert.equal(manifest.credential.one_time_device_secret, undefined);
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
  assert.equal(created.usb_flash_package.written_file.contains_secret, true);
  assert.equal(fs.existsSync(headerPath), true);

  const content = fs.readFileSync(headerPath, "utf8");
  assert.match(content, /GERNETIX_FACTORY_PROVISIONING_PAYLOAD/);
  assert.match(content, /one_time_device_secret/);
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
  const service = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    ALLOW_REAL_USB_FLASH: "true",
    REGISTER_DEVICE_ON_COMPLETE: "false",
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
