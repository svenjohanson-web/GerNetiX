const assert = require("node:assert/strict");
const test = require("node:test");
const { createDevHardwareUtils } = require("../src/dev/hardware-utils");

function createUtils() {
  return createDevHardwareUtils({
    defaultCatalogSeed: () => ({ hardwareItems: [] }),
    execFileAsync: async () => ({ stdout: "" }),
    hardwareCatalogJson: async () => ({ items: [] }),
  });
}

test("keeps USB firmware recovery available for offline ESP32 devices", () => {
  const { isUsbFlashDevice, deviceBuildConfig, buildTargetLabel } = createUtils();
  const device = {
    device_id: "account_device_esp32",
    hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
    connectivity_status: "offline",
  };

  assert.equal(isUsbFlashDevice(device), true);
  assert.equal(deviceBuildConfig(device).board, "esp32dev");
  assert.equal(buildTargetLabel(device), "espressif32/esp32dev/arduino");
});
