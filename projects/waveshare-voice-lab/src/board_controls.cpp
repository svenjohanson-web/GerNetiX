#include "nexi/board_controls.h"

#include "basissoftware/feedback.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/audio_engine.h"
#include "nexi/hardware_platform.h"
#include "nexi/voice_effects.h"

namespace nexi {
namespace {
constexpr const char *TAG = "voiceLab";

const char *modeName(OperatingMode mode) {
  switch (mode) {
    case OperatingMode::VoiceStudio: return "Voice Studio";
    case OperatingMode::ReactionGame: return "Reaction Game";
    case OperatingMode::LocalQuiz: return "Local Sound Quiz";
    case OperatingMode::LocalStories: return "Local Stories";
    case OperatingMode::VoiceCompanion: return "Local Companion";
    case OperatingMode::LocalTimer: return "Local Timer";
    case OperatingMode::AiStory: return "AI Story";
    default: return "Unknown";
  }
}
}  // namespace

void showReadyEffect(VoiceEffect effect) {
  auto &hardware = HardwarePlatform::instance();
  constexpr uint8_t brightness = HardwarePlatform::STATUS_LED_BRIGHTNESS;
  switch (effect) {
    case VoiceEffect::Normal:
      hardware.setStatusLeds(1, 0, brightness, 0);
      break;
    case VoiceEffect::Robot:
      hardware.setStatusLeds(2, 0, brightness, brightness);
      break;
    case VoiceEffect::Monster:
      hardware.setStatusLeds(3, brightness, 0, brightness);
      break;
    case VoiceEffect::Helium:
      hardware.setStatusLeds(4, brightness, brightness, 0);
      break;
    case VoiceEffect::Echo:
      hardware.setStatusLeds(5, brightness, brightness, brightness);
      break;
    default:
      hardware.setStatusLeds(1, 0, brightness, 0);
      break;
  }
}

void showVolumeFeedback(const VolumeState &volume) {
  auto &hardware = HardwarePlatform::instance();
  constexpr uint8_t brightness = HardwarePlatform::STATUS_LED_BRIGHTNESS;
  if (volume.muted) {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, brightness, brightness / 4, 0);
  } else {
    hardware.setStatusLeds(volume.levelIndex + 1, brightness, brightness, 0);
  }
}

void showModeSelection(OperatingMode mode) {
  auto &hardware = HardwarePlatform::instance();
  constexpr uint8_t brightness = HardwarePlatform::STATUS_LED_BRIGHTNESS;
  if (mode == OperatingMode::AiStory) {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, brightness, 0, brightness);
  } else if (mode == OperatingMode::ReactionGame) {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, brightness, brightness / 3, 0);
  } else if (mode == OperatingMode::LocalQuiz) {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, 0, brightness / 2, brightness);
  } else if (mode == OperatingMode::LocalStories) {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, brightness / 3, 0, brightness);
  } else if (mode == OperatingMode::VoiceCompanion) {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, brightness / 2, 0, brightness);
  } else if (mode == OperatingMode::LocalTimer) {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, brightness, brightness / 2, 0);
  } else {
    hardware.setStatusLeds(
        HardwarePlatform::STATUS_LED_COUNT, 0, brightness, 0);
  }
}

esp_err_t selectOperatingMode(OperatingMode *mode) {
  if (mode == nullptr) return ESP_ERR_INVALID_ARG;
  auto &hardware = HardwarePlatform::instance();
  *mode = OperatingMode::VoiceStudio;
  showModeSelection(*mode);
  feedbackInfo(TAG,
      "Mode selection: %s; KEY1 changes, KEY2 confirms",
      modeName(*mode));
  unsigned recordStableChecks = 0;
  unsigned nextStableChecks = 0;
  while (true) {
    bool confirmPressed = false;
    bool nextPressed = false;
    esp_err_t result = hardware.readButtonPressed(
        BoardButton::Record, &confirmPressed);
    if (result != ESP_OK) return result;
    result = hardware.readButtonPressed(BoardButton::Effect, &nextPressed);
    if (result != ESP_OK) return result;
    recordStableChecks = confirmPressed ? recordStableChecks + 1 : 0;
    nextStableChecks = nextPressed ? nextStableChecks + 1 : 0;

    if (recordStableChecks >= 3) {
      const esp_err_t releaseResult = hardware.waitForButtonState(
          BoardButton::Record, false);
      if (releaseResult != ESP_OK) return releaseResult;
      feedbackInfo(TAG, "Mode confirmed: %s", modeName(*mode));
      return ESP_OK;
    }
    if (nextStableChecks >= 3) {
      const uint8_t next = (static_cast<uint8_t>(*mode) + 1)
          % static_cast<uint8_t>(OperatingMode::Count);
      *mode = static_cast<OperatingMode>(next);
      showModeSelection(*mode);
      feedbackInfo(TAG, "Mode selected: %s", modeName(*mode));
      const esp_err_t releaseResult = hardware.waitForButtonState(
          BoardButton::Effect, false);
      if (releaseResult != ESP_OK) return releaseResult;
      nextStableChecks = 0;
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

esp_err_t waitForUserAction(
    VoiceEffect *effect, VolumeState *volume, UserAction *action) {
  if (effect == nullptr || volume == nullptr || action == nullptr) {
    return ESP_ERR_INVALID_ARG;
  }
  auto &hardware = HardwarePlatform::instance();
  unsigned recordStableChecks = 0;
  unsigned effectStableChecks = 0;
  unsigned volumeStableChecks = 0;
  while (true) {
    bool recordPressed = false;
    bool effectPressed = false;
    bool volumePressed = false;
    esp_err_t result = hardware.readButtonPressed(
        BoardButton::Record, &recordPressed);
    if (result != ESP_OK) return result;
    result = hardware.readButtonPressed(BoardButton::Effect, &effectPressed);
    if (result != ESP_OK) return result;
    result = hardware.readButtonPressed(BoardButton::Volume, &volumePressed);
    if (result != ESP_OK) return result;

    recordStableChecks = recordPressed ? recordStableChecks + 1 : 0;
    if (recordStableChecks >= 3) {
      *action = UserAction::Record;
      return ESP_OK;
    }

    if (effectPressed) {
      effectStableChecks++;
      if (effectStableChecks >= 3) {
        unsigned heldChecks = effectStableChecks;
        while (true) {
          bool stillPressed = false;
          const esp_err_t heldResult = hardware.readButtonPressed(
              BoardButton::Effect, &stillPressed);
          if (heldResult != ESP_OK) return heldResult;
          if (!stillPressed) {
            const uint8_t next = (static_cast<uint8_t>(*effect) + 1)
                % static_cast<uint8_t>(VoiceEffect::Count);
            *effect = static_cast<VoiceEffect>(next);
            showReadyEffect(*effect);
            feedbackInfo(TAG, "Effect selected: %s", effectName(*effect));
            *action = UserAction::EffectChanged;
            return ESP_OK;
          }
          heldChecks++;
          if (heldChecks >= 50) {
            const esp_err_t releaseResult = hardware.waitForButtonState(
                BoardButton::Effect, false);
            if (releaseResult != ESP_OK) return releaseResult;
            *action = UserAction::ModeMenu;
            return ESP_OK;
          }
          vTaskDelay(pdMS_TO_TICKS(20));
        }
      }
    } else {
      effectStableChecks = 0;
    }

    if (volumePressed) {
      volumeStableChecks++;
      if (volumeStableChecks >= 3) {
        unsigned heldChecks = volumeStableChecks;
        while (true) {
          bool stillPressed = false;
          const esp_err_t heldResult = hardware.readButtonPressed(
              BoardButton::Volume, &stillPressed);
          if (heldResult != ESP_OK) return heldResult;
          if (!stillPressed) {
            volume->levelIndex =
                (volume->levelIndex + 1) % AudioEngine::volumeLevelCount();
            volume->muted = false;
            *action = UserAction::VolumeChanged;
            return ESP_OK;
          }
          heldChecks++;
          if (heldChecks >= 50) {
            const esp_err_t releaseResult = hardware.waitForButtonState(
                BoardButton::Volume, false);
            if (releaseResult != ESP_OK) return releaseResult;
            volume->muted = !volume->muted;
            *action = UserAction::VolumeChanged;
            return ESP_OK;
          }
          vTaskDelay(pdMS_TO_TICKS(20));
        }
      }
    } else {
      volumeStableChecks = 0;
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

}  // namespace nexi
