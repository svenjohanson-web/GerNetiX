#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"
#include "nexi/voice_effects.h"

namespace nexi {

class AudioEngine final {
 public:
  static constexpr size_t MAX_RECORD_SECONDS = 15;
  static constexpr size_t MAX_RECORD_FRAMES =
      AUDIO_SAMPLE_RATE * MAX_RECORD_SECONDS;
  static constexpr size_t RECORD_CAPACITY_BYTES =
      MAX_RECORD_FRAMES * AUDIO_INPUT_CHANNELS * sizeof(int16_t);
  static constexpr size_t MIN_RECORD_FRAMES = AUDIO_SAMPLE_RATE / 10;

  esp_err_t captureWhileRecordButtonHeld(
      int16_t *recording, size_t *recordedFrames);
  esp_err_t play(const int16_t *recording, size_t recordedFrames,
      const RecordingLevel &level, VoiceEffect effect);
  esp_err_t applyOutputVolume(const VolumeState &volume);

  static int outputVolumePercent(const VolumeState &volume);
  static size_t volumeLevelCount();
  static void secureErase(void *memory, size_t size);
};

}  // namespace nexi
