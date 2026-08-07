#pragma once

#include <cstdint>

#include "nexi/application.h"
#include "nexi/capability_policy.h"
#include "nexi/companion_feedback.h"
#include "nexi/companion_state.h"
#include "nexi/companion_state_store.h"

namespace nexi {

class VoiceCompanionApplication final : public Application {
 public:
  static constexpr uint16_t kSaveDelayTicks = 50;

  VoiceCompanionApplication(const CapabilityPolicy& policy,
      CompanionStateStore& store, CompanionFeedback& feedback);

  ApplicationId id() const override;
  bool start(const Intent& trigger) override;
  void stop(ApplicationStopReason reason) override;
  void handleIntent(const Intent& intent) override;
  void tick() override;

  bool running() const;
  bool dirty() const;
  const CompanionState& state() const;
  CompanionMood mood() const;

 private:
  static uint8_t boundedAdd(uint8_t value, int change);
  static bool actionForIntent(
      const Intent& intent, CompanionAction* action);
  void applyAction(CompanionAction action);
  void reset();
  void scheduleStore();
  void storeNow();

  const CapabilityPolicy& policy_;
  CompanionStateStore& store_;
  CompanionFeedback& feedback_;
  CompanionState state_;
  uint16_t saveTicksRemaining_;
  bool running_;
  bool dirty_;
};

}  // namespace nexi
