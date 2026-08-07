#pragma once

#include <cstdint>

#include "nexi/audio_frame_source.h"

namespace nexi {

struct WakeWordDetection {
  bool detected;
  uint8_t confidence;

  static WakeWordDetection noMatch() { return {false, 0}; }
  static WakeWordDetection match(uint8_t confidence) {
    return {true, confidence};
  }
};

// A detector is local and synchronous. Implementations may keep model state,
// but never own, persist or transmit the source frame.
class WakeWordDetector {
 public:
  virtual ~WakeWordDetector() = default;
  virtual WakeWordDetection process(const AudioFrame& frame) = 0;
};

}  // namespace nexi
