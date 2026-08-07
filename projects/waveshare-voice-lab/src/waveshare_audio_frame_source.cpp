#include "nexi/waveshare_audio_frame_source.h"

#include "nexi/hardware_platform.h"

namespace nexi {

bool WaveshareAudioFrameSource::read(AudioFrame* frame) {
  if (frame == nullptr) return false;
  if (HardwarePlatform::instance().readAudio(
          codecSamples_.data(), codecSamples_.size() * sizeof(int32_t)) != ESP_OK) {
    return false;
  }

  for (size_t sample = 0; sample < kWakeAudioFrameSamples; sample++) {
    // ES7210/I2S is configured for left-aligned 32-bit samples. Keep a stable
    // microphone channel across frames; per-frame channel switching would add
    // discontinuities that look like artificial transients to local detectors.
    monoSamples_[sample] = static_cast<int16_t>(
        codecSamples_[sample * kCodecChannels] >> 16);
  }

  *frame = AudioFrame{
      monoSamples_.data(), monoSamples_.size(), sequence_++};
  return true;
}

}  // namespace nexi
