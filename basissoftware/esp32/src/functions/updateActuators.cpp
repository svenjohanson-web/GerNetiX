#include "driver/gpio.h"

#include "basissoftware/config.h"
#include "basissoftware/functions/updateActuators.h"

void updateActuators() {
  static bool ledState = false;
  ledState = !ledState;
  gpio_set_level(static_cast<gpio_num_t>(STATUS_LED_PIN), ledState ? 1 : 0);
}
