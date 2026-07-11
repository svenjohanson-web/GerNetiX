const assert = require("node:assert/strict");
const test = require("node:test");
const { createDevHardwareUtils } = require("../src/dev/hardware-utils");

function createUtils(overrides = {}) {
  return createDevHardwareUtils({
    defaultCatalogSeed: () => ({ hardwareItems: [] }),
    execFileAsync: async () => ({ stdout: "" }),
    hardwareCatalogJson: async () => ({ items: [] }),
    ...overrides,
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

test("detects ESP32 USB serial ports on macOS without listing duplicate tty devices", async () => {
  const { listUsbSerialPorts } = createUtils({
    platform: "darwin",
    readDeviceDirectory: () => [
      "tty.usbserial-10",
      "cu.usbserial-10",
      "cu.Bluetooth-Incoming-Port",
      "cu.usbmodem2101",
    ],
  });

  assert.deepEqual(await listUsbSerialPorts(), [
    {
      port: "/dev/cu.usbmodem2101",
      name: "cu.usbmodem2101 (USB CDC)",
      device_id: "cu.usbmodem2101",
      manufacturer: "",
      pnp_class: "Ports",
      status: "OK",
    },
    {
      port: "/dev/cu.usbserial-10",
      name: "cu.usbserial-10 (USB Serial)",
      device_id: "cu.usbserial-10",
      manufacturer: "",
      pnp_class: "Ports",
      status: "OK",
    },
  ]);
});

test("detects USB serial ports on Linux", async () => {
  const { listUsbSerialPorts } = createUtils({
    platform: "linux",
    readDeviceDirectory: () => ["tty0", "ttyUSB0", "ttyACM1"],
  });

  assert.deepEqual((await listUsbSerialPorts()).map((item) => item.port), [
    "/dev/ttyACM1",
    "/dev/ttyUSB0",
  ]);
});
