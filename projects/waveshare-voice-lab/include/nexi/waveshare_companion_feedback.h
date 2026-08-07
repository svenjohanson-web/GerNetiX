#pragma once

#include "nexi/companion_feedback.h"

namespace nexi {

class WaveshareCompanionFeedback final : public CompanionFeedback {
 public:
  void companionStarted(const CompanionState& state,
      CompanionStateLoadResult loadResult) override;
  void showState(const CompanionState& state, CompanionMood mood) override;
  void showAction(CompanionAction action,
      const CompanionState& state, CompanionMood mood) override;
  void stateStored(bool saved) override;
  void companionReset(bool erased, const CompanionState& state) override;
  void companionStopped() override;
};

}  // namespace nexi
