#include "nexi/wake_word_input_provider.h"

namespace nexi {

WakeWordInputProvider::WakeWordInputProvider(
    AudioFrameSource& source, WakeWordDetector& detector)
    : source_(source), detector_(detector), detectionLatched_(false) {}

bool WakeWordInputProvider::poll(Intent* intent) {
  if (intent == nullptr) return false;

  AudioFrame frame{nullptr, 0, 0};
  if (!source_.read(&frame) || frame.samples == nullptr ||
      frame.sampleCount == 0) {
    return false;
  }

  const WakeWordDetection detection = detector_.process(frame);
  if (!detection.detected) {
    detectionLatched_ = false;
    return false;
  }
  if (detectionLatched_) return false;

  detectionLatched_ = true;
  *intent = Intent::create(
      IntentType::WakeDetected, IntentSource::Voice, 0, detection.confidence);
  return true;
}

}  // namespace nexi
