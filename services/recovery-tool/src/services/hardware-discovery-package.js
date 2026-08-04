const crypto = require("node:crypto");
const { RecoveryToolError } = require("../errors");

function createDiscoveryBuildPackage(session) {
  const profile = session.ai_analysis?.profile;
  if (!profile) throw new RecoveryToolError("hardware_ai_analysis_required", "Vor dem Discovery-Build muss die KI-Quellenanalyse abgeschlossen sein.", 409);
  if (profile.processor_family !== "esp32") {
    throw new RecoveryToolError("hardware_discovery_family_not_supported", "Der erste echte Discovery-Firmware-Build unterstuetzt derzeit ESP32-Boards.", 422, {
      processor_family: profile.processor_family,
    });
  }
  const compilerTarget = resolveCompilerTarget(profile);
  const compilerBoard = compilerTarget.board;
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(compilerBoard)) {
    throw new RecoveryToolError("hardware_discovery_platformio_board_missing", "Die Quellenanalyse konnte kein belastbares PlatformIO-Boardprofil bestimmen.", 422);
  }
  const environment = safeIdentifier(profile.platformio?.environment || profile.board_name || compilerBoard);
  const jobId = `hardware-lab-${crypto.createHash("sha256").update(`${session.recovery_session_id}:${session.updated_at}`).digest("hex").slice(0, 20)}`;
  const platformioIni = [
    `[env:${environment}]`,
    `platform = ${compilerTarget.platform}`,
    `board = ${compilerBoard}`,
    "framework = arduino",
    "monitor_speed = 115200",
    "build_flags =",
    "  -DGERNETIX_HARDWARE_LAB=1",
    ...sanitizeBuildFlags(profile.platformio?.build_flags).map((flag) => `  ${flag}`),
    "",
  ].join("\n");
  const manifest = {
    contract: "gernetix_hardware_lab_discovery_v1",
    recovery_session_id: session.recovery_session_id,
    board_name: profile.board_name,
    processor_family: profile.processor_family,
    mcu_variant: profile.mcu_variant,
    platformio_board: compilerBoard,
    compiler_profile_source: compilerTarget.source,
    discovery_mode: "passive_safe_bootstrap",
    active_pin_tests_enabled: false,
    expected_properties: profile.discovery_expectations?.passive_checks || [],
    source_urls: (session.candidate_profile?.source_evidence || []).map((item) => item.source_url),
  };
  return {
    job_id: jobId,
    mode: "build",
    build_profile: "standard",
    account_id: session.account_id || null,
    software_unit_id: `hardware-lab-discovery-${environment}`,
    build_package: {
      files: {
        "build-job.json": JSON.stringify({ job_id: jobId, software_unit_id: `hardware-lab-discovery-${environment}`, hardware_lab_session_id: session.recovery_session_id }, null, 2),
        "platformio.ini": platformioIni,
        "include/gernetix_hardware_lab_manifest.h": createManifestHeader(manifest),
        "src/main.cpp": passiveEsp32DiscoverySource(),
        "hardware-lab-manifest.json": JSON.stringify(manifest, null, 2),
      },
    },
    manifest,
  };
}

function resolveCompilerTarget(profile) {
  const documentedBoard = String(profile.platformio?.board || "").trim();
  if (/^[A-Za-z0-9_-]{2,80}$/.test(documentedBoard)) {
    return { platform: profile.platformio?.platform || "espressif32", board: documentedBoard, source: "source_derived_platformio_profile" };
  }
  const variant = String(profile.mcu_variant || profile.module_name || "").toLowerCase();
  const genericTargets = [
    [/esp32[- ]?c6/, "esp32-c6-devkitc-1"],
    [/esp32[- ]?c3/, "esp32-c3-devkitm-1"],
    [/esp32[- ]?s3/, "esp32-s3-devkitc-1"],
    [/esp32[- ]?s2/, "esp32-s2-saola-1"],
    [/esp32/, "esp32dev"],
  ];
  const match = genericTargets.find(([pattern]) => pattern.test(variant));
  if (!match) {
    throw new RecoveryToolError("hardware_discovery_platformio_board_missing", "Fuer diese MCU-Variante existiert noch kein sicherer generischer Discovery-Compilerpfad.", 422, {
      mcu_variant: profile.mcu_variant,
    });
  }
  return { platform: "espressif32", board: match[1], source: "generic_chip_family_bootstrap" };
}

function passiveEsp32DiscoverySource() {
  return `#include <Arduino.h>
#include <WiFi.h>
#include "esp_system.h"
#include "esp_chip_info.h"
#include "gernetix_hardware_lab_manifest.h"

static void printEscaped(const String &value) {
  for (size_t i = 0; i < value.length(); ++i) {
    const char c = value[i];
    if (c == '\\"' || c == '\\\\') Serial.print('\\\\');
    if (c >= 0x20) Serial.print(c);
  }
}

static void printReport() {
  esp_chip_info_t chip;
  esp_chip_info(&chip);
  Serial.print("{\\\"report_contract\\\":\\\"gernetix_hardware_lab_report_v1\\\",");
  Serial.print("\\\"discovery_mode\\\":\\\"passive_safe_bootstrap\\\",");
  Serial.print("\\\"manifest_sha256\\\":\\\""); Serial.print(GERNETIX_HARDWARE_LAB_MANIFEST_SHA256); Serial.print("\\\",");
  Serial.print("\\\"chip_model\\\":\\\""); printEscaped(ESP.getChipModel()); Serial.print("\\\",");
  Serial.print("\\\"chip_revision\\\":"); Serial.print(ESP.getChipRevision()); Serial.print(',');
  Serial.print("\\\"chip_cores\\\":"); Serial.print(chip.cores); Serial.print(',');
  Serial.print("\\\"cpu_mhz\\\":"); Serial.print(ESP.getCpuFreqMHz()); Serial.print(',');
  Serial.print("\\\"flash_bytes\\\":"); Serial.print(ESP.getFlashChipSize()); Serial.print(',');
  Serial.print("\\\"flash_speed_hz\\\":"); Serial.print(ESP.getFlashChipSpeed()); Serial.print(',');
  Serial.print("\\\"heap_bytes\\\":"); Serial.print(ESP.getHeapSize()); Serial.print(',');
  Serial.print("\\\"free_heap_bytes\\\":"); Serial.print(ESP.getFreeHeap()); Serial.print(',');
  Serial.print("\\\"psram_bytes\\\":"); Serial.print(ESP.getPsramSize()); Serial.print(',');
  Serial.print("\\\"free_psram_bytes\\\":"); Serial.print(ESP.getFreePsram()); Serial.print(',');
  Serial.print("\\\"sdk_version\\\":\\\""); printEscaped(ESP.getSdkVersion()); Serial.print("\\\",");
  Serial.print("\\\"wifi_mac\\\":\\\""); printEscaped(WiFi.macAddress()); Serial.print("\\\",");
  Serial.print("\\\"active_pin_tests_executed\\\":false,");
  Serial.print("\\\"completed_phases\\\":[\\\"chip_and_memory\\\",\\\"runtime_and_connectivity\\\"]}");
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  delay(1200);
  WiFi.mode(WIFI_STA);
  printReport();
  WiFi.mode(WIFI_OFF);
}

void loop() {
  delay(10000);
  printReport();
}
`;
}

function createManifestHeader(manifest) {
  const json = JSON.stringify(manifest);
  const sha256 = crypto.createHash("sha256").update(json).digest("hex");
  return `#pragma once\n#define GERNETIX_HARDWARE_LAB_MANIFEST_SHA256 "${sha256}"\n`;
}

function sanitizeBuildFlags(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter((item) => /^-D[A-Za-z_][A-Za-z0-9_]*(?:=[A-Za-z0-9_.-]+)?$/.test(item))
    .slice(0, 20);
}

function safeIdentifier(value) {
  return String(value || "hardware_lab").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "hardware_lab";
}

module.exports = { createDiscoveryBuildPackage, passiveEsp32DiscoverySource, resolveCompilerTarget };
