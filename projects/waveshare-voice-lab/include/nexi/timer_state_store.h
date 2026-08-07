#pragma once

#include "nexi/timer_state.h"

namespace nexi {

class TimerStateStore {
 public:
  virtual ~TimerStateStore() = default;
  virtual TimerStateLoadResult load(TimerState* state) = 0;
  virtual bool save(const TimerState& state) = 0;
  virtual bool erase() = 0;
};

}  // namespace nexi
