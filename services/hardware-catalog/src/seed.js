function defaultCatalogSeed() {
  return {
    capabilities: [
      capability("capability.processor_esp32", "ESP32 ProcessorBoard"),
      capability("capability.processor_esp8266", "ESP8266 ProcessorBoard"),
      capability("capability.processor_avr_8bit", "AVR 8-bit ProcessorBoard"),
      capability("capability.processor_arduino_avr", "Arduino-kompatibles AVR-Board"),
      capability("capability.arduino_framework_runtime", "Arduino-Framework Runtime"),
      capability("capability.atmel_avr_bare_metal_runtime", "Atmel/AVR-nahe Runtime ohne Arduino"),
      capability("capability.usb_identification", "USB-Identifikation"),
      capability("capability.flash_firmware", "Firmware flashen"),
      capability("capability.basissoftware_supported", "GerNetiX-Basissoftware unterstuetzt"),
      capability("capability.device_http_status", "Device-HTTP-Status"),
      capability("capability.captive_setup_supported", "Captive Setup unterstuetzt"),
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
      avrBoard({
        hardware_item_id: "hardware.processor_board.arduino_nano_r3_atmega328p",
        sku: "GNX-ARDUINO-NANO-R3-ATMEGA328P",
        title: "Arduino Nano R3 / ATmega328P",
        summary: "Arduino-Nano-R3-kompatibles AVR-Board fuer experimentelle Browser-Web-Serial-Erkennung ohne lokale avrdude-Installation.",
        vendor: "Arduino",
        form_factor: "nano",
        mcu_variant: "ATmega328P",
      }),
      esp8266Board({
        hardware_item_id: "hardware.processor_board.wemos_d1_mini_esp12f",
        sku: "GNX-ESP8266-D1-MINI-ESP12F",
        title: "Wemos D1 mini / ESP-12F",
        summary: "Gueltiger Einstieg fuer guenstige WLAN-Nodes mit ESP8266EX im ESP-12F Modul.",
        vendor: "Wemos",
        module_name: "ESP-12F",
      }),
      esp8266Board({
        hardware_item_id: "hardware.processor_board.generic_esp8266_esp12f",
        sku: "GNX-ESP8266-ESP12F-GENERIC",
        title: "Generisches ESP8266-Board mit ESP-12F Modul",
        summary: "Neutrale Katalogklasse fuer verbreitete ESP8266-Traegerboards mit ESP-12F Modul.",
        vendor: "Generic",
        module_name: "ESP-12F",
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.generic_esp_wroom32",
        sku: "GNX-ESP32-WROOM32-GENERIC",
        title: "Generisches ESP32-Board mit ESP-WROOM-32 Modul",
        summary: "Neutrale Katalogklasse fuer ESP32-Traegerboards mit ESP-WROOM-32 Modul.",
        module_name: "ESP-WROOM-32",
        mcu_variant: "ESP32",
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.espressif_esp32_devkitc",
        sku: "GNX-ESP32-DEVKITC",
        title: "Espressif ESP32-DevKitC",
        summary: "Offizielles Espressif-Development-Board fuer ESP32-WROOM-Module.",
        vendor: "Espressif",
        module_name: "ESP-WROOM-32",
        mcu_variant: "ESP32",
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.arduino_nano_esp32",
        sku: "GNX-ARDUINO-NANO-ESP32",
        title: "Arduino Nano ESP32",
        summary: "Offizielles Arduino-Nano-Board mit ESP32-S3-basierter NORA-W106 Realisierung.",
        vendor: "Arduino",
        form_factor: "nano",
        module_name: "NORA-W106",
        mcu_variant: "ESP32-S3",
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.generic_esp32_s3_wroom1",
        sku: "GNX-ESP32-S3-WROOM1-GENERIC",
        title: "Generisches ESP32-S3-Board mit ESP32-S3-WROOM-1 Modul",
        summary: "Neutrale Katalogklasse fuer ESP32-S3-Traegerboards mit ESP32-S3-WROOM-1 Modul.",
        module_name: "ESP32-S3-WROOM-1",
        mcu_variant: "ESP32-S3",
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.espressif_esp32_s3_devkitc_1",
        sku: "GNX-ESP32-S3-DEVKITC-1",
        title: "Espressif ESP32-S3-DevKitC-1",
        summary: "Offizielles Espressif-Development-Board fuer ESP32-S3-WROOM-Module.",
        vendor: "Espressif",
        module_name: "ESP32-S3-WROOM-1",
        mcu_variant: "ESP32-S3",
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.generic_esp32_c6_wroom1",
        sku: "GNX-ESP32-C6-WROOM1-GENERIC",
        title: "Generisches ESP32-C6-Board mit ESP32-C6-WROOM-1 Modul",
        summary: "Neutrale Katalogklasse fuer ESP32-C6-Traegerboards mit ESP32-C6-WROOM-1 Modul.",
        module_name: "ESP32-C6-WROOM-1",
        mcu_variant: "ESP32-C6",
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.espressif_esp32_c6_devkitc_1",
        sku: "GNX-ESP32-C6-DEVKITC-1",
        title: "Espressif ESP32-C6-DevKitC-1",
        summary: "Offizielles Espressif-Development-Board fuer ESP32-C6-WROOM-Module.",
        vendor: "Espressif",
        module_name: "ESP32-C6-WROOM-1",
        mcu_variant: "ESP32-C6",
      }),
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

function avrBoard(input) {
  return {
    hardware_item_id: input.hardware_item_id,
    sku: input.sku,
    item_type: "processor_board",
    title: input.title,
    summary: input.summary,
    processor_family: "avr_8bit",
    mcu_variant: input.mcu_variant,
    module_name: "",
    vendor: input.vendor || "",
    form_factor: input.form_factor || "",
    capability_ids: ["capability.processor_avr_8bit", "capability.processor_arduino_avr", "capability.arduino_framework_runtime", "capability.atmel_avr_bare_metal_runtime", "capability.usb_identification", "capability.flash_firmware", "capability.digital_input", "capability.digital_output"],
    identification_methods: ["web_serial_stk500v1_experimental"],
    support_policy: "community_supported",
    provisioning_profile_id: "",
    basissoftware_profile_id: "",
    factory_firmware_artifact: null,
    min_basissoftware_version: "",
    default_instance_configuration: {},
    status: "active",
  };
}

function esp8266Board(input) {
  return networkBoard({
    ...input,
    processor_family: "esp8266",
    mcu_variant: input.mcu_variant || "ESP8266EX",
    capability_ids: ["capability.processor_esp8266", "capability.wifi", "capability.device_http_status", "capability.captive_setup_supported", "capability.basissoftware_supported", "capability.usb_identification", "capability.flash_firmware", "capability.digital_input", "capability.digital_output"],
    basissoftware_profile_id: "basissoftware.profile.esp8266_factory",
    provisioning_profile_id: "provisioning_profile.esp8266_basissoftware",
    min_basissoftware_version: "0.1.0",
  });
}

function esp32Board(input) {
  return networkBoard({
    ...input,
    processor_family: "esp32",
    capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.ota", "capability.device_http_status", "capability.captive_setup_supported", "capability.basissoftware_supported", "capability.usb_identification", "capability.flash_firmware", "capability.digital_input", "capability.digital_output"],
    basissoftware_profile_id: "basissoftware.profile.esp32_factory",
    provisioning_profile_id: "provisioning_profile.esp32_ota_bootstrap",
    min_basissoftware_version: "0.1.0",
    factory_firmware_artifact: {
      artifact_id: "firmware_artifact.esp32_basissoftware_factory.latest",
      source: "sqlite",
      uri: "sqlite://provisioning_firmware_artifacts/firmware_artifact.esp32_basissoftware_factory.latest",
      version: "latest",
      sha256: "",
    },
  });
}

function networkBoard(input) {
  return {
    hardware_item_id: input.hardware_item_id,
    sku: input.sku,
    item_type: "processor_board",
    title: input.title,
    summary: input.summary,
    processor_family: input.processor_family,
    mcu_variant: input.mcu_variant,
    module_name: input.module_name || "",
    vendor: input.vendor || "Generic",
    form_factor: input.form_factor || "",
    capability_ids: input.capability_ids,
    identification_methods: ["network_http_status", "web_serial_bootloader"],
    support_policy: "gernetix_verified_after_provisioning",
    provisioning_profile_id: input.provisioning_profile_id,
    basissoftware_profile_id: input.basissoftware_profile_id,
    factory_firmware_artifact: input.factory_firmware_artifact || null,
    min_basissoftware_version: input.min_basissoftware_version || "",
    default_instance_configuration: {
      online_led: { configurable: true },
      display: { configurable: true, optional: true },
      sound: { configurable: true, optional: true },
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
