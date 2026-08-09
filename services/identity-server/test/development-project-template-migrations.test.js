const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cameraDisplayTemplateMigrationProposal,
  migrateCameraTemplateDisplayGpioTypes,
  migrateCameraTemplateWifiArchitecture,
} = require("../src/dev/development-project-template-migrations");

test("keeps the camera/display migration as a consent-only proposal", () => {
  assert.equal(cameraDisplayTemplateMigrationProposal.customer_consent_required, true);
  assert.equal(cameraDisplayTemplateMigrationProposal.automatic_execution, false);
  assert.equal(cameraDisplayTemplateMigrationProposal.target_runtime_model_version, 19);
});

test("replaces only the legacy direct camera-to-display processor connection", () => {
  const legacy = [
    '@startuml',
    'rectangle "IoT-Device 1" as camera_device {',
    '  rectangle "ESP32-S3 Prozessor" as camera_processor',
    '}',
    'rectangle "IoT-Device 2" as display_device {',
    '  rectangle "ESP32-S3 Prozessor" as display_processor',
    '}',
    'camera_processor --> display_processor : uebertraegt Bilddaten',
    '@enduml',
  ].join("\n");

  const migrated = migrateCameraTemplateWifiArchitecture(legacy);
  assert.match(migrated, /rectangle "WLAN-\/WiFi-Schnittstelle" as camera_wifi/);
  assert.match(migrated, /rectangle "WLAN-\/WiFi-Schnittstelle" as display_wifi/);
  assert.match(migrated, /camera_processor --> camera_wifi : uebergibt Bilddaten/);
  assert.match(migrated, /camera_wifi --> display_wifi : uebertraegt Bilddaten per WLAN/);
  assert.match(migrated, /display_wifi --> display_processor : liefert Bilddaten/);
  assert.doesNotMatch(migrated, /camera_processor --> display_processor/);
  assert.equal(migrateCameraTemplateWifiArchitecture(migrated), migrated);
});

test("does not rewrite a customized architecture without the legacy direct edge", () => {
  const customized = '@startuml\ncamera_processor --> router : sendet Bilddaten\n@enduml';
  assert.equal(migrateCameraTemplateWifiArchitecture(customized), customized);
});

test("types legacy ESP-IDF display GPIO assignments without changing unrelated user code", () => {
  const legacy = [
    "bus.sclk_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_SCLK;",
    "bus.mosi_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MOSI;",
    "bus.miso_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MISO;",
    "io.cs_gpio_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS;",
    "io.dc_gpio_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_DC;",
    "userDefinedCall();",
  ].join("\n");

  const migrated = migrateCameraTemplateDisplayGpioTypes(legacy);
  assert.match(migrated, /bus\.sclk_io_num = static_cast<gpio_num_t>\(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_SCLK\)/);
  assert.match(migrated, /io\.dc_gpio_num = static_cast<gpio_num_t>\(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_DC\)/);
  assert.match(migrated, /userDefinedCall\(\);/);
  assert.equal(migrateCameraTemplateDisplayGpioTypes(migrated), migrated);
});
