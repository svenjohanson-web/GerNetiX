#include <Arduino.h>
#include <WebServer.h>
#include <WiFi.h>

#include "gernetix/runtime_core.h"
#include "gernetix_flashbox_config.h"
#include "gernetix_flashbox_display.h"
#include "gernetix_flashbox_firmware_download.h"
#include "gernetix_flashbox_json_response.h"
#include "gernetix_flashbox_target_detection.h"

namespace {

WebServer server(80);

static constexpr unsigned long WIFI_SCAN_INTERVAL_MS = 60000;
static constexpr int WIFI_DISPLAY_MAX_SSIDS = 4;

unsigned long lastWifiScanStartMs = 0;
bool wifiScanRunning = false;
String lastWifiDisplaySignature;
String latestScannedSsids;
String latestWifiScanState = "not_started";

String serialNumber() {
  return gernetix::runtime::serialFromMacArduino("GNX-FLASHBOX-", ESP.getEfuseMac());
}

String setupApSsid() {
  return String(GERNETIX_FLASHBOX_SETUP_AP_PREFIX) + serialNumber().substring(serialNumber().length() - 6);
}

String wifiDisplaySignature(const String& state, const String& detail) {
  return state + "|" + detail;
}

bool wifiDisplayMayOwnScreen(const String& state) {
  if (state == "connected") return true;
  return !flashboxTargetDetectionStatus().targetConnected;
}

void updateWifiDisplayIfChanged(const String& state, const String& detail, bool force = false) {
  const String signature = wifiDisplaySignature(state, detail);
  if (!force && signature == lastWifiDisplaySignature) return;
  if (!wifiDisplayMayOwnScreen(state)) return;
  lastWifiDisplaySignature = signature;

  if (state == "connected") {
    flashboxDisplayShowWifiConnected(WiFi.SSID(), WiFi.localIP().toString());
    return;
  }

  flashboxDisplayShowWifiDisconnected(setupApSsid(), detail);
}

String scannedSsidsForDisplay(int networkCount) {
  String visibleSsids[WIFI_DISPLAY_MAX_SSIDS];
  int visibleCount = 0;
  for (int index = 0; index < networkCount && visibleCount < WIFI_DISPLAY_MAX_SSIDS; index += 1) {
    const String ssid = WiFi.SSID(index);
    if (ssid.length() == 0) continue;
    bool alreadyListed = false;
    for (int existing = 0; existing < visibleCount; existing += 1) {
      if (visibleSsids[existing] == ssid) alreadyListed = true;
    }
    if (alreadyListed) continue;

    int insertAt = visibleCount;
    while (insertAt > 0 && ssid < visibleSsids[insertAt - 1]) {
      visibleSsids[insertAt] = visibleSsids[insertAt - 1];
      insertAt -= 1;
    }
    visibleSsids[insertAt] = ssid;
    visibleCount += 1;
  }
  if (visibleCount == 0) {
    return "Keine SSID gefunden";
  }

  String result;
  for (int index = 0; index < visibleCount; index += 1) {
    if (result.length() > 0) result += "\n";
    result += visibleSsids[index];
  }
  return result;
}

void startWifiScanIfDue(unsigned long now) {
  if (wifiScanRunning || now - lastWifiScanStartMs < WIFI_SCAN_INTERVAL_MS) return;
  WiFi.scanDelete();
  WiFi.scanNetworks(true, false);
  wifiScanRunning = true;
  latestWifiScanState = "running";
  lastWifiScanStartMs = now;
}

void updateWifiDisplay() {
  const unsigned long now = millis();
  if (WiFi.status() == WL_CONNECTED) {
    wifiScanRunning = false;
    latestWifiScanState = "not_needed_connected";
    updateWifiDisplayIfChanged("connected", WiFi.SSID() + "|" + WiFi.localIP().toString());
    return;
  }

  const int scanState = WiFi.scanComplete();
  if (scanState >= 0) {
    latestScannedSsids = scannedSsidsForDisplay(scanState);
    WiFi.scanDelete();
    wifiScanRunning = false;
    latestWifiScanState = "completed";
    updateWifiDisplayIfChanged("disconnected", latestScannedSsids);
    return;
  }

  if (scanState == WIFI_SCAN_FAILED) {
    WiFi.scanDelete();
    wifiScanRunning = false;
    latestWifiScanState = "failed";
    lastWifiScanStartMs = now;
    updateWifiDisplayIfChanged("disconnected", latestScannedSsids.length() > 0 ? latestScannedSsids : "WLAN-Scan fehlgeschlagen");
    return;
  }

  startWifiScanIfDue(now);
}

void sendJson(int status, const String& body) {
  server.sendHeader("Cache-Control", "no-store");
  server.send(status, "application/json; charset=utf-8", body);
}

int readBatteryVoltageMilliVolts() {
#if GERNETIX_FLASHBOX_BATTERY_ADC_PIN >= 0
  const int measuredMilliVolts = analogReadMilliVolts(GERNETIX_FLASHBOX_BATTERY_ADC_PIN);
  return measuredMilliVolts *
    GERNETIX_FLASHBOX_BATTERY_VOLTAGE_DIVIDER_NUMERATOR /
    GERNETIX_FLASHBOX_BATTERY_VOLTAGE_DIVIDER_DENOMINATOR;
#else
  return -1;
#endif
}

bool softwareVbusSwitchingAvailable() {
  return GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN >= 0 &&
    GERNETIX_FLASHBOX_USB_VBUS_BOOST_ENABLE_PIN >= 0 &&
    GERNETIX_FLASHBOX_USB_VBUS_CURRENT_LIMIT_ENABLE_PIN >= 0;
}

String powerStatusJson() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "power_switching_mode", GERNETIX_FLASHBOX_POWER_SWITCHING_MODE);
  gernetix::runtime::jsonAppendString(writer, "power_switching_policy", GERNETIX_FLASHBOX_POWER_SWITCHING_POLICY);
  gernetix::runtime::jsonAppendString(writer, "vbus_power_mode", GERNETIX_FLASHBOX_USB_VBUS_POWER_MODE);
  gernetix::runtime::jsonAppendString(writer, "target_power_policy", GERNETIX_FLASHBOX_USB_TARGET_POWER_POLICY);
  gernetix::runtime::jsonAppendString(writer, "host_port_role", GERNETIX_FLASHBOX_HOST_PORT_ROLE);
  gernetix::runtime::jsonAppendString(writer, "target_port_role", GERNETIX_FLASHBOX_TARGET_PORT_ROLE);
  flashboxJsonAppendInt(writer, "battery_adc_pin", GERNETIX_FLASHBOX_BATTERY_ADC_PIN);
  flashboxJsonAppendInt(writer, "battery_voltage_mv", readBatteryVoltageMilliVolts());
  flashboxJsonAppendInt(writer, "vbus_power_switch_pin", GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN);
  flashboxJsonAppendInt(writer, "vbus_boost_enable_pin", GERNETIX_FLASHBOX_USB_VBUS_BOOST_ENABLE_PIN);
  flashboxJsonAppendInt(writer, "vbus_source_select_pin", GERNETIX_FLASHBOX_USB_VBUS_SOURCE_SELECT_PIN);
  flashboxJsonAppendInt(writer, "vbus_current_limit_enable_pin", GERNETIX_FLASHBOX_USB_VBUS_CURRENT_LIMIT_ENABLE_PIN);
  gernetix::runtime::jsonAppendBool(writer, "software_vbus_switching_available", softwareVbusSwitchingAvailable());
  gernetix::runtime::jsonAppendBool(writer, "battery_input_documented", GERNETIX_FLASHBOX_BATTERY_ADC_PIN >= 0);
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}

String wifiStatusJson() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "wifi_state", WiFi.status() == WL_CONNECTED ? "connected" : "not_connected");
  gernetix::runtime::jsonAppendString(writer, "connected_ssid", WiFi.status() == WL_CONNECTED ? WiFi.SSID().c_str() : "");
  gernetix::runtime::jsonAppendString(writer, "ip_address", WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "");
  gernetix::runtime::jsonAppendString(writer, "setup_ap_ssid", setupApSsid().c_str());
  gernetix::runtime::jsonAppendString(writer, "visible_ssids", latestScannedSsids.c_str());
  gernetix::runtime::jsonAppendString(writer, "scan_state", latestWifiScanState.c_str());
  gernetix::runtime::jsonAppendBool(writer, "scan_running", wifiScanRunning);
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}

void handleRoot() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "service", "gernetix-flashbox");
  gernetix::runtime::jsonAppendString(writer, "status", "ok");
  gernetix::runtime::jsonAppendString(writer, "ui_mode", GERNETIX_FLASHBOX_UI_MODE);
  gernetix::runtime::jsonAppendString(writer, "hint", "Nutze /status, /wifi/status, /power/status oder /targets/status fuer Diagnose.");
  gernetix::runtime::jsonAppendString(writer, "serial_number", serialNumber().c_str());
  gernetix::runtime::jsonEnd(writer);
  sendJson(200, flashboxJsonResponseString());
}

void handleWifiStatus() {
  sendJson(200, wifiStatusJson());
}

void handlePowerStatus() {
  sendJson(200, powerStatusJson());
}

void handleFavicon() {
  server.send(204);
}

String signClaimChallengePlaceholder(const String& challengeBody) {
  // TODO: Replace this placeholder with ECDSA-P256/SHA-256 signing over the canonical server challenge.
  // The Device Private Key must be generated/stored on the Flashbox and must never be logged or exported.
  if (challengeBody.length() > GERNETIX_FLASHBOX_MAX_CHALLENGE_BYTES) {
    return "";
  }
  return "not-implemented-device-signature";
}

void handleStatus() {
  const String serial = serialNumber();
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::RuntimeIdentity identity{
    GERNETIX_FLASHBOX_ROLE,
    "",
    serial.c_str(),
    GERNETIX_FLASHBOX_HARDWARE_PROFILE_ID,
    GERNETIX_FLASHBOX_FIRMWARE_VERSION,
    "gernetix-flashbox-firmware",
  };
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::writeRuntimeIdentityJsonFields(writer, identity);
  gernetix::runtime::jsonAppendString(writer, "claim_state", "factory_unclaimed");
  gernetix::runtime::jsonAppendString(writer, "claim_mode", GERNETIX_FLASHBOX_CLAIM_MODE);
  gernetix::runtime::jsonAppendString(writer, "device_key_policy", GERNETIX_FLASHBOX_DEVICE_KEY_POLICY);
  gernetix::runtime::jsonAppendString(writer, "release_public_key_id", GERNETIX_FLASHBOX_RELEASE_PUBLIC_KEY_ID);
  gernetix::runtime::jsonAppendString(writer, "firmware_manifest_url", GERNETIX_FLASHBOX_DEFAULT_MANIFEST_URL);
  gernetix::runtime::jsonAppendString(writer, "firmware_download_state", flashboxFirmwareDownloadStatus().state.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_detection_state", flashboxTargetDetectionStatus().state.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_connection_state", flashboxTargetDetectionStatus().connectionState.c_str());
  gernetix::runtime::jsonAppendString(writer, "display_profile_id", GERNETIX_FLASHBOX_DISPLAY_PROFILE_ID);
  gernetix::runtime::jsonAppendString(writer, "ui_mode", GERNETIX_FLASHBOX_UI_MODE);
  gernetix::runtime::jsonAppendString(writer, "discovery", "wlan_visible_claim_challenge_required");
  gernetix::runtime::jsonEnd(writer);
  sendJson(200, flashboxJsonResponseString());
}

void handleClaimChallenge() {
  String challengeBody = server.arg("plain");
  String signature = signClaimChallengePlaceholder(challengeBody);
  if (signature.length() == 0) {
    flashboxDisplayShowError("challenge_too_large", "Server-Challenge ist groesser als erlaubt.");
    sendJson(400, "{\"error\":\"challenge_too_large\"}");
    return;
  }

  String body = "{";
  body += "\"serial_number\":\"";
  body += gernetix::runtime::jsonEscapeArduino(serialNumber());
  body += "\",\"algorithm\":\"ECDSA_P256_SHA256\",";
  body += "\"signature\":\"";
  body += signature;
  body += "\",\"proof\":\"challenge_signature\"";
  body += "}";
  flashboxDisplayShowClaimState("Challenge", "Signaturantwort wurde lokal erzeugt.");
  sendJson(200, body);
}

void handleManifestPublicKey() {
  String body = "{";
  body += "\"key_id\":\"";
  body += GERNETIX_FLASHBOX_RELEASE_PUBLIC_KEY_ID;
  body += "\",\"algorithm\":\"ECDSA_P256_SHA256\",";
  body += "\"public_key_pem\":\"";
  body += gernetix::runtime::jsonEscapeArduino(GERNETIX_RELEASE_PUBLIC_KEY_PEM);
  body += "\"}";
  sendJson(200, body);
}

void handleFirmwareDownloadStatus() {
  sendJson(200, flashboxFirmwareDownloadStatusJson());
}

void handleTargetsStatus() {
  sendJson(200, flashboxTargetDetectionStatusJson());
}

void handleFirmwareManifestCheck() {
  String manifestUrl = server.arg("manifest_url");
  if (manifestUrl.length() == 0 && server.hasArg("plain")) {
    // Minimal contract parser for {"manifest_url":"https://..."} without pulling a JSON dependency into the skeleton.
    const String body = server.arg("plain");
    const String marker = "\"manifest_url\"";
    int keyIndex = body.indexOf(marker);
    int colonIndex = keyIndex >= 0 ? body.indexOf(':', keyIndex + marker.length()) : -1;
    int valueStart = colonIndex >= 0 ? body.indexOf('"', colonIndex + 1) : -1;
    int valueEnd = valueStart >= 0 ? body.indexOf('"', valueStart + 1) : -1;
    if (valueStart >= 0 && valueEnd > valueStart) {
      manifestUrl = body.substring(valueStart + 1, valueEnd);
    }
  }
  const bool accepted = flashboxFetchFirmwareManifest(manifestUrl);
  sendJson(accepted ? 202 : 409, flashboxFirmwareDownloadStatusJson());
}

void handleFirmwareArtifactVerify() {
  const bool verified = flashboxDownloadAndVerifyFirmwareArtifact();
  sendJson(verified ? 202 : 409, flashboxFirmwareDownloadStatusJson());
}

void handleNotFound() {
  sendJson(404, "{\"error\":\"not_found\"}");
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(100);
  flashboxDisplayBegin();
  flashboxFirmwareDownloadBegin();
  flashboxTargetDetectionBegin();
  flashboxDisplayShowBoot(serialNumber(), GERNETIX_FLASHBOX_FIRMWARE_VERSION);

  WiFi.mode(WIFI_AP_STA);
  const String ssid = setupApSsid();
  WiFi.softAP(ssid.c_str());
  flashboxDisplayShowWifiDisconnected(ssid, "Suche WLANs...");
  lastWifiDisplaySignature = wifiDisplaySignature("disconnected", "Suche WLANs...");
  lastWifiScanStartMs = millis();
  WiFi.scanNetworks(true, false);
  wifiScanRunning = true;

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/", HTTP_GET, handleRoot);
  server.on("/wifi/status", HTTP_GET, handleWifiStatus);
  server.on("/power/status", HTTP_GET, handlePowerStatus);
  server.on("/favicon.ico", HTTP_GET, handleFavicon);
  server.on("/claim/challenge", HTTP_POST, handleClaimChallenge);
  server.on("/firmware/manifest-public-key", HTTP_GET, handleManifestPublicKey);
  server.on("/firmware/download/status", HTTP_GET, handleFirmwareDownloadStatus);
  server.on("/targets/status", HTTP_GET, handleTargetsStatus);
  server.on("/firmware/manifest/check", HTTP_POST, handleFirmwareManifestCheck);
  server.on("/firmware/artifact/verify", HTTP_POST, handleFirmwareArtifactVerify);
  server.onNotFound(handleNotFound);
  server.begin();

  Serial.println("GerNetiX Flashbox contract skeleton started");
}

void loop() {
  server.handleClient();
  updateWifiDisplay();
  flashboxTargetDetectionLoop();
  flashboxDisplayLoop();
}
