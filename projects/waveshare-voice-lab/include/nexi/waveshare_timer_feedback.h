#pragma once

#include "nexi/local_timer_feedback.h"

namespace nexi {

class WaveshareTimerFeedback final : public LocalTimerFeedback {
 public:
  void showPreset(
      uint32_t durationSeconds, size_t number, size_t count) override;
  void timerStarted(uint32_t durationSeconds) override;
  void timerRestored(uint32_t remainingSeconds, bool paused) override;
  void timerProgress(uint32_t remainingSeconds,
      uint32_t totalSeconds, bool paused) override;
  void timerAdjusted(uint32_t remainingSeconds) override;
  void timerCancelled() override;
  void alarmPulse() override;
  void alarmAcknowledged() override;
  void timerSleeping(uint32_t remainingSeconds) override;
  void persistenceUnavailable() override;
  void sleepUnavailable() override;
  void timerStopped() override;
};

}  // namespace nexi
