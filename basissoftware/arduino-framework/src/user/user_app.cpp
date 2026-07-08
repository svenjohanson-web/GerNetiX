#include <Arduino.h>
#include "user/user_app.h"

void userSetup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void userLoop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(250);
  digitalWrite(LED_BUILTIN, LOW);
  delay(250);
}
