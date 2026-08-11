#include <Arduino.h>

#ifndef GERNETIX_RADAR_OUT_PIN
#define GERNETIX_RADAR_OUT_PIN 27
#endif

namespace {
constexpr uint8_t RADAR_OUT_PIN = GERNETIX_RADAR_OUT_PIN;
constexpr uint32_t PRESENCE_CONFIRM_MS = 150U;
constexpr uint32_t ABSENCE_HOLD_MS = 5000U;

bool stablePresence = false;
bool candidatePresence = false;
uint32_t candidateSinceMs = 0U;

bool elapsed(uint32_t now, uint32_t since, uint32_t duration) {
  return static_cast<uint32_t>(now - since) >= duration;
}

void updatePresence(bool rawPresence, uint32_t now) {
  if (rawPresence != candidatePresence) {
    candidatePresence = rawPresence;
    candidateSinceMs = now;
  }

  const uint32_t requiredMs = candidatePresence ? PRESENCE_CONFIRM_MS : ABSENCE_HOLD_MS;
  if (stablePresence != candidatePresence && elapsed(now, candidateSinceMs, requiredMs)) {
    stablePresence = candidatePresence;
    Serial.print(F("Praesenz="));
    Serial.print(stablePresence ? F("erkannt") : F("frei"));
    Serial.print(F(", Rohsignal="));
    Serial.print(rawPresence ? F("HIGH") : F("LOW"));
    Serial.print(F(", Zeitpunkt="));
    Serial.print(static_cast<unsigned long>(now));
    Serial.println(F(" ms"));
  }
}
}

void setup() {
  Serial.begin(115200);
  pinMode(RADAR_OUT_PIN, INPUT);
  candidatePresence = digitalRead(RADAR_OUT_PIN) == HIGH;
  candidateSinceMs = millis();
  Serial.println(F("GerNetiX Radar-Raumpraesenz startet."));
  Serial.print(F("Radar-OUT an Digitalpin "));
  Serial.print(RADAR_OUT_PIN);
  Serial.println(F("; keine Cloud, keine Kamera, kein automatischer Aktor."));
}

void loop() {
  const uint32_t now = millis();
  const bool rawPresence = digitalRead(RADAR_OUT_PIN) == HIGH;
  updatePresence(rawPresence, now);

  static uint32_t nextStatusMs = 0U;
  if (static_cast<int32_t>(now - nextStatusMs) >= 0) {
    nextStatusMs = now + 1000U;
    Serial.print(F("Status: roh="));
    Serial.print(rawPresence ? F("HIGH") : F("LOW"));
    Serial.print(F(" stabil="));
    Serial.println(stablePresence ? F("Praesenz") : F("frei"));
  }
  delay(10);
}
