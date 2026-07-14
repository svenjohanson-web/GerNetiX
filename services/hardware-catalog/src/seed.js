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
      capability("capability.touchscreen_input", "Touchscreen-Eingabe"),
      capability("capability.audio_output", "Audio-Ausgabe"),
      capability("capability.audio_input", "Audio-Eingabe"),
      capability("capability.bluetooth", "Bluetooth"),
      capability("capability.external_ram", "Externer RAM / PSRAM"),
      capability("capability.flash_storage", "Flash-Speicher"),
      capability("capability.spi", "SPI"),
      capability("capability.rfid_reading", "RFID lesen"),
      capability("capability.item_identification", "Item Identification"),
      capability("capability.servo_control", "Servo-Steuerung"),
      capability("capability.mechanical_locking", "Mechanische Verriegelung"),
      capability("capability.fallback_unlock", "Fallback-Entriegelung"),
      capability("capability.digital_input", "Digitaler Eingang"),
      capability("capability.digital_output", "Digitaler Ausgang"),
      capability("capability.analog_input", "Analoger Eingang"),
      capability("capability.pulse_counter", "Impulszaehler"),
      capability("capability.quadrature_counter", "Inkrementalgeber A/B"),
      capability("capability.i2c", "I2C"),
      capability("capability.one_wire", "1-Wire"),
      capability("capability.uart", "UART"),
    ],
    hardwareItems: [
      ...boardFeatureOptions(),
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
        hardware_item_id: "hardware.processor_board.generic_esp32_s3_touch_display",
        sku: "GNX-ESP32-S3-TOUCH-DISPLAY-GENERIC",
        title: "Generisches ESP32-S3 Touch-Display-Board",
        summary: "Katalogklasse fuer ESP32-S3-Boards mit integriertem Display und Touchcontroller.",
        form_factor: "integrated_touch_display",
        module_name: "ESP32-S3-WROOM-1",
        mcu_variant: "ESP32-S3",
        extra_capability_ids: ["capability.display_output", "capability.touchscreen_input"],
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
        sku: "GNX-ESP32-S3-ES3C28P",
        title: "ESP32-S3 ES3C28P Touch-Board",
        summary: "Lokal getestetes ESP32-S3-Board mit 2,8-Zoll-ILI9341V-Display, FT6336G-Touch und ES8311/NS8002E-Audio.",
        vendor: "ES3C28P",
        form_factor: "integrated_touch_display_audio",
        mcu_variant: "ESP32-S3",
        extra_capability_ids: ["capability.display_output", "capability.touchscreen_input", "capability.audio_output", "capability.bluetooth", "capability.analog_input"],
        pin_profile: {
          assigned_pins: {
            display_spi: { mosi: 11, miso: 13, sclk: 12, cs: 10, dc: 46, reset: -1, backlight: 45 },
            touch_i2c: { sda: 16, scl: 15, interrupt: 17, reset: 18 },
            audio_i2s: { enable: 1, mclk: 4, bclk: 5, data_out: 8, lrclk: 7 },
            battery_adc: { pin: 9, voltage_divider: 2.0 },
          },
          diagnostic_output_allowlist: [],
          diagnostic_note: "Keine Onboard-LED dokumentiert; belegte Pins duerfen nicht generisch als Testausgang verwendet werden.",
        },
        default_instance_configuration: {
          board_model: "ESP32-S3 ES3C28P",
          verification_status: "user_tested",
          evidence: {
            source_type: "working_platformio_project",
            source_reference: "ESP32-OLED-Games/AI-Assistant-ESP32-Touch",
          },
          board_features: {
            display: {
              enabled: true,
              hardware: "tft_lcd",
              driver: "ili9341",
              connection: "spi",
              controller_variant: "ILI9341V",
              width: 240,
              height: 320,
              pins: { mosi: 11, miso: 13, sclk: 12, cs: 10, dc: 46, reset: -1, backlight: 45 },
              verification_status: "user_tested",
            },
            touch: {
              enabled: true,
              hardware: "kapazitiv",
              driver: "ft6336g",
              connection: "i2c",
              address: "0x38",
              clock_hz: 400000,
              pins: { sda: 16, scl: 15, interrupt: 17, reset: 18 },
              verification_status: "user_tested",
            },
            speaker: {
              enabled: true,
              hardware: "i2s_verst_rker",
              driver: "es8311",
              connection: "i2s",
              codec_address: "0x18",
              amplifier: "NS8002E",
              format: "philips_i2s",
              pins: { enable: 1, mclk: 4, bclk: 5, data_out: 8, lrclk: 7 },
              verification_status: "user_tested",
            },
            bluetooth: {
              enabled: true,
              hardware: "bluetooth_low_energy",
              connection: "im_prozessor_integriert",
              verification_status: "processor_specification",
            },
            wifi: {
              enabled: true,
              hardware: "2_4_ghz",
              driver: "arduino_wifi",
              verification_status: "user_tested",
            },
            ram: {
              enabled: true,
              hardware: "interner_sram",
              connection: "im_modul_integriert",
              value: "512_kb",
              verification_status: "user_confirmed",
            },
            flash: {
              enabled: true,
              hardware: "qspi_flash",
              connection: "extern_auf_dem_board",
              value: "16_mb",
              verification_status: "user_confirmed",
            },
          },
          battery_measurement: {
            enabled: true,
            connection: "adc",
            pin: 9,
            voltage_divider: 2.0,
            verification_status: "user_tested",
          },
          datasheet_url: "",
          datasheet_required: true,
        },
        verification_status: "locally_verified",
        evidence: {
          source_type: "working_platformio_project",
          source_reference: "ESP32-OLED-Games/AI-Assistant-ESP32-Touch",
        },
      }),
      esp32Board({
        hardware_item_id: "hardware.processor_board.generic_esp32_c6_wroom1",
        sku: "GNX-ESP32-C6-WROOM1-GENERIC",
        title: "Generisches ESP32-C6-Board mit ESP32-C6-WROOM-1 Modul",
        summary: "Neutrale Katalogklasse fuer ESP32-C6-Traegerboards mit ESP32-C6-WROOM-1 Modul.",
        module_name: "ESP32-C6-WROOM-1",
        mcu_variant: "ESP32-C6",
      }),
      sensor({ id: "pt1000", title: "PT1000 Widerstandsthermometer", measurements: ["temperature"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "ntc", title: "NTC-Temperatursensor", measurements: ["temperature"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "ptc", title: "PTC-Temperatursensor", measurements: ["temperature"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "ds18b20", title: "DS18B20 Temperatursensor", measurements: ["temperature"], signal: "one_wire", capabilities: ["capability.one_wire"] }),
      sensor({ id: "dht22", title: "DHT22 Temperatur- und Feuchtesensor", measurements: ["temperature", "humidity"], signal: "digital", capabilities: ["capability.digital_input"] }),
      sensor({ id: "bme280", title: "BME280 Temperatur-, Feuchte- und Drucksensor", measurements: ["temperature", "humidity", "pressure"], signal: "i2c", capabilities: ["capability.i2c"] }),
      sensor({ id: "soil_moisture_analog", title: "Kapazitiver Bodenfeuchtesensor", measurements: ["soil_moisture"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "ldr", title: "LDR Fotowiderstand", measurements: ["light"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "bh1750", title: "BH1750 Helligkeitssensor", measurements: ["light"], signal: "i2c", capabilities: ["capability.i2c"] }),
      sensor({ id: "hc_sr04", title: "HC-SR04 Ultraschall-Abstandssensor", measurements: ["distance"], signal: "pulse_counter", capabilities: ["capability.pulse_counter"] }),
      sensor({ id: "reed_contact", title: "Reedkontakt", measurements: ["contact"], signal: "digital", capabilities: ["capability.digital_input"] }),
      sensor({ id: "hall_a3144", title: "A3144 Hall-Schaltsensor", measurements: ["magnetic_field"], signal: "digital", capabilities: ["capability.digital_input"] }),
      sensor({ id: "hall_ss49e", title: "SS49E linearer Hallsensor", measurements: ["magnetic_field"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "incremental_encoder_ab", title: "Inkrementalgeber A/B", measurements: ["position", "rotation"], signal: "incremental_ab", capabilities: ["capability.quadrature_counter"] }),
      sensor({ id: "pulse_encoder", title: "Einspuriger Impulsgeber", measurements: ["rotation", "speed"], signal: "pulse_counter", capabilities: ["capability.pulse_counter"] }),
      sensor({ id: "adxl335", title: "ADXL335 Beschleunigungssensor", measurements: ["acceleration"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "adxl345", title: "ADXL345 Beschleunigungssensor", measurements: ["acceleration"], signal: "i2c", capabilities: ["capability.i2c"] }),
      sensor({ id: "mpu6050", title: "MPU6050 Beschleunigungs- und Drehratensensor", measurements: ["acceleration", "rotation"], signal: "i2c", capabilities: ["capability.i2c"] }),
      sensor({ id: "pir", title: "PIR-Bewegungssensor", measurements: ["motion"], signal: "digital", capabilities: ["capability.digital_input"] }),
      sensor({ id: "water_level_analog", title: "Analoger Wasserstandssensor", measurements: ["level"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "float_switch", title: "Schwimmerschalter", measurements: ["level"], signal: "digital", capabilities: ["capability.digital_input"] }),
      sensor({ id: "acs712", title: "ACS712 Stromsensor", measurements: ["current"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "voltage_divider", title: "Spannungsteiler-Messung", measurements: ["voltage"], signal: "analog", capabilities: ["capability.analog_input"] }),
      sensor({ id: "bmp280", title: "BMP280 Drucksensor", measurements: ["pressure"], signal: "i2c", capabilities: ["capability.i2c"] }),
      sensor({ id: "load_cell_hx711", title: "Waegezelle mit HX711", measurements: ["weight", "force"], signal: "digital", capabilities: ["capability.digital_input"] }),
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

function boardFeatureOptions() {
  return [
    boardFeature("display", "Display", "capability.display_output", {
      hardware_options: options(["TFT-LCD", "IPS-LCD", "OLED", "E-Paper"]),
      driver_options: options(["ST7789", "ILI9341", "ILI9488", "ST7735", "GC9A01", "SSD1306", "SH1106"]),
      connection_options: options(["SPI", "I2C", "RGB parallel", "8080 parallel", "MIPI DSI"]),
      datasheet_hint: "Controller-Aufdruck, Displaygröße, Auflösung, Pinbelegung und Versorgungsspannung im Board-Datenblatt prüfen.",
    }),
    boardFeature("touch", "Touch", "capability.touchscreen_input", {
      hardware_options: options(["Kapazitiv", "Resistiv"]),
      driver_options: options(["GT911", "FT6236", "FT6336G", "CST816", "XPT2046"]),
      connection_options: options(["I2C", "SPI", "GPIO Interrupt"]),
      datasheet_hint: "Touchcontroller und Interrupt-/Reset-Pins stehen meist separat im Schaltplan des Boards.",
    }),
    boardFeature("speaker", "Speaker", "capability.audio_output", {
      hardware_options: options(["Passiver Lautsprecher", "Aktiver Buzzer", "I2S-Verstärker"]),
      driver_options: options(["Direkt per PWM", "MAX98357A", "NS4168", "ES8311"]),
      connection_options: options(["PWM", "DAC", "I2S"]),
      datasheet_hint: "Verstärker, Impedanz und zulässige Leistung vor dem Flashen prüfen.",
    }),
    boardFeature("microphone", "Mikrofon", "capability.audio_input", {
      hardware_options: options(["Analoges Mikrofon", "I2S-Mikrofon", "PDM-Mikrofon"]),
      driver_options: options(["INMP441", "ICS-43434", "SPH0645", "ES7210", "Analog/ADC"]),
      connection_options: options(["ADC", "I2S", "PDM"]),
      datasheet_hint: "Takt, Kanalwahl und Versorgungsspannung des Mikrofonmoduls im Datenblatt prüfen.",
    }),
    boardFeature("bluetooth", "Bluetooth", "capability.bluetooth", {
      hardware_options: options(["Bluetooth Classic", "Bluetooth Low Energy", "Classic + BLE"]),
      driver_options: options(["ESP-IDF Bluetooth", "NimBLE", "Arduino BLE"]),
      connection_options: options(["Im Prozessor integriert"]),
      datasheet_hint: "Nicht jede ESP-Variante unterstützt Bluetooth Classic. Maßgeblich ist das konkrete MCU-Datenblatt.",
    }),
    boardFeature("wifi", "WLAN", "capability.wifi", {
      hardware_options: options(["2,4 GHz", "2,4 + 5 GHz"]),
      driver_options: options(["ESP-IDF Wi-Fi", "Arduino WiFi"]),
      connection_options: options(["PCB-Antenne", "Externe Antenne / U.FL"]),
      datasheet_hint: "Antennenvariante und zulässige Funkbänder anhand der exakten Modulbezeichnung prüfen.",
    }),
    boardFeature("ram", "RAM / PSRAM", "capability.external_ram", {
      hardware_options: options(["Interner SRAM", "QSPI-PSRAM", "OPI-PSRAM"]),
      driver_options: options(["ESP-IDF Heap/PSRAM", "Arduino PSRAM"]),
      connection_options: options(["Im Modul integriert", "Extern auf dem Board"]),
      value_options: options(["512 KB", "2 MB", "4 MB", "8 MB", "16 MB"]),
      datasheet_hint: "Die PSRAM-Größe folgt der vollständigen Modul-/Boardbezeichnung, nicht nur dem Prozessortyp.",
    }),
    boardFeature("flash", "Flash", "capability.flash_storage", {
      hardware_options: options(["QSPI-Flash", "OPI-Flash"]),
      driver_options: options(["ESP-IDF Partition Table", "Arduino Partition Scheme"]),
      connection_options: options(["Im Modul integriert", "Extern auf dem Board"]),
      value_options: options(["2 MB", "4 MB", "8 MB", "16 MB", "32 MB"]),
      datasheet_hint: "Flash-Größe und Partitionslayout müssen vor OTA und Basissoftware-Flash eindeutig feststehen.",
    }),
  ];
}

function boardFeature(id, title, capabilityId, details) {
  return {
    hardware_item_id: `hardware.board_feature.${id}`,
    sku: `GNX-BOARD-FEATURE-${id.toUpperCase()}`,
    item_type: "board_feature_option",
    feature_id: id,
    title,
    summary: `${title} am konkreten Board erfassen.`,
    capability_ids: [capabilityId],
    support_policy: "catalog_reference",
    provisioning_profile_id: "",
    status: "active",
    ...details,
  };
}

function options(values) {
  return values.map((title) => ({ id: title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), title }));
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
    pin_profile: {
      analog_inputs: ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      digital_pins: ["D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13"],
      pwm_pins: ["D3", "D5", "D6", "D9", "D10", "D11"],
      i2c: ["SDA A4 + SCL A5"],
    },
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
    pin_profile: {
      analog_inputs: ["A0"],
      digital_pins: ["D1 / GPIO5", "D2 / GPIO4", "D5 / GPIO14", "D6 / GPIO12", "D7 / GPIO13"],
      pwm_pins: ["D1 / GPIO5", "D2 / GPIO4", "D5 / GPIO14", "D6 / GPIO12", "D7 / GPIO13"],
      i2c: ["SDA D2 / GPIO4 + SCL D1 / GPIO5"],
    },
  });
}

function esp32Board(input) {
  return networkBoard({
    ...input,
    processor_family: "esp32",
    capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.ota", "capability.device_http_status", "capability.captive_setup_supported", "capability.basissoftware_supported", "capability.usb_identification", "capability.flash_firmware", "capability.digital_input", "capability.digital_output", ...(input.extra_capability_ids || [])],
    basissoftware_profile_id: "basissoftware.profile.esp32_factory",
    provisioning_profile_id: "provisioning_profile.esp32_ota_bootstrap",
    min_basissoftware_version: "0.1.0",
    pin_profile: input.pin_profile || {
      analog_inputs: ["GPIO32 / ADC1_CH4", "GPIO33 / ADC1_CH5", "GPIO34 / ADC1_CH6", "GPIO35 / ADC1_CH7", "GPIO36 / ADC1_CH0", "GPIO39 / ADC1_CH3"],
      digital_pins: ["GPIO4", "GPIO5", "GPIO12", "GPIO13", "GPIO14", "GPIO16", "GPIO17", "GPIO18", "GPIO19", "GPIO21", "GPIO22", "GPIO23", "GPIO25", "GPIO26", "GPIO27"],
      pwm_pins: ["GPIO4", "GPIO5", "GPIO12", "GPIO13", "GPIO14", "GPIO18", "GPIO19", "GPIO23", "GPIO25", "GPIO26", "GPIO27"],
      i2c: ["SDA GPIO21 + SCL GPIO22"],
    },
    default_instance_configuration: input.default_instance_configuration,
    verification_status: input.verification_status,
    evidence: input.evidence,
    peripheral_profile: esp32PeripheralProfile(input.mcu_variant),
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
    default_instance_configuration: input.default_instance_configuration || {
      online_led: { configurable: true },
      display: { configurable: true, optional: true },
      sound: { configurable: true, optional: true },
    },
    verification_status: input.verification_status || "catalog_seed",
    evidence: input.evidence || {},
    pin_profile: input.pin_profile || {},
    peripheral_profile: input.peripheral_profile || {},
    status: "active",
  };
}

function esp32PeripheralProfile(mcuVariant = "ESP32") {
  return {
    schema_version: 1,
    documentation_url: esp32PeripheralDocumentationUrl(mcuVariant),
    resources: [
      peripheral("gpio", "GPIO", "Digitale Ein- und Ausgänge", { configurable: true, pin_profile_key: "digital_pins" }),
      peripheral("adc", "ADC", "Analoge Signale digital erfassen", { configurable: true, pin_profile_key: "analog_inputs" }),
      peripheral("pwm", "PWM", "Pulsweitenmodulierte Ausgänge", { configurable: true, pin_profile_key: "pwm_pins" }),
      peripheral("i2c", "I²C", "Zweidraht-Bus für Sensoren und Erweiterungen", { configurable: true, pin_profile_key: "i2c" }),
      peripheral("spi", "SPI", "Synchroner serieller Hochgeschwindigkeitsbus", { configurable: true }),
      peripheral("uart", "UART", "Asynchrone serielle Kommunikation", { configurable: true }),
      peripheral("pcnt", "PCNT", "Hardware-Impuls- und Quadraturzähler", { configurable: true }),
      peripheral("rmt", "RMT", "Präzise Pulsfolgen senden und empfangen", { configurable: true }),
      peripheral("i2s", "I²S", "Digitale Audio- und Datenströme", { configurable: true }),
      peripheral("twai", "TWAI / CAN", "CAN-kompatible Feldbuskommunikation", { configurable: true }),
      peripheral("mcpwm", "Motor-PWM", "Mehrkanal-PWM mit Totzeit für Motorsteuerungen", { configurable: true }),
      peripheral("hardware_timer", "Hardware-Timer", "Zeitbasis für Scheduler, Regelung und präzise Ereignisse", { managed_by: "runtime_timer" }),
      peripheral("interrupt", "Interrupt-Controller", "Ereignisgesteuerte Reaktion auf Peripherie und Pins", { managed_by: "runtime_events" }),
    ],
    abstractions: [
      abstraction("runtime_timer", "Zeitgeber", "OS/Basissoftware verwaltet Zeitpunkte, Intervalle und Scheduler-Ticks.", ["hardware_timer"]),
      abstraction("runtime_events", "Ereignisse", "Interrupts werden als sichere Ereignisse und Callbacks bereitgestellt.", ["interrupt", "gpio"]),
      abstraction("digital_io", "Digital-I/O", "Einheitlicher Zugriff auf digitale Ein- und Ausgänge.", ["gpio"]),
      abstraction("analog_input", "Analogeingang", "Kalibrierte Messwerte statt direkter ADC-Registerzugriffe.", ["adc"]),
      abstraction("measurement_acquisition", "Messwerterfassung", "Sensorwerte zyklisch erfassen, kalibrieren und als einheitliche Messwerte bereitstellen.", ["runtime_timer", "analog_input", "serial_bus"]),
      abstraction("waveform_output", "Puls- und Wellenformausgabe", "Zeitgesteuerte Ausgaben über PWM, Motor-PWM oder RMT.", ["pwm", "mcpwm", "rmt", "hardware_timer"]),
      abstraction("serial_bus", "Serielle Busse", "Treiberzugriff auf I²C, SPI, UART, I²S und TWAI.", ["i2c", "spi", "uart", "i2s", "twai"]),
    ],
    drivers: [
      driver("data_logger", "Datenlogger", "Messwerte in konfigurierbaren Intervallen sammeln, zusammenfassen und an ein Speicherziel übergeben.", ["measurement_acquisition", "runtime_timer"], { configures: "sensor" }),
      driver("servo_driver", "Servo-Treiber", "Positionsvorgabe über zeitgenaue PWM-Signale.", ["waveform_output", "pwm"]),
      driver("dc_motor_driver", "DC-Motortreiber / H-Brücke", "Drehzahl und Richtung über PWM und digitale Ausgänge.", ["waveform_output", "pwm", "gpio"]),
      driver("stepper_driver", "Schrittmotor-Treiber", "STEP/DIR-Signale mit deterministischer Zeitbasis.", ["runtime_timer", "gpio", "rmt"]),
      driver("synchronous_motor_driver", "Synchronmotor / BLDC / PMSM", "Kommutierung oder FOC über 3-Phasen-Leistungstreiber, Motor-PWM, Strommessung und Rotorlage.", ["mcpwm", "adc", "hardware_timer", "pcnt"]),
    ],
  };
}

function esp32PeripheralDocumentationUrl(mcuVariant) {
  const normalized = String(mcuVariant || "").toLowerCase();
  if (normalized.includes("s3")) return "https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/peripherals/index.html";
  if (normalized.includes("c6")) return "https://docs.espressif.com/projects/esp-idf/en/latest/esp32c6/api-reference/peripherals/index.html";
  return "https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/peripherals/index.html";
}

function peripheral(id, title, description, options = {}) {
  return { id, title, description, configurable: false, ...options };
}

function abstraction(id, title, description, dependsOn) {
  return { id, title, description, depends_on: dependsOn };
}

function driver(id, title, description, dependsOn, options = {}) {
  return { id, title, description, depends_on: dependsOn, configures: "actuator", ...options };
}

function capability(capabilityId, title) {
  return {
    capability_id: capabilityId,
    title,
    owner_domain: "Hardware",
    status: "active",
  };
}

function sensor(input) {
  return {
    hardware_item_id: `hardware.sensor.${input.id}`,
    sku: `GNX-SENSOR-${input.id.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`,
    item_type: "sensor",
    sensor_type_id: input.id,
    title: input.title,
    summary: input.summary || input.title,
    measurement_kinds: input.measurements,
    signal_type: input.signal,
    capability_ids: input.capabilities,
    support_policy: "component_support",
    provisioning_profile_id: "",
    status: "active",
  };
}

module.exports = { defaultCatalogSeed };
