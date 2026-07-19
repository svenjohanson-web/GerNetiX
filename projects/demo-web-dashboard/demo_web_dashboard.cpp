#include <cstdio>

#include "esp_timer.h"

#include "basissoftware/feedback.h"
#include "basissoftware/project_dashboard.h"

namespace {
constexpr const char *TAG = "demoProject";
constexpr int64_t INTERVAL_US = 5 * 1000 * 1000;
int measurement = 0;
int64_t nextMeasurementUs = 0;
}

extern "C" void onProjectInit() {
  measurement = 0;
  nextMeasurementUs = 0;
  projectDashboardPublishMeasurement(measurement);
  projectDashboardAppendLog("Projektinstanz gestartet: Demo-Messwert = 0");
  feedbackInfo(TAG, "Demo project dashboard started");
}

extern "C" void onProjectTick() {
  const int64_t nowUs = esp_timer_get_time();
  if (nowUs < nextMeasurementUs) return;

  projectDashboardPublishMeasurement(measurement);
  char message[80] = {};
  std::snprintf(message, sizeof(message), "Messwert aktualisiert: %d", measurement);
  projectDashboardAppendLog(message);
  feedbackInfo(TAG, "%s", message);
  measurement = (measurement + 1) % 11;
  nextMeasurementUs = nowUs + INTERVAL_US;
}
