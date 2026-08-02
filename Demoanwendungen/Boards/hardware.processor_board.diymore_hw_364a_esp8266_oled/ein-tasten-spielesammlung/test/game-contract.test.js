const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const firmwareRoot = path.join(projectRoot, "firmware");
const sources = path.join(firmwareRoot, "lib", "game_collection", "src");
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, "manifest.json"), "utf8"));
const app = fs.readFileSync(path.join(sources, "game_application.cpp"), "utf8");
const cat = fs.readFileSync(path.join(sources, "cat_jump.cpp"), "utf8");
const bat = fs.readFileSync(path.join(sources, "cave_bat.cpp"), "utf8");
const platformio = fs.readFileSync(path.join(firmwareRoot, "platformio.ini"), "utf8");

test("demo is bound to the exact HW-364A catalog profile", () => {
  assert.equal(manifest.board_hardware_item_id, "hardware.processor_board.diymore_hw_364a_esp8266_oled");
  assert.match(platformio, /board = nodemcuv2/);
  assert.match(platformio, /GERNETIX_USER_APPLICATION_HEADER/);
});

test("one-button menu uses short selection and long start", () => {
  assert.match(app, /BUTTON_PIN = 0/);
  assert.match(app, /LONG_PRESS_MS = 700/);
  assert.match(app, /menuSelection = \(menuSelection \+ 1\) % 2/);
  assert.match(app, /startSelectedGame\(\)/);
  assert.match(app, /pendingGamePress = true/);
});

test("Cat Jump jumps over a dog and Cave Bat uses hold-to-rise physics", () => {
  assert.match(cat, /drawDog/);
  assert.match(cat, /jumpPressed && grounded_/);
  assert.match(bat, /buttonHeld \? -0\.34f : 0\.27f/);
  assert.match(bat, /drawCaveEdge/);
});
