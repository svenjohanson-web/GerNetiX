#include <cstddef>
#include <cstdint>
#include <new>

#include "basissoftware/feedback.h"
#include "esp_err.h"
#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/application_manager.h"
#include "nexi/audio_engine.h"
#include "nexi/board_controls.h"
#include "nexi/capability_policy.h"
#include "nexi/nvs_companion_state_store.h"
#include "nexi/nvs_timer_state_store.h"
#include "nexi/hardware_platform.h"
#include "nexi/intent.h"
#include "nexi/local_quiz_application.h"
#include "nexi/local_quiz_pack.h"
#include "nexi/local_story_application.h"
#include "nexi/local_story_pack.h"
#include "nexi/local_timer_application.h"
#include "nexi/esp_monotonic_clock.h"
#include "nexi/esp_timer_power_control.h"
#include "nexi/local_voice_entry.h"
#include "nexi/privacy_gate.h"
#include "nexi/personal_wake_word_detector.h"
#include "nexi/personal_voice_profile_store.h"
#include "nexi/pcf85063_retained_clock.h"
#include "nexi/pcf85063_time.h"
#include "nexi/reaction_game_application.h"
#include "nexi/runtime.h"
#include "nexi/service_button_input.h"
#include "nexi/voice_studio_application.h"
#include "nexi/voice_companion_application.h"
#include "nexi/voice_types.h"
#include "nexi/waveshare_audio_frame_source.h"
#include "nexi/waveshare_companion_feedback.h"
#include "nexi/waveshare_quiz_feedback.h"
#include "nexi/waveshare_reaction_game_feedback.h"
#include "nexi/waveshare_story_feedback.h"
#include "nexi/waveshare_timer_feedback.h"

namespace {
constexpr const char *TAG = "nexiRuntime";
constexpr const char* kVoiceStudioSentenceProfileKey = "studio_s1";
constexpr const char* kStopSentenceProfileKey = "stop_s1";
constexpr const char* kLouderSentenceProfileKey = "louder_s1";
constexpr const char* kQuieterSentenceProfileKey = "quieter_s1";
constexpr const char* kNextEffectSentenceProfileKey = "effect_s1";
constexpr const char* kReactionGameSentenceProfileKey = "game_s1";
constexpr const char* kLocalQuizSentenceProfileKey = "quiz_s1";
constexpr const char* kLocalStoriesSentenceProfileKey = "stories_s1";
constexpr const char* kLegacyWakeProfileKey = "wake_v1";
constexpr const char* kLegacyVoiceStudioProfileKey = "studio_v1";
constexpr const char* kLegacyStopProfileKey = "stop_v1";
bool runtimeStartRequested = false;

bool calibratePersonalPhrase(
    nexi::WaveshareAudioFrameSource& source,
    nexi::PersonalWakeWordDetector& detector,
    const char* const* speakingStyles,
    uint8_t readyRed, uint8_t readyGreen, uint8_t readyBlue) {
  auto& hardware = nexi::HardwarePlatform::instance();
  feedbackInfo(TAG,
      "Personal phrase setup: record '%s' %u times with KEY2",
      detector.wakeWord(),
      static_cast<unsigned>(detector.requiredReferenceCount()));

  while (!detector.ready()) {
    const size_t nextSample = detector.referenceCount() + 1;
    hardware.setStatusLeds(
        nextSample, readyRed, readyGreen, readyBlue);
    feedbackInfo(TAG,
        "Reference %u/%u: hold KEY2, say '%s' %s, then release KEY2",
        static_cast<unsigned>(nextSample),
        static_cast<unsigned>(detector.requiredReferenceCount()),
        detector.wakeWord(), speakingStyles[nextSample - 1]);

    bool recordPressed = false;
    while (!recordPressed) {
      bool exitPressed = false;
      if (hardware.readButtonPressed(
              nexi::BoardButton::Effect, &exitPressed) != ESP_OK ||
          hardware.readButtonPressed(
              nexi::BoardButton::Record, &recordPressed) != ESP_OK) {
        feedbackWarning(TAG, "Unable to read calibration buttons");
        return false;
      }
      if (exitPressed) {
        hardware.waitForButtonState(nexi::BoardButton::Effect, false);
        return false;
      }
      // Keep DMA current while waiting; this discarded frame is never stored.
      nexi::AudioFrame discarded{nullptr, 0, 0};
      source.read(&discarded);
    }
    if (hardware.waitForButtonState(
            nexi::BoardButton::Record, true) != ESP_OK ||
        !detector.beginCalibrationSample()) {
      return false;
    }

    hardware.setStatusLeds(
        nexi::HardwarePlatform::STATUS_LED_COUNT,
        nexi::HardwarePlatform::STATUS_LED_BRIGHTNESS, 0, 0);
    while (recordPressed) {
      nexi::AudioFrame frame{nullptr, 0, 0};
      if (!source.read(&frame) || !detector.captureCalibrationFrame(frame)) {
        feedbackWarning(TAG,
            "Reference recording failed or exceeded 2.4 seconds");
        break;
      }
      if (hardware.readButtonPressed(
              nexi::BoardButton::Record, &recordPressed) != ESP_OK) {
        return false;
      }
    }
    hardware.waitForButtonState(nexi::BoardButton::Record, false);

    const nexi::WakeCalibrationResult result =
        detector.finishCalibrationSample();
    if (!result.accepted) {
      feedbackWarning(TAG,
          "Reference rejected: speak clearly while holding KEY2 (minimum 0.12 seconds)");
      hardware.setStatusLeds(
          nexi::HardwarePlatform::STATUS_LED_COUNT,
          nexi::HardwarePlatform::STATUS_LED_BRIGHTNESS, 0, 0);
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }
    feedbackInfo(TAG, "Reference %u/%u accepted: %u active frames",
        static_cast<unsigned>(result.referenceCount),
        static_cast<unsigned>(detector.requiredReferenceCount()),
        static_cast<unsigned>(result.activeFrames));
    hardware.setStatusLeds(result.referenceCount, 0,
        nexi::HardwarePlatform::STATUS_LED_BRIGHTNESS, 0);
    vTaskDelay(pdMS_TO_TICKS(600));
  }

  feedbackInfo(TAG,
      "Personal '%s' profile ready; threshold=%.4f, expected=%u frames",
      detector.wakeWord(), static_cast<double>(detector.threshold()),
      static_cast<unsigned>(detector.expectedFrameCount()));
  return true;
}

bool prepareSentenceProfile(
    nexi::WaveshareAudioFrameSource& source,
    const nexi::PersonalVoiceProfileStore& profileStore,
    const char* key,
    nexi::PersonalWakeWordDetector& detector,
    const char* const* speakingStyles,
    uint8_t readyRed, uint8_t readyGreen, uint8_t readyBlue,
    bool* durable) {
  if (durable != nullptr) *durable = false;
  const nexi::VoiceProfileLoadResult loadResult =
      profileStore.load(key, &detector);
  if (loadResult == nexi::VoiceProfileLoadResult::Loaded) {
    feedbackInfo(TAG,
        "Loaded saved sentence '%s'; no new recording required",
        detector.wakeWord());
    if (durable != nullptr) *durable = true;
    return true;
  }
  if (loadResult == nexi::VoiceProfileLoadResult::Invalid) {
    feedbackWarning(TAG,
        "Saved sentence '%s' is invalid or outdated; relearning it",
        detector.wakeWord());
  } else if (loadResult == nexi::VoiceProfileLoadResult::Error) {
    feedbackWarning(TAG,
        "Saved sentence '%s' is unavailable; using a new local profile",
        detector.wakeWord());
  }
  if (!calibratePersonalPhrase(source, detector, speakingStyles,
          readyRed, readyGreen, readyBlue)) {
    return false;
  }
  const bool saved = profileStore.save(key, detector);
  if (saved) {
    feedbackInfo(TAG, "Saved complete sentence '%s' locally",
        detector.wakeWord());
  } else {
    feedbackWarning(TAG,
        "Could not persist sentence '%s'; it remains usable until restart",
        detector.wakeWord());
  }
  if (durable != nullptr) *durable = saved;
  return true;
}

void runLocalVoiceEntryTest(nexi::ApplicationManager& applications) {
  struct SentenceDefinition {
    const char* key;
    const char* phrase;
    nexi::IntentType intentType;
    nexi::ApplicationId application;
    int32_t value;
    uint8_t red;
    uint8_t green;
    uint8_t blue;
  };
  static const SentenceDefinition kSentences[] = {
      {kVoiceStudioSentenceProfileKey,
          "Hey Nexi, starte das Stimmenstudio",
          nexi::IntentType::SelectApplication,
          nexi::ApplicationId::VoiceStudio, 0, 20, 12, 0},
      {kStopSentenceProfileKey, "Hey Nexi, stopp",
          nexi::IntentType::StopApplication,
          nexi::ApplicationId::Count, 0, 20, 0, 0},
      {kLouderSentenceProfileKey, "Hey Nexi, lauter",
          nexi::IntentType::AdjustVolume,
          nexi::ApplicationId::Count, 1, 0, 20, 20},
      {kQuieterSentenceProfileKey, "Hey Nexi, leiser",
          nexi::IntentType::AdjustVolume,
          nexi::ApplicationId::Count, -1, 0, 8, 20},
      {kNextEffectSentenceProfileKey, "Hey Nexi, naechster Effekt",
          nexi::IntentType::NextEffect,
          nexi::ApplicationId::Count, 0, 20, 0, 20},
      {kReactionGameSentenceProfileKey, "Hey Nexi, starte das Reaktionsspiel",
          nexi::IntentType::SelectApplication,
          nexi::ApplicationId::ReactionGame, 0, 12, 8, 20},
      {kLocalQuizSentenceProfileKey, "Hey Nexi, starte das Klangquiz",
          nexi::IntentType::SelectApplication,
          nexi::ApplicationId::LocalQuiz, 0, 0, 12, 20},
      {kLocalStoriesSentenceProfileKey, "Hey Nexi, starte die Geschichten",
          nexi::IntentType::SelectApplication,
          nexi::ApplicationId::LocalStories, 0, 8, 0, 20},
  };
  constexpr size_t kSentenceCount =
      sizeof(kSentences) / sizeof(kSentences[0]);
  void* detectorMemory = heap_caps_malloc(
      sizeof(nexi::PersonalWakeWordDetector) * kSentenceCount,
      MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  if (detectorMemory == nullptr) {
    feedbackWarning(TAG, "Unable to reserve PSRAM for sentence recognition");
    return;
  }
  auto* detectorBytes = static_cast<uint8_t*>(detectorMemory);
  nexi::PersonalWakeWordDetector* detectors[kSentenceCount]{};
  for (size_t index = 0; index < kSentenceCount; ++index) {
    detectors[index] = new (
        detectorBytes + index * sizeof(nexi::PersonalWakeWordDetector))
        nexi::PersonalWakeWordDetector(kSentences[index].phrase, 2);
  }

  nexi::WaveshareAudioFrameSource source;
  nexi::PersonalVoiceProfileStore profileStore;
  bool resetProfiles = false;
  const esp_err_t resetButtonResult = nexi::HardwarePlatform::instance()
      .readButtonPressed(nexi::BoardButton::Volume, &resetProfiles);
  if (resetButtonResult != ESP_OK) {
    feedbackWarning(TAG, "Unable to read KEY3 for voice-profile reset: %s",
        esp_err_to_name(resetButtonResult));
  } else if (resetProfiles) {
    nexi::HardwarePlatform::instance().waitForButtonState(
        nexi::BoardButton::Volume, false);
    const bool erased = profileStore.eraseAll() &&
        profileStore.eraseLegacyDefault(kLegacyWakeProfileKey) &&
        profileStore.eraseLegacyDefault(kLegacyVoiceStudioProfileKey) &&
        profileStore.eraseLegacyDefault(kLegacyStopProfileKey);
    if (erased) {
      feedbackInfo(TAG,
          "KEY3 held at startup: saved personal sentences erased");
    } else {
      feedbackWarning(TAG,
          "KEY3 held at startup, but saved sentences could not be erased");
    }
  }

  static constexpr const char* kSentenceStyles[] = {
      "fluently in one natural sentence",
      "fluently in one natural sentence again"};
  bool durable[kSentenceCount]{};
  bool ready = true;
  for (size_t index = 0; index < kSentenceCount && ready; ++index) {
    ready = prepareSentenceProfile(source, profileStore,
        kSentences[index].key, *detectors[index], kSentenceStyles,
        kSentences[index].red, kSentences[index].green,
        kSentences[index].blue, &durable[index]);
  }
  if (!ready) {
    feedbackInfo(TAG, "Personal sentence setup left with KEY1");
    for (size_t index = 0; index < kSentenceCount; ++index) {
      detectors[index]->~PersonalWakeWordDetector();
    }
    heap_caps_free(detectorMemory);
    return;
  }

  bool allDurable = true;
  for (size_t index = 0; index < kSentenceCount; ++index) {
    allDurable = allDurable && durable[index];
  }
  if (allDurable) {
    const bool legacyErased =
        profileStore.eraseLegacyDefault(kLegacyWakeProfileKey) &&
        profileStore.eraseLegacyDefault(kLegacyVoiceStudioProfileKey) &&
        profileStore.eraseLegacyDefault(kLegacyStopProfileKey);
    if (legacyErased) {
      feedbackInfo(TAG,
          "Removed obsolete separately trained word profiles");
    } else {
      feedbackWarning(TAG,
          "Some obsolete word profiles could not be removed");
    }
  }

  nexi::LocalVoiceEntry voiceEntry;
  const size_t registrationOrder[] = {1, 0, 5, 6, 7, 2, 3, 4};
  bool registered = true;
  for (size_t orderIndex = 0; orderIndex < kSentenceCount; ++orderIndex) {
    const size_t index = registrationOrder[orderIndex];
    const nexi::Intent intent = kSentences[index].intentType ==
            nexi::IntentType::SelectApplication
        ? nexi::Intent::selectApplication(kSentences[index].application)
        : nexi::Intent::create(
              kSentences[index].intentType, nexi::IntentSource::Runtime,
              kSentences[index].value);
    registered = voiceEntry.registerSentence(detectors[index], intent) &&
        registered;
  }
  if (!registered) {
    feedbackWarning(TAG, "Unable to register all local voice sentences");
    for (size_t index = 0; index < kSentenceCount; ++index) {
      detectors[index]->~PersonalWakeWordDetector();
    }
    heap_caps_free(detectorMemory);
    return;
  }
  nexi::HardwarePlatform::instance().setStatusLeds(
      1, 0, nexi::HardwarePlatform::STATUS_LED_BRIGHTNESS,
      nexi::HardwarePlatform::STATUS_LED_BRIGHTNESS);
  feedbackInfo(TAG,
      "Natural sentence input ready; speak activation phrase and command without a pause");
  feedbackInfo(TAG,
      "Eight local sentences are ready: studio, reaction game, sound quiz, local stories, stop, louder, quieter, next effect");

  uint32_t loggedEvaluations[kSentenceCount]{};
  for (size_t index = 0; index < kSentenceCount; ++index) {
    loggedEvaluations[index] = detectors[index]->evaluationCount();
  }
  bool applicationWasActive = applications.activeApplication() != nullptr;
  while (true) {
    if (applications.activeApplication() == nullptr &&
        !applicationWasActive) {
      bool exitPressed = false;
      const esp_err_t buttonResult = nexi::HardwarePlatform::instance()
          .readButtonPressed(nexi::BoardButton::Effect, &exitPressed);
      if (buttonResult != ESP_OK) {
        feedbackWarning(TAG, "Voice-entry button read failed: %s",
            esp_err_to_name(buttonResult));
        break;
      }
      if (exitPressed) {
        nexi::HardwarePlatform::instance().waitForButtonState(
            nexi::BoardButton::Effect, false);
        feedbackInfo(TAG, "Local voice-entry test finished by KEY1");
        break;
      }
    }

    nexi::AudioFrame frame{nullptr, 0, 0};
    if (!source.read(&frame)) {
      feedbackWarning(TAG, "Voice-entry audio read failed");
      break;
    }
    nexi::Intent voiceIntent = nexi::Intent::create(nexi::IntentType::None);
    const bool producedIntent = voiceEntry.process(frame, &voiceIntent);
    for (size_t index = 0; index < kSentenceCount; ++index) {
      if (detectors[index]->evaluationCount() == loggedEvaluations[index]) {
        continue;
      }
      loggedEvaluations[index] = detectors[index]->evaluationCount();
      const bool matched = producedIntent &&
          voiceIntent.type == kSentences[index].intentType &&
          (voiceIntent.type != nexi::IntentType::AdjustVolume ||
              voiceIntent.value == kSentences[index].value);
      feedbackInfo(TAG,
          "Sentence '%s': distance=%.4f threshold=%.4f frames=%u expected=%u result=%s",
          kSentences[index].phrase,
          static_cast<double>(detectors[index]->lastDistance()),
          static_cast<double>(detectors[index]->threshold()),
          static_cast<unsigned>(detectors[index]->lastCandidateFrameCount()),
          static_cast<unsigned>(detectors[index]->expectedFrameCount()),
          matched ? "detected" : "rejected");
    }
    if (producedIntent && applications.dispatch(voiceIntent)) {
      if (voiceIntent.type == nexi::IntentType::SelectApplication) {
        feedbackInfo(TAG,
            "Natural voice intent dispatched: SelectApplication(VoiceStudio)");
        applicationWasActive = true;
      } else if (voiceIntent.type == nexi::IntentType::StopApplication) {
        feedbackInfo(TAG,
            "Natural voice intent dispatched: StopApplication");
        nexi::HardwarePlatform::instance().setStatusLeds(
            nexi::HardwarePlatform::STATUS_LED_COUNT,
            nexi::HardwarePlatform::STATUS_LED_BRIGHTNESS, 0, 0);
        vTaskDelay(pdMS_TO_TICKS(300));
        break;
      } else if (voiceIntent.type == nexi::IntentType::AdjustVolume) {
        feedbackInfo(TAG, "Natural voice intent dispatched: AdjustVolume(%d)",
            static_cast<int>(voiceIntent.value));
      } else if (voiceIntent.type == nexi::IntentType::NextEffect) {
        feedbackInfo(TAG, "Natural voice intent dispatched: NextEffect");
      }
    } else if (producedIntent) {
      feedbackInfo(TAG,
          "Local voice sentence ignored: no compatible application is active");
    }

    if (applications.activeApplication() != nullptr) {
      applications.tick();
      applicationWasActive = true;
    } else if (applicationWasActive) {
      feedbackInfo(TAG,
          "Active application stopped; returning to mode selection");
      break;
    }
  }

  for (size_t index = 0; index < kSentenceCount; ++index) {
    detectors[index]->~PersonalWakeWordDetector();
  }
  heap_caps_free(detectorMemory);
}

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
  nexi::WaveshareReactionGameFeedback reactionFeedback;
  nexi::ReactionGameApplication reactionGame(policy, reactionFeedback);
  nexi::WaveshareQuizFeedback quizFeedback;
  nexi::LocalQuizApplication localQuiz(
      policy, nexi::builtInLocalQuizCatalog(), quizFeedback);
  nexi::WaveshareStoryFeedback storyFeedback;
  nexi::LocalStoryApplication localStories(
      policy, nexi::builtInLocalStoryCatalog(), storyFeedback);
  nexi::NvsCompanionStateStore companionStore;
  nexi::WaveshareCompanionFeedback companionFeedback;
  nexi::VoiceCompanionApplication companion(
      policy, companionStore, companionFeedback);
  nexi::EspMonotonicClock timerClock;
  nexi::Pcf85063RetainedClock retainedTimerClock;
  nexi::NvsTimerStateStore timerStore;
  nexi::EspTimerPowerControl timerPower;
  nexi::WaveshareTimerFeedback timerFeedback;
  nexi::LocalTimerApplication localTimer(
      policy, timerClock, retainedTimerClock, timerStore, timerPower,
      timerFeedback);
  nexi::ServiceButtonInput serviceButtons;
  nexi::ApplicationManager applications;

  if (!applications.registerApplication(&voiceStudio)
      || !applications.registerApplication(&reactionGame)
      || !applications.registerApplication(&localQuiz)
      || !applications.registerApplication(&localStories)
      || !applications.registerApplication(&companion)
      || !applications.registerApplication(&localTimer)
      || !applications.registerInputProvider(&serviceButtons)) {
    feedbackError(TAG, "Unable to compose the bounded Nexi application runtime");
    nexi::AudioEngine::secureErase(
        recording, nexi::AudioEngine::RECORD_CAPACITY_BYTES);
    heap_caps_free(recording);
    hardware.shutdown();
    vTaskDelete(nullptr);
    return;
  }

  uint64_t retainedSeconds = 0;
  const bool rtcHadValidTime = retainedTimerClock.nowSeconds(&retainedSeconds);
  if (!rtcHadValidTime) {
    if (retainedTimerClock.ensureAvailable(
            nexi::Pcf85063TimeCodec::kFallbackEpochSeconds)) {
      feedbackWarning(TAG,
          "PCF85063 oscillator state was invalid; local epoch initialized and stale timer removed");
    } else {
      feedbackWarning(TAG,
          "PCF85063 is unavailable; timers remain volatile and cannot deep sleep");
    }
    timerStore.erase();
  } else {
    feedbackInfo(TAG, "PCF85063 retained clock ready");
  }

  if (localTimer.hasRestorableState()) {
    feedbackInfo(TAG, "Saved local timer found; resuming before normal setup");
    if (applications.dispatch(nexi::Intent::selectApplication(
            nexi::ApplicationId::LocalTimer,
            nexi::IntentSource::Runtime))) {
      while (applications.activeApplication() != nullptr) {
        applications.tick();
        vTaskDelay(pdMS_TO_TICKS(20));
      }
    }
  }

  runLocalVoiceEntryTest(applications);

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

    nexi::ApplicationId selectedApplication = nexi::ApplicationId::VoiceStudio;
    if (operatingMode == nexi::OperatingMode::ReactionGame) {
      selectedApplication = nexi::ApplicationId::ReactionGame;
    } else if (operatingMode == nexi::OperatingMode::LocalQuiz) {
      selectedApplication = nexi::ApplicationId::LocalQuiz;
    } else if (operatingMode == nexi::OperatingMode::LocalStories) {
      selectedApplication = nexi::ApplicationId::LocalStories;
    } else if (operatingMode == nexi::OperatingMode::VoiceCompanion) {
      selectedApplication = nexi::ApplicationId::VoiceCompanion;
    } else if (operatingMode == nexi::OperatingMode::LocalTimer) {
      selectedApplication = nexi::ApplicationId::LocalTimer;
    }
    if (!applications.dispatch(nexi::Intent::selectApplication(
            selectedApplication,
            nexi::IntentSource::Runtime))) {
      feedbackError(TAG, "Selected local application is unavailable under current policy");
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
