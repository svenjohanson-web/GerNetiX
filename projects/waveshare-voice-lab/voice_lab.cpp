#include <cstddef>
#include <cstdint>

#include "basissoftware/feedback.h"
#include "esp_err.h"
#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/application_manager.h"
#include "nexi/audio_engine.h"
#include "nexi/board_controls.h"
#include "nexi/capability_policy.h"
#include "nexi/hardware_platform.h"
#include "nexi/intent.h"
#include "nexi/privacy_gate.h"
#include "nexi/runtime.h"
#include "nexi/service_button_input.h"
#include "nexi/voice_studio_application.h"
#include "nexi/voice_types.h"

namespace {
constexpr const char *TAG = "nexiRuntime";
bool runtimeStartRequested = false;

void showAiStoryUnavailable() {
  auto &hardware = nexi::HardwarePlatform::instance();
  feedbackWarning(TAG,
      "AI Story mode is not available until the GerNetiX voice service is configured");
  for (unsigned blink = 0; blink < 3; blink++) {
    hardware.setStatusLeds(
        nexi::HardwarePlatform::STATUS_LED_COUNT,
        nexi::HardwarePlatform::STATUS_LED_BRIGHTNESS, 0, 0);
    vTaskDelay(pdMS_TO_TICKS(200));
    hardware.setStatusLeds(0, 0, 0, 0);
    vTaskDelay(pdMS_TO_TICKS(200));
  }
}

void runtimeTask(void *) {
  feedbackInfo(TAG, "Nexi Basic modular runtime is starting");
  auto &hardware = nexi::HardwarePlatform::instance();
  const esp_err_t ledResult = hardware.initializeStatusLeds();
  if (ledResult != ESP_OK) {
    feedbackWarning(TAG, "Status LEDs unavailable: %s", esp_err_to_name(ledResult));
  }
  vTaskDelay(pdMS_TO_TICKS(2000));

  const esp_err_t hardwareResult = hardware.initializeAudioHardware();
  if (hardwareResult != ESP_OK) {
    if (hardwareResult == ESP_ERR_NOT_FOUND) {
      feedbackError(TAG, "Audio control hardware is not ready");
    } else {
      feedbackError(TAG, "Audio initialization failed: %s",
          esp_err_to_name(hardwareResult));
    }
    hardware.shutdown();
    vTaskDelete(nullptr);
    return;
  }

  int16_t *recording = static_cast<int16_t *>(heap_caps_malloc(
      nexi::AudioEngine::RECORD_CAPACITY_BYTES,
      MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (recording == nullptr) {
    feedbackError(TAG, "Unable to reserve %u bytes of PSRAM for recording",
        static_cast<unsigned>(nexi::AudioEngine::RECORD_CAPACITY_BYTES));
    hardware.shutdown();
    vTaskDelete(nullptr);
    return;
  }

  const nexi::CapabilityPolicy policy = nexi::CapabilityPolicy::offlineDefault();
  nexi::PrivacyGate privacy(policy);
  nexi::VoiceStudioApplication voiceStudio(
      recording, nexi::AudioEngine::RECORD_CAPACITY_BYTES, policy, privacy);
  nexi::ServiceButtonInput serviceButtons;
  nexi::ApplicationManager applications;

  if (!applications.registerApplication(&voiceStudio)
      || !applications.registerInputProvider(&serviceButtons)) {
    feedbackError(TAG, "Unable to compose the bounded Nexi application runtime");
    nexi::AudioEngine::secureErase(
        recording, nexi::AudioEngine::RECORD_CAPACITY_BYTES);
    heap_caps_free(recording);
    hardware.shutdown();
    vTaskDelete(nullptr);
    return;
  }

  while (true) {
    nexi::OperatingMode operatingMode = nexi::OperatingMode::VoiceStudio;
    const esp_err_t selectionResult = nexi::selectOperatingMode(&operatingMode);
    if (selectionResult != ESP_OK) {
      feedbackError(TAG, "Application selection failed: %s",
          esp_err_to_name(selectionResult));
      break;
    }
    if (operatingMode == nexi::OperatingMode::AiStory) {
      showAiStoryUnavailable();
      continue;
    }

    if (!applications.dispatch(nexi::Intent::selectApplication(
            nexi::ApplicationId::VoiceStudio,
            nexi::IntentSource::Runtime))) {
      feedbackError(TAG, "Local voice studio is unavailable under current policy");
      break;
    }
    while (applications.activeApplication() != nullptr) {
      applications.tick();
      vTaskDelay(pdMS_TO_TICKS(20));
    }
    feedbackInfo(TAG, "Returning to application selection");
  }

  applications.stopActive(nexi::ApplicationStopReason::Fault);
  nexi::AudioEngine::secureErase(
      recording, nexi::AudioEngine::RECORD_CAPACITY_BYTES);
  heap_caps_free(recording);
  hardware.shutdown();
  vTaskDelete(nullptr);
}
}  // namespace

namespace nexi {

void startRuntime() {
  if (runtimeStartRequested) {
    feedbackWarning(TAG, "Ignoring duplicate Nexi runtime start request");
    return;
  }
  runtimeStartRequested = true;
  feedbackInfo(TAG,
      "Nexi Basic starting through the GerNetiX basissoftware project boundary");
  const BaseType_t created = xTaskCreate(
      runtimeTask, "nexi-runtime", 8192, nullptr, 5, nullptr);
  if (created != pdPASS) {
    feedbackError(TAG, "Unable to start bounded Nexi runtime task");
  }
}

void tickRuntime() {
  // The basissoftware tick must never block on product audio. Nexi owns its
  // bounded project task and receives future configuration through adapters.
}

}  // namespace nexi
