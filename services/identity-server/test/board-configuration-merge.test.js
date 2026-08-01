const assert = require("node:assert/strict");
const test = require("node:test");
const { mergeBoardFeatures } = require("../src/dev/board-configuration-merge");

test("inherits catalog features missing from an older immutable board snapshot", () => {
  const merged = mergeBoardFeatures({
    camera: { enabled: true, driver: "esp32-camera", pins: { xclk: 38 } },
    camera_power: { enabled: true, driver: "waveshare_io_extension", pins: { sda: 8, scl: 7, address: 36, output: 6 } },
  }, {
    camera: { enabled: true, driver: "esp32-camera", pins: { xclk: 38 } },
  });

  assert.equal(merged.camera_power.enabled, true);
  assert.equal(merged.camera_power.driver, "waveshare_io_extension");
  assert.deepEqual(merged.camera_power.pins, { sda: 8, scl: 7, address: 36, output: 6 });
});

test("preserves explicit project overrides while inheriting unrelated catalog features", () => {
  const merged = mergeBoardFeatures({
    display: { enabled: true, driver: "ili9341", pins: { cs: 10, dc: 46 } },
    wifi: { enabled: true },
  }, {
    display: { enabled: false, pins: {} },
  });

  assert.equal(merged.display.enabled, false);
  assert.equal(merged.display.driver, "ili9341");
  assert.deepEqual(merged.display.pins, {});
  assert.equal(merged.wifi.enabled, true);
});
