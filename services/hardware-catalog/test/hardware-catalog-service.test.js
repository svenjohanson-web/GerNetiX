const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultHardwareCatalog } = require("../src");
const { SqliteBackedHardwareCatalogRepository } = require("../src/repositories");
const { defaultCatalogSeed } = require("../src/seed");
const { renderPlatformioIni } = require("../../shared/platformio-config");

test("lists catalog capabilities and processor boards from catalog", async () => {
  const service = await createDefaultHardwareCatalog({ persistenceBackend: "memory" });

  assert.equal((await service.listCapabilities()).some((item) => item.capability_id === "capability.processor_esp32"), true);
  assert.equal((await service.listCapabilities()).some((item) => item.capability_id === "capability.processor_esp8266"), true);
  assert.equal((await service.listCapabilities()).some((item) => item.capability_id === "capability.touchscreen_input"), true);
  assert.equal((await service.listCapabilities()).some((item) => item.capability_id === "capability.camera_input"), true);
  assert.equal((await service.listProcessorBoards()).some((item) => item.hardware_item_id === "hardware.processor_board.generic_esp_wroom32"), true);
  assert.equal((await service.listProcessorBoards()).some((item) => item.hardware_item_id === "hardware.processor_board.espressif_esp32_s3_devkitc_1"), true);
  const touchBoard = await service.getHardwareItem("hardware.processor_board.generic_esp32_s3_touch_display");
  assert.ok(touchBoard.capability_ids.includes("capability.display_output"));
  assert.ok(touchBoard.capability_ids.includes("capability.touchscreen_input"));
  const es3c28p = await service.getHardwareItem("hardware.processor_board.esp32_s3_es3c28p");
  const cameraBoard = await service.getHardwareItem("hardware.processor_board.ai_thinker_esp32_cam");
  const waveshareCamera = await service.getHardwareItem("hardware.processor_board.waveshare_esp32_s3_cam_ov3660");
  const waveshareAudio = await service.getHardwareItem("hardware.processor_board.waveshare_esp32_s3_audio_board");
  assert.ok(cameraBoard.capability_ids.includes("capability.camera_input"));
  assert.equal(cameraBoard.default_instance_configuration.board_features.camera.hardware, "ov2640");
  assert.equal(cameraBoard.pin_profile.assigned_pins.camera_parallel.xclk, 0);
  assert.equal(waveshareCamera.title, "Waveshare ESP32-S3-CAM-OV3660");
  assert.equal(waveshareCamera.vendor, "Waveshare");
  assert.equal(waveshareCamera.module_memory_variant, "N16R8");
  assert.equal(waveshareCamera.verification_status, "vendor_reference");
  assert.equal(waveshareCamera.default_instance_configuration.product_family, "Waveshare ESP32-S3-CAM-OVxxxx");
  assert.ok(waveshareCamera.default_instance_configuration.available_camera_variants.includes("GC2145"));
  assert.ok(waveshareCamera.capability_ids.includes("capability.camera_input"));
  assert.ok(waveshareCamera.capability_ids.includes("capability.removable_storage"));
  assert.equal(waveshareCamera.capability_ids.includes("capability.display_output"), false);
  assert.equal(waveshareCamera.capability_ids.includes("capability.touchscreen_input"), false);
  assert.ok(waveshareCamera.capability_ids.includes("capability.uart"));
  assert.equal(waveshareCamera.default_instance_configuration.board_features.camera.hardware, "ov3660");
  assert.equal(waveshareCamera.default_instance_configuration.board_features.camera.maximum_resolution, "2048x1536");
  assert.equal(waveshareCamera.default_instance_configuration.board_features.camera.pins.xclk, 38);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.camera.pins.d0, 45);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.camera_power.hardware, "CH32V003F4U6");
  assert.equal(waveshareCamera.default_instance_configuration.board_features.camera_power.pins.address, 0x24);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.camera_power.pins.output, 6);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.microphone.driver, "es7210");
  assert.equal(waveshareCamera.default_instance_configuration.board_features.microphone.pins.data_in, 13);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.speaker.pins.data_out, 14);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.speaker.driver, "es8311");
  assert.equal(waveshareCamera.default_instance_configuration.board_features.storage.pins.clk, 16);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.display.enabled, false);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.display.included, false);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.display.pins.cs, 6);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.display.pins.mosi_sda0, 1);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.touch.enabled, false);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.touch.included, false);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.touch.pins.interrupt, 9);
  assert.equal(waveshareCamera.default_instance_configuration.io_expander.lines.exio2, "display_backlight");
  assert.equal(waveshareCamera.default_instance_configuration.io_expander.lines.exio3, "display_reset");
  assert.equal(waveshareCamera.default_instance_configuration.io_expander.lines.exio6, "camera_enable");
  assert.equal(waveshareCamera.default_instance_configuration.io_expander.lines.exio_pwm, "display_backlight_pwm");
  assert.equal(waveshareCamera.default_instance_configuration.external_connectors.uart.pins.tx, 43);
  assert.equal(waveshareCamera.default_instance_configuration.external_connectors.battery.nominal_voltage_v, 3.7);
  assert.equal(waveshareCamera.default_instance_configuration.mechanical.width_mm, 37);
  assert.equal(waveshareCamera.default_instance_configuration.mechanical.mounting_hole_center_spacing_x_mm, 32.6);
  assert.equal(waveshareCamera.default_instance_configuration.mechanical.mounting_hole_radius_mm, 2.25);
  assert.match(waveshareCamera.pin_profile.shared_pin_notes.join(" "), /GPIO43\/GPIO44/);
  assert.equal(waveshareCamera.default_instance_configuration.board_features.psram.value, "8_mb");
  assert.equal(waveshareCamera.default_instance_configuration.board_features.flash.value, "16_mb");
  assert.equal(waveshareCamera.platformio_build.board, "esp32-s3-devkitc-1");
  assert.equal(waveshareCamera.platformio_build.environment, "waveshare_esp32_s3_cam_ov3660");
  assert.equal(waveshareCamera.platformio_build.flash_size_mb, 16);
  assert.equal(waveshareCamera.platformio_build.platformio_options["board_build.arduino.memory_type"], "qio_opi");
  assert.ok(waveshareCamera.platformio_build.build_flags.includes("-D CAMERA_MODEL_ESP_EYE"));
  const wavesharePlatformio = renderPlatformioIni(waveshareCamera.platformio_build);
  assert.match(wavesharePlatformio, /\[env:waveshare_esp32_s3_cam_ov3660\]/);
  assert.match(wavesharePlatformio, /board = esp32-s3-devkitc-1/);
  assert.match(wavesharePlatformio, /board_build\.flash_size = 16MB/);
  assert.match(wavesharePlatformio, /board_build\.arduino\.memory_type = qio_opi/);
  assert.match(wavesharePlatformio, /-D CAMERA_MODEL_ESP_EYE/);
  assert.equal(waveshareAudio.title, "Waveshare ESP32-S3-AUDIO-Board");
  assert.equal(waveshareAudio.vendor, "Waveshare");
  assert.equal(waveshareAudio.module_name, "ESP32-S3R8");
  assert.equal(waveshareAudio.module_memory_variant, "N16R8");
  assert.equal(waveshareAudio.firmware_build_target_id, "firmware_build_target.esp32_s3_opi_n16r8");
  assert.ok(waveshareAudio.capability_ids.includes("capability.audio_input"));
  assert.ok(waveshareAudio.capability_ids.includes("capability.audio_output"));
  assert.ok(waveshareAudio.capability_ids.includes("capability.removable_storage"));
  assert.equal(waveshareAudio.capability_ids.includes("capability.display_output"), false);
  assert.equal(waveshareAudio.capability_ids.includes("capability.camera_input"), false);
  assert.equal(waveshareAudio.default_instance_configuration.hardware_test_status, "pending_user_hardware_test");
  assert.deepEqual(waveshareAudio.default_instance_configuration.manufacturer_skus, ["32184", "32185"]);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.microphone.driver, "es7210");
  assert.equal(waveshareAudio.default_instance_configuration.board_features.microphone.pins.data_in, 15);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.speaker.driver, "es8311");
  assert.equal(waveshareAudio.default_instance_configuration.board_features.speaker.pins.data_out, 16);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.rgb_led.count, 7);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.rgb_led.pins.data, 38);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.storage.pins.sclk, 40);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.storage.chip_select, "EXIO3");
  assert.equal(waveshareAudio.default_instance_configuration.board_features.display.enabled, false);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.display.pins.cs, 3);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.touch.pins.sda, 11);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.camera.enabled, false);
  assert.equal(waveshareAudio.default_instance_configuration.board_features.camera.pins.d7, 48);
  assert.equal(waveshareAudio.default_instance_configuration.io_expander.hardware, "TCA9555PWR");
  assert.equal(waveshareAudio.default_instance_configuration.io_expander.lines.exio5, "camera_power_down");
  assert.equal(waveshareAudio.platformio_build.board, "4d_systems_esp32s3_gen4_r8n16");
  assert.equal(waveshareAudio.platformio_build.environment, "waveshare_esp32_s3_audio_board");
  assert.equal(waveshareAudio.platformio_build.framework, "espidf");
  assert.equal(waveshareAudio.platformio_build.firmware_basis_id, "gernetix-runtime-basissoftware");
  const waveshareAudioPlatformio = renderPlatformioIni(waveshareAudio.platformio_build);
  assert.match(waveshareAudioPlatformio, /\[env:waveshare_esp32_s3_audio_board\]/);
  assert.match(waveshareAudioPlatformio, /board = 4d_systems_esp32s3_gen4_r8n16/);
  assert.match(waveshareAudioPlatformio, /framework = espidf/);
  assert.match(waveshareAudioPlatformio, /board_build\.partitions = partitions_full_16mb\.csv/);
  assert.equal(es3c28p.mcu_variant, "ESP32-S3");
  assert.equal(es3c28p.module_name, "ESP32-S3-WROOM-1");
  assert.equal(es3c28p.module_memory_variant, "N16R8");
  assert.equal(es3c28p.firmware_build_target_id, "firmware_build_target.esp32_s3_opi_n16r8");
  assert.equal(es3c28p.verification_status, "locally_verified");
  assert.equal(es3c28p.default_instance_configuration.board_features.display.driver, "ili9341");
  assert.equal(es3c28p.default_instance_configuration.board_features.display.pins.backlight, 45);
  assert.equal(es3c28p.default_instance_configuration.board_features.display.pin_assignment_group, "display_spi");
  assert.equal(es3c28p.default_instance_configuration.board_features.touch.driver, "ft6336g");
  assert.equal(es3c28p.default_instance_configuration.board_features.touch.pins.sda, 16);
  assert.equal(es3c28p.default_instance_configuration.board_features.speaker.pins.data_out, 8);
  assert.equal(es3c28p.default_instance_configuration.board_features.ram.hardware, "interner_sram");
  assert.equal(es3c28p.default_instance_configuration.board_features.ram.value, "512_kb");
  assert.equal(es3c28p.default_instance_configuration.board_features.psram.hardware, "octal_psram");
  assert.equal(es3c28p.default_instance_configuration.board_features.psram.value, "8_mb");
  assert.equal(es3c28p.default_instance_configuration.board_features.flash.hardware, "qspi_flash");
  assert.equal(es3c28p.default_instance_configuration.board_features.flash.value, "16_mb");
  assert.equal(es3c28p.platformio_build.environment, "es3c28p");
  assert.equal(es3c28p.platformio_build.flash_size_mb, 16);
  assert.ok(es3c28p.platformio_build.build_flags.includes("-D ARDUINO_USB_MODE=1"));
  assert.equal(es3c28p.default_instance_configuration.battery_measurement.pin, 9);
  assert.deepEqual(es3c28p.pin_profile.diagnostic_output_allowlist, []);
  assert.equal((await service.listProcessorBoards()).some((item) => item.hardware_item_id === "hardware.processor_board.wemos_d1_mini_esp12f"), true);
  assert.equal((await service.listProcessorBoards()).some((item) => item.processor_family === "esp32" && item.module_name === "ESP32-S3-WROOM-1"), true);
  const wroom32 = await service.getHardwareItem("hardware.processor_board.generic_esp_wroom32");
  const c6 = await service.getHardwareItem("hardware.processor_board.espressif_esp32_c6_devkitc_1");
  const nano = await service.getHardwareItem("hardware.processor_board.arduino_nano_r3_atmega328p");
  assert.ok(wroom32.pin_profile.analog_inputs.includes("GPIO32 / ADC1_CH4"));
  assert.equal(wroom32.peripheral_profile.resources.some((item) => item.id === "hardware_timer" && item.managed_by === "runtime_timer"), true);
  assert.equal(wroom32.peripheral_profile.abstractions.some((item) => item.id === "runtime_timer"), true);
  assert.equal(wroom32.peripheral_profile.drivers.some((item) => item.id === "synchronous_motor_driver" && item.depends_on.includes("mcpwm")), true);
  assert.equal(wroom32.peripheral_profile.abstractions.some((item) => item.id === "measurement_acquisition" && item.depends_on.includes("runtime_timer")), true);
  assert.equal(wroom32.peripheral_profile.drivers.some((item) => item.id === "data_logger" && item.configures === "sensor"), true);
  assert.match(c6.peripheral_profile.documentation_url, /esp32c6\/api-reference\/peripherals/);
  assert.ok(nano.pin_profile.pwm_pins.includes("D3"));
  assert.equal(nano.platformio_build.platform, "atmelavr");
  assert.equal(nano.platformio_build.maximum_program_size_bytes, 30720);
  const d1Mini = await service.getHardwareItem("hardware.processor_board.wemos_d1_mini_esp12f");
  assert.equal(d1Mini.platformio_build.platform, "espressif8266");
  assert.equal(d1Mini.platformio_build.flash_size_mb, 4);
  const diymoreOled = await service.getHardwareItem("hardware.processor_board.diymore_hw_364a_esp8266_oled");
  assert.equal(diymoreOled.title, "diymore HW-364A ESP8266 mit 0,96-Zoll-OLED");
  assert.equal(diymoreOled.vendor, "diymore");
  assert.equal(diymoreOled.module_name, "ESP-12F");
  assert.equal(diymoreOled.usb_serial_chip, "CH340");
  assert.equal(diymoreOled.cpu_architecture, "Xtensa 32-bit RISC");
  assert.equal(diymoreOled.cpu_core, "Tensilica Xtensa LX106");
  assert.equal(diymoreOled.clock_hz, 80000000);
  assert.equal(diymoreOled.factory_firmware_artifact.artifact_id, "firmware_artifact.esp8266_diymore_hw364a_basissoftware_factory.latest");
  assert.equal(diymoreOled.factory_firmware_artifact.source, "sqlite");
  assert.ok(diymoreOled.capability_ids.includes("capability.display_output"));
  assert.ok(diymoreOled.capability_ids.includes("capability.i2c"));
  assert.equal(diymoreOled.platformio_build.board, "nodemcuv2");
  assert.equal(diymoreOled.platformio_build.environment, "diymore_hw_364a");
  assert.ok(diymoreOled.platformio_build.libraries.includes("olikraus/U8g2@^2.36.17"));
  assert.equal(diymoreOled.default_instance_configuration.board_features.display.driver, "ssd1306");
  assert.equal(diymoreOled.default_instance_configuration.board_features.display.address, "0x3C");
  assert.equal(diymoreOled.default_instance_configuration.board_features.display.width, 128);
  assert.equal(diymoreOled.default_instance_configuration.board_features.display.height, 64);
  assert.equal(diymoreOled.default_instance_configuration.board_features.display.pins.sda, 14);
  assert.equal(diymoreOled.default_instance_configuration.board_features.display.pins.scl, 12);
  assert.equal(diymoreOled.default_instance_configuration.board_features.display.pin_assignment_group, "display_i2c");
  assert.equal(diymoreOled.default_instance_configuration.board_features.flash.value, "4_mb");
  assert.equal(diymoreOled.default_instance_configuration.board_features.ram.value, "64_kb");
  const sensors = await service.listSensors();
  assert.equal(sensors.some((item) => item.sensor_type_id === "pt1000" && item.signal_type === "analog"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "bme280" && item.measurement_kinds.includes("humidity")), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "incremental_encoder_ab" && item.signal_type === "incremental_ab"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "reed_contact" && item.measurement_kinds.includes("contact")), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "adxl335" && item.measurement_kinds.includes("acceleration") && item.signal_type === "analog"), true);
  assert.equal(sensors.some((item) => item.sensor_type_id === "adxl345" && item.measurement_kinds.includes("acceleration") && item.signal_type === "i2c"), true);
  const ov3660 = sensors.find((item) => item.sensor_type_id === "ov3660");
  assert.equal(ov3660.component_class, "camera_sensor");
  assert.equal(ov3660.signal_type, "parallel_dvp_sccb");
  assert.equal(ov3660.maximum_resolution, "2048x1536");
  assert.equal(ov3660.driver_id, "espressif_esp32_camera");
  assert.deepEqual(
    ["ov2640", "ov3660", "ov5640", "gc2145", "gc0308"].filter((id) => sensors.some((item) => item.sensor_type_id === id)),
    ["ov2640", "ov3660", "ov5640", "gc2145", "gc0308"],
  );
  const boardFeatures = await service.listBoardFeatureOptions();
  const display = boardFeatures.find((item) => item.feature_id === "display");
  const memory = boardFeatures.find((item) => item.feature_id === "ram");
  assert.equal(boardFeatures.length, 11);
  assert.equal(boardFeatures.find((item) => item.feature_id === "camera").driver_options[0].title, "Espressif esp32-camera");
  assert.equal(boardFeatures.find((item) => item.feature_id === "camera").hardware_options.some((item) => item.title === "GC2145"), true);
  assert.equal(display.driver_options.some((item) => item.title === "ST7789"), true);
  assert.equal(display.connection_options.some((item) => item.title === "SPI"), true);
  assert.equal(boardFeatures.find((item) => item.feature_id === "touch").driver_options.some((item) => item.title === "FT6336G"), true);
  const psram = boardFeatures.find((item) => item.feature_id === "psram");
  assert.equal(psram.value_options.some((item) => item.title === "8 MB"), true);
  assert.equal(memory.value_options.some((item) => item.title === "512 KB"), true);
  assert.equal(memory.driver_options.some((item) => item.title === "ESP-IDF Heap"), true);
  assert.equal(psram.driver_options.some((item) => item.title === "ESP-IDF Heap/PSRAM"), true);
  assert.equal(boardFeatures.find((item) => item.feature_id === "storage").driver_options.some((item) => item.title === "SD_MMC"), true);
  assert.match(display.datasheet_hint, /Datenblatt/);
});

test("sqlite catalog migration additively enriches an existing Waveshare camera board", () => {
  const loaded = defaultCatalogSeed();
  const itemId = "hardware.processor_board.waveshare_esp32_s3_cam_ov3660";
  const board = loaded.hardwareItems.find((item) => item.hardware_item_id === itemId);
  board.capability_ids = board.capability_ids.filter((item) => ![
    "capability.uart",
  ].includes(item));
  delete board.pin_profile.assigned_pins.display_spi_qspi;
  delete board.pin_profile.assigned_pins.touch_i2c;
  delete board.pin_profile.shared_pin_notes;
  delete board.default_instance_configuration.board_features.display;
  delete board.default_instance_configuration.board_features.touch;
  delete board.default_instance_configuration.io_expander.lines;
  delete board.default_instance_configuration.external_connectors;
  delete board.default_instance_configuration.mechanical;
  board.default_instance_configuration.board_features.camera.hardware = "custom_confirmed_camera";
  let persisted;

  const repository = new SqliteBackedHardwareCatalogRepository({
    load: () => loaded,
    ensureSchema: () => {},
    save: (state) => { persisted = state; },
  });

  const migrated = repository.findHardwareItem(itemId);
  assert.equal(migrated.default_instance_configuration.board_features.camera.hardware, "custom_confirmed_camera");
  assert.equal(migrated.default_instance_configuration.board_features.display.pins.cs, 6);
  assert.equal(migrated.default_instance_configuration.board_features.touch.pins.interrupt, 9);
  assert.equal(migrated.default_instance_configuration.io_expander.lines.exio4, "tf_card_chip_select");
  assert.equal(migrated.default_instance_configuration.io_expander.lines.exio6, "camera_enable");
  assert.equal(migrated.default_instance_configuration.board_features.camera_power.pins.output, 6);
  assert.equal(migrated.default_instance_configuration.mechanical.height_mm, 37);
  assert.equal(migrated.default_instance_configuration.board_features.display.enabled, false);
  assert.equal(migrated.default_instance_configuration.board_features.touch.enabled, false);
  assert.equal(migrated.capability_ids.includes("capability.display_output"), false);
  assert.equal(migrated.capability_ids.includes("capability.touchscreen_input"), false);
  assert.ok(migrated.capability_ids.includes("capability.uart"));
  assert.equal(persisted.hardwareItems.find((item) => item.hardware_item_id === itemId)
    .default_instance_configuration.external_connectors.i2c.pins.sda, 8);
});

test("sqlite catalog migration enriches an existing ES3C28P board with known memory", async () => {
  const loaded = defaultCatalogSeed();
  const board = loaded.hardwareItems.find((item) => item.hardware_item_id === "hardware.processor_board.esp32_s3_es3c28p");
  delete board.default_instance_configuration.board_features.ram;
  delete board.default_instance_configuration.board_features.psram;
  delete board.module_name;
  delete board.module_memory_variant;
  delete board.firmware_build_target_id;
  delete board.platformio_build;
  delete board.default_instance_configuration.board_features.display.pins;
  board.default_instance_configuration.board_features.flash.value = "custom_confirmed_value";
  let persisted;
  const repository = new SqliteBackedHardwareCatalogRepository({
    load: () => loaded,
    ensureSchema: () => {},
    save: (state) => { persisted = state; },
  });

  const migrated = repository.findHardwareItem(board.hardware_item_id);
  assert.equal(migrated.default_instance_configuration.board_features.ram.value, "512_kb");
  assert.equal(migrated.default_instance_configuration.board_features.psram.value, "8_mb");
  assert.equal(migrated.module_name, "ESP32-S3-WROOM-1");
  assert.equal(migrated.module_memory_variant, "N16R8");
  assert.equal(migrated.firmware_build_target_id, "firmware_build_target.esp32_s3_opi_n16r8");
  assert.equal(migrated.platformio_build.environment, "es3c28p");
  assert.equal(migrated.default_instance_configuration.board_features.flash.value, "custom_confirmed_value");
  assert.equal(migrated.default_instance_configuration.board_features.display.pins.dc, 46);
  assert.equal(persisted.hardwareItems.find((item) => item.hardware_item_id === board.hardware_item_id)
    .default_instance_configuration.board_features.ram.hardware, "interner_sram");
});

test("lists GerNetiX Flashbox as purchase-only claimable hardware", async () => {
  const service = await createDefaultHardwareCatalog({ persistenceBackend: "memory" });
  const flashbox = (await service.listFlashboxes()).find((item) => item.hardware_item_id === "hardware.flashbox.esp32_s3_usb_helper");

  assert.ok(flashbox);
  assert.equal(flashbox.item_type, "flashbox");
  assert.equal(flashbox.hardware_class, "flashbox");
  assert.equal(flashbox.form_factor, "displayless_dual_usb_helper");
  assert.equal(flashbox.purchase_policy, "gernetix_purchase_only");
  assert.equal(flashbox.inventory_policy, "claim_required");
  assert.equal(flashbox.self_creation_allowed, false);
  assert.equal(flashbox.capability_ids.includes("capability.usb_otg_host"), true);
  assert.equal(flashbox.capability_ids.includes("capability.device_http_status"), true);
  assert.equal(flashbox.capability_ids.includes("capability.display_output"), false);
  assert.equal(flashbox.capability_ids.includes("capability.touchscreen_input"), false);
  assert.equal(flashbox.flashbox_capability_keys.includes("flashbox.self_update"), true);
  assert.equal(flashbox.default_instance_configuration.ui.display_enabled, false);
  assert.equal(flashbox.default_instance_configuration.ui.touch_enabled, false);
  assert.equal(flashbox.default_instance_configuration.usb_ports.control.role, "control_upstream_power_and_service");
  assert.equal(flashbox.default_instance_configuration.usb_ports.target.role, "target_downstream_usb_host");
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.vbus_power_mode, "two_usb_s3_helper_target_vbus_pending_verification");
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.vbus_power_switch_pin, null);
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.vbus_boost_enable_pin, null);
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.vbus_source_select_pin, null);
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.vbus_current_limit_enable_pin, null);
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.software_vbus_switching, "pending_two_usb_s3_board_verification");
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.unpowered_targets_require_external_power, true);
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.battery_input.documented, false);
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.battery_input.adc_pin, null);
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.required_product_verification, "two_usb_s3_helper_target_vbus_hardware_test");
  assert.equal(flashbox.default_instance_configuration.usb_otg_power.schematic_conclusion, "pending_new_two_usb_s3_board_schematic");
});

test("admin can add catalog hardware item with known capabilities", async () => {
  const service = await createDefaultHardwareCatalog({ persistenceBackend: "memory" });
  const item = await service.upsertHardwareItem({
    hardware_item_id: "hardware.sensor.button",
    sku: "GNX-BUTTON",
    item_type: "sensor",
    title: "Button Modul",
    capability_ids: ["capability.digital_input"],
    pin_profile: { digital_pins: ["SIG"] },
    peripheral_profile: { resources: [{ id: "gpio", configurable: true }] },
  });

  assert.equal(item.hardware_item_id, "hardware.sensor.button");
  assert.deepEqual(item.pin_profile.digital_pins, ["SIG"]);
  assert.equal(item.peripheral_profile.resources[0].id, "gpio");
});
