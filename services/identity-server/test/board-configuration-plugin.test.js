const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../public/app/board-configuration-plugin.js"), "utf8");
const plugin = vm.runInNewContext(`${source}\nBoardConfigurationPlugin;`);

const features = [{
  feature_id: "display",
  title: "Display",
  hardware_options: [{ id: "lcd", title: "LCD" }],
  driver_options: [{ id: "lvgl", title: "LVGL" }],
  connection_options: [{ id: "spi", title: "SPI" }],
  value_options: [{ id: "320x240", title: "320 × 240" }],
}];

const board = {
  hardware_item_id: "board-1",
  platformio_build: { platform: "espressif32", environment: "esp32dev", board: "esp32dev", framework: "arduino", flash_size_mb: 4 },
  default_instance_configuration: {
    board_features: {
      display: { enabled: true, hardware: "lcd", driver: "lvgl", connection: "spi", pins: { cs: 10 }, value: "320x240" },
    },
  },
};

test("board configuration plugin normalizes provisioning defaults and detects modifications", () => {
  const defaults = plugin.defaultsForBoard(board, features);
  assert.equal(defaults.display.enabled, true);
  assert.equal(defaults.display.pins.cs, 10);
  assert.equal(plugin.selectionsDiffer(defaults, defaults), false);
  assert.equal(plugin.selectionsDiffer({ ...defaults, display: { ...defaults.display, driver: "custom" } }, defaults), true);
});

test("board configuration plugin inherits catalog features missing from an older project snapshot", () => {
  const enrichedBoard = {
    ...board,
    default_instance_configuration: {
      board_features: {
        ...board.default_instance_configuration.board_features,
        camera_power: {
          enabled: true,
          hardware: "io_expander",
          driver: "waveshare_io_extension",
          connection: "i2c_io_expander",
          pins: { sda: 8, scl: 7, output: 6 },
          value: "0x24",
        },
      },
    },
  };

  const olderProjectSnapshot = {
    display: board.default_instance_configuration.board_features.display,
  };
  const normalized = plugin.normalizeSelections(features, olderProjectSnapshot, enrichedBoard);
  const defaults = plugin.defaultsForBoard(enrichedBoard, features);

  assert.equal(normalized.camera_power.enabled, true);
  assert.equal(normalized.camera_power.driver, "waveshare_io_extension");
  assert.equal(normalized.camera_power.pins.output, 6);
  assert.equal(plugin.selectionsDiffer(normalized, defaults), false);
});

test("board configuration plugin previews the generated PlatformIO target", () => {
  const defaults = plugin.defaultsForBoard(board, features);
  const html = plugin.renderCompilerProjection(board, defaults);
  assert.match(html, /Compiler-Ausgabe/);
  assert.match(html, /platformio\.ini/);
  assert.match(html, /espressif32/);
  assert.match(html, /esp32dev/);
});

test("board configuration plugin renders the shared provisioning table with pin editing", () => {
  const defaults = plugin.defaultsForBoard(board, features);
  const html = plugin.renderFeatureTable(features, defaults, defaults);
  assert.match(html, /board-feature-table/);
  assert.match(html, /Komponente/);
  assert.match(html, /Treiber/);
  assert.match(html, /Pin-Zuordnung/);
  assert.match(html, /data-edit-board-feature-pins="display"/);
  assert.match(html, /CS=GPIO10/);
});

test("board configuration plugin derives fixed feature pins from the hardware catalog pin profile", () => {
  const catalogBoard = {
    ...board,
    pin_profile: { assigned_pins: { display_spi: { sclk: 12, mosi: 11, cs: 10, dc: 46, backlight: 45 } } },
    default_instance_configuration: {
      board_features: { display: { enabled: true, hardware: "lcd", driver: "lvgl", connection: "spi", value: "320x240" } },
    },
  };
  const defaults = plugin.defaultsForBoard(catalogBoard, features);
  assert.equal(defaults.display.pins.sclk, 12);
  assert.equal(defaults.display.pins.backlight, 45);
  assert.deepEqual(Array.from(plugin.availablePins(catalogBoard)), [10, 11, 12, 45, 46]);
  assert.match(plugin.renderFeatureTable(features, defaults, defaults), /BACKLIGHT=GPIO45/);
});

test("board selector separates GerNetiX, account and project configurations", () => {
  const html = plugin.renderBoardOptions([
    { ...board, configuration_scope: "gernetix" },
    { ...board, hardware_item_id: "board-account", title: "Mein Display", configuration_scope: "account" },
    { ...board, hardware_item_id: "board-project", title: "Projektprofil", configuration_scope: "project" },
  ], "board-project");
  assert.match(html, /GerNetiX-Boards/);
  assert.match(html, /Meine Boards/);
  assert.match(html, /Projektanpassungen/);
  assert.match(html, /value="board-project" selected/);
});
