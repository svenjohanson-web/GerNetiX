#include <Arduino.h>
#include <ArduinoJson.h>
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <LittleFS.h>
#include <U8g2lib.h>
#include <base64.h>
#include <bearssl/bearssl.h>
#include <osapi.h>

#ifdef GERNETIX_USER_APPLICATION_HEADER
#include GERNETIX_USER_APPLICATION_HEADER
#else
inline void gernetixUserApplicationBegin(U8G2 &) {}
inline void gernetixUserApplicationTick(U8G2 &, uint32_t) {}
#endif

namespace {
constexpr uint8_t OLED_SCL = 12;
constexpr uint8_t OLED_SDA = 14;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint16_t DNS_PORT = 53;
constexpr size_t MAX_PROVISIONING_BYTES = 12288;
constexpr char PROTOCOL_TYPE[] = "gernetix.serial_provisioning";
constexpr char PRIVATE_KEY_PATH[] = "/device-key.bin";
constexpr char PUBLIC_KEY_PATH[] = "/device-public.pem";
constexpr char PROVISIONING_PATH[] = "/provisioning.json";
constexpr char CERTIFICATE_PATH[] = "/device-certificate.pem";
constexpr char WIFI_PATH[] = "/wifi.json";

U8G2_SSD1306_128X64_NONAME_F_SW_I2C display(
    U8G2_R0, OLED_SCL, OLED_SDA, U8X8_PIN_NONE);
ESP8266WebServer server(80);
DNSServer dns;
String setupSsid;
String serialLine;
bool filesystemReady = false;

String readTextFile(const char *path) {
  if (!filesystemReady || !LittleFS.exists(path)) return "";
  File file = LittleFS.open(path, "r");
  if (!file) return "";
  String value = file.readString();
  file.close();
  return value;
}

bool writeTextFile(const char *path, const String &value) {
  if (!filesystemReady) return false;
  File file = LittleFS.open(path, "w");
  if (!file) return false;
  const size_t written = file.print(value);
  file.close();
  return written == value.length();
}

bool readPrivateScalar(uint8_t target[32]) {
  if (!filesystemReady || !LittleFS.exists(PRIVATE_KEY_PATH)) return false;
  File file = LittleFS.open(PRIVATE_KEY_PATH, "r");
  if (!file || file.size() != 32) {
    file.close();
    return false;
  }
  const size_t read = file.read(target, 32);
  file.close();
  return read == 32;
}

bool writePrivateScalar(const uint8_t source[32]) {
  if (!filesystemReady) return false;
  File file = LittleFS.open(PRIVATE_KEY_PATH, "w");
  if (!file) return false;
  const size_t written = file.write(source, 32);
  file.close();
  return written == 32;
}

String base64Url(const uint8_t *data, size_t length) {
  String encoded = base64::encode(data, length, false);
  encoded.replace('+', '-');
  encoded.replace('/', '_');
  while (encoded.endsWith("=")) encoded.remove(encoded.length() - 1);
  return encoded;
}

String pemEncodePublicPoint(const uint8_t point[65]) {
  static const uint8_t header[] = {
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE,
    0x3D, 0x02, 0x01, 0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D,
    0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
  };
  uint8_t der[sizeof(header) + 65] = {};
  memcpy(der, header, sizeof(header));
  memcpy(der + sizeof(header), point, 65);
  const String encoded = base64::encode(der, sizeof(der), false);
  String pem = "-----BEGIN PUBLIC KEY-----\n";
  for (size_t offset = 0; offset < encoded.length(); offset += 64) {
    pem += encoded.substring(offset, min(offset + 64, encoded.length()));
    pem += '\n';
  }
  pem += "-----END PUBLIC KEY-----\n";
  return pem;
}

bool ensureDeviceKeyPair() {
  uint8_t existing[32] = {};
  if (readPrivateScalar(existing) && readTextFile(PUBLIC_KEY_PATH).length() > 0) return true;

  uint8_t seed[48] = {};
  if (os_get_random(seed, sizeof(seed)) != 0) return false;
  br_hmac_drbg_context random;
  br_hmac_drbg_init(&random, &br_sha256_vtable, seed, sizeof(seed));
  memset(seed, 0, sizeof(seed));

  const br_ec_impl *ec = br_ec_get_default();
  br_ec_private_key privateKey = {};
  uint8_t privateScalar[BR_EC_KBUF_PRIV_MAX_SIZE] = {};
  if (br_ec_keygen(&random.vtable, ec, &privateKey, privateScalar, BR_EC_secp256r1) != 32) return false;
  br_ec_public_key publicKey = {};
  uint8_t publicPoint[BR_EC_KBUF_PUB_MAX_SIZE] = {};
  if (br_ec_compute_pub(ec, &publicKey, publicPoint, &privateKey) != 65) return false;

  const bool stored = writePrivateScalar(privateScalar)
      && writeTextFile(PUBLIC_KEY_PATH, pemEncodePublicPoint(publicPoint));
  memset(privateScalar, 0, sizeof(privateScalar));
  return stored;
}

bool signCanonical(const String &canonical, String &signature) {
  uint8_t privateScalar[32] = {};
  if (!readPrivateScalar(privateScalar)) return false;
  br_sha256_context hashContext;
  uint8_t hash[32] = {};
  br_sha256_init(&hashContext);
  br_sha256_update(&hashContext, canonical.c_str(), canonical.length());
  br_sha256_out(&hashContext, hash);

  br_ec_private_key privateKey = {BR_EC_secp256r1, privateScalar, sizeof(privateScalar)};
  uint8_t rawSignature[64] = {};
  br_ecdsa_sign signer = br_ecdsa_sign_raw_get_default();
  const size_t signatureLength = signer(
      br_ec_get_default(), &br_sha256_vtable, hash, &privateKey, rawSignature);
  memset(privateScalar, 0, sizeof(privateScalar));
  if (signatureLength != sizeof(rawSignature)) return false;
  signature = base64Url(rawSignature, sizeof(rawSignature));
  return true;
}

void showDisplay(const String &line1, const String &line2 = "", const String &line3 = "", const String &line4 = "") {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  display.drawStr(0, 10, line1.c_str());
  display.drawStr(0, 25, line2.c_str());
  display.drawStr(0, 40, line3.c_str());
  display.drawStr(0, 55, line4.c_str());
  display.sendBuffer();
}

String jsonString(const JsonVariantConst &value) {
  return value.is<const char *>() ? String(value.as<const char *>()) : String();
}

bool loadProvisioning(JsonDocument &document) {
  const String stored = readTextFile(PROVISIONING_PATH);
  return stored.length() > 0 && deserializeJson(document, stored) == DeserializationError::Ok;
}

String deviceId() {
  JsonDocument document;
  return loadProvisioning(document) ? jsonString(document["device_id"]) : "";
}

String statusJson() {
  JsonDocument provisioning;
  const bool provisioned = loadProvisioning(provisioning);
  JsonDocument response;
  response["device"] = provisioned ? jsonString(provisioning["device_id"]) : setupSsid;
  response["runtime"] = "GerNetiX ESP8266 Basissoftware";
  response["runtimeVersion"] = GERNETIX_BASISSOFTWARE_VERSION;
  response["basissoftwareVersion"] = GERNETIX_BASISSOFTWARE_VERSION;
  response["basissoftwareVariant"] = "esp8266_factory";
  response["hardwareProfileId"] = GERNETIX_HARDWARE_PROFILE;
  response["wifiMode"] = WiFi.status() == WL_CONNECTED ? "station" : "setup_ap";
  response["setupApSsid"] = setupSsid;
  response["wifiStationState"] = WiFi.status() == WL_CONNECTED ? "connected" : "not_connected";
  response["ip"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  response["uptimeMs"] = millis();
  response["freeHeapBytes"] = ESP.getFreeHeap();
  response["provisioningState"] = provisioned ? "provisioned" : "not_configured";
  response["hasDevicePrivateKey"] = LittleFS.exists(PRIVATE_KEY_PATH);
  response["hasMqttClientCertificate"] = LittleFS.exists(CERTIFICATE_PATH);
  String output;
  serializeJson(response, output);
  return output;
}

String scanNetworksJson() {
  const int found = WiFi.scanNetworks(false, true);
  JsonDocument response;
  JsonArray networks = response["networks"].to<JsonArray>();
  for (int index = 0; index < found && index < 24; ++index) {
    JsonObject network = networks.add<JsonObject>();
    network["ssid"] = WiFi.SSID(index);
    network["rssi"] = WiFi.RSSI(index);
    network["secure"] = WiFi.encryptionType(index) != ENC_TYPE_NONE;
  }
  WiFi.scanDelete();
  String output;
  serializeJson(response, output);
  return output;
}

bool saveAndConnectWifi(const String &ssid, const String &password) {
  if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 64) return false;
  JsonDocument document;
  document["ssid"] = ssid;
  document["password"] = password;
  String stored;
  serializeJson(document, stored);
  if (!writeTextFile(WIFI_PATH, stored)) return false;
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(ssid, password);
  showDisplay("GerNetiX WLAN", ssid, "Verbindung...", WiFi.softAPIP().toString());
  return true;
}

void restoreWifi() {
  const String stored = readTextFile(WIFI_PATH);
  if (stored.isEmpty()) return;
  JsonDocument document;
  if (deserializeJson(document, stored) != DeserializationError::Ok) return;
  saveAndConnectWifi(jsonString(document["ssid"]), jsonString(document["password"]));
}

void sendJson(int status, const String &body) {
  server.sendHeader("Cache-Control", "no-store");
  server.send(status, "application/json; charset=utf-8", body);
}

void handleProvisioning() {
  const String body = server.arg("plain");
  if (body.isEmpty() || body.length() > MAX_PROVISIONING_BYTES) {
    sendJson(413, "{\"error\":\"invalid_provisioning_payload\"}");
    return;
  }
  JsonDocument document;
  if (deserializeJson(document, body) != DeserializationError::Ok
      || jsonString(document["device_id"]).isEmpty()
      || jsonString(document["serial_number"]).isEmpty()
      || jsonString(document["credential"]["credential_id"]).isEmpty()) {
    sendJson(422, "{\"error\":\"invalid_provisioning_payload\"}");
    return;
  }
  if (!ensureDeviceKeyPair() || !writeTextFile(PROVISIONING_PATH, body)) {
    sendJson(500, "{\"error\":\"device_identity_storage_failed\"}");
    return;
  }
  const String certificate = jsonString(document["mqtt_client_certificate_pem"]);
  if (!certificate.isEmpty() && !writeTextFile(CERTIFICATE_PATH, certificate)) {
    sendJson(500, "{\"error\":\"device_certificate_storage_failed\"}");
    return;
  }
  JsonDocument response;
  response["status"] = certificate.isEmpty() ? "provisioned" : "certificate_stored";
  response["public_key_pem"] = readTextFile(PUBLIC_KEY_PATH);
  response["has_mqtt_client_certificate"] = LittleFS.exists(CERTIFICATE_PATH);
  String output;
  serializeJson(response, output);
  showDisplay("GerNetiX", certificate.isEmpty() ? "Identitaet bereit" : "Zertifikat bereit", deviceId());
  sendJson(200, output);
}

void handleChallenge() {
  JsonDocument request;
  if (deserializeJson(request, server.arg("plain")) != DeserializationError::Ok) {
    sendJson(422, "{\"error\":\"invalid_challenge_payload\"}");
    return;
  }
  const String challengeId = jsonString(request["challenge_id"]);
  const String challenge = jsonString(request["challenge"]);
  const String expectedDeviceId = deviceId();
  if (challengeId.isEmpty() || challenge.isEmpty() || expectedDeviceId.isEmpty()
      || jsonString(request["device_id"]) != expectedDeviceId) {
    sendJson(422, "{\"error\":\"invalid_challenge_payload\"}");
    return;
  }
  const String canonical = "gernetix-device-auth-v1\n" + challengeId + "\n" + expectedDeviceId + "\n" + challenge;
  if (jsonString(request["canonical"]) != canonical) {
    sendJson(422, "{\"error\":\"invalid_challenge_canonical\"}");
    return;
  }
  String signature;
  if (!signCanonical(canonical, signature)) {
    sendJson(409, "{\"error\":\"device_private_key_missing\"}");
    return;
  }
  JsonDocument response;
  response["device_id"] = expectedDeviceId;
  response["challenge_id"] = challengeId;
  response["algorithm"] = "ECDSA_P256_SHA256";
  response["signature"] = signature;
  String output;
  serializeJson(response, output);
  sendJson(200, output);
}

void handleWifiPost() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  if (server.hasArg("plain") && !server.arg("plain").isEmpty()) {
    JsonDocument document;
    if (deserializeJson(document, server.arg("plain")) == DeserializationError::Ok) {
      ssid = jsonString(document["ssid"]);
      password = jsonString(document["password"]);
    }
  }
  if (!saveAndConnectWifi(ssid, password)) {
    sendJson(422, "{\"error\":\"invalid_wifi_credentials\"}");
    return;
  }
  sendJson(202, "{\"status\":\"wifi_connecting\",\"stored_only_on_device\":true}");
}

void registerHttpRoutes() {
  server.on("/health", HTTP_GET, [] { server.send(200, "text/plain", "ok\n"); });
  server.on("/status", HTTP_GET, [] { sendJson(200, statusJson()); });
  server.on("/wifi/scan", HTTP_GET, [] { sendJson(200, scanNetworksJson()); });
  server.on("/wifi", HTTP_POST, handleWifiPost);
  server.on("/provisioning", HTTP_POST, handleProvisioning);
  server.on("/auth/challenge", HTTP_POST, handleChallenge);
  server.onNotFound([] {
    server.sendHeader("Location", "http://192.168.4.1/status", true);
    server.send(302, "text/plain", "GerNetiX Setup");
  });
  server.begin();
}

void sendSerialResponse(const String &requestId, const char *event, const String &payload) {
  Serial.print("{\"type\":\"");
  Serial.print(PROTOCOL_TYPE);
  Serial.print("\",\"request_id\":\"");
  Serial.print(requestId);
  Serial.print("\",\"event\":\"");
  Serial.print(event);
  Serial.print("\",\"payload\":");
  Serial.print(payload);
  Serial.println('}');
}

void handleSerialCommand(const String &line) {
  JsonDocument request;
  if (deserializeJson(request, line) != DeserializationError::Ok
      || jsonString(request["type"]) != PROTOCOL_TYPE) return;
  const String requestId = jsonString(request["request_id"]);
  const String action = jsonString(request["action"]);
  if (requestId.isEmpty() || action.isEmpty()) return;
  if (action == "wifi_scan") {
    sendSerialResponse(requestId, "wifi_networks", scanNetworksJson());
  } else if (action == "wifi_connect") {
    const bool accepted = saveAndConnectWifi(
        jsonString(request["payload"]["ssid"]), jsonString(request["payload"]["password"]));
    sendSerialResponse(requestId, accepted ? "wifi_connecting" : "error",
        accepted ? "{\"stored_only_on_device\":true}" : "{\"code\":\"invalid_wifi_credentials\"}");
  } else if (action == "wifi_status" || action == "diagnostics") {
    sendSerialResponse(requestId, action == "wifi_status" ? "wifi_status" : "diagnostics", statusJson());
  }
}

void readSerialCommands() {
  while (Serial.available()) {
    const char value = static_cast<char>(Serial.read());
    if (value == '\n') {
      serialLine.trim();
      if (!serialLine.isEmpty()) handleSerialCommand(serialLine);
      serialLine = "";
    } else if (value != '\r' && serialLine.length() < 1024) {
      serialLine += value;
    }
  }
}
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(50);
  filesystemReady = LittleFS.begin();
  if (!filesystemReady && LittleFS.format()) filesystemReady = LittleFS.begin();
  display.setI2CAddress(OLED_ADDRESS << 1);
  display.begin();

  setupSsid = "GerNetiX-Setup-" + String(ESP.getChipId(), HEX);
  setupSsid.toUpperCase();
  WiFi.persistent(false);
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(setupSsid.c_str());
  dns.start(DNS_PORT, "*", WiFi.softAPIP());
  registerHttpRoutes();
  restoreWifi();

  showDisplay("GerNetiX ESP8266", "Provisioning bereit", setupSsid, WiFi.softAPIP().toString());
  Serial.printf("GerNetiX ESP8266 Basissoftware %s bereit\n", GERNETIX_BASISSOFTWARE_VERSION);
  gernetixUserApplicationBegin(display);
}

void loop() {
  dns.processNextRequest();
  server.handleClient();
  readSerialCommands();
  gernetixUserApplicationTick(display, millis());
  delay(2);
}
