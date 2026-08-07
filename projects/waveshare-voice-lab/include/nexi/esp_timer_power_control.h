#pragma once

#include "nexi/timer_power_control.h"

namespace nexi {

class EspTimerPowerControl final : public TimerPowerControl {
 public:
  bool enterDeepSleep(uint32_t wakeAfterSeconds) override;
};

}  // namespace nexi
