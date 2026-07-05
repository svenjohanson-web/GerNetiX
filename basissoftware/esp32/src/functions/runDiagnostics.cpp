#include "esp_log.h"

#include "basissoftware/functions/runDiagnostics.h"

namespace {
constexpr const char *TAG = "runDiagnostics";
}

void runDiagnostics() {
  ESP_LOGI(TAG, "Diagnostics: ok");
}
