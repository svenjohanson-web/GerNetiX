#pragma once

#include <cstdint>

namespace nexi {

class TimerPowerControl {
 public:
  virtual ~TimerPowerControl() = default;
  virtual bool enterDeepSleep(uint32_t wakeAfterSeconds) = 0;
};

}  // namespace nexi
