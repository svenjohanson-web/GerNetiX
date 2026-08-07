#include "nexi/esp_monotonic_clock.h"

#include "esp_timer.h"

namespace nexi {

uint64_t EspMonotonicClock::nowMilliseconds() const {
  return static_cast<uint64_t>(esp_timer_get_time() / 1000);
}

}  // namespace nexi
