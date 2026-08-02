const fs = require("node:fs");
const path = require("node:path");

const { createConfig, FirmwareArtifactStore } = require("../src");

const ARTIFACT_ID = "firmware_artifact.esp8266_diymore_hw364a_basissoftware_factory.latest";
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const defaultFirmwarePath = path.join(
  repoRoot,
  ".runtime",
  "server-firmware",
  "esp8266-diymore-hw364a",
  "latest",
  "firmware.bin",
);

function main() {
  const config = createConfig({
    ...process.env,
    PERSISTENCE_BACKEND: "sqlite",
    PROVISIONING_SQLITE_PATH: process.env.PROVISIONING_SQLITE_PATH
      || process.env.PERSISTENCE_SQLITE_PATH
      || path.join(repoRoot, ".runtime", "gernetix-services.sqlite"),
  });
  const firmwarePath = path.resolve(process.env.PROVISIONING_ESP8266_FIRMWARE_FILE_PATH || defaultFirmwarePath);
  if (!fs.existsSync(firmwarePath)) throw new Error(`ESP8266-Firmware wurde nicht gefunden: ${firmwarePath}`);

  const firmwareBytes = fs.readFileSync(firmwarePath);
  const store = FirmwareArtifactStore.sqlite(config.sqlitePath, config.runtimeRoot);
  const artifact = store.upsertArtifact({
    artifact_id: ARTIFACT_ID,
    title: "diymore HW-364A ESP8266 Basissoftware Factory Image",
    version: "0.1.0",
    source: "sqlite",
    uri: `sqlite://provisioning_firmware_artifacts/${ARTIFACT_ID}`,
    file_name: "firmware.bin",
    content_base64: firmwareBytes.toString("base64"),
    flash_strategy: "esp8266_app_bin",
    flash_offset: "0x0",
    chip: "esp8266",
  });
  console.log(JSON.stringify({ status: "seeded", sqlite_path: config.sqlitePath, firmware_path: firmwarePath, artifact }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
