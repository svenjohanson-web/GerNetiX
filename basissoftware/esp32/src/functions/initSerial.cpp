#include "esp_log.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"
#include "basissoftware/functions/initSerial.h"

namespace {
constexpr const char *TAG = "initSerial";
}

void initSerial() {
  esp_log_level_set("*", ESP_LOG_INFO);
  feedbackInfo(TAG, "GerNetiX firmware started at %lu baud", SERIAL_BAUD_RATE);
}
