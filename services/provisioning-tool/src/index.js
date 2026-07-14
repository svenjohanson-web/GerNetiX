const fs = require("node:fs");
const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { CredentialGenerator } = require("./modules/credential-generator");
const { OpenSslDeviceCertificateIssuer } = require("./modules/device-certificate-issuer");
const { DeviceIdFactory } = require("./modules/device-id-factory");
const { FlashPlanner } = require("./modules/flash-planner");
const { FirmwareArtifactStore } = require("./modules/firmware-artifact-store");
const { HardwareCatalogClient } = require("./modules/hardware-catalog-client");
const { UsbFlashRunner } = require("./modules/usb-flash-runner");
const { InMemoryProvisioningRepository } = require("./repositories/in-memory-provisioning-repository");
const { SqliteBackedProvisioningRepository } = require("./repositories/sqlite-backed-provisioning-repository");
const { ProvisioningService } = require("./services/provisioning-service");

function createDefaultProvisioningTool(config = createConfig()) {
  const firmwareArtifactStore = createFirmwareArtifactStore(config);
  seedServerFirmwareArtifact(firmwareArtifactStore, config);
  return new ProvisioningService({
    repository: createRepository(config),
    deviceIdFactory: new DeviceIdFactory(),
    credentialGenerator: new CredentialGenerator(),
    certificateIssuer: new OpenSslDeviceCertificateIssuer({
      caCertificatePath: config.deviceCaCertificatePath,
      caPrivateKeyPath: config.deviceCaPrivateKeyPath,
      opensslCommand: config.opensslCommand,
      validityDays: config.deviceCertificateValidityDays,
    }),
    otaTrust: {
      key_id: config.otaSigningKeyId,
      algorithm: "ECDSA_P256_SHA256",
      public_key_pem: config.otaSigningPublicKeyPem,
    },
    flashPlanner: new FlashPlanner({ flashRunner: config.flashRunner }),
    firmwareArtifactStore,
    hardwareCatalog: new HardwareCatalogClient({ baseUrl: config.hardwareCatalogBaseUrl }),
    deviceManagementBaseUrl: config.deviceManagementBaseUrl,
    registerDeviceOnComplete: config.registerDeviceOnComplete,
    allowFirmwareArtifactAdminWrite: config.allowFirmwareArtifactAdminWrite,
    generatedProvisioningHeaderPath: config.generatedProvisioningHeaderPath,
    firmwareArtifact: config.firmwareArtifact,
    usbFlashRunner: new UsbFlashRunner({
      runner: config.flashRunner,
      allowRealUsbFlash: config.allowRealUsbFlash,
      firmwareRoot: config.firmwareRoot,
      firmwareArtifact: config.firmwareArtifact,
      toolchainRoot: config.toolchainRoot,
      toolchainManifestPath: config.toolchainManifestPath,
      platformioExecutable: config.platformioExecutable,
      esptoolExecutable: config.esptoolExecutable,
      esptoolPythonExecutable: config.esptoolPythonExecutable,
      timeoutMs: config.flashTimeoutMs,
    }),
  });
}

function createRepository(config) {
  if (config.persistenceBackend === "sqlite") return SqliteBackedProvisioningRepository.create(config.sqlitePath);
  return new InMemoryProvisioningRepository();
}

function createFirmwareArtifactStore(config) {
  if (config.persistenceBackend === "sqlite") return FirmwareArtifactStore.sqlite(config.sqlitePath, config.runtimeRoot);
  return new FirmwareArtifactStore({ runtimeRoot: config.runtimeRoot });
}

function seedServerFirmwareArtifact(store, config) {
  const artifact = config.firmwareArtifact || {};
  if (!artifact.local_file_path || !fs.existsSync(artifact.local_file_path)) return;
  store.upsertArtifact({
    artifact_id: artifact.artifact_id,
    title: artifact.title || artifact.artifact_id,
    version: artifact.version || "latest",
    source: artifact.source || "sqlite",
    uri: artifact.uri,
    file_name: artifact.file_name,
    local_file_path: artifact.local_file_path,
    sha256: artifact.sha256 || "",
    flash_strategy: artifact.flash_strategy || "esp32_merged_bin",
    flash_offset: artifact.flash_offset || "0x0",
  });
}

module.exports = {
  createConfig,
  createHttpApp,
  CredentialGenerator,
  OpenSslDeviceCertificateIssuer,
  DeviceIdFactory,
  FlashPlanner,
  FirmwareArtifactStore,
  UsbFlashRunner,
  InMemoryProvisioningRepository,
  SqliteBackedProvisioningRepository,
  ProvisioningService,
  createDefaultProvisioningTool,
};
