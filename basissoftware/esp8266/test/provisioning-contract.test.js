const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "main.cpp"), "utf8");
const platformio = fs.readFileSync(path.join(root, "platformio.ini"), "utf8");

test("HW-364A firmware uses the confirmed OLED and build profile", () => {
  assert.match(platformio, /board = nodemcuv2/);
  assert.match(platformio, /board_build\.f_cpu = 80000000L/);
  assert.match(source, /constexpr uint8_t OLED_SCL = 12/);
  assert.match(source, /constexpr uint8_t OLED_SDA = 14/);
  assert.match(source, /constexpr uint8_t OLED_ADDRESS = 0x3C/);
  assert.match(source, /U8G2_SSD1306_128X64_NONAME_F_SW_I2C/);
});

test("ESP8266 provisioning keeps the private P-256 key on the board", () => {
  assert.match(source, /br_ec_keygen\(/);
  assert.match(source, /BR_EC_secp256r1/);
  assert.match(source, /br_ecdsa_sign_raw_get_default\(\)/);
  assert.match(source, /writePrivateScalar\(privateScalar\)/);
  assert.doesNotMatch(source, /response\["private_key/);
  assert.doesNotMatch(source, /sendJson\([^\n]+privateScalar/);
});

test("ESP8266 provisioning exposes the required local contracts", () => {
  for (const endpoint of ["/health", "/status", "/wifi/scan", "/wifi", "/provisioning", "/auth/challenge"]) {
    assert.match(source, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(source, /gernetix-device-auth-v1\\n/);
  assert.match(source, /gernetix\.serial_provisioning/);
  assert.match(source, /stored_only_on_device/);
});
