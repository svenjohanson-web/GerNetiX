const fs = require("node:fs");
const path = require("node:path");

const { createConfig, FirmwareArtifactStore } = require("../src");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const defaultFirmwarePath = path.join(
  repoRoot,
  ".runtime",
  "server-firmware",
  "esp32-basissoftware",
  "latest",
  "merged-firmware.bin",
);

function main() {
  const config = createConfig({
    ...process.env,
    PERSISTENCE_BACKEND: "sqlite",
    PROVISIONING_SQLITE_PATH: process.env.PROVISIONING_SQLITE_PATH
      || process.env.PERSISTENCE_SQLITE_PATH
      || path.join(repoRoot, ".runtime", "gernetix-services.sqlite"),
  });
  const firmwarePath = path.resolve(process.env.PROVISIONING_FIRMWARE_FILE_PATH || defaultFirmwarePath);

  if (!fs.existsSync(firmwarePath)) {
    throw new Error(`Firmware-Artefakt wurde nicht gefunden: ${firmwarePath}`);
  }

  const firmwareBytes = fs.readFileSync(firmwarePath);
  const store = FirmwareArtifactStore.sqlite(config.sqlitePath, config.runtimeRoot);
  const artifact = store.upsertArtifact({
    artifact_id: config.firmwareArtifact.artifact_id,
    title: "ESP32 Basissoftware Factory Image",
    version: config.firmwareArtifact.version || "latest",
    source: "sqlite",
    uri: config.firmwareArtifact.uri,
    file_name: process.env.PROVISIONING_FIRMWARE_FILE_NAME || path.basename(firmwarePath),
    content_base64: firmwareBytes.toString("base64"),
    flash_strategy: "esp32_merged_bin",
    flash_offset: "0x0",
  });

  console.log(JSON.stringify({
    status: "seeded",
    sqlite_path: config.sqlitePath,
    firmware_path: firmwarePath,
    artifact,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
