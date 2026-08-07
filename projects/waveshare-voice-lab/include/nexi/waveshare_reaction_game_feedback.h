#pragma once

#include "nexi/reaction_game_feedback.h"

namespace nexi {

class WaveshareReactionGameFeedback final : public ReactionGameFeedback {
 public:
  void gameStarted() override;
  void showWaiting() override;
  void showTarget(ReactionTarget target) override;
  void showResult(bool success, ReactionTarget target,
      uint16_t reactionTicks) override;
  void gameStopped() override;
};

}  // namespace nexi
