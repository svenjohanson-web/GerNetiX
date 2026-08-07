#include "nexi/esp_timer_power_control.h"

#include "esp_sleep.h"
#include "nexi/hardware_platform.h"

namespace nexi {

bool EspTimerPowerControl::enterDeepSleep(uint32_t wakeAfterSeconds) {
  if (wakeAfterSeconds == 0) return false;
  auto& hardware = HardwarePlatform::instance();
  hardware.setSpeakerAmplifier(false);
  hardware.setStatusLeds(0, 0, 0, 0);
  const uint64_t microseconds =
      static_cast<uint64_t>(wakeAfterSeconds) * 1000000ULL;
  if (esp_sleep_enable_timer_wakeup(microseconds) != ESP_OK) return false;
  esp_deep_sleep_start();
  return true;
}

}  // namespace nexi
