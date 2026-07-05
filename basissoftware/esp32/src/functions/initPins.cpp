#include "driver/gpio.h"

#include "basissoftware/config.h"
#include "basissoftware/functions/initPins.h"

void initPins() {
  gpio_reset_pin(static_cast<gpio_num_t>(STATUS_LED_PIN));
  gpio_set_direction(static_cast<gpio_num_t>(STATUS_LED_PIN), GPIO_MODE_OUTPUT);
  gpio_set_level(static_cast<gpio_num_t>(STATUS_LED_PIN), 0);
}
