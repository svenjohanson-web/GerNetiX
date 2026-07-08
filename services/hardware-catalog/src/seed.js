function defaultCatalogSeed() {
  return {
    capabilities: [
      capability("capability.processor_esp32", "ESP32 ProcessorBoard"),
      capability("capability.processor_arduino_avr", "Arduino-kompatibles AVR-Board"),
      capability("capability.arduino_framework_runtime", "Arduino-Framework Runtime"),
      capability("capability.atmel_avr_bare_metal_runtime", "Atmel/AVR-nahe Runtime ohne Arduino"),
      capability("capability.flash_firmware", "Firmware flashen"),
      capability("capability.wifi", "WiFi"),
      capability("capability.ota", "OTA"),
      capability("capability.display_output", "Display-Ausgabe"),
      capability("capability.spi", "SPI"),
      capability("capability.rfid_reading", "RFID lesen"),
      capability("capability.item_identification", "Item Identification"),
      capability("capability.servo_control", "Servo-Steuerung"),
      capability("capability.mechanical_locking", "Mechanische Verriegelung"),
      capability("capability.fallback_unlock", "Fallback-Entriegelung"),
      capability("capability.digital_input", "Digitaler Eingang"),
      capability("capability.digital_output", "Digitaler Ausgang"),
    ],
    hardwareItems: [
      esp32Board("hardware.processor_board.esp32_devkit", "GNX-ESP32-DEVKIT", "GerNetiX ESP32 DevKit", "ESP32-Board mit WiFi, OTA-vorbereiteter Basissoftware und Provisioning-Unterstuetzung."),
      esp32Board("hardware.processor_board.esp_wroom32", "GNX-ESP-WROOM32", "ESP-WROOM-32 Dev Board", "ESP-WROOM-32-basiertes Entwicklungsboard mit WiFi, USB-Erstflash und OTA-faehiger Basissoftware."),
      esp32Board("hardware.processor_board.esp_wroom32_display", "GNX-ESP-WROOM32-DISPLAY", "ESP-WROOM-32 mit Display", "ESP-WROOM-32-basiertes Board mit integriertem Display fuer lokale Status- und Bedienoberflaechen.", ["capability.display_output"]),
      {
        hardware_item_id: "hardware.processor_board.arduino_nano_atmega328p",
        sku: "GNX-ARDUINO-NANO-ATMEGA328P",
        item_type: "processor_board",
        title: "Arduino Nano ATmega328P",
        summary: "Arduino-Nano-kompatibles AVR-Board fuer experimentelle Browser-Web-Serial-Erkennung und spaeteres USB-Flashen.",
        capability_ids: ["capability.processor_arduino_avr", "capability.arduino_framework_runtime", "capability.atmel_avr_bare_metal_runtime", "capability.flash_firmware", "capability.digital_input", "capability.digital_output"],
        support_policy: "community_supported",
        provisioning_profile_id: "",
        status: "active",
      },
      {
        hardware_item_id: "hardware.module.rfid_rc522",
        sku: "GNX-RFID-RC522",
        item_type: "module",
        title: "RFID RC522 Modul",
        summary: "RFID-Leser fuer Tags und Karten im SPI-Bus.",
        capability_ids: ["capability.spi", "capability.rfid_reading", "capability.item_identification"],
        support_policy: "component_support",
        provisioning_profile_id: "",
        status: "active",
      },
      {
        hardware_item_id: "hardware.actuator.micro_servo",
        sku: "GNX-SERVO-MICRO",
        item_type: "actuator",
        title: "Micro Servo",
        summary: "Kleiner Servo fuer Sperren, Klappen und mechanische Lernprojekte.",
        capability_ids: ["capability.servo_control", "capability.mechanical_locking", "capability.fallback_unlock"],
        support_policy: "component_support",
        provisioning_profile_id: "",
        status: "active",
      },
    ],
  };
}

function esp32Board(id, sku, title, summary, extraCapabilities = []) {
  return {
    hardware_item_id: id,
    sku,
    item_type: "processor_board",
    title,
    summary,
    capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.ota", "capability.digital_input", "capability.digital_output", ...extraCapabilities],
    support_policy: "gernetix_verified_after_provisioning",
    provisioning_profile_id: "provisioning_profile.esp32_ota_bootstrap",
    basissoftware_profile_id: "basissoftware.profile.esp32_factory",
    factory_firmware_artifact: {
      artifact_id: "firmware_artifact.esp32_basissoftware_factory.latest",
      source: "sqlite",
      uri: "sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest",
      version: "latest",
      sha256: "",
    },
    status: "active",
  };
}

function capability(capabilityId, title) {
  return {
    capability_id: capabilityId,
    title,
    owner_domain: "Hardware",
    status: "active",
  };
}

module.exports = { defaultCatalogSeed };
