#pragma once

#include "nexi/retained_clock.h"

namespace nexi {

class Pcf85063RetainedClock final : public RetainedClock {
 public:
  bool nowSeconds(uint64_t* seconds) const override;
  bool ensureAvailable(uint64_t fallbackSeconds) override;
};

}  // namespace nexi
