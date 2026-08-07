#pragma once

#include <cstdint>

namespace nexi {

class MonotonicClock {
 public:
  virtual ~MonotonicClock() = default;
  virtual uint64_t nowMilliseconds() const = 0;
};

}  // namespace nexi
