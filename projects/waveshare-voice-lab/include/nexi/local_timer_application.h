#pragma once

#include <cstddef>
#include <cstdint>

#include "nexi/application.h"
#include "nexi/capability_policy.h"
#include "nexi/local_timer_feedback.h"
#include "nexi/monotonic_clock.h"
#include "nexi/retained_clock.h"
#include "nexi/timer_power_control.h"
#include "nexi/timer_state_store.h"

namespace nexi {

class LocalTimerApplication final : public Application {
 public:
  static constexpr size_t kPresetCount = 3;
  static constexpr uint32_t kMaximumDurationSeconds = 24U * 60U * 60U;
  static constexpr uint32_t kAddedSeconds = 60;
  static constexpr uint32_t kAlarmIntervalMilliseconds = 3000;

  LocalTimerApplication(const CapabilityPolicy& policy,
      const MonotonicClock& clock, RetainedClock& retainedClock,
      TimerStateStore& stateStore, TimerPowerControl& powerControl,
      LocalTimerFeedback& feedback);

  ApplicationId id() const override;
  bool start(const Intent& trigger) override;
  void stop(ApplicationStopReason reason) override;
  void handleIntent(const Intent& intent) override;
  void tick() override;

  bool running() const;
  bool timerActive() const;
  bool paused() const;
  bool alarming() const;
  size_t selectedPresetIndex() const;
  uint32_t remainingSeconds() const;
  bool hasRestorableState();

 private:
  enum class State : uint8_t { Selecting, Running, Paused, Alarm };

  static const uint32_t kPresetSeconds[kPresetCount];
  static bool acceptsControl(const Intent& intent);
  void movePreset(int direction);
  void startSelectedTimer();
  void pauseTimer();
  void resumeTimer();
  void addMinute();
  void cancelTimer();
  void acknowledgeAlarm();
  bool restoreState();
  bool persistRunning(uint32_t remainingSeconds);
  bool persistPaused(uint32_t remainingSeconds);
  void requestSleep();
  uint64_t remainingMilliseconds(uint64_t now) const;
  void showProgress(uint64_t now, bool force);

  const CapabilityPolicy& policy_;
  const MonotonicClock& clock_;
  RetainedClock& retainedClock_;
  TimerStateStore& stateStore_;
  TimerPowerControl& powerControl_;
  LocalTimerFeedback& feedback_;
  State state_;
  size_t selectedPresetIndex_;
  uint64_t deadlineMilliseconds_;
  uint64_t pausedRemainingMilliseconds_;
  uint64_t totalMilliseconds_;
  uint64_t nextAlarmMilliseconds_;
  uint64_t retainedDeadlineSeconds_;
  uint32_t lastShownSecond_;
  bool running_;
};

}  // namespace nexi
