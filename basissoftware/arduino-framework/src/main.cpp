#include <Arduino.h>
#include "user/user_app.h"

void setup() {
  Serial.begin(9600);
  userSetup();
}

void loop() {
  userLoop();
}
