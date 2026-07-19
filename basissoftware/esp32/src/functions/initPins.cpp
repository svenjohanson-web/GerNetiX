#include "basissoftware/functions/initPins.h"

void initPins() {
  // The basissoftware deliberately owns no arbitrary board GPIO.  GPIO 2 is
  // not a portable status LED, especially on display boards such as the
  // GEN4-ESP32-S3.  Project- or board-specific firmware initializes its own
  // LEDs, displays and actuators through the project hooks.
}
