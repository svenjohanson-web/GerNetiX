#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

#include "nexi/wake_word_detector.h"

namespace nexi {

struct WakeCalibrationResult {
  bool accepted;
  size_t referenceCount;
  size_t activeFrames;
};

// Speaker-dependent, fully local phrase detector. It intentionally retains
// compact acoustic features rather than PCM recordings and never uses the
// network. Versioned feature profiles can be exported to a device-local store.
class PersonalWakeWordDetector final : public WakeWordDetector {
 public:
  static constexpr size_t kRequiredReferenceCount = 3;
  static constexpr size_t kMaximumSerializedProfileBytes =
      4 + 4 + 4 + kRequiredReferenceCount * (2 + 240 * 7 * 2) + 4;

  explicit PersonalWakeWordDetector(
      const char* phrase = "Hey Nexi",
      size_t requiredReferenceCount = kRequiredReferenceCount);

  bool beginCalibrationSample();
  bool captureCalibrationFrame(const AudioFrame& frame);
  WakeCalibrationResult finishCalibrationSample();
  void resetCalibration();
  size_t serializedProfileSize() const;
  bool exportProfile(
      uint8_t* destination, size_t capacity, size_t* written) const;
  bool importProfile(const uint8_t* source, size_t size);

  bool ready() const;
  size_t referenceCount() const;
  size_t requiredReferenceCount() const;
  float threshold() const;
  float lastDistance() const;
  uint32_t evaluationCount() const;
  size_t expectedFrameCount() const;
  size_t lastCandidateFrameCount() const;
  bool lastDurationAccepted() const;
  const char* wakeWord() const;

  WakeWordDetection process(const AudioFrame& frame) override;

 private:
  static constexpr size_t kFeatureCount = 7;
  static constexpr size_t kMaximumFrames = 240;
  static constexpr size_t kMinimumActiveFrames = 12;
  static constexpr size_t kSilenceFramesToFinish = 30;
  static constexpr size_t kAmbientWarmupFrames = 50;

  struct FeatureFrame {
    std::array<float, kFeatureCount> values{};
  };

  struct FeatureSequence {
    std::array<FeatureFrame, kMaximumFrames> frames{};
    size_t count = 0;
  };

  FeatureFrame extractFeature(const AudioFrame& frame) const;
  bool normalizeAndTrim(FeatureSequence* sequence) const;
  float frameDistance(const FeatureFrame& left, const FeatureFrame& right) const;
  float dtwDistance(const FeatureSequence& left,
      const FeatureSequence& right);
  float calibrationThreshold();
  WakeWordDetection evaluateCandidate();
  void resetCandidate();

  std::array<FeatureSequence, kRequiredReferenceCount> references_{};
  FeatureSequence candidate_{};
  std::array<float, kMaximumFrames + 1> dtwPrevious_{};
  std::array<float, kMaximumFrames + 1> dtwCurrent_{};
  size_t referenceCount_ = 0;
  const char* phrase_ = "Hey Nexi";
  size_t requiredReferenceCount_ = kRequiredReferenceCount;
  size_t silenceFrames_ = 0;
  size_t ambientFrames_ = 0;
  float noiseRms_ = 120.0f;
  float threshold_ = 0.18f;
  float lastDistance_ = 0.0f;
  uint32_t evaluationCount_ = 0;
  size_t expectedFrameCount_ = 0;
  size_t lastCandidateFrameCount_ = 0;
  bool lastDurationAccepted_ = false;
  bool calibrating_ = false;
  bool speechActive_ = false;
};

}  // namespace nexi
