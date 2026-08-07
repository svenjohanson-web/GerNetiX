#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

constexpr uint32_t kWakeAudioSampleRateHz = 16000;
constexpr size_t kWakeAudioFrameSamples = 160;

// A non-owning view of one 10 ms mono PCM16 frame. The source keeps ownership
// of the samples until its next read. No audio is persisted by this contract.
struct AudioFrame {
  const int16_t* samples;
  size_t sampleCount;
  uint64_t sequence;
};

class AudioFrameSource {
 public:
  virtual ~AudioFrameSource() = default;
  virtual bool read(AudioFrame* frame) = 0;
};

}  // namespace nexi
