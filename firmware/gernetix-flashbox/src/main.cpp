#include <Arduino.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>

#include "gernetix/runtime_core.h"
#include "gernetix_flashbox_config.h"
#include "gernetix_flashbox_ble.h"
#include "gernetix_flashbox_display.h"
#include "gernetix_flashbox_firmware_download.h"
#include "gernetix_flashbox_json_response.h"
#include "gernetix_flashbox_mqtt_job_client.h"
#include "gernetix_flashbox_provisioning.h"
#include "gernetix_flashbox_target_detection.h"
#include "gernetix_flashbox_target_serial.h"

namespace {

WebServer server(80);
DNSServer captiveDns;
Preferences wifiPreferences;

String configuredWifiSsid;
String configuredWifiPassword;

constexpr char FLASHBOX_BLE_SERVICE_UUID[] = "bca44b20-62df-4a89-bbf6-6479a04ea101";
constexpr char FLASHBOX_BLE_STATUS_UUID[] = "bca44b21-62df-4a89-bbf6-6479a04ea101";
constexpr char FLASHBOX_BLE_CAPABILITIES_UUID[] = "bca44b22-62df-4a89-bbf6-6479a04ea101";

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

String flashboxBleName() {
  return String("GNX-FlashBox-") + serialNumber().substring(serialNumber().length() - 6);
}

String flashboxBleStatusValue() {
  String value = "{\"serial_number\":\"" + serialNumber();
  value += "\",\"firmware_version\":\"" GERNETIX_FLASHBOX_FIRMWARE_VERSION;
  value += "\",\"wifi_state\":\"";
  value += WiFi.status() == WL_CONNECTED ? "connected" : "not_connected";
  value += "\",\"ip_address\":\"";
  value += WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "";
  value += "\"}";
  return value;
}

void updateFlashboxBleStatus() {
  const String value = flashboxBleStatusValue();
  flashboxBleUpdateStatus(value.c_str());
}

void beginFlashboxBle() {
  updateFlashboxBleStatus();
  flashboxBleBegin(flashboxBleName().c_str());
}

bool saveAndConnectWifi(const String& ssid, const String& password) {
  if (ssid.length() == 0 || ssid.length() > 32 || password.length() > 63) return false;
  if (!wifiPreferences.putString("ssid", ssid) || !wifiPreferences.putString("password", password)) return false;
  configuredWifiSsid = ssid;
  configuredWifiPassword = password;
  WiFi.disconnect(false, false);
  WiFi.begin(configuredWifiSsid.c_str(), configuredWifiPassword.c_str());
  return true;
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
  gernetix::runtime::jsonAppendString(writer, "setup_ap_ip", WiFi.softAPIP().toString().c_str());
  gernetix::runtime::jsonAppendString(writer, "visible_ssids", latestScannedSsids.c_str());
  gernetix::runtime::jsonAppendString(writer, "scan_state", latestWifiScanState.c_str());
  gernetix::runtime::jsonAppendBool(writer, "scan_running", wifiScanRunning);
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}

String bleStatusJson() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "state", "advertising");
  gernetix::runtime::jsonAppendString(writer, "device_name", flashboxBleName().c_str());
  gernetix::runtime::jsonAppendString(writer, "service_uuid", FLASHBOX_BLE_SERVICE_UUID);
  gernetix::runtime::jsonAppendString(writer, "scope", "discovery_and_status");
  gernetix::runtime::jsonAppendString(writer, "wifi_configuration", "local_web_portal");
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}

constexpr const char FLASHBOX_SETUP_PORTAL[] PROGMEM = R"html(<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GerNetiX FlashBox</title><style>
:root{color-scheme:dark;--bg:#07141c;--panel:#0d222d;--line:#245064;--text:#eefaff;--muted:#9eb6c3;--accent:#5eead4;--accent-strong:#14b8a6}*{box-sizing:border-box}body{min-height:100vh;margin:0;background:radial-gradient(circle at top,#12394a 0,#07141c 42rem);color:var(--text);font:16px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(100% - 2rem,42rem);margin:0 auto;padding:2.5rem 0}.brand{display:flex;align-items:center;gap:.8rem;margin-bottom:1.25rem}.mark{display:grid;width:50px;height:50px;place-items:center;border:1px solid var(--accent);border-radius:14px;color:var(--accent);font-size:22px;font-weight:900}.eyebrow{margin:0 0 .25rem;color:var(--accent);font-size:.75rem;font-weight:850;letter-spacing:.1em;text-transform:uppercase}h1{margin:0;font-size:clamp(1.6rem,6vw,2.25rem);line-height:1.1}.meta{margin:.45rem 0 0;color:var(--muted);font-size:.88rem}.panel{border:1px solid var(--line);border-radius:14px;padding:1.2rem;background:rgba(13,34,45,.94);box-shadow:0 24px 60px rgba(0,0,0,.28)}p{color:#c9dde5}.intro{margin-top:0}label{display:grid;gap:.4rem;margin:1rem 0 0;color:#dceef4;font-size:.88rem;font-weight:750}input,button{width:100%;min-height:44px;border-radius:8px;font:inherit}input{border:1px solid var(--line);padding:.65rem .75rem;background:#07141c;color:var(--text)}input:focus{outline:2px solid var(--accent);outline-offset:2px;border-color:var(--accent)}button{margin-top:1.2rem;border:1px solid #0f766e;padding:.65rem .9rem;background:var(--accent-strong);color:#ecfeff;font-weight:850;cursor:pointer}button:hover{background:#0d9488}#status{min-height:54px;margin-top:1rem;border:1px solid #176477;border-radius:8px;padding:.75rem;background:#092b36;color:#d5fff8;white-space:pre-wrap;font-size:.9rem}.links{display:flex;gap:1rem;margin-top:1rem}.links a{color:#7dd3fc;font-size:.88rem;text-decoration:none}.links a:hover{text-decoration:underline}</style></head><body><main><header class="brand"><div class="mark">GX</div><div><p class="eyebrow">GerNetiX FlashBox</p><h1>WLAN einrichten</h1><p id="identity" class="meta">FlashBox wird erkannt …</p></div></header><section class="panel"><p class="intro">Wähle das WLAN für diese FlashBox. Das Passwort wird nur lokal auf der FlashBox gespeichert und nicht an GerNetiX übertragen.</p><form id="wifi-form"><label for="ssid">WLAN-Name (SSID)</label><input id="ssid" name="ssid" list="networks" maxlength="32" required autocomplete="off" placeholder="WLAN auswählen oder eingeben"><datalist id="networks"></datalist><label for="password">WLAN-Passwort</label><input id="password" name="password" type="password" maxlength="63" autocomplete="current-password"><button type="submit">Mit WLAN verbinden</button></form><div id="status" role="status">WLANs werden gesucht …</div></section><nav class="links"><a href="/status">Diagnose</a><a href="/targets/status">Angeschlossenes Zielgerät</a></nav></main><script>const statusBox=document.getElementById('status'),ssid=document.getElementById('ssid'),networks=document.getElementById('networks');function show(s){document.getElementById('identity').textContent='FlashBox: '+(s.serial_number||'unbekannt')+' · Firmware: '+(s.firmware_version||'unbekannt')}async function refresh(){try{const [status,wifi]=await Promise.all([fetch('/status').then(r=>r.json()),fetch('/wifi/status').then(r=>r.json())]);show(status);networks.replaceChildren();(wifi.visible_ssids||'').split(',').map(v=>v.trim()).filter(Boolean).forEach(name=>{const option=document.createElement('option');option.value=name;networks.append(option)});let text='Setup-WLAN: '+(wifi.setup_ap_ssid||'GerNetiX FlashBox')+'\n';text+='Verbindung: '+(wifi.wifi_state||'nicht verbunden');if(wifi.connected_ssid)text+=' · '+wifi.connected_ssid;if(wifi.ip_address)text+='\nIP-Adresse: '+wifi.ip_address;statusBox.textContent=text}catch{statusBox.textContent='Status konnte nicht geladen werden. Bitte mit dem FlashBox-Setup-WLAN verbunden bleiben.'}}document.getElementById('wifi-form').addEventListener('submit',async event=>{event.preventDefault();statusBox.textContent='WLAN-Daten werden lokal gespeichert. Verbindung wird aufgebaut …';try{const response=await fetch('/wifi',{method:'POST',body:new URLSearchParams(new FormData(event.target))});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'Verbindung konnte nicht gestartet werden.');statusBox.textContent='Verbindung wird aufgebaut. Diese Seite zeigt gleich die IP-Adresse an.';setTimeout(refresh,1200)}catch(error){statusBox.textContent=error.message}});refresh()</script></body></html>)html";

void handleRoot() {
  server.sendHeader("Cache-Control", "no-store");
  server.send_P(200, "text/html; charset=utf-8", FLASHBOX_SETUP_PORTAL);
}

void handleWifiStatus() {
  sendJson(200, wifiStatusJson());
}

void handleWifiConnect() {
  const String ssid = server.arg("ssid");
  const String password = server.arg("password");
  if (!saveAndConnectWifi(ssid, password)) {
    sendJson(422, "{\"error\":\"invalid_or_unsaved_wifi_credentials\"}");
    return;
  }
  sendJson(202, "{\"status\":\"wifi_connection_started\"}");
}

void handleBleStatus() {
  sendJson(200, bleStatusJson());
}

void handleCaptivePortal() {
  if (server.method() == HTTP_GET) handleRoot();
  else sendJson(404, "{\"error\":\"not_found\"}");
}

void handlePowerStatus() {
  sendJson(200, powerStatusJson());
}

void handleFavicon() {
  server.send(204);
}

String provisioningChallengeSignature(const String& challengeBody) {
  if (challengeBody.length() > GERNETIX_FLASHBOX_MAX_CHALLENGE_BYTES) return "";
  const String deviceIdMarker = "\"device_id\"";
  const int deviceIdKey = challengeBody.indexOf(deviceIdMarker);
  const int deviceIdColon = deviceIdKey < 0 ? -1 : challengeBody.indexOf(':', deviceIdKey + deviceIdMarker.length());
  const int deviceIdStart = deviceIdColon < 0 ? -1 : challengeBody.indexOf('"', deviceIdColon + 1);
  const int deviceIdEnd = deviceIdStart < 0 ? -1 : challengeBody.indexOf('"', deviceIdStart + 1);
  const String canonicalMarker = "\"canonical\"";
  const int canonicalKey = challengeBody.indexOf(canonicalMarker);
  const int canonicalColon = canonicalKey < 0 ? -1 : challengeBody.indexOf(':', canonicalKey + canonicalMarker.length());
  const int canonicalStart = canonicalColon < 0 ? -1 : challengeBody.indexOf('"', canonicalColon + 1);
  const int canonicalEnd = canonicalStart < 0 ? -1 : challengeBody.indexOf('"', canonicalStart + 1);
  if (deviceIdStart < 0 || deviceIdEnd <= deviceIdStart || canonicalStart < 0 || canonicalEnd <= canonicalStart) return "";
  String canonical = challengeBody.substring(canonicalStart + 1, canonicalEnd);
  canonical.replace("\\n", "\n");
  canonical.replace("\\\"", "\"");
  return flashboxSignProvisioningChallenge(canonical, challengeBody.substring(deviceIdStart + 1, deviceIdEnd));
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
  gernetix::runtime::jsonAppendString(writer, "provisioning_state", flashboxProvisioningStatus().state.c_str());
  gernetix::runtime::jsonAppendString(writer, "mqtt_job_client_state", flashboxMqttJobClientStatus().state.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_detection_state", flashboxTargetDetectionStatus().state.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_connection_state", flashboxTargetDetectionStatus().connectionState.c_str());
  gernetix::runtime::jsonAppendString(writer, "display_profile_id", GERNETIX_FLASHBOX_DISPLAY_PROFILE_ID);
  gernetix::runtime::jsonAppendString(writer, "ui_mode", GERNETIX_FLASHBOX_UI_MODE);
  gernetix::runtime::jsonAppendString(writer, "ble_state", "advertising");
  gernetix::runtime::jsonAppendString(writer, "ble_device_name", flashboxBleName().c_str());
  gernetix::runtime::jsonAppendString(writer, "discovery", "wlan_visible_claim_challenge_required");
  gernetix::runtime::jsonEnd(writer);
  sendJson(200, flashboxJsonResponseString());
}

void handleClaimChallenge() {
  String challengeBody = server.arg("plain");
  String signature = provisioningChallengeSignature(challengeBody);
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

void handleProvisioningStatus() { sendJson(200, flashboxProvisioningStatusJson()); }
void handleMqttJobClientStatus() { sendJson(200, flashboxMqttJobClientStatusJson()); }

void handleProvisioning() {
  int statusCode = 400;
  const String response = flashboxProvisioningApply(server.arg("plain"), statusCode);
  sendJson(statusCode, response);
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

void handleTargetSerialStatus() {
  sendJson(200, flashboxTargetSerialStatusJson());
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

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(100);
  flashboxDisplayBegin();
  flashboxFirmwareDownloadBegin();
  flashboxProvisioningBegin();
  flashboxMqttJobClientBegin();
  flashboxTargetDetectionBegin();
  flashboxTargetSerialBegin();
  flashboxDisplayShowBoot(serialNumber(), GERNETIX_FLASHBOX_FIRMWARE_VERSION);

  wifiPreferences.begin("gnx-wifi", false);
  configuredWifiSsid = wifiPreferences.getString("ssid", "");
  configuredWifiPassword = wifiPreferences.getString("password", "");
  WiFi.mode(WIFI_AP_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  const String ssid = setupApSsid();
  WiFi.softAP(ssid.c_str());
  captiveDns.start(53, "*", WiFi.softAPIP());
  if (configuredWifiSsid.length() > 0) WiFi.begin(configuredWifiSsid.c_str(), configuredWifiPassword.c_str());
  beginFlashboxBle();
  flashboxDisplayShowWifiDisconnected(ssid, "Suche WLANs...");
  lastWifiDisplaySignature = wifiDisplaySignature("disconnected", "Suche WLANs...");
  lastWifiScanStartMs = millis();
  WiFi.scanNetworks(true, false);
  wifiScanRunning = true;

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/", HTTP_GET, handleRoot);
  server.on("/wifi/status", HTTP_GET, handleWifiStatus);
  server.on("/wifi", HTTP_POST, handleWifiConnect);
  server.on("/ble/status", HTTP_GET, handleBleStatus);
  server.on("/power/status", HTTP_GET, handlePowerStatus);
  server.on("/favicon.ico", HTTP_GET, handleFavicon);
  server.on("/claim/challenge", HTTP_POST, handleClaimChallenge);
  server.on("/provisioning", HTTP_POST, handleProvisioning);
  server.on("/provisioning/status", HTTP_GET, handleProvisioningStatus);
  server.on("/mqtt/jobs/status", HTTP_GET, handleMqttJobClientStatus);
  server.on("/firmware/manifest-public-key", HTTP_GET, handleManifestPublicKey);
  server.on("/firmware/download/status", HTTP_GET, handleFirmwareDownloadStatus);
  server.on("/targets/status", HTTP_GET, handleTargetsStatus);
  server.on("/targets/serial/status", HTTP_GET, handleTargetSerialStatus);
  server.on("/firmware/manifest/check", HTTP_POST, handleFirmwareManifestCheck);
  server.on("/firmware/artifact/verify", HTTP_POST, handleFirmwareArtifactVerify);
  server.onNotFound(handleCaptivePortal);
  server.begin();

  Serial.println("GerNetiX Flashbox contract skeleton started");
}

void loop() {
  server.handleClient();
  captiveDns.processNextRequest();
  updateWifiDisplay();
  updateFlashboxBleStatus();
  flashboxTargetDetectionLoop();
  flashboxTargetSerialLoop();
  flashboxMqttJobClientLoop();
  flashboxDisplayLoop();
}

// Arduino is compiled as an ESP-IDF component so the USB Host driver can be
// used. In that mode ESP-IDF requires an explicit application entry point.
extern "C" void app_main() {
  initArduino();
  setup();
  for (;;) {
    loop();
    delay(1);
  }
}
