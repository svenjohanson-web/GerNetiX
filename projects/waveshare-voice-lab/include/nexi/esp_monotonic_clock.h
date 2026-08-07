#pragma once

#include "nexi/monotonic_clock.h"

namespace nexi {

class EspMonotonicClock final : public MonotonicClock {
 public:
  uint64_t nowMilliseconds() const override;
};

}  // namespace nexi
