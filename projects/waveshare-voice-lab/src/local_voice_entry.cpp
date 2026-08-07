#include "nexi/local_voice_entry.h"

namespace nexi {

LocalVoiceEntry::LocalVoiceEntry() : bindings_{}, bindingCount_(0) {}

bool LocalVoiceEntry::registerSentence(
    WakeWordDetector* detector, const Intent& intent) {
  if (detector == nullptr || intent.type == IntentType::None ||
      bindingCount_ >= kMaximumSentences) {
    return false;
  }
  for (size_t index = 0; index < bindingCount_; ++index) {
    if (bindings_[index].detector == detector) return false;
  }
  bindings_[bindingCount_++] = {detector, intent};
  return true;
}

bool LocalVoiceEntry::process(const AudioFrame& frame, Intent* intent) {
  if (intent == nullptr) return false;
  bool matched = false;
  for (size_t index = 0; index < bindingCount_; ++index) {
    const WakeWordDetection detection = bindings_[index].detector->process(frame);
    if (!matched && detection.detected) {
      *intent = bindings_[index].intent;
      intent->source = IntentSource::Voice;
      intent->confidence = detection.confidence;
      matched = true;
    }
  }
  return matched;
}

size_t LocalVoiceEntry::sentenceCount() const { return bindingCount_; }

}  // namespace nexi
