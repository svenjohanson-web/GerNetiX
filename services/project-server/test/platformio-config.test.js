const assert = require("node:assert/strict");
const test = require("node:test");
const { renderPlatformioIni } = require("../../shared/platformio-config");

test("renders ESP32 board memory, libraries and flags from the structured project configuration", () => {
  const ini = renderPlatformioIni({
    platform: "espressif32",
    board: "esp32-s3-devkitc-1",
    environment: "es3c28p",
    framework: "arduino",
    monitor_speed: 115200,
    upload_protocol: "esptool",
    libraries: ["lovyan03/LovyanGFX@^1.2.7"],
    build_flags: ["-D ARDUINO_USB_MODE=1"],
    board_configuration: { board_features: { flash: { value: "16_mb" } } },
  });

  assert.match(ini, /default_envs = es3c28p/);
  assert.match(ini, /board_build\.flash_size = 16MB/);
  assert.match(ini, /LovyanGFX/);
  assert.match(ini, /ARDUINO_USB_MODE=1/);
});

test("renders ESP8266 and AVR targets through the same generator", () => {
  const esp8266 = renderPlatformioIni({ platform: "espressif8266", board: "d1_mini", environment: "d1_mini", framework: "arduino", flash_size_mb: 4 });
  const avr = renderPlatformioIni({ platform: "atmelavr", board: "nanoatmega328", environment: "nanoatmega328", framework: "", maximum_program_size_bytes: 30720, maximum_ram_size_bytes: 2048 });

  assert.match(esp8266, /platform = espressif8266/);
  assert.match(esp8266, /board_build\.flash_size = 4MB/);
  assert.match(avr, /platform = atmelavr/);
  assert.match(avr, /board_upload\.maximum_size = 30720/);
  assert.match(avr, /board_upload\.maximum_ram_size = 2048/);
  assert.doesNotMatch(avr, /framework =/);
});

test("does not let additional PlatformIO options override the graphical compiler target", () => {
  const ini = renderPlatformioIni({
    platform: "atmelavr",
    board: "nanoatmega328",
    environment: "nanoatmega328",
    platformio_options: { board: "esp32dev", framework: "espidf", lib_extra_dirs: "lib" },
  });

  assert.match(ini, /board = nanoatmega328/);
  assert.doesNotMatch(ini, /board = esp32dev/);
  assert.doesNotMatch(ini, /framework = espidf/);
  assert.match(ini, /lib_extra_dirs = lib/);
});

test("preincludes project basissoftware configuration only for basissoftware builds", () => {
  const basis = renderPlatformioIni({
    platform: "espressif32", board: "esp32dev", firmware_basis_id: "gernetix-runtime-basissoftware",
    basissoftware_configuration: { wifi: { enabled: true } },
  });
  const plain = renderPlatformioIni({ platform: "espressif32", board: "esp32dev" });
  assert.match(basis, /-include include\/gernetix_basissoftware_configuration\.h/);
  assert.doesNotMatch(plain, /gernetix_basissoftware_configuration/);
});
