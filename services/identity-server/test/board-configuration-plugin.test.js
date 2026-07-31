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

test("board configuration plugin renders the shared provisioning table with pin editing", () => {
  const defaults = plugin.defaultsForBoard(board, features);
  const html = plugin.renderFeatureTable(features, defaults, defaults);
  assert.match(html, /board-feature-table/);
  assert.match(html, /Komponente/);
  assert.match(html, /Treiber/);
  assert.match(html, /Pin-Zuordnung/);
  assert.match(html, /data-edit-board-feature-pins="display"/);
});
