#include "nexi/wake_word_pipeline.h"

namespace nexi {

WakeWordPipeline::WakeWordPipeline(AudioFrameSource& source,
    WakeWordDetector& detector, uint32_t commandWindowMs,
    WakeSessionFeedback* feedback)
    : input_(source, detector), session_(commandWindowMs, feedback) {}

WakeSessionEvent WakeWordPipeline::tick(uint32_t nowMs) {
  Intent intent = Intent::create(IntentType::None);
  if (input_.poll(&intent)) return session_.handle(intent, nowMs);
  return session_.tick(nowMs);
}

WakeSessionEvent WakeWordPipeline::handle(
    const Intent& intent, uint32_t nowMs) {
  return session_.handle(intent, nowMs);
}

bool WakeWordPipeline::isListeningForCommand() const {
  return session_.isListeningForCommand();
}

}  // namespace nexi
