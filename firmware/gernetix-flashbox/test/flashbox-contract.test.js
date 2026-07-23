const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("declares Flashbox hardware profile and release public key contract", () => {
  const config = read("include/gernetix_flashbox_config.h");

  assert.match(config, /hardware\.flashbox\.esp32_s3_usb_helper/);
  assert.match(config, /GERNETIX_RELEASE_PUBLIC_KEY_PEM/);
  assert.match(config, /BEGIN PUBLIC KEY/);
  assert.match(config, /device_private_key_non_exportable/);
  assert.doesNotMatch(config, /BEGIN PRIVATE KEY/);
});

test("exposes WLAN status and claim challenge endpoints", () => {
  const config = read("include/gernetix_flashbox_config.h");
  const main = read("src/main.cpp");

  assert.match(config, /GERNETIX_FLASHBOX_SETUP_AP_PREFIX = "GerNetiX_FB-"/);
  assert.match(main, /String\(GERNETIX_FLASHBOX_SETUP_AP_PREFIX\) \+ serialNumber\(\)\.substring/);
  assert.match(main, /gernetix\/runtime_core\.h/);
  assert.match(main, /gernetix_flashbox_json_response\.h/);
  assert.match(main, /writeRuntimeIdentityJsonFields/);
  assert.match(main, /server\.on\("\/", HTTP_GET, handleRoot\)/);
  assert.match(main, /server\.on\("\/status", HTTP_GET/);
  assert.match(main, /server\.on\("\/wifi\/status", HTTP_GET, handleWifiStatus\)/);
  assert.match(main, /server\.on\("\/wifi", HTTP_POST, handleWifiConnect\)/);
  assert.match(main, /server\.on\("\/ble\/status", HTTP_GET, handleBleStatus\)/);
  assert.match(main, /server\.on\("\/power\/status", HTTP_GET, handlePowerStatus\)/);
  assert.match(main, /server\.on\("\/favicon\.ico", HTTP_GET, handleFavicon\)/);
  assert.match(main, /server\.on\("\/claim\/challenge", HTTP_POST/);
  assert.match(main, /server\.on\("\/provisioning", HTTP_POST, handleProvisioning\)/);
  assert.match(main, /server\.on\("\/provisioning\/status", HTTP_GET, handleProvisioningStatus\)/);
  assert.match(main, /server\.on\("\/mqtt\/jobs\/status", HTTP_GET, handleMqttJobClientStatus\)/);
  assert.match(main, /server\.on\("\/firmware\/download\/status", HTTP_GET/);
  assert.match(main, /server\.on\("\/firmware\/manifest\/check", HTTP_POST/);
  assert.match(main, /server\.on\("\/firmware\/artifact\/verify", HTTP_POST/);
  assert.match(main, /server\.on\("\/targets\/status", HTTP_GET/);
  assert.match(main, /server\.on\("\/targets\/serial\/status", HTTP_GET, handleTargetSerialStatus\)/);
  assert.match(main, /updateWifiDisplay/);
  assert.match(main, /WiFi\.scanNetworks\(true, false\)/);
  assert.match(main, /WiFi\.scanComplete/);
  assert.match(main, /WIFI_SCAN_INTERVAL_MS = 60000/);
  assert.match(main, /wifiDisplayMayOwnScreen/);
  assert.match(main, /targetConnected/);
  assert.match(main, /scannedSsidsForDisplay/);
  assert.match(main, /visibleSsids\[WIFI_DISPLAY_MAX_SSIDS\]/);
  assert.match(main, /WIFI_SCAN_FAILED/);
  assert.match(main, /flashboxDisplayShowWifiDisconnected/);
  assert.match(main, /flashboxDisplayShowWifiConnected/);
  assert.match(main, /wifi_state/);
  assert.match(main, /visible_ssids/);
  assert.match(main, /scan_state/);
  assert.match(main, /FLASHBOX_SETUP_PORTAL/);
  assert.match(main, /WLAN einrichten/);
  assert.match(main, /Das Passwort wird nur lokal auf der FlashBox gespeichert/);
  assert.match(main, /DNSServer captiveDns/);
  assert.match(main, /captiveDns\.start\(53, "\*", WiFi\.softAPIP\(\)\)/);
  assert.match(main, /captiveDns\.processNextRequest\(\)/);
  assert.match(main, /server\.onNotFound\(handleCaptivePortal\)/);
  assert.match(main, /wifiPreferences\.putString\("password", password\)/);
  assert.match(main, /flashboxBleBegin/);
  assert.match(main, /FLASHBOX_BLE_SERVICE_UUID/);
  assert.doesNotMatch(main, /BLECharacteristic::PROPERTY_WRITE/);
  assert.doesNotMatch(main, /Serial\.(print|println)\([^\n]*password/);
  assert.doesNotMatch(main, /WIFI_DISPLAY_REFRESH_MS/);
  assert.match(main, /wlan_visible_claim_challenge_required/);
  assert.match(main, /firmware_manifest_url/);
  assert.match(main, /firmware_download_state/);
  assert.match(main, /target_detection_state/);
  assert.match(main, /target_connection_state/);
  assert.match(main, /display_profile_id/);
  assert.match(main, /flashboxSignProvisioningChallenge/);
  assert.doesNotMatch(main, /char body\[/);
  assert.doesNotMatch(main, /BEGIN PRIVATE KEY/);
});

test("offers a BLE discovery and status service without accepting credentials over BLE", () => {
  const main = read("src/main.cpp");
  const ble = read("src/gernetix_flashbox_ble.cpp");
  const sdkconfig = read("sdkconfig.defaults");
  const cmake = read("src/CMakeLists.txt");
  const readme = read("README.md");

  assert.match(sdkconfig, /CONFIG_BT_ENABLED=y/);
  assert.match(sdkconfig, /CONFIG_BT_BLE_ENABLED=y/);
  assert.match(sdkconfig, /CONFIG_BT_NIMBLE_ENABLED=y/);
  assert.match(cmake, /REQUIRES bt/);
  assert.match(ble, /esp_nimble_hci_and_controller_init/);
  assert.match(ble, /nimble_port_freertos_init/);
  assert.match(ble, /\{BLE_UUID_TYPE_128\}/);
  assert.doesNotMatch(ble, /BLE_UUID128_INIT/);
  assert.match(ble, /BLE_GATT_CHR_F_READ/);
  assert.doesNotMatch(ble, /BLE_GATT_CHR_F_WRITE/);
  assert.match(readme, /BLE neben WLAN/);
  assert.match(readme, /nicht.*ungeschuetzte BLE-Characteristic angenommen/);
});

test("uses a certificate-authenticated MQTT client only for its own FlashBox job topic", () => {
  const client = read("src/gernetix_flashbox_mqtt_job_client.cpp");
  assert.match(client, /esp_mqtt_client_init/);
  assert.match(client, /client_cert_pem/);
  assert.match(client, /client_key_pem/);
  assert.match(client, /broker\.startsWith\("mqtts:\/\/"\)/);
  assert.match(client, /\/flashbox\/jobs/);
  assert.match(client, /incomingTopic!=topic/);
  assert.match(client, /flashbox_job_id/);
  assert.match(client, /status\/flashbox/);
});

test("generates the P-256 device key after flashing and accepts only certificate/configuration provisioning", () => {
  const provisioning = read("src/gernetix_flashbox_provisioning.cpp");
  const header = read("include/gernetix_flashbox_provisioning.h");
  assert.match(provisioning, /mbedtls_ecp_gen_key\(MBEDTLS_ECP_DP_SECP256R1/);
  assert.match(provisioning, /mbedtls_pk_write_key_pem/);
  assert.match(provisioning, /mbedtls_pk_write_pubkey_pem/);
  assert.match(provisioning, /mqtt_client_certificate_pem/);
  assert.match(provisioning, /flashboxSignProvisioningChallenge/);
  assert.match(provisioning, /mbedtls_ecdsa_sign/);
  assert.match(provisioning, /private_key_ready/);
  assert.doesNotMatch(provisioning, /mqtt_client_private_key_pem/);
  assert.match(header, /flashboxProvisioningApply/);
});

test("defines the HTTPS firmware manifest download path and delegates trust checks to the validator", () => {
  const config = read("include/gernetix_flashbox_config.h");
  const downloader = read("src/gernetix_flashbox_firmware_download.cpp");
  const header = read("include/gernetix_flashbox_firmware_download.h");
  const validatorHeader = read("include/gernetix_flashbox_manifest_validator.h");

  assert.match(config, /GERNETIX_FLASHBOX_DEFAULT_MANIFEST_URL/);
  assert.match(config, /https:\/\/vps\.gernetix\.example\/firmware\/flashbox\/latest\/manifest\.json/);
  assert.match(config, /GERNETIX_FLASHBOX_HTTPS_ROOT_CA_PEM/);
  assert.match(config, /initial_bootstrap_flash/);
  assert.match(config, /known_device_recovery_flash/);
  assert.match(config, /basissoftware_reflash/);
  assert.match(config, /project_firmware_flash/);
  assert.doesNotMatch(config, /target_firmware/);
  assert.match(downloader, /WiFiClientSecure/);
  assert.match(downloader, /HTTPClient/);
  assert.match(downloader, /client\.setCACert\(GERNETIX_FLASHBOX_HTTPS_ROOT_CA_PEM\)/);
  assert.match(downloader, /flashboxValidateFirmwareManifestContract/);
  assert.match(downloader, /validation_state/);
  assert.match(downloader, /hash_verified/);
  assert.match(downloader, /artifact_write_allowed/);
  assert.match(downloader, /flashboxDownloadAndVerifyFirmwareArtifact/);
  assert.match(downloader, /flashboxJsonResponseWriter/);
  assert.match(downloader, /flashboxJsonAppendUnsigned/);
  assert.doesNotMatch(downloader, /char body\[/);
  assert.doesNotMatch(downloader, /char numeric\[/);
  assert.doesNotMatch(downloader, /Update\.begin/);
  assert.doesNotMatch(downloader, /esp_ota_begin/);
  assert.match(header, /flashboxFetchFirmwareManifest/);
  assert.match(header, /flashboxDownloadAndVerifyFirmwareArtifact/);
  assert.match(header, /String validationState/);
  assert.match(header, /bool hashVerified/);
  assert.match(header, /bool artifactWriteAllowed/);
  assert.match(validatorHeader, /flashboxVerifyArtifactSha256Hex/);
});

test("separates initial provisioning from offline known-device flashing", () => {
  const validator = read("src/gernetix_flashbox_manifest_validator.cpp");
  const header = read("include/gernetix_flashbox_firmware_download.h");

  assert.match(validator, /flashboxIsSupportedManifestType/);
  assert.match(validator, /GERNETIX_FLASHBOX_MANIFEST_TYPE_INITIAL_BOOTSTRAP/);
  assert.match(validator, /GERNETIX_FLASHBOX_MANIFEST_TYPE_KNOWN_DEVICE_RECOVERY/);
  assert.match(validator, /initial_bootstrap_requires_new_identity_policy/);
  assert.match(validator, /known_device_flash_requires_preserve_identity_policy/);
  assert.match(validator, /known_device_flash_requires_target_device_id/);
  assert.match(validator, /self_update_identity_policy_must_be_not_applicable/);
  assert.match(header, /String identityPolicy/);
  assert.match(header, /String targetDeviceId/);
  assert.match(header, /String useCase/);
});

test("implements manifest signature, artifact hash and safe validation states before any write", () => {
  const validator = read("src/gernetix_flashbox_manifest_validator.cpp");
  const header = read("include/gernetix_flashbox_manifest_validator.h");
  const downloader = read("src/gernetix_flashbox_firmware_download.cpp");

  assert.match(validator, /mbedtls_pk_verify/);
  assert.match(validator, /MBEDTLS_MD_SHA256/);
  assert.match(validator, /mbedtls_sha256/);
  assert.match(validator, /decodeBase64Url/);
  assert.match(validator, /missing_manifest_signature/);
  assert.match(validator, /release_public_key_not_configured/);
  assert.match(validator, /manifest_signature_invalid/);
  assert.match(validator, /schema_checked/);
  assert.match(validator, /signature_checking/);
  assert.match(validator, /artifact_hash_pending/);
  assert.match(validator, /ready_for_artifact_download/);
  assert.match(header, /bool signatureVerified/);
  assert.match(header, /bool hashVerified/);
  assert.match(header, /bool artifactDownloadAllowed/);
  assert.match(downloader, /Signatur geprueft, Artefakt-Hash ausstehend/);
  assert.doesNotMatch(validator, /Update\.begin/);
  assert.doesNotMatch(validator, /esp_ota_begin/);
  assert.doesNotMatch(downloader, /Update\.begin/);
  assert.doesNotMatch(downloader, /esp_ota_begin/);
});

test("downloads artifact bytes only after manifest verification and blocks writes after hash verification", () => {
  const main = read("src/main.cpp");
  const downloader = read("src/gernetix_flashbox_firmware_download.cpp");
  const writeState = read("src/gernetix_flashbox_write_state_machine.cpp");
  const writeHeader = read("include/gernetix_flashbox_write_state_machine.h");

  assert.match(main, /handleFirmwareArtifactVerify/);
  assert.match(main, /flashboxDownloadAndVerifyFirmwareArtifact/);
  assert.match(downloader, /artifact_download_requires_verified_manifest/);
  assert.match(downloader, /artifact_streaming_sha256/);
  assert.match(downloader, /mbedtls_sha256_update/);
  assert.match(downloader, /mbedtls_sha256_finish/);
  assert.match(downloader, /artifact_sha256_mismatch/);
  assert.match(downloader, /artifact_hash_verified/);
  assert.match(downloader, /artifact_write_state_machine_not_implemented/);
  assert.match(downloader, /artifact_bytes/);
  assert.match(downloader, /artifact_http_status/);
  assert.match(writeHeader, /FlashboxWritePlan/);
  assert.match(writeHeader, /bool writeAllowed/);
  assert.match(writeState, /flashboxPlanWriteAfterArtifactVerified/);
  assert.match(writeState, /self_update_dual_slot_preflight_blocked/);
  assert.match(writeState, /target_usb_otg_flash_preflight_blocked/);
  assert.match(writeState, /write_requires_verified_artifact_hash/);
  assert.match(writeState, /false \}/);
  assert.doesNotMatch(writeState, /Update\.begin/);
  assert.doesNotMatch(writeState, /esp_ota_begin/);
  assert.doesNotMatch(writeState, /usb_host/);
});

test("uses a displayless Serial and HTTP status facade", () => {
  const config = read("include/gernetix_flashbox_config.h");
  const display = read("src/gernetix_flashbox_display.cpp");
  const header = read("include/gernetix_flashbox_display.h");

  assert.match(config, /GERNETIX_FLASHBOX_UI_MODE = "displayless_http_serial_helper"/);
  assert.match(config, /display\.none\.displayless_helper/);
  assert.match(config, /GERNETIX_FLASHBOX_DISPLAY_ENABLED 0/);
  assert.match(config, /GERNETIX_FLASHBOX_DISPLAY_DRIVER_ILI9341 0/);
  assert.match(display, /Displayloser Helper/);
  assert.match(display, /flashbox-status/);
  assert.match(display, /Serial-\/HTTP-Status aktiv/);
  assert.match(display, /flashboxDisplayShowBoot/);
  assert.match(display, /flashboxDisplayShowNetwork/);
  assert.match(display, /flashboxDisplayShowWifiDisconnected/);
  assert.match(display, /WLAN nicht verbunden/);
  assert.match(display, /Gefunden:/);
  assert.match(display, /flashboxDisplayShowWifiConnected/);
  assert.match(display, /WLAN verbunden/);
  assert.match(display, /IP: /);
  assert.match(display, /flashboxDisplayShowTargetState/);
  assert.match(display, /USB: /);
  assert.doesNotMatch(display, /#include <SPI\.h>/);
  assert.doesNotMatch(display, /CMD_SWRESET/);
  assert.doesNotMatch(display, /CMD_DISPON/);
  assert.doesNotMatch(display, /FONT_LETTERS/);
  assert.doesNotMatch(display, /drawText/);
  assert.doesNotMatch(display, /Arduino_GFX_Library/);
  assert.doesNotMatch(display, /Arduino_ILI9341/);
  assert.doesNotMatch(config, /GERNETIX_FLASHBOX_DISPLAY_PIN_/);
  assert.match(header, /flashboxDisplayLoop/);
  assert.match(header, /flashboxDisplayShowWifiDisconnected/);
  assert.match(header, /flashboxDisplayShowWifiConnected/);
});

test("detects USB-OTG target candidates and exposes them on webserver and displayless status facade", () => {
  const config = read("include/gernetix_flashbox_config.h");
  const main = read("src/main.cpp");
  const detector = read("src/gernetix_flashbox_target_detection.cpp");
  const header = read("include/gernetix_flashbox_target_detection.h");

  assert.match(config, /GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED/);
  assert.match(config, /GERNETIX_FLASHBOX_TARGET_DETECTION_BACKEND/);
  assert.match(config, /rom_bootloader_required_before_flash/);
  assert.match(config, /usb_serial_bridge_detected_requires_bootloader_handshake/);
  assert.match(config, /GERNETIX_FLASHBOX_USB_VBUS_POWER_MODE/);
  assert.match(config, /two_usb_s3_helper_target_vbus_pending_verification/);
  assert.match(config, /GERNETIX_FLASHBOX_USB_TARGET_POWER_POLICY/);
  assert.match(config, /unpowered_targets_allowed_only_after_dedicated_target_port_vbus_verification/);
  assert.match(config, /GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN -1/);
  assert.match(config, /GERNETIX_FLASHBOX_POWER_SWITCHING_MODE/);
  assert.match(config, /two_usb_s3_helper_power_profile_pending_hardware_verification/);
  assert.match(config, /GERNETIX_FLASHBOX_POWER_SWITCHING_POLICY/);
  assert.match(config, /target_vbus_switching_must_be_verified_on_new_two_usb_s3_board/);
  assert.match(config, /GERNETIX_FLASHBOX_USB_VBUS_BOOST_ENABLE_PIN -1/);
  assert.match(config, /GERNETIX_FLASHBOX_USB_VBUS_SOURCE_SELECT_PIN -1/);
  assert.match(config, /GERNETIX_FLASHBOX_USB_VBUS_CURRENT_LIMIT_ENABLE_PIN -1/);
  assert.match(config, /GERNETIX_FLASHBOX_BATTERY_ADC_PIN -1/);
  assert.match(config, /control_upstream_power_and_service/);
  assert.match(config, /target_downstream_usb_host/);
  assert.match(config, /303A/);
  assert.match(main, /flashboxTargetDetectionBegin/);
  assert.match(main, /flashboxTargetDetectionLoop/);
  assert.match(main, /flashboxTargetSerialBegin/);
  assert.match(main, /flashboxTargetSerialLoop/);
  assert.match(main, /flashboxTargetDetectionStatusJson/);
  assert.match(header, /FlashboxTargetDeviceStatus/);
  assert.match(header, /targetKind/);
  assert.match(header, /targetDisplayName/);
  assert.match(header, /serialBridge/);
  assert.match(header, /recommendedAction/);
  assert.match(header, /vbusPowerMode/);
  assert.match(header, /targetPowerPolicy/);
  assert.match(header, /targetConnected/);
  assert.match(header, /vbusControlAvailable/);
  assert.match(header, /espRomBootloaderLikely/);
  assert.match(header, /targetFlashPreflightAllowed/);
  assert.match(detector, /usb\/usb_host\.h/);
  assert.match(detector, /usb_host_install/);
  assert.match(detector, /usb_host_client_register/);
  assert.match(detector, /USB_HOST_CLIENT_EVENT_NEW_DEV/);
  assert.match(detector, /usb_host_get_device_descriptor/);
  assert.match(detector, /descriptor->idVendor/);
  assert.match(detector, /descriptor->idProduct/);
  assert.match(detector, /classifyUsbTarget/);
  assert.match(detector, /isLikelyEspressifRomBootloader/);
  assert.match(detector, /0x303A/);
  assert.match(detector, /0x1A86/);
  assert.match(detector, /0x7523/);
  assert.match(detector, /0x55D4/);
  assert.match(detector, /0x10C4/);
  assert.match(detector, /0xEA60/);
  assert.match(detector, /0x0403/);
  assert.match(detector, /0x2341/);
  assert.match(detector, /0x2A03/);
  assert.match(detector, /0x067B/);
  assert.match(detector, /ESP32 native USB/);
  assert.match(detector, /Arduino Nano \/ ESP via CH340/);
  assert.match(detector, /ESP32 \/ ESP8266 via CP210x/);
  assert.match(detector, /Arduino \/ ESP via FTDI/);
  assert.match(detector, /Arduino USB device/);
  assert.match(detector, /target_device_detected/);
  assert.match(detector, /rom_bootloader_candidate/);
  assert.match(detector, /serial_bridge_detected/);
  assert.match(detector, /chip_profile_read_not_implemented/);
  assert.match(detector, /serial_bootloader_handshake_not_implemented/);
  assert.match(detector, /flashboxDisplayShowTargetState/);
  assert.match(detector, /Target-USB-VBUS der neuen Zwei-USB-S3-Flashbox ist noch nicht verifiziert/);
  assert.match(detector, /Power: /);
  assert.match(detector, /target_display_name/);
  assert.match(detector, /serial_bridge/);
  assert.match(detector, /vbus_power_mode/);
  assert.match(detector, /target_power_policy/);
  assert.match(detector, /vbus_control_available/);
  assert.match(detector, /recommended_action/);
  assert.match(detector, /target_flash_preflight_allowed/);
  assert.match(detector, /detected_device_count/);
  assert.match(detector, /flashboxJsonResponseWriter/);
  assert.doesNotMatch(detector, /char body\[/);
  assert.doesNotMatch(detector, /char numeric\[/);
  assert.doesNotMatch(detector, /Update\.begin/);
  assert.doesNotMatch(detector, /esp_ota_begin/);
});

test("installs the official USB CDC host transport for ESP target candidates", () => {
  const platformio = read("platformio.ini");
  const sdkconfigDefaults = read("sdkconfig.defaults");
  const component = read("src/idf_component.yml");
  const serial = read("src/gernetix_flashbox_target_serial.cpp");
  const serialHeader = read("include/gernetix_flashbox_target_serial.h");
  const detector = read("src/gernetix_flashbox_target_detection.cpp");

  assert.match(platformio, /framework\s*=\s*arduino, espidf/);
  assert.match(sdkconfigDefaults, /CONFIG_FREERTOS_HZ=1000/);
  assert.match(sdkconfigDefaults, /CONFIG_ARDUINO_VARIANT="esp32s3"/);
  assert.match(component, /espressif\/usb_host_cdc_acm/);
  assert.match(component, /\^2\.0\.6/);
  assert.match(serial, /usb\/cdc_acm_host\.h/);
  assert.match(serial, /cdc_acm_host_install/);
  assert.match(serial, /cdc_acm_host_open_vendor_specific/);
  assert.match(serial, /cdc_acm_host_data_tx_blocking/);
  assert.match(serial, /usb_host_lib_handle_events/);
  assert.match(serial, /Deliberately do not toggle DTR\/RTS here/);
  assert.match(serialHeader, /FlashboxTargetSerialStatus/);
  assert.match(serialHeader, /flashboxTargetSerialStatusJson/);
  assert.match(detector, /CDC transport owns the single USB Host event task/);
});

test("keeps webserver JSON response buffers off the request stack", () => {
  const config = read("include/gernetix_flashbox_config.h");
  const jsonHeader = read("include/gernetix_flashbox_json_response.h");
  const jsonResponse = read("src/gernetix_flashbox_json_response.cpp");
  const main = read("src/main.cpp");
  const downloader = read("src/gernetix_flashbox_firmware_download.cpp");
  const detector = read("src/gernetix_flashbox_target_detection.cpp");

  assert.match(config, /GERNETIX_FLASHBOX_JSON_RESPONSE_BUFFER_BYTES = 3072/);
  assert.match(jsonHeader, /flashboxJsonResponseWriter/);
  assert.match(jsonHeader, /flashboxJsonResponseString/);
  assert.match(jsonResponse, /char responseBuffer\[GERNETIX_FLASHBOX_JSON_RESPONSE_BUFFER_BYTES\]/);
  assert.match(jsonResponse, /char numericBuffer\[32\]/);
  assert.match(jsonResponse, /std::memset\(responseBuffer/);
  assert.match(main, /flashboxJsonResponseWriter/);
  assert.match(downloader, /flashboxJsonResponseWriter/);
  assert.match(detector, /flashboxJsonResponseWriter/);
  assert.doesNotMatch(`${main}\n${downloader}\n${detector}`, /char body\[\d+\]/);
  assert.doesNotMatch(`${main}\n${downloader}\n${detector}`, /char numeric\[\d+\]/);
});

test("documents that the device private key never leaves the Flashbox", () => {
  const readme = read("README.md");

  assert.match(readme, /Device Private Key verlaesst die Flashbox nie/);
  assert.match(readme, /WLAN-Sichtbarkeit allein ist kein Besitz- oder Echtheitsnachweis/);
  assert.match(readme, /Kauf-\/Claim-Code bleibt nur Fallback/);
  assert.match(readme, /Displayloser Status-Vertrag/);
  assert.match(readme, /displaylose Status-Fassade/);
  assert.match(readme, /WLAN nicht verbunden/);
  assert.match(readme, /SSID und IP-Adresse/);
  assert.match(readme, /\/wifi\/status/);
  assert.match(readme, /kein zyklischer 5-Sekunden-Refresh/);
  assert.match(readme, /VBUS/);
  assert.match(readme, /\/power\/status/);
  assert.match(readme, /Control-\/Upstream-Port/);
  assert.match(readme, /Target-\/Downstream-Port/);
  assert.match(readme, /two_usb_s3_helper_target_vbus_pending_verification/);
  assert.match(readme, /initial_bootstrap_flash/);
  assert.match(readme, /known_device_recovery_flash/);
});

test("keeps PlatformIO target explicit for manual firmware builds", () => {
  const platformio = read("platformio.ini");
  const partitions = read("partitions_16mb_flashbox.csv");

  assert.match(platformio, /\[env:esp32_s3_usb_helper_flashbox\]/);
  assert.match(platformio, /GERNETIX_FLASHBOX_FIRMWARE_VERSION/);
  assert.match(platformio, /GERNETIX_FLASHBOX_HARDWARE_PROFILE_ID/);
  assert.match(platformio, /board_build\.flash_size\s*=\s*16MB/);
  assert.match(platformio, /board_upload\.flash_size\s*=\s*16MB/);
  assert.match(platformio, /board_build\.partitions\s*=\s*partitions_16mb_flashbox\.csv/);
  assert.match(platformio, /BOARD_HAS_PSRAM/);
  assert.doesNotMatch(platformio, /ARDUINO_USB_MODE=0/);
  assert.doesNotMatch(platformio, /ARDUINO_USB_CDC_ON_BOOT=0/);
  assert.match(platformio, /GERNETIX_FLASHBOX_DISPLAY_ENABLED=0/);
  assert.match(platformio, /GERNETIX_FLASHBOX_DISPLAY_DRIVER_ILI9341=0/);
  assert.match(platformio, /GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED=1/);
  assert.doesNotMatch(platformio, /GFX Library for Arduino/);
  assert.doesNotMatch(platformio, /lib_deps\s*=/);
  assert.match(platformio, /lib_extra_dirs\s*=\s*\r?\n\s*\.\.\/shared/);
  assert.match(partitions, /app0,app,ota_0,0x10000,0x500000/);
  assert.match(partitions, /app1,app,ota_1,0x510000,0x500000/);
  assert.match(partitions, /spiffs,data,spiffs,0xA10000,0x5F0000/);
});

test("documents the shared Runtime Core boundary instead of copying Basissoftware wholesale", () => {
  const readme = read("README.md");

  assert.match(readme, /firmware\/shared\/gernetix-runtime-core/);
  assert.match(readme, /Die Basissoftware kann denselben Core schrittweise/);
  assert.match(readme, /Die Flashbox bleibt trotzdem ein eigenes Firmwarepaket/);
});
