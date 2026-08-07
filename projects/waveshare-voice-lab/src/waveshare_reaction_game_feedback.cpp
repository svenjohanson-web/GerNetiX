#include "nexi/waveshare_reaction_game_feedback.h"

#include <cstdint>

#include "basissoftware/feedback.h"
#include "nexi/hardware_platform.h"
#include "nexi/local_tone_output.h"

namespace nexi {
namespace {
constexpr const char* kTag = "reactionGame";
const char* targetName(ReactionTarget target) {
  switch (target) {
    case ReactionTarget::EffectButton: return "KEY1 left";
    case ReactionTarget::RecordButton: return "KEY2 middle";
    case ReactionTarget::VolumeButton: return "KEY3 right";
    default: return "none";
  }
}
}  // namespace

void WaveshareReactionGameFeedback::gameStarted() {
  feedbackInfo(kTag, "Local reaction game started; wait for a colored target");
  playLocalTone(520, 70);
}

void WaveshareReactionGameFeedback::showWaiting() {
  HardwarePlatform::instance().setStatusLeds(1, 10, 6, 0);
  feedbackInfo(kTag, "Wait: pressing a game button now is a false start");
}

void WaveshareReactionGameFeedback::showTarget(ReactionTarget target) {
  constexpr uint8_t brightness = HardwarePlatform::STATUS_LED_BRIGHTNESS;
  auto& hardware = HardwarePlatform::instance();
  switch (target) {
    case ReactionTarget::EffectButton:
      hardware.setStatusLeds(2, brightness, 0, 0);
      break;
    case ReactionTarget::RecordButton:
      hardware.setStatusLeds(4, 0, brightness, 0);
      break;
    case ReactionTarget::VolumeButton:
      hardware.setStatusLeds(7, 0, 0, brightness);
      break;
    default:
      return;
  }
  feedbackInfo(kTag, "React now: %s", targetName(target));
  playLocalTone(740, 55);
}

void WaveshareReactionGameFeedback::showResult(
    bool success, ReactionTarget target, uint16_t reactionTicks) {
  constexpr uint8_t brightness = HardwarePlatform::STATUS_LED_BRIGHTNESS;
  HardwarePlatform::instance().setStatusLeds(
      HardwarePlatform::STATUS_LED_COUNT,
      success ? 0 : brightness,
      success ? brightness : 0,
      0);
  feedbackInfo(kTag, "%s: %s after %u ticks",
      success ? "Hit" : "Miss", targetName(target),
      static_cast<unsigned>(reactionTicks));
  playLocalTone(success ? 980 : 220, success ? 90 : 130);
}

void WaveshareReactionGameFeedback::gameStopped() {
  HardwarePlatform::instance().setStatusLeds(1, 0, 8, 8);
  HardwarePlatform::instance().setSpeakerAmplifier(false);
  feedbackInfo(kTag, "Local reaction game stopped");
}

}  // namespace nexi
