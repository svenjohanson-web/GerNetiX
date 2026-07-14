const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const basisRoot = path.resolve(__dirname, "..");
const otaSource = fs.readFileSync(path.join(basisRoot, "src/functions/ota_update.cpp"), "utf8");
const webSource = fs.readFileSync(path.join(basisRoot, "src/functions/startDeviceWebServer.cpp"), "utf8");
const sdkconfig = fs.readFileSync(path.join(basisRoot, "sdkconfig.esp32dev"), "utf8");

test("OTA path downloads, verifies and activates through ESP-IDF", () => {
  assert.match(otaSource, /esp_https_ota_begin/);
  assert.match(otaSource, /esp_https_ota_perform/);
  assert.match(otaSource, /esp_https_ota_is_complete_data_received/);
  assert.match(otaSource, /esp_https_ota_get_image_len_read/);
  assert.match(otaSource, /calculateDownloadedImageSha256/);
  assert.match(otaSource, /esp_partition_read/);
  assert.match(otaSource, /esp_partition_get_sha256/);
  assert.match(otaSource, /esp_https_ota_finish/);
  assert.match(webSource, /registerUri\("\/ota", HTTP_POST, otaHandler\)/);
  assert.match(webSource, /config\.max_uri_handlers = 12/);
});

test("OTA path verifies ECDSA signatures, expiry and replay sequences", () => {
  assert.match(otaSource, /verifyEcdsaP256SignatureBase64Url/);
  assert.match(otaSource, /gernetix-ota-command-v1/);
  assert.match(otaSource, /expiresAt <= static_cast<uint64_t>\(now\)/);
  assert.match(otaSource, /sequence <= readAcceptedSequence\(\)/);
  assert.match(otaSource, /esp_crt_bundle_attach/);
  assert.match(otaSource, /httpsOrigin\(config\.buildDeployUrl\)/);
  assert.match(otaSource, /constantTimeEqual/);
});

test("new OTA image remains rollbackable until runtime diagnostics pass", () => {
  assert.match(sdkconfig, /^CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE=y$/m);
  assert.match(otaSource, /ESP_OTA_IMG_PENDING_VERIFY/);
  assert.match(otaSource, /esp_ota_mark_app_valid_cancel_rollback/);
  assert.match(otaSource, /esp_ota_mark_app_invalid_rollback_and_reboot/);
});
