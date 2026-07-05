#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "basissoftware/functions/handleNetwork.h"

void handleNetwork() {
  vTaskDelay(pdMS_TO_TICKS(1));
}
