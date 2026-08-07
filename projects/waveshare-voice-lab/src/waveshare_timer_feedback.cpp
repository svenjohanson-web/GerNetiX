#include "nexi/waveshare_timer_feedback.h"

#include "basissoftware/feedback.h"
#include "nexi/hardware_platform.h"
#include "nexi/local_tone_output.h"

namespace nexi {
namespace {
constexpr const char* kTag = "localTimer";
}

void WaveshareTimerFeedback::showPreset(
    uint32_t durationSeconds, size_t number, size_t count) {
  HardwarePlatform::instance().setStatusLeds(number, 20, 10, 0);
  feedbackInfo(kTag,
      "Timer preset %u/%u: %u minutes; KEY1 previous, KEY3 next, KEY2 starts",
      static_cast<unsigned>(number), static_cast<unsigned>(count),
      static_cast<unsigned>(durationSeconds / 60));
}

void WaveshareTimerFeedback::timerStarted(uint32_t durationSeconds) {
  feedbackInfo(kTag,
      "Local timer started for %u seconds; KEY2 pauses, KEY3 adds one minute, KEY1 cancels",
      static_cast<unsigned>(durationSeconds));
  playLocalTone(620, 70);
}

void WaveshareTimerFeedback::timerRestored(
    uint32_t remainingSeconds, bool paused) {
  feedbackInfo(kTag, "Timer restored after restart: %u seconds remaining%s",
      static_cast<unsigned>(remainingSeconds), paused ? ", paused" : "");
}

void WaveshareTimerFeedback::timerProgress(
    uint32_t remainingSeconds, uint32_t totalSeconds, bool paused) {
  const size_t leds = totalSeconds == 0 ? 0 : static_cast<size_t>(
      (static_cast<uint64_t>(remainingSeconds) *
          HardwarePlatform::STATUS_LED_COUNT + totalSeconds - 1) /
      totalSeconds);
  HardwarePlatform::instance().setStatusLeds(
      leds, paused ? 20 : 0, paused ? 10 : 18, paused ? 0 : 6);
  if (paused || remainingSeconds == 0 || remainingSeconds % 30 == 0 ||
      remainingSeconds <= 10) {
    feedbackInfo(kTag, "Timer %s: %u seconds remaining",
        paused ? "paused" : "running",
        static_cast<unsigned>(remainingSeconds));
  }
}

void WaveshareTimerFeedback::timerAdjusted(uint32_t remainingSeconds) {
  feedbackInfo(kTag, "Timer extended: %u seconds remaining",
      static_cast<unsigned>(remainingSeconds));
  playLocalTone(760, 50);
}

void WaveshareTimerFeedback::timerCancelled() {
  feedbackInfo(kTag, "Local timer cancelled");
  playLocalTone(260, 80);
}

void WaveshareTimerFeedback::alarmPulse() {
  HardwarePlatform::instance().setStatusLeds(
      HardwarePlatform::STATUS_LED_COUNT, 20, 0, 0);
  playLocalTone(880, 120);
  playLocalTone(660, 120);
  feedbackInfo(kTag, "Timer elapsed; press any key to acknowledge");
}

void WaveshareTimerFeedback::alarmAcknowledged() {
  feedbackInfo(kTag, "Timer alarm acknowledged");
  playLocalTone(520, 60);
}

void WaveshareTimerFeedback::timerSleeping(uint32_t remainingSeconds) {
  feedbackInfo(kTag,
      "Timer enters deep sleep for %u seconds; restart resumes the saved deadline",
      static_cast<unsigned>(remainingSeconds));
  playLocalTone(420, 60);
}

void WaveshareTimerFeedback::persistenceUnavailable() {
  feedbackWarning(kTag,
      "RTC or timer state unavailable; countdown remains volatile");
}

void WaveshareTimerFeedback::sleepUnavailable() {
  feedbackWarning(kTag,
      "Deep sleep requires a running timer with a saved RTC deadline");
}

void WaveshareTimerFeedback::timerStopped() {
  HardwarePlatform::instance().setSpeakerAmplifier(false);
  HardwarePlatform::instance().setStatusLeds(1, 8, 4, 0);
  feedbackInfo(kTag, "Local timer stopped");
}

}  // namespace nexi
