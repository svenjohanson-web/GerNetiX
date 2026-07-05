#include "esp_log.h"
#include "esp_timer.h"

#include "basissoftware/config.h"
#include "basissoftware/functions/publishStatus.h"

namespace {
constexpr const char *TAG = "publishStatus";
}

void publishStatus() {
  static int64_t lastStatusAt = 0;
  const int64_t now = esp_timer_get_time() / 1000;

  if (now - lastStatusAt < STATUS_INTERVAL_MS) {
    return;
  }

  lastStatusAt = now;
  ESP_LOGI(TAG, "Status: running");
}
