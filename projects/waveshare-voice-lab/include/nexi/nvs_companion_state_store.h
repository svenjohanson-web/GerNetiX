#pragma once

#include "nexi/companion_state_store.h"

namespace nexi {

class NvsCompanionStateStore final : public CompanionStateStore {
 public:
  CompanionStateLoadResult load(CompanionState* state) override;
  bool save(const CompanionState& state) override;
  bool erase() override;
};

}  // namespace nexi
