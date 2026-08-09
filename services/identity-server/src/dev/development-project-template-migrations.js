"use strict";

// Candidate transformations for a future, explicitly customer-approved
// project migration. This module is deliberately not connected to project
// reads, project opening, server bootstrap or any automatic write path.
const cameraDisplayTemplateMigrationProposal = Object.freeze({
  id: "project_template_migration.camera_display_runtime_v19",
  template_id: "esp32_camera_to_touch_display",
  target_runtime_model_version: 19,
  customer_consent_required: true,
  automatic_execution: false,
});

function migrateCameraTemplateWifiArchitecture(source) {
  const current = String(source || "");
  if (!/^[ \t]*camera_processor[ \t]+-->[ \t]+display_processor[ \t]+:[ \t]+uebertraegt Bilddaten[ \t]*$/m.test(current)) return current;

  let migrated = current;
  if (!/\bas\s+camera_wifi\b/.test(migrated)) {
    migrated = migrated.replace(
      /^([ \t]*)(rectangle[ \t]+"[^"]+"[ \t]+as[ \t]+camera_processor[ \t]*)$/m,
      (_match, indentation, declaration) => `${indentation}${declaration}\n${indentation}rectangle "WLAN-/WiFi-Schnittstelle" as camera_wifi`,
    );
  }
  if (!/\bas\s+display_wifi\b/.test(migrated)) {
    migrated = migrated.replace(
      /^([ \t]*)(rectangle[ \t]+"[^"]+"[ \t]+as[ \t]+display_processor[ \t]*)$/m,
      (_match, indentation, declaration) => `${indentation}${declaration}\n${indentation}rectangle "WLAN-/WiFi-Schnittstelle" as display_wifi`,
    );
  }
  if (!/\bas\s+camera_wifi\b/.test(migrated) || !/\bas\s+display_wifi\b/.test(migrated)) return current;
  return migrated.replace(
    /^[ \t]*camera_processor[ \t]+-->[ \t]+display_processor[ \t]+:[ \t]+uebertraegt Bilddaten[ \t]*$/m,
    "camera_processor --> camera_wifi : uebergibt Bilddaten\ncamera_wifi --> display_wifi : uebertraegt Bilddaten per WLAN\ndisplay_wifi --> display_processor : liefert Bilddaten",
  );
}

function migrateCameraTemplateDisplayGpioTypes(source) {
  const replacements = [
    ["bus.sclk_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_SCLK;", "bus.sclk_io_num = static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_SCLK);"],
    ["bus.mosi_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MOSI;", "bus.mosi_io_num = static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MOSI);"],
    ["bus.miso_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MISO;", "bus.miso_io_num = static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MISO);"],
    ["io.cs_gpio_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS;", "io.cs_gpio_num = static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS);"],
    ["io.dc_gpio_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_DC;", "io.dc_gpio_num = static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_DC);"],
  ];
  return replacements.reduce((content, [legacy, replacement]) => content.replaceAll(legacy, replacement), String(source || ""));
}

module.exports = {
  cameraDisplayTemplateMigrationProposal,
  migrateCameraTemplateDisplayGpioTypes,
  migrateCameraTemplateWifiArchitecture,
};
