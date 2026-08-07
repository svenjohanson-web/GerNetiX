#pragma once

#include <cstdint>

#include "nexi/companion_state.h"

namespace nexi {

enum class CompanionAction : uint8_t {
  Feed,
  Play,
  Rest,
};

enum class CompanionMood : uint8_t {
  Tired,
  Lonely,
  Curious,
  Happy,
  Count,
};

class CompanionFeedback {
 public:
  virtual ~CompanionFeedback() = default;
  virtual void companionStarted(const CompanionState& state,
      CompanionStateLoadResult loadResult) = 0;
  virtual void showState(const CompanionState& state,
      CompanionMood mood) = 0;
  virtual void showAction(CompanionAction action,
      const CompanionState& state, CompanionMood mood) = 0;
  virtual void stateStored(bool saved) = 0;
  virtual void companionReset(bool erased, const CompanionState& state) = 0;
  virtual void companionStopped() = 0;
};

}  // namespace nexi
