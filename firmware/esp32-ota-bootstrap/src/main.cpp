#include <Arduino.h>
#include <ArduinoOTA.h>
#include <WiFi.h>
#include "config.h"

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

static uint32_t lastBlinkAt = 0;
static bool ledState = false;

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

void setupWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(GERNETIX_WIFI_SSID, GERNETIX_WIFI_PASSWORD);

  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("WiFi connected: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println(GERNETIX_FIRMWARE_NAME " " GERNETIX_FIRMWARE_VERSION);

  setupWifi();
  setupOta();
  Serial.println("OTA ready");
}

void loop() {
  ArduinoOTA.handle();

  if (millis() - lastBlinkAt >= 1000) {
    lastBlinkAt = millis();
    ledState = !ledState;
    digitalWrite(LED_BUILTIN, ledState ? HIGH : LOW);
  }
}
