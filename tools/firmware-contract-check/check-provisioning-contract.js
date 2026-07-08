const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createConfig,
  createDefaultProvisioningTool,
} = require("../../services/provisioning-tool/src");

const repoRoot = path.resolve(__dirname, "..", "..");
const firmwareRoot = path.join(repoRoot, "basissoftware", "esp32");
const provisioningHeader = path.join(firmwareRoot, "include", "basissoftware", "provisioning_config.h");
const provisioningSource = path.join(firmwareRoot, "src", "functions", "provisioning_config.cpp");
const factoryProvisioningSource = path.join(firmwareRoot, "src", "functions", "factory_provisioning.cpp");
const deviceWebServerSource = path.join(firmwareRoot, "src", "functions", "startDeviceWebServer.cpp");

async function createManifest() {
  const service = createDefaultProvisioningTool(createConfig({
    DEVICE_MANAGEMENT_BASE_URL: "https://devices.gernetix.test/api/device-management",
    FLASH_RUNNER: "mock",
    REGISTER_DEVICE_ON_COMPLETE: "false",
  }));
  const session = await service.createSession({
    serial_number: "GNX-ESP32-CONTRACT",
    hardware_profile_id: "hardware.processor_board.esp32_devkit",
    provisioning_batch_id: "batch-contract",
    firmware_version: "0.1.0",
    provisioned_by: "contract-check@gernetix.local",
    capabilities: ["ota", "wifi"],
    service_endpoints: {
      device_management: "https://devices.gernetix.test/api/device-management",
      build_deploy: "https://build.gernetix.test",
    },
  });
  const manifest = service.getManifest(session.session_id);
  return {
    manifest,
    usbFlashPackage: session.usb_flash_package,
    provisioningPayload: {
      ...manifest,
      one_time_device_secret: session.one_time_device_secret,
    },
  };
}

function assertFirmwareKnowsManifestField(source, header, field) {
  assert.match(source, new RegExp(`"${field}"`), `Firmware parser does not reference manifest field: ${field}`);
  const camel = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  assert.ok(
    header.includes(camel) || source.includes(field),
    `Firmware config has no visible storage/status mapping for: ${field}`,
  );
}

async function run() {
  const { manifest, provisioningPayload, usbFlashPackage } = await createManifest();
  const header = fs.readFileSync(provisioningHeader, "utf8");
  const source = fs.readFileSync(provisioningSource, "utf8");
  const factorySource = fs.readFileSync(factoryProvisioningSource, "utf8");
  const webServerSource = fs.readFileSync(deviceWebServerSource, "utf8");

  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.firmware.basis, "gernetix-runtime-basissoftware");
  assert.equal(manifest.firmware.ota_preserved, true);
  assert.equal(manifest.credential.one_time_device_secret, undefined);
  assert.ok(provisioningPayload.one_time_device_secret);
  assert.equal(usbFlashPackage.transport, "usb");
  assert.equal(usbFlashPackage.generated_files[0].path, "basissoftware/esp32/include/basissoftware/generated_provisioning_payload.h");
  assert.match(usbFlashPackage.generated_files[0].content, /GERNETIX_FACTORY_PROVISIONING_PAYLOAD/);
  assert.match(usbFlashPackage.generated_files[0].content, /one_time_device_secret/);

  for (const field of [
    "device_id",
    "serial_number",
    "hardware_profile_id",
    "version",
    "basis",
    "credential_id",
    "credential_type",
    "key_reference",
    "secret_sha256",
    "one_time_device_secret",
    "device_management",
    "build_deploy",
    "batch_id",
    "provisioned_by",
    "capabilities",
  ]) {
    assertFirmwareKnowsManifestField(source, header, field);
  }

  assert.match(header, /writeChallengeProofJson/, "Firmware contract does not expose challenge proof writer");
  assert.match(source, /mbedtls_md_hmac/, "Firmware does not create an HMAC challenge proof");
  assert.match(source, /dev_secret/, "Firmware does not persist the local device secret");
  assert.match(factorySource, /generated_provisioning_payload/, "Firmware does not import generated USB factory provisioning payload");
  assert.match(factorySource, /saveProvisioningPayload/, "Factory provisioning does not store payload through normal provisioning parser");
  assert.match(webServerSource, /\/auth\/challenge/, "Device web server does not expose local auth challenge endpoint");

  console.log("OK provisioning manifest matches ESP32 basissoftware contract");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
