#pragma once

#include <cstddef>
#include <cstdint>

#include "nexi/wake_word_detector.h"

namespace nexi_test {

// Deterministic host-test implementation. It models a detection for a fixed
// sequence range; it does not pretend to recognize speech.
class ScriptedWakeWordDetector final : public nexi::WakeWordDetector {
 public:
  ScriptedWakeWordDetector(
      uint64_t firstSequence, size_t durationFrames, uint8_t confidence)
      : firstSequence_(firstSequence),
        durationFrames_(durationFrames),
        confidence_(confidence) {}

  nexi::WakeWordDetection process(const nexi::AudioFrame& frame) override {
    const bool inRange = frame.sequence >= firstSequence_ &&
        frame.sequence - firstSequence_ < durationFrames_;
    return inRange ? nexi::WakeWordDetection::match(confidence_)
                   : nexi::WakeWordDetection::noMatch();
  }

 private:
  uint64_t firstSequence_;
  size_t durationFrames_;
  uint8_t confidence_;
};

}  // namespace nexi_test
