#include <Arduino.h>
#include "gernetix_avr_diagnostics.h"
#include "user/user_app.h"

namespace {
uint32_t diagnosticsUptime() { return millis(); }
uint8_t diagnosticsAvailable() { return Serial.available() > 0 ? 1 : 0; }
int16_t diagnosticsRead() { return Serial.read(); }
void diagnosticsWrite(const char *text) { Serial.print(text); }
}

void setup() {
  Serial.begin(9600);
  const gernetix_avr_diagnostics_config_t diagnostics = {
    "arduino",
    diagnosticsUptime,
    diagnosticsAvailable,
    diagnosticsRead,
    diagnosticsWrite,
  };
  gernetix_avr_diagnostics_init(&diagnostics);
  userSetup();
}

void loop() {
  gernetix_avr_diagnostics_poll();
  const uint32_t startedAt = micros();
  userLoop();
  gernetix_avr_diagnostics_observe_loop(micros() - startedAt);
  gernetix_avr_diagnostics_poll();
}
