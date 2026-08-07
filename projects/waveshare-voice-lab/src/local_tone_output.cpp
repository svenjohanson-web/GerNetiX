#include "nexi/local_tone_output.h"

#include <array>
#include <cstddef>
#include <cstdint>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nexi/hardware_platform.h"
#include "nexi/voice_effects.h"

namespace nexi {
namespace {
constexpr size_t kToneFramesPerChunk = 128;
constexpr size_t kOutputChannels = 2;
}

void playLocalTone(uint16_t frequencyHz, uint16_t durationMs) {
  auto& hardware = HardwarePlatform::instance();
  if (frequencyHz == 0 || durationMs == 0 ||
      hardware.setSpeakerAmplifier(true) != ESP_OK) {
    return;
  }
  vTaskDelay(pdMS_TO_TICKS(20));

  std::array<int32_t, kToneFramesPerChunk * kOutputChannels> samples{};
  const size_t totalFrames =
      static_cast<size_t>(AUDIO_SAMPLE_RATE) * durationMs / 1000U;
  const uint32_t phaseIncrement = static_cast<uint32_t>(
      (static_cast<uint64_t>(frequencyHz) << 32U) / AUDIO_SAMPLE_RATE);
  uint32_t phase = 0;
  size_t writtenFrames = 0;
  while (writtenFrames < totalFrames) {
    const size_t frameCount = (totalFrames - writtenFrames) < kToneFramesPerChunk
        ? totalFrames - writtenFrames : kToneFramesPerChunk;
    for (size_t frame = 0; frame < frameCount; ++frame) {
      const int32_t sample = (phase & 0x80000000U) != 0
          ? 2200 * 65536 : -2200 * 65536;
      samples[frame * 2] = sample;
      samples[frame * 2 + 1] = sample;
      phase += phaseIncrement;
    }
    if (hardware.writeAudio(samples.data(),
            frameCount * kOutputChannels * sizeof(samples[0])) != ESP_OK) {
      break;
    }
    writtenFrames += frameCount;
  }
  samples.fill(0);
  hardware.setSpeakerAmplifier(false);
}

}  // namespace nexi
