#pragma once

#include <array>
#include <cstdint>
#include <fstream>

#include "nexi/audio_frame_source.h"

namespace nexi_test {

enum class RecordedWavError : uint8_t {
  None,
  CannotOpen,
  InvalidContainer,
  UnsupportedFormat,
  MissingAudioData,
  TruncatedAudioData,
};

// Host-only adapter for deterministic tests. It streams one fixed-size frame
// at a time and never loads the complete recording into memory.
class RecordedWavFrameSource final : public nexi::AudioFrameSource {
 public:
  explicit RecordedWavFrameSource(const char* path);

  bool read(nexi::AudioFrame* frame) override;
  bool valid() const;
  RecordedWavError error() const;

 private:
  bool parseHeader();
  bool readExact(char* target, std::streamsize size);

  std::ifstream stream_;
  std::array<int16_t, nexi::kWakeAudioFrameSamples> samples_;
  uint32_t dataBytesRemaining_;
  uint64_t sequence_;
  RecordedWavError error_;
};

}  // namespace nexi_test
