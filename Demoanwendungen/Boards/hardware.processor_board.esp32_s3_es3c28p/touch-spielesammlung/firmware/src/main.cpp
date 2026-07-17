#include "game_application.h"

#include <Arduino.h>

namespace {
GameApplication application;
}

void setup() {
  application.begin();
}

void loop() {
  application.tick();
  delay(20);
}
