#pragma once

#include "nexi/audio_frame_source.h"
#include "nexi/input_provider.h"
#include "nexi/wake_word_detector.h"

namespace nexi {

class WakeWordInputProvider final : public InputProvider {
 public:
  WakeWordInputProvider(AudioFrameSource& source, WakeWordDetector& detector);

  bool poll(Intent* intent) override;

 private:
  AudioFrameSource& source_;
  WakeWordDetector& detector_;
  bool detectionLatched_;
};

}  // namespace nexi
