const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(projectRoot, "src", "main.cpp"), "utf8");
const config = fs.readFileSync(path.join(projectRoot, "platformio.ini"), "utf8");

test("targets the ESP8266 OLED board and its confirmed I2C pins", () => {
  assert.match(config, /platform = espressif8266/);
  assert.match(config, /board = nodemcuv2/);
  assert.match(source, /kOledSdaPin = D6/);
  assert.match(source, /kOledSclPin = D5/);
  assert.match(source, /U8G2_SSD1306_128X64_NONAME_F_HW_I2C/);
});

test("uses the Flash key as the sole game input with short and long presses", () => {
  assert.match(source, /kFlashButtonPin = 0/);
  assert.match(source, /INPUT_PULLUP/);
  assert.match(source, /kLongPressMs = 650/);
  assert.match(source, /kurz: waehlen  lang: starten/);
  assert.match(source, /lang: zurueck ins Menue/);
});

test("contains the three one-button games", () => {
  for (const title of ["Reaktion", "Sprungspiel", "Ausweichen"]) assert.match(source, new RegExp(title));
  assert.match(source, /void beginReaction\(\)/);
  assert.match(source, /void beginJump\(\)/);
  assert.match(source, /void beginDodge\(\)/);
});
