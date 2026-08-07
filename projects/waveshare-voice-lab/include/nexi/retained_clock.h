#pragma once

#include <cstdint>

namespace nexi {

// Clock whose seconds continue while the ESP32 is reset or sleeping. The
// value is deliberately an opaque local epoch; civil time is not required by
// countdown applications.
class RetainedClock {
 public:
  virtual ~RetainedClock() = default;
  virtual bool nowSeconds(uint64_t* seconds) const = 0;
  virtual bool ensureAvailable(uint64_t fallbackSeconds) = 0;
};

}  // namespace nexi
