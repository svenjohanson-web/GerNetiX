#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

class LocalTimerFeedback {
 public:
  virtual ~LocalTimerFeedback() = default;
  virtual void showPreset(
      uint32_t durationSeconds, size_t number, size_t count) = 0;
  virtual void timerStarted(uint32_t durationSeconds) = 0;
  virtual void timerRestored(uint32_t remainingSeconds, bool paused) = 0;
  virtual void timerProgress(
      uint32_t remainingSeconds, uint32_t totalSeconds, bool paused) = 0;
  virtual void timerAdjusted(uint32_t remainingSeconds) = 0;
  virtual void timerCancelled() = 0;
  virtual void alarmPulse() = 0;
  virtual void alarmAcknowledged() = 0;
  virtual void timerSleeping(uint32_t remainingSeconds) = 0;
  virtual void persistenceUnavailable() = 0;
  virtual void sleepUnavailable() = 0;
  virtual void timerStopped() = 0;
};

}  // namespace nexi
