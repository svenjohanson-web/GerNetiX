#pragma once

#include "nexi/timer_state_store.h"

namespace nexi {

class NvsTimerStateStore final : public TimerStateStore {
 public:
  TimerStateLoadResult load(TimerState* state) override;
  bool save(const TimerState& state) override;
  bool erase() override;
};

}  // namespace nexi
