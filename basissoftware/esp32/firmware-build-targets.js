// Build targets describe binary compatibility. They deliberately live next to
// platformio.ini, not in the hardware catalog: a board references a target,
// while this file owns compiler and partition settings.

const firmwareBuildTargets = Object.freeze([
  {
    firmware_build_target_id: "firmware_build_target.esp32_classic_qspi_4mb",
    title: "ESP32 Classic / QSPI / 4 MB",
    platformio_environment: "esp32dev",
    esp_idf_target: "esp32",
    cpu_family: "xtensa_lx6",
    flash: { protocol: "qspi", size_mb: 4 },
    psram: { enabled: false, protocol: "" },
    partition_layout: "partitions_ota_4mb.csv",
    supported_basissoftware_profiles: ["full"],
  },
  {
    firmware_build_target_id: "firmware_build_target.esp32_s3_opi_n16r8",
    title: "ESP32-S3 / OPI / N16R8",
    platformio_environment: "esp32-s3-16mb-full",
    esp_idf_target: "esp32s3",
    cpu_family: "xtensa_lx7",
    flash: { protocol: "qspi", size_mb: 16 },
    psram: { enabled: true, protocol: "opi", size_mb: 8 },
    partition_layout: "partitions_full_16mb.csv",
    supported_basissoftware_profiles: ["full"],
  },
  {
    firmware_build_target_id: "firmware_build_target.esp32_c6_qspi_4mb",
    title: "ESP32-C6 / QSPI / 4 MB",
    platformio_environment: "esp32-c6-4mb-full",
    esp_idf_target: "esp32c6",
    cpu_family: "riscv32imc",
    flash: { protocol: "qspi", size_mb: 4 },
    psram: { enabled: false, protocol: "" },
    partition_layout: "partitions_ota_4mb.csv",
    supported_basissoftware_profiles: ["full"],
  },
]);

const factoryFirmwareReleases = Object.freeze([
  {
    firmware_build_target_id: "firmware_build_target.esp32_classic_qspi_4mb",
    basissoftware_profile: "full",
    artifact_id: "firmware_artifact.esp32_classic_qspi_4mb.full.factory.latest",
    label: "ESP32 Classic / FULL / 4 MB",
    file_name: "gernetix-esp32-classic-qspi-4mb-full.bin",
    relative_file_path: "esp32-classic-qspi-4mb/full/merged-firmware.bin",
  },
  {
    firmware_build_target_id: "firmware_build_target.esp32_s3_opi_n16r8",
    basissoftware_profile: "full",
    artifact_id: "firmware_artifact.esp32_s3_opi_n16r8.full.factory.latest",
    label: "ESP32-S3 / N16R8 / FULL",
    version: "0.3.1",
    // These values are emitted by ESP-IDF in flash_args for this binary.
    // The browser must use the same boot-flash parameters when it writes the
    // merged factory image; its previous generic 40 MHz default was wrong.
    flash_mode: "dio",
    flash_freq: "80m",
    flash_size: "16MB",
    file_name: "gernetix-esp32-s3-opi-n16r8-full.bin",
    relative_file_path: "esp32-s3-opi-n16r8/full/merged-firmware.bin",
  },
]);

function getFirmwareBuildTarget(id) {
  return firmwareBuildTargets.find((target) => target.firmware_build_target_id === id) || null;
}

function getFactoryFirmwareRelease({ firmwareBuildTargetId, basissoftwareProfile }) {
  return factoryFirmwareReleases.find((release) => (
    release.firmware_build_target_id === firmwareBuildTargetId
    && release.basissoftware_profile === basissoftwareProfile
  )) || null;
}

module.exports = { firmwareBuildTargets, factoryFirmwareReleases, getFirmwareBuildTarget, getFactoryFirmwareRelease };
