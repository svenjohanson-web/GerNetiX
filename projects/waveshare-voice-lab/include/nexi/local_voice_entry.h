#pragma once

#include <cstddef>

#include "nexi/intent.h"
#include "nexi/wake_word_detector.h"

namespace nexi {

// Hardware-independent local sentence route. Each detector represents one
// complete utterance beginning with the activation phrase, for example
// "Hey Nexi, starte das Stimmenstudio". This avoids an artificial pause
// between activation phrase and command. No audio is retained here.
class LocalVoiceEntry final {
 public:
  static constexpr size_t kMaximumSentences = 8;

  LocalVoiceEntry();
  bool registerSentence(WakeWordDetector* detector, const Intent& intent);

  bool process(const AudioFrame& frame, Intent* intent);
  size_t sentenceCount() const;

 private:
  struct Binding {
    WakeWordDetector* detector;
    Intent intent;
  };

  Binding bindings_[kMaximumSentences];
  size_t bindingCount_;
};

}  // namespace nexi
