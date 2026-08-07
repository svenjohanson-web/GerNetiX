#include "nexi/local_timer_application.h"

#include <limits>

#include "nexi/pcf85063_time.h"

namespace nexi {

const uint32_t LocalTimerApplication::kPresetSeconds[kPresetCount] = {
    60, 180, 300};

LocalTimerApplication::LocalTimerApplication(const CapabilityPolicy& policy,
    const MonotonicClock& clock, RetainedClock& retainedClock,
    TimerStateStore& stateStore, TimerPowerControl& powerControl,
    LocalTimerFeedback& feedback)
    : policy_(policy),
      clock_(clock),
      retainedClock_(retainedClock),
      stateStore_(stateStore),
      powerControl_(powerControl),
      feedback_(feedback),
      state_(State::Selecting),
      selectedPresetIndex_(0),
      deadlineMilliseconds_(0),
      pausedRemainingMilliseconds_(0),
      totalMilliseconds_(0),
      nextAlarmMilliseconds_(0),
      retainedDeadlineSeconds_(0),
      lastShownSecond_(std::numeric_limits<uint32_t>::max()),
      running_(false) {}

ApplicationId LocalTimerApplication::id() const {
  return ApplicationId::LocalTimer;
}

bool LocalTimerApplication::start(const Intent&) {
  if (!policy_.allows(Capability::LocalTimer)) return false;
  state_ = State::Selecting;
  selectedPresetIndex_ = 0;
  deadlineMilliseconds_ = 0;
  pausedRemainingMilliseconds_ = 0;
  totalMilliseconds_ = 0;
  nextAlarmMilliseconds_ = 0;
  retainedDeadlineSeconds_ = 0;
  lastShownSecond_ = std::numeric_limits<uint32_t>::max();
  running_ = true;
  if (restoreState()) return true;
  feedback_.showPreset(kPresetSeconds[selectedPresetIndex_],
      selectedPresetIndex_ + 1, kPresetCount);
  return true;
}

void LocalTimerApplication::stop(ApplicationStopReason) {
  if (!running_) return;
  stateStore_.erase();
  running_ = false;
  state_ = State::Selecting;
  feedback_.timerStopped();
}

void LocalTimerApplication::handleIntent(const Intent& intent) {
  if (!running_ || !acceptsControl(intent)) return;
  if (state_ == State::Alarm) {
    acknowledgeAlarm();
    return;
  }
  if (state_ == State::Selecting) {
    if (intent.type == IntentType::NextEffect) {
      movePreset(-1);
    } else if (intent.type == IntentType::AdjustVolume) {
      movePreset(1);
    } else if (intent.type == IntentType::Record ||
        intent.type == IntentType::Confirm) {
      startSelectedTimer();
    }
    return;
  }
  if (intent.type == IntentType::ToggleMute) {
    requestSleep();
    return;
  }
  if (intent.type == IntentType::NextEffect) {
    cancelTimer();
  } else if (intent.type == IntentType::AdjustVolume) {
    addMinute();
  } else if (intent.type == IntentType::Record ||
      intent.type == IntentType::Confirm) {
    if (state_ == State::Running) pauseTimer();
    else if (state_ == State::Paused) resumeTimer();
  }
}

void LocalTimerApplication::tick() {
  if (!running_) return;
  const uint64_t now = clock_.nowMilliseconds();
  if (state_ == State::Running) {
    if (now >= deadlineMilliseconds_) {
      state_ = State::Alarm;
      nextAlarmMilliseconds_ = now + kAlarmIntervalMilliseconds;
      feedback_.timerProgress(0,
          static_cast<uint32_t>(totalMilliseconds_ / 1000), false);
      feedback_.alarmPulse();
      return;
    }
    showProgress(now, false);
  } else if (state_ == State::Alarm && now >= nextAlarmMilliseconds_) {
    nextAlarmMilliseconds_ = now + kAlarmIntervalMilliseconds;
    feedback_.alarmPulse();
  }
}

bool LocalTimerApplication::running() const { return running_; }
bool LocalTimerApplication::timerActive() const {
  return state_ == State::Running || state_ == State::Paused;
}
bool LocalTimerApplication::paused() const { return state_ == State::Paused; }
bool LocalTimerApplication::alarming() const { return state_ == State::Alarm; }
size_t LocalTimerApplication::selectedPresetIndex() const {
  return selectedPresetIndex_;
}

uint32_t LocalTimerApplication::remainingSeconds() const {
  const uint64_t remaining = remainingMilliseconds(clock_.nowMilliseconds());
  return static_cast<uint32_t>((remaining + 999) / 1000);
}

bool LocalTimerApplication::hasRestorableState() {
  TimerState state{};
  return stateStore_.load(&state) == TimerStateLoadResult::Loaded;
}

bool LocalTimerApplication::acceptsControl(const Intent& intent) {
  return intent.source == IntentSource::ServiceButton ||
      intent.source == IntentSource::Test;
}

void LocalTimerApplication::movePreset(int direction) {
  if (direction < 0) {
    selectedPresetIndex_ = selectedPresetIndex_ == 0
        ? kPresetCount - 1 : selectedPresetIndex_ - 1;
  } else {
    selectedPresetIndex_ = (selectedPresetIndex_ + 1) % kPresetCount;
  }
  feedback_.showPreset(kPresetSeconds[selectedPresetIndex_],
      selectedPresetIndex_ + 1, kPresetCount);
}

void LocalTimerApplication::startSelectedTimer() {
  const uint64_t now = clock_.nowMilliseconds();
  totalMilliseconds_ =
      static_cast<uint64_t>(kPresetSeconds[selectedPresetIndex_]) * 1000;
  deadlineMilliseconds_ = now + totalMilliseconds_;
  uint64_t retainedNow = 0;
  if (retainedClock_.ensureAvailable(
          Pcf85063TimeCodec::kFallbackEpochSeconds) &&
      retainedClock_.nowSeconds(&retainedNow)) {
    retainedDeadlineSeconds_ = retainedNow + kPresetSeconds[selectedPresetIndex_];
  } else {
    retainedDeadlineSeconds_ = 0;
  }
  pausedRemainingMilliseconds_ = 0;
  state_ = State::Running;
  lastShownSecond_ = std::numeric_limits<uint32_t>::max();
  feedback_.timerStarted(kPresetSeconds[selectedPresetIndex_]);
  if (!persistRunning(kPresetSeconds[selectedPresetIndex_])) {
    feedback_.persistenceUnavailable();
  }
  showProgress(now, true);
}

void LocalTimerApplication::pauseTimer() {
  const uint64_t now = clock_.nowMilliseconds();
  pausedRemainingMilliseconds_ = remainingMilliseconds(now);
  state_ = State::Paused;
  retainedDeadlineSeconds_ = 0;
  const uint32_t remaining = static_cast<uint32_t>(
      (pausedRemainingMilliseconds_ + 999) / 1000);
  if (!persistPaused(remaining)) feedback_.persistenceUnavailable();
  showProgress(now, true);
}

void LocalTimerApplication::resumeTimer() {
  const uint64_t now = clock_.nowMilliseconds();
  deadlineMilliseconds_ = now + pausedRemainingMilliseconds_;
  uint64_t retainedNow = 0;
  const uint32_t remaining = static_cast<uint32_t>(
      (pausedRemainingMilliseconds_ + 999) / 1000);
  retainedDeadlineSeconds_ = retainedClock_.nowSeconds(&retainedNow)
      ? retainedNow + remaining : 0;
  state_ = State::Running;
  if (!persistRunning(remaining)) feedback_.persistenceUnavailable();
  showProgress(now, true);
}

void LocalTimerApplication::addMinute() {
  const uint64_t now = clock_.nowMilliseconds();
  const uint64_t maximum =
      static_cast<uint64_t>(kMaximumDurationSeconds) * 1000;
  const uint64_t addition = static_cast<uint64_t>(kAddedSeconds) * 1000;
  if (state_ == State::Running) {
    const uint64_t remaining = remainingMilliseconds(now);
    const uint64_t adjusted = remaining > maximum - addition
        ? maximum : remaining + addition;
    deadlineMilliseconds_ = now + adjusted;
    totalMilliseconds_ = totalMilliseconds_ > maximum - addition
        ? maximum : totalMilliseconds_ + addition;
  } else {
    pausedRemainingMilliseconds_ = pausedRemainingMilliseconds_ >
            maximum - addition
        ? maximum : pausedRemainingMilliseconds_ + addition;
    totalMilliseconds_ = totalMilliseconds_ > maximum - addition
        ? maximum : totalMilliseconds_ + addition;
  }
  lastShownSecond_ = std::numeric_limits<uint32_t>::max();
  const uint32_t remaining = static_cast<uint32_t>(
      (remainingMilliseconds(now) + 999) / 1000);
  feedback_.timerAdjusted(remaining);
  if (state_ == State::Running) {
    uint64_t retainedNow = 0;
    retainedDeadlineSeconds_ = retainedClock_.nowSeconds(&retainedNow)
        ? retainedNow + remaining : 0;
    if (!persistRunning(remaining)) feedback_.persistenceUnavailable();
  } else if (!persistPaused(remaining)) {
    feedback_.persistenceUnavailable();
  }
  showProgress(now, true);
}

void LocalTimerApplication::cancelTimer() {
  state_ = State::Selecting;
  retainedDeadlineSeconds_ = 0;
  stateStore_.erase();
  feedback_.timerCancelled();
  feedback_.showPreset(kPresetSeconds[selectedPresetIndex_],
      selectedPresetIndex_ + 1, kPresetCount);
}

void LocalTimerApplication::acknowledgeAlarm() {
  state_ = State::Selecting;
  retainedDeadlineSeconds_ = 0;
  stateStore_.erase();
  feedback_.alarmAcknowledged();
  feedback_.showPreset(kPresetSeconds[selectedPresetIndex_],
      selectedPresetIndex_ + 1, kPresetCount);
}

bool LocalTimerApplication::restoreState() {
  TimerState stored{};
  const TimerStateLoadResult result = stateStore_.load(&stored);
  if (result == TimerStateLoadResult::Missing) return false;
  if (result != TimerStateLoadResult::Loaded) {
    stateStore_.erase();
    feedback_.persistenceUnavailable();
    return false;
  }
  selectedPresetIndex_ = stored.presetIndex;
  totalMilliseconds_ = static_cast<uint64_t>(stored.totalSeconds) * 1000ULL;
  lastShownSecond_ = std::numeric_limits<uint32_t>::max();
  if (stored.phase == TimerStoredPhase::Paused) {
    pausedRemainingMilliseconds_ =
        static_cast<uint64_t>(stored.remainingSeconds) * 1000ULL;
    state_ = State::Paused;
    feedback_.timerRestored(stored.remainingSeconds, true);
    showProgress(clock_.nowMilliseconds(), true);
    return true;
  }
  uint64_t retainedNow = 0;
  if (!retainedClock_.nowSeconds(&retainedNow)) {
    stateStore_.erase();
    feedback_.persistenceUnavailable();
    return false;
  }
  retainedDeadlineSeconds_ = stored.deadlineSeconds;
  if (retainedNow >= retainedDeadlineSeconds_) {
    state_ = State::Alarm;
    nextAlarmMilliseconds_ =
        clock_.nowMilliseconds() + kAlarmIntervalMilliseconds;
    feedback_.timerRestored(0, false);
    feedback_.alarmPulse();
    return true;
  }
  const uint64_t remaining = retainedDeadlineSeconds_ - retainedNow;
  if (remaining > kMaximumDurationSeconds) {
    stateStore_.erase();
    feedback_.persistenceUnavailable();
    return false;
  }
  deadlineMilliseconds_ = clock_.nowMilliseconds() + remaining * 1000ULL;
  state_ = State::Running;
  feedback_.timerRestored(static_cast<uint32_t>(remaining), false);
  showProgress(clock_.nowMilliseconds(), true);
  return true;
}

bool LocalTimerApplication::persistRunning(uint32_t) {
  if (retainedDeadlineSeconds_ == 0) return false;
  return stateStore_.save({TimerStoredPhase::Running,
      static_cast<uint8_t>(selectedPresetIndex_), retainedDeadlineSeconds_, 0,
      static_cast<uint32_t>((totalMilliseconds_ + 999) / 1000)});
}

bool LocalTimerApplication::persistPaused(uint32_t remainingSeconds) {
  return stateStore_.save({TimerStoredPhase::Paused,
      static_cast<uint8_t>(selectedPresetIndex_), 0, remainingSeconds,
      static_cast<uint32_t>((totalMilliseconds_ + 999) / 1000)});
}

void LocalTimerApplication::requestSleep() {
  if (state_ != State::Running) {
    feedback_.sleepUnavailable();
    return;
  }
  const uint32_t remaining = remainingSeconds();
  if (remaining == 0 || !persistRunning(remaining)) {
    feedback_.persistenceUnavailable();
    return;
  }
  feedback_.timerSleeping(remaining);
  if (!powerControl_.enterDeepSleep(remaining)) feedback_.sleepUnavailable();
}

uint64_t LocalTimerApplication::remainingMilliseconds(uint64_t now) const {
  if (state_ == State::Paused) return pausedRemainingMilliseconds_;
  if (state_ != State::Running || now >= deadlineMilliseconds_) return 0;
  return deadlineMilliseconds_ - now;
}

void LocalTimerApplication::showProgress(uint64_t now, bool force) {
  const uint32_t remaining = static_cast<uint32_t>(
      (remainingMilliseconds(now) + 999) / 1000);
  if (!force && remaining == lastShownSecond_) return;
  lastShownSecond_ = remaining;
  feedback_.timerProgress(remaining,
      static_cast<uint32_t>((totalMilliseconds_ + 999) / 1000),
      state_ == State::Paused);
}

}  // namespace nexi
