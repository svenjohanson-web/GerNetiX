#pragma once

#include <cstdint>

namespace nexi {

enum class ReactionTarget : uint8_t {
  EffectButton,
  RecordButton,
  VolumeButton,
  Count,
};

// Hardware-independent output boundary for the local reaction game.
class ReactionGameFeedback {
 public:
  virtual ~ReactionGameFeedback() = default;
  virtual void gameStarted() = 0;
  virtual void showWaiting() = 0;
  virtual void showTarget(ReactionTarget target) = 0;
  virtual void showResult(bool success, ReactionTarget target,
      uint16_t reactionTicks) = 0;
  virtual void gameStopped() = 0;
};

}  // namespace nexi
