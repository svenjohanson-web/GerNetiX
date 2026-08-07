#pragma once

#include <cstdint>

#include "nexi/wake_session.h"
#include "nexi/wake_word_input_provider.h"

namespace nexi {

// Small hardware-free composition for the complete first wake slice. A later
// board adapter only has to supply AudioFrameSource and WakeWordDetector.
class WakeWordPipeline {
 public:
  WakeWordPipeline(AudioFrameSource& source, WakeWordDetector& detector,
      uint32_t commandWindowMs, WakeSessionFeedback* feedback = nullptr);

  WakeSessionEvent tick(uint32_t nowMs);
  WakeSessionEvent handle(const Intent& intent, uint32_t nowMs);
  bool isListeningForCommand() const;

 private:
  WakeWordInputProvider input_;
  WakeSession session_;
};

}  // namespace nexi
