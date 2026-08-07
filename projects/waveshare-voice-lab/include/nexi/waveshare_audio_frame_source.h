#pragma once

#include <array>
#include <cstdint>

#include "nexi/audio_frame_source.h"

namespace nexi {

// Reads one 10 ms ES7210 frame and converts the codec's left-aligned 32-bit
// stereo samples to the mono PCM16 contract used by local recognizers. The
// frame remains in volatile memory and is overwritten by the next read.
class WaveshareAudioFrameSource final : public AudioFrameSource {
 public:
  bool read(AudioFrame* frame) override;

 private:
  static constexpr size_t kCodecChannels = 2;
  std::array<int32_t, kWakeAudioFrameSamples * kCodecChannels> codecSamples_{};
  std::array<int16_t, kWakeAudioFrameSamples> monoSamples_{};
  uint64_t sequence_ = 0;
};

}  // namespace nexi
