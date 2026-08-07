#pragma once

#include "nexi/companion_state.h"

namespace nexi {

class CompanionStateStore {
 public:
  virtual ~CompanionStateStore() = default;
  virtual CompanionStateLoadResult load(CompanionState* state) = 0;
  virtual bool save(const CompanionState& state) = 0;
  virtual bool erase() = 0;
};

}  // namespace nexi
