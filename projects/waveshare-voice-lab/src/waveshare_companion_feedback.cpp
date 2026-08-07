#include "nexi/waveshare_companion_feedback.h"

#include "basissoftware/feedback.h"
#include "nexi/hardware_platform.h"
#include "nexi/local_tone_output.h"

namespace nexi {
namespace {
constexpr const char* kTag = "nexiFriend";

const char* moodName(CompanionMood mood) {
  switch (mood) {
    case CompanionMood::Tired: return "tired";
    case CompanionMood::Lonely: return "lonely";
    case CompanionMood::Curious: return "curious";
    case CompanionMood::Happy: return "happy";
    default: return "unknown";
  }
}

void showMoodLeds(CompanionMood mood) {
  constexpr uint8_t brightness = HardwarePlatform::STATUS_LED_BRIGHTNESS;
  auto& hardware = HardwarePlatform::instance();
  switch (mood) {
    case CompanionMood::Tired:
      hardware.setStatusLeds(2, 0, 0, brightness);
      break;
    case CompanionMood::Lonely:
      hardware.setStatusLeds(3, brightness, brightness / 4, 0);
      break;
    case CompanionMood::Happy:
      hardware.setStatusLeds(
          HardwarePlatform::STATUS_LED_COUNT, 0, brightness, brightness / 2);
      break;
    default:
      hardware.setStatusLeds(4, brightness / 2, 0, brightness);
      break;
  }
}
}

void WaveshareCompanionFeedback::companionStarted(
    const CompanionState& state, CompanionStateLoadResult loadResult) {
  feedbackInfo(kTag,
      "Local companion started: load=%u energy=%u joy=%u trust=%u interactions=%u",
      static_cast<unsigned>(loadResult), static_cast<unsigned>(state.energy),
      static_cast<unsigned>(state.joy), static_cast<unsigned>(state.trust),
      static_cast<unsigned>(state.interactions));
  feedbackInfo(kTag,
      "KEY1 plays, KEY2 feeds, KEY3 rests, long KEY3 resets, long KEY1 stops");
}

void WaveshareCompanionFeedback::showState(
    const CompanionState& state, CompanionMood mood) {
  showMoodLeds(mood);
  feedbackInfo(kTag, "Mood=%s energy=%u joy=%u trust=%u interactions=%u",
      moodName(mood), static_cast<unsigned>(state.energy),
      static_cast<unsigned>(state.joy), static_cast<unsigned>(state.trust),
      static_cast<unsigned>(state.interactions));
}

void WaveshareCompanionFeedback::showAction(CompanionAction action,
    const CompanionState& state, CompanionMood mood) {
  showMoodLeds(mood);
  switch (action) {
    case CompanionAction::Feed:
      playLocalTone(520, 60);
      break;
    case CompanionAction::Play:
      playLocalTone(680, 50);
      playLocalTone(900, 70);
      break;
    case CompanionAction::Rest:
      playLocalTone(360, 100);
      break;
  }
  feedbackInfo(kTag, "Action=%u mood=%s energy=%u joy=%u trust=%u",
      static_cast<unsigned>(action), moodName(mood),
      static_cast<unsigned>(state.energy), static_cast<unsigned>(state.joy),
      static_cast<unsigned>(state.trust));
}

void WaveshareCompanionFeedback::stateStored(bool saved) {
  if (saved) {
    feedbackInfo(kTag, "Companion state stored locally");
  } else {
    feedbackWarning(kTag,
        "Companion state could not be stored; session remains usable");
  }
}

void WaveshareCompanionFeedback::companionReset(
    bool erased, const CompanionState&) {
  feedbackInfo(kTag, "Companion reset %s", erased ? "completed" : "volatile-only");
  playLocalTone(erased ? 760 : 220, 100);
}

void WaveshareCompanionFeedback::companionStopped() {
  HardwarePlatform::instance().setSpeakerAmplifier(false);
  HardwarePlatform::instance().setStatusLeds(1, 8, 0, 8);
  feedbackInfo(kTag, "Local companion stopped");
}

}  // namespace nexi
