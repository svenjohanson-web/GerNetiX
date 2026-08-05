#include "nexi/voice_studio_application.h"

#include "basissoftware/feedback.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/board_controls.h"
#include "nexi/hardware_platform.h"
#include "nexi/voice_effects.h"

namespace nexi {
namespace {
constexpr const char *TAG = "voiceStudio";
}

VoiceStudioApplication::VoiceStudioApplication(int16_t *recording,
    size_t capacityBytes, const CapabilityPolicy &policy, PrivacyGate &privacy)
    : recording_(recording),
      capacityBytes_(capacityBytes),
      policy_(policy),
      privacy_(privacy),
      audio_(),
      effect_(VoiceEffect::Normal),
      volume_{AudioEngine::volumeLevelCount() - 1, false},
      retainedLevel_{0, 0, 1, 1},
      retainedFrames_(0),
      running_(false) {
}

ApplicationId VoiceStudioApplication::id() const {
  return ApplicationId::VoiceStudio;
}

bool VoiceStudioApplication::start(const Intent &) {
  if (recording_ == nullptr
      || capacityBytes_ < AudioEngine::RECORD_CAPACITY_BYTES
      || !policy_.allows(Capability::VoiceStudio)) {
    return false;
  }
  privacy_.activateLocalSession();
  feedbackInfo(TAG, "Nexi Basic local voice studio is starting");
  AudioEngine::secureErase(recording_, capacityBytes_);
  retainedFrames_ = 0;
  effect_ = VoiceEffect::Normal;
  running_ = true;
  showReadyEffect(effect_);
  feedbackInfo(TAG,
      "Ready: local voice studio; service buttons and future voice input share intents");
  return true;
}

void VoiceStudioApplication::stop(ApplicationStopReason) {
  if (recording_ != nullptr) AudioEngine::secureErase(recording_, capacityBytes_);
  retainedFrames_ = 0;
  running_ = false;
  privacy_.endSession();
  feedbackInfo(TAG, "Local voice studio stopped and volatile recording erased");
}

void VoiceStudioApplication::handleIntent(const Intent &intent) {
  if (!running_) return;
  switch (intent.type) {
    case IntentType::Record:
      recordAndPlay();
      break;
    case IntentType::NextEffect:
      selectEffect(static_cast<VoiceEffect>(
          (static_cast<uint8_t>(effect_) + 1)
          % static_cast<uint8_t>(VoiceEffect::Count)));
      break;
    case IntentType::PreviousEffect:
      selectEffect(static_cast<VoiceEffect>(
          (static_cast<uint8_t>(effect_) +
              static_cast<uint8_t>(VoiceEffect::Count) - 1)
          % static_cast<uint8_t>(VoiceEffect::Count)));
      break;
    case IntentType::SetEffect:
      if (intent.value >= 0
          && intent.value < static_cast<int32_t>(VoiceEffect::Count)) {
        selectEffect(static_cast<VoiceEffect>(intent.value));
      }
      break;
    case IntentType::AdjustVolume:
      changeVolume(intent.value == 0 ? 1 : intent.value);
      break;
    case IntentType::ToggleMute:
      volume_.muted = !volume_.muted;
      audio_.applyOutputVolume(volume_);
      showVolumeFeedback(volume_);
      break;
    case IntentType::Cancel:
      AudioEngine::secureErase(recording_, capacityBytes_);
      retainedFrames_ = 0;
      break;
    default:
      break;
  }
}

void VoiceStudioApplication::tick() {
}

void VoiceStudioApplication::selectEffect(VoiceEffect effect) {
  effect_ = effect;
  showReadyEffect(effect_);
  feedbackInfo(TAG, "Effect selected: %s", effectName(effect_));
  if (retainedFrames_ > 0) playRetained();
}

void VoiceStudioApplication::recordAndPlay() {
  if (!privacy_.mayCaptureAudio()) return;
  auto &hardware = HardwarePlatform::instance();
  hardware.setStatusLeds(HardwarePlatform::STATUS_LED_COUNT,
      HardwarePlatform::STATUS_LED_BRIGHTNESS, 0, 0);
  AudioEngine::secureErase(recording_, capacityBytes_);
  retainedFrames_ = 0;
  feedbackInfo(TAG, "Recording locally while the service record button is held");
  esp_err_t result = audio_.captureWhileRecordButtonHeld(
      recording_, &retainedFrames_);
  if (result == ESP_OK) {
    result = hardware.waitForButtonState(BoardButton::Record, false);
  }
  if (result != ESP_OK) {
    feedbackError(TAG, "Local recording failed: %s", esp_err_to_name(result));
    AudioEngine::secureErase(recording_, capacityBytes_);
    retainedFrames_ = 0;
    return;
  }

  const unsigned durationMs = static_cast<unsigned>(
      retainedFrames_ * 1000 / AUDIO_SAMPLE_RATE);
  feedbackInfo(TAG, "Recording stopped after %u ms", durationMs);
  if (retainedFrames_ < AudioEngine::MIN_RECORD_FRAMES) {
    feedbackWarning(TAG, "Recording was too short; use at least 100 ms");
    AudioEngine::secureErase(recording_, capacityBytes_);
    retainedFrames_ = 0;
    showReadyEffect(effect_);
    return;
  }

  retainedLevel_ = analyzeRecordingLevel(recording_, retainedFrames_);
  playRetained();
}

void VoiceStudioApplication::playRetained() {
  if (retainedFrames_ == 0) return;
  auto &hardware = HardwarePlatform::instance();
  hardware.setStatusLeds(HardwarePlatform::STATUS_LED_COUNT, 0, 0,
      HardwarePlatform::STATUS_LED_BRIGHTNESS);
  feedbackInfo(TAG, "Playing retained recording with effect: %s",
      effectName(effect_));
  esp_err_t result = hardware.setSpeakerAmplifier(true);
  if (result == ESP_OK) {
    vTaskDelay(pdMS_TO_TICKS(50));
    result = audio_.play(recording_, retainedFrames_, retainedLevel_, effect_);
  }
  const esp_err_t amplifierResult = hardware.setSpeakerAmplifier(false);
  if (result == ESP_OK && amplifierResult != ESP_OK) result = amplifierResult;
  if (result != ESP_OK) {
    feedbackError(TAG, "Local playback failed: %s", esp_err_to_name(result));
    return;
  }
  hardware.setStatusLeds(HardwarePlatform::STATUS_LED_COUNT, 0,
      HardwarePlatform::STATUS_LED_BRIGHTNESS, 0);
  feedbackInfo(TAG,
      "Playback complete; recording retained in volatile PSRAM for effect previews");
  vTaskDelay(pdMS_TO_TICKS(300));
  showReadyEffect(effect_);
}

void VoiceStudioApplication::changeVolume(int32_t steps) {
  const int32_t count = static_cast<int32_t>(AudioEngine::volumeLevelCount());
  int32_t next = static_cast<int32_t>(volume_.levelIndex) + steps;
  next %= count;
  if (next < 0) next += count;
  volume_.levelIndex = static_cast<size_t>(next);
  volume_.muted = false;
  if (audio_.applyOutputVolume(volume_) == ESP_OK) {
    showVolumeFeedback(volume_);
  }
}

}  // namespace nexi
