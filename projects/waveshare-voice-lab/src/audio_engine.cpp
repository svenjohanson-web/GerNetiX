#include "nexi/audio_engine.h"

#include <array>

#include "basissoftware/feedback.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/hardware_platform.h"
#include "nexi/voice_effects.h"

namespace nexi {
namespace {
constexpr const char *TAG = "voiceLab";
constexpr size_t OUTPUT_CHANNELS = 2;
constexpr size_t IO_FRAMES = 256;
constexpr std::array<int, 5> OUTPUT_VOLUME_LEVELS{{20, 40, 60, 80, 100}};
}  // namespace

void AudioEngine::secureErase(void *memory, size_t size) {
  volatile uint8_t *bytes = static_cast<volatile uint8_t *>(memory);
  while (size-- > 0) *bytes++ = 0;
}

size_t AudioEngine::volumeLevelCount() {
  return OUTPUT_VOLUME_LEVELS.size();
}

int AudioEngine::outputVolumePercent(const VolumeState &volume) {
  if (volume.muted) return 0;
  const size_t level = volume.levelIndex < OUTPUT_VOLUME_LEVELS.size()
      ? volume.levelIndex : OUTPUT_VOLUME_LEVELS.size() - 1;
  return OUTPUT_VOLUME_LEVELS[level];
}

esp_err_t AudioEngine::applyOutputVolume(const VolumeState &volume) {
  const int outputVolume = outputVolumePercent(volume);
  const esp_err_t result =
      HardwarePlatform::instance().setOutputVolume(outputVolume);
  if (result != ESP_OK) return result;
  feedbackInfo(TAG, "Output volume: %d%% (%s)", outputVolume,
      volume.muted ? "muted" : "active");
  return ESP_OK;
}

esp_err_t AudioEngine::captureWhileRecordButtonHeld(
    int16_t *recording, size_t *recordedFrames) {
  if (recording == nullptr || recordedFrames == nullptr) return ESP_ERR_INVALID_ARG;
  auto &hardware = HardwarePlatform::instance();
  size_t offset = 0;
  unsigned releasedChecks = 0;
  while (offset < RECORD_CAPACITY_BYTES) {
    bool pressed = false;
    const esp_err_t buttonResult = hardware.readButtonPressed(
        BoardButton::Record, &pressed);
    if (buttonResult != ESP_OK) return buttonResult;
    if (!pressed) {
      releasedChecks++;
      if (releasedChecks >= 2) break;
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }
    releasedChecks = 0;
    const size_t bytes = (RECORD_CAPACITY_BYTES - offset) < 4096
        ? (RECORD_CAPACITY_BYTES - offset) : 4096;
    const esp_err_t result = hardware.readAudio(
        reinterpret_cast<uint8_t *>(recording) + offset, bytes);
    if (result != ESP_OK) return result;
    offset += bytes;
  }
  *recordedFrames = offset / (AUDIO_INPUT_CHANNELS * sizeof(int16_t));
  return ESP_OK;
}

esp_err_t AudioEngine::play(const int16_t *recording, size_t recordedFrames,
    const RecordingLevel &level, VoiceEffect effect) {
  if (recording == nullptr || recordedFrames == 0) return ESP_ERR_INVALID_ARG;
  std::array<int32_t, IO_FRAMES * OUTPUT_CHANNELS> output{};
  const size_t outputFrames = effectOutputFrames(effect, recordedFrames);
  auto &hardware = HardwarePlatform::instance();
  for (size_t frameOffset = 0; frameOffset < outputFrames; frameOffset += IO_FRAMES) {
    const size_t frameCount = (outputFrames - frameOffset) < IO_FRAMES
        ? (outputFrames - frameOffset) : IO_FRAMES;
    for (size_t frame = 0; frame < frameCount; frame++) {
      const int32_t mono16 = effectSample(
          recording, recordedFrames, frameOffset + frame, level, effect);
      const int32_t mono = mono16 * 65536;
      output[frame * 2] = mono;
      output[frame * 2 + 1] = mono;
    }
    const esp_err_t result = hardware.writeAudio(
        output.data(), frameCount * OUTPUT_CHANNELS * sizeof(int32_t));
    if (result != ESP_OK) {
      secureErase(output.data(), output.size() * sizeof(output[0]));
      return result;
    }
  }
  secureErase(output.data(), output.size() * sizeof(output[0]));
  return ESP_OK;
}

}  // namespace nexi
