#include <Arduino.h>
#include <ArduinoOTA.h>
#include <WiFi.h>
#include "config.h"
#include "user/user_app.h"

#ifndef GERNETIX_WIFI_MODE_NODE
#define GERNETIX_WIFI_MODE_NODE 1
#endif

#ifndef GERNETIX_WIFI_MODE_ACCESS_POINT
#define GERNETIX_WIFI_MODE_ACCESS_POINT 2
#endif

#ifndef GERNETIX_WIFI_MODE
#define GERNETIX_WIFI_MODE GERNETIX_WIFI_MODE_NODE
#endif

#ifndef GERNETIX_WIFI_CONNECT_TIMEOUT_MS
#define GERNETIX_WIFI_CONNECT_TIMEOUT_MS 15000
#endif

const char *wifiModeName() {
#if GERNETIX_WIFI_MODE == GERNETIX_WIFI_MODE_ACCESS_POINT
  return "access_point";
#else
  return "node";
#endif
}

void setupOta() {
  ArduinoOTA.setHostname(GERNETIX_OTA_HOSTNAME);

  ArduinoOTA.onStart([]() {
    Serial.println("OTA start");
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("OTA end");
  });

  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("OTA error: %u\n", error);
  });

  ArduinoOTA.begin();
}

bool setupNodeWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(GERNETIX_WIFI_SSID, GERNETIX_WIFI_PASSWORD);

  Serial.print("Connecting WiFi");
  const uint32_t connectStartedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - connectStartedAt < GERNETIX_WIFI_CONNECT_TIMEOUT_MS) {
    delay(300);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Configured WiFi not reachable, starting setup access point");
    WiFi.disconnect(true);
    delay(200);
    return false;
  }

  Serial.print("Node IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void setupAccessPointWifi() {
  WiFi.mode(WIFI_AP);

  const bool started = WiFi.softAP(
    GERNETIX_AP_SSID,
    GERNETIX_AP_PASSWORD,
    GERNETIX_AP_CHANNEL,
    GERNETIX_AP_HIDDEN,
    GERNETIX_AP_MAX_CLIENTS
  );

  if (!started) {
    Serial.println("Access point start failed");
    return;
  }

  Serial.print("Access point SSID: ");
  Serial.println(GERNETIX_AP_SSID);
  Serial.print("Access point IP: ");
  Serial.println(WiFi.softAPIP());
}

void setupWifi() {
  Serial.print("WiFi mode: ");
  Serial.println(wifiModeName());

#if GERNETIX_WIFI_MODE == GERNETIX_WIFI_MODE_ACCESS_POINT
  setupAccessPointWifi();
#else
  if (!setupNodeWifi()) {
    setupAccessPointWifi();
  }
#endif
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(GERNETIX_FIRMWARE_NAME " " GERNETIX_FIRMWARE_VERSION);

  setupWifi();
  setupOta();
  setupUserApp();
  Serial.println("OTA ready");
}

void loop() {
  ArduinoOTA.handle();
  loopUserApp();
}
