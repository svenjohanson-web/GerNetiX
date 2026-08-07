#pragma once

#include <cstdint>

#include "nexi/application.h"
#include "nexi/capability_policy.h"
#include "nexi/reaction_game_feedback.h"

namespace nexi {

class ReactionGameApplication final : public Application {
 public:
  ReactionGameApplication(
      const CapabilityPolicy& policy, ReactionGameFeedback& feedback);

  ApplicationId id() const override;
  bool start(const Intent& trigger) override;
  void stop(ApplicationStopReason reason) override;
  void handleIntent(const Intent& intent) override;
  void tick() override;

  bool running() const;
  uint16_t successes() const;
  uint16_t misses() const;
  ReactionTarget currentTarget() const;

 private:
  enum class State : uint8_t {
    Waiting,
    AwaitingReaction,
    ShowingResult,
  };

  static bool targetForIntent(const Intent& intent, ReactionTarget* target);
  uint16_t nextWaitingTicks();
  ReactionTarget nextTarget();
  void beginRound();
  void finishRound(bool success, ReactionTarget pressed, uint16_t reactionTicks);

  const CapabilityPolicy& policy_;
  ReactionGameFeedback& feedback_;
  State state_;
  ReactionTarget target_;
  uint32_t randomState_;
  uint16_t ticksRemaining_;
  uint16_t successes_;
  uint16_t misses_;
  bool running_;
};

}  // namespace nexi
