#include "nexi/personal_wake_word_detector.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

namespace nexi {
constexpr size_t PersonalWakeWordDetector::kRequiredReferenceCount;

namespace {
constexpr std::array<float, 5> kAnalysisFrequencies{{
    250.0f, 500.0f, 1000.0f, 2000.0f, 3000.0f}};
constexpr uint8_t kProfileMagic[] = {'N', 'X', 'V', 'P'};
constexpr uint8_t kProfileFormatVersion = 1;

float clamp(float value, float minimum, float maximum) {
  return std::max(minimum, std::min(maximum, value));
}

uint32_t phraseHash(const char* phrase) {
  uint32_t hash = 2166136261u;
  if (phrase == nullptr) return hash;
  while (*phrase != '\0') {
    hash ^= static_cast<uint8_t>(*phrase++);
    hash *= 16777619u;
  }
  return hash;
}

uint32_t checksum(const uint8_t* data, size_t size) {
  uint32_t value = 2166136261u;
  for (size_t index = 0; index < size; ++index) {
    value ^= data[index];
    value *= 16777619u;
  }
  return value;
}

void writeU16(uint8_t** cursor, uint16_t value) {
  *(*cursor)++ = static_cast<uint8_t>(value & 0xffu);
  *(*cursor)++ = static_cast<uint8_t>(value >> 8u);
}

void writeU32(uint8_t** cursor, uint32_t value) {
  for (unsigned shift = 0; shift < 32; shift += 8) {
    *(*cursor)++ = static_cast<uint8_t>((value >> shift) & 0xffu);
  }
}

uint16_t readU16(const uint8_t** cursor) {
  const uint16_t value = static_cast<uint16_t>((*cursor)[0]) |
      static_cast<uint16_t>((*cursor)[1] << 8u);
  *cursor += 2;
  return value;
}

uint32_t readU32(const uint8_t** cursor) {
  uint32_t value = 0;
  for (unsigned shift = 0; shift < 32; shift += 8) {
    value |= static_cast<uint32_t>(*(*cursor)++) << shift;
  }
  return value;
}
}  // namespace

PersonalWakeWordDetector::PersonalWakeWordDetector(
    const char* phrase, size_t requiredReferenceCount)
    : phrase_(phrase == nullptr ? "" : phrase),
      requiredReferenceCount_(std::max<size_t>(1,
          std::min(requiredReferenceCount, kRequiredReferenceCount))) {}

bool PersonalWakeWordDetector::beginCalibrationSample() {
  if (referenceCount_ >= requiredReferenceCount_) return false;
  resetCandidate();
  calibrating_ = true;
  return true;
}

bool PersonalWakeWordDetector::captureCalibrationFrame(
    const AudioFrame& frame) {
  if (!calibrating_ || frame.samples == nullptr ||
      frame.sampleCount != kWakeAudioFrameSamples ||
      candidate_.count >= kMaximumFrames) {
    return false;
  }
  candidate_.frames[candidate_.count++] = extractFeature(frame);
  return true;
}

WakeCalibrationResult PersonalWakeWordDetector::finishCalibrationSample() {
  calibrating_ = false;
  const bool accepted = normalizeAndTrim(&candidate_);
  const size_t activeFrames = accepted ? candidate_.count : 0;
  if (accepted && referenceCount_ < requiredReferenceCount_) {
    references_[referenceCount_] = candidate_;
    ++referenceCount_;
    if (ready()) {
      threshold_ = calibrationThreshold();
      std::array<size_t, kRequiredReferenceCount> lengths{};
      for (size_t index = 0; index < requiredReferenceCount_; ++index) {
        lengths[index] = references_[index].count;
      }
      std::sort(lengths.begin(), lengths.begin() + requiredReferenceCount_);
      expectedFrameCount_ = lengths[requiredReferenceCount_ / 2];
    }
  }
  resetCandidate();
  return {accepted, referenceCount_, activeFrames};
}

void PersonalWakeWordDetector::resetCalibration() {
  for (auto& reference : references_) reference.count = 0;
  referenceCount_ = 0;
  threshold_ = 0.18f;
  lastDistance_ = 0.0f;
  expectedFrameCount_ = 0;
  lastCandidateFrameCount_ = 0;
  lastDurationAccepted_ = false;
  calibrating_ = false;
  resetCandidate();
}

size_t PersonalWakeWordDetector::serializedProfileSize() const {
  if (!ready()) return 0;
  size_t size = 4 + 4 + 4 + 4;
  for (size_t index = 0; index < referenceCount_; ++index) {
    size += 2 + references_[index].count * kFeatureCount * 2;
  }
  return size;
}

bool PersonalWakeWordDetector::exportProfile(
    uint8_t* destination, size_t capacity, size_t* written) const {
  if (written != nullptr) *written = 0;
  const size_t required = serializedProfileSize();
  if (required == 0 || destination == nullptr || capacity < required) {
    return false;
  }
  uint8_t* cursor = destination;
  std::memcpy(cursor, kProfileMagic, sizeof(kProfileMagic));
  cursor += sizeof(kProfileMagic);
  *cursor++ = kProfileFormatVersion;
  *cursor++ = static_cast<uint8_t>(kFeatureCount);
  *cursor++ = static_cast<uint8_t>(requiredReferenceCount_);
  *cursor++ = static_cast<uint8_t>(referenceCount_);
  writeU32(&cursor, phraseHash(phrase_));
  for (size_t referenceIndex = 0;
       referenceIndex < referenceCount_; ++referenceIndex) {
    const FeatureSequence& reference = references_[referenceIndex];
    writeU16(&cursor, static_cast<uint16_t>(reference.count));
    for (size_t frameIndex = 0; frameIndex < reference.count; ++frameIndex) {
      for (size_t featureIndex = 0; featureIndex < kFeatureCount;
           ++featureIndex) {
        const float normalized = clamp(
            reference.frames[frameIndex].values[featureIndex], 0.0f, 1.0f);
        writeU16(&cursor, static_cast<uint16_t>(normalized * 65535.0f + 0.5f));
      }
    }
  }
  const size_t payloadSize = static_cast<size_t>(cursor - destination);
  writeU32(&cursor, checksum(destination, payloadSize));
  if (written != nullptr) *written = static_cast<size_t>(cursor - destination);
  return static_cast<size_t>(cursor - destination) == required;
}

bool PersonalWakeWordDetector::importProfile(
    const uint8_t* source, size_t size) {
  constexpr size_t kMinimumProfileBytes = 4 + 4 + 4 + 2 + 4;
  if (source == nullptr || size < kMinimumProfileBytes ||
      size > kMaximumSerializedProfileBytes ||
      std::memcmp(source, kProfileMagic, sizeof(kProfileMagic)) != 0) {
    return false;
  }
  const uint8_t* cursor = source + sizeof(kProfileMagic);
  const uint8_t version = *cursor++;
  const uint8_t featureCount = *cursor++;
  const uint8_t requiredCount = *cursor++;
  const uint8_t storedCount = *cursor++;
  const uint32_t storedPhraseHash = readU32(&cursor);
  if (version != kProfileFormatVersion || featureCount != kFeatureCount ||
      requiredCount != requiredReferenceCount_ ||
      storedCount != requiredReferenceCount_ ||
      storedPhraseHash != phraseHash(phrase_)) {
    return false;
  }

  std::array<uint16_t, kRequiredReferenceCount> lengths{};
  const uint8_t* validationCursor = cursor;
  const uint8_t* checksumPosition = source + size - 4;
  for (size_t referenceIndex = 0; referenceIndex < storedCount;
       ++referenceIndex) {
    if (validationCursor + 2 > checksumPosition) return false;
    lengths[referenceIndex] = readU16(&validationCursor);
    if (lengths[referenceIndex] < kMinimumActiveFrames ||
        lengths[referenceIndex] > kMaximumFrames) {
      return false;
    }
    const size_t featureBytes =
        static_cast<size_t>(lengths[referenceIndex]) * kFeatureCount * 2;
    if (featureBytes > static_cast<size_t>(checksumPosition - validationCursor)) {
      return false;
    }
    validationCursor += featureBytes;
  }
  if (validationCursor != checksumPosition) return false;
  const uint8_t* storedChecksumCursor = checksumPosition;
  if (readU32(&storedChecksumCursor) !=
      checksum(source, static_cast<size_t>(checksumPosition - source))) {
    return false;
  }

  resetCalibration();
  for (size_t referenceIndex = 0; referenceIndex < storedCount;
       ++referenceIndex) {
    FeatureSequence& reference = references_[referenceIndex];
    reference.count = readU16(&cursor);
    for (size_t frameIndex = 0; frameIndex < reference.count; ++frameIndex) {
      for (size_t featureIndex = 0; featureIndex < kFeatureCount;
           ++featureIndex) {
        reference.frames[frameIndex].values[featureIndex] =
            static_cast<float>(readU16(&cursor)) / 65535.0f;
      }
    }
  }
  referenceCount_ = storedCount;
  threshold_ = calibrationThreshold();
  std::sort(lengths.begin(), lengths.begin() + requiredReferenceCount_);
  expectedFrameCount_ = lengths[requiredReferenceCount_ / 2];
  return ready();
}

bool PersonalWakeWordDetector::ready() const {
  return referenceCount_ == requiredReferenceCount_;
}

size_t PersonalWakeWordDetector::referenceCount() const {
  return referenceCount_;
}

size_t PersonalWakeWordDetector::requiredReferenceCount() const {
  return requiredReferenceCount_;
}

float PersonalWakeWordDetector::threshold() const { return threshold_; }

float PersonalWakeWordDetector::lastDistance() const { return lastDistance_; }

uint32_t PersonalWakeWordDetector::evaluationCount() const {
  return evaluationCount_;
}

size_t PersonalWakeWordDetector::expectedFrameCount() const {
  return expectedFrameCount_;
}

size_t PersonalWakeWordDetector::lastCandidateFrameCount() const {
  return lastCandidateFrameCount_;
}

bool PersonalWakeWordDetector::lastDurationAccepted() const {
  return lastDurationAccepted_;
}

const char* PersonalWakeWordDetector::wakeWord() const { return phrase_; }

PersonalWakeWordDetector::FeatureFrame
PersonalWakeWordDetector::extractFeature(const AudioFrame& frame) const {
  FeatureFrame feature{};
  double squareSum = 0.0;
  size_t zeroCrossings = 0;
  for (size_t index = 0; index < frame.sampleCount; ++index) {
    const float sample = static_cast<float>(frame.samples[index]);
    squareSum += sample * sample;
    if (index > 0 && ((frame.samples[index] >= 0) !=
        (frame.samples[index - 1] >= 0))) {
      ++zeroCrossings;
    }
  }
  feature.values[0] = static_cast<float>(
      std::sqrt(squareSum / static_cast<double>(frame.sampleCount)));
  feature.values[1] = clamp(
      3.0f * static_cast<float>(zeroCrossings) /
          static_cast<float>(frame.sampleCount),
      0.0f, 1.0f);

  std::array<float, kAnalysisFrequencies.size()> powers{};
  float totalPower = 1.0e-12f;
  for (size_t frequencyIndex = 0;
       frequencyIndex < kAnalysisFrequencies.size(); ++frequencyIndex) {
    constexpr float kPi = 3.14159265358979323846f;
    const float omega = 2.0f * kPi * kAnalysisFrequencies[frequencyIndex] /
        static_cast<float>(kWakeAudioSampleRateHz);
    const float coefficient = 2.0f * std::cos(omega);
    float previous = 0.0f;
    float previousPrevious = 0.0f;
    for (size_t sampleIndex = 0; sampleIndex < frame.sampleCount; ++sampleIndex) {
      const float current = static_cast<float>(frame.samples[sampleIndex]) +
          coefficient * previous - previousPrevious;
      previousPrevious = previous;
      previous = current;
    }
    const float power = std::max(0.0f,
        previousPrevious * previousPrevious + previous * previous -
        coefficient * previous * previousPrevious);
    powers[frequencyIndex] = power;
    totalPower += power;
  }
  for (size_t frequencyIndex = 0;
       frequencyIndex < kAnalysisFrequencies.size(); ++frequencyIndex) {
    feature.values[frequencyIndex + 2] =
        std::sqrt(powers[frequencyIndex] / totalPower);
  }
  return feature;
}

bool PersonalWakeWordDetector::normalizeAndTrim(
    FeatureSequence* sequence) const {
  if (sequence == nullptr || sequence->count < kMinimumActiveFrames) return false;
  float maximumRms = 0.0f;
  for (size_t index = 0; index < sequence->count; ++index) {
    maximumRms = std::max(maximumRms, sequence->frames[index].values[0]);
  }
  if (maximumRms < 180.0f) return false;

  const float activeThreshold = std::max(180.0f, maximumRms * 0.16f);
  size_t first = 0;
  while (first < sequence->count &&
      sequence->frames[first].values[0] < activeThreshold) {
    ++first;
  }
  size_t last = sequence->count;
  while (last > first &&
      sequence->frames[last - 1].values[0] < activeThreshold) {
    --last;
  }
  if (last - first < kMinimumActiveFrames) return false;
  first = first > 2 ? first - 2 : 0;
  last = std::min(sequence->count, last + 2);
  const size_t trimmedCount = last - first;
  for (size_t index = 0; index < trimmedCount; ++index) {
    sequence->frames[index] = sequence->frames[first + index];
    sequence->frames[index].values[0] = clamp(
        sequence->frames[index].values[0] / maximumRms, 0.0f, 1.0f);
  }
  sequence->count = trimmedCount;
  return true;
}

float PersonalWakeWordDetector::frameDistance(
    const FeatureFrame& left, const FeatureFrame& right) const {
  float sum = 0.0f;
  for (size_t index = 0; index < kFeatureCount; ++index) {
    const float difference = left.values[index] - right.values[index];
    sum += difference * difference;
  }
  return std::sqrt(sum / static_cast<float>(kFeatureCount));
}

float PersonalWakeWordDetector::dtwDistance(
    const FeatureSequence& left, const FeatureSequence& right) {
  const float infinity = std::numeric_limits<float>::infinity();
  std::fill(dtwPrevious_.begin(), dtwPrevious_.end(), infinity);
  dtwPrevious_[0] = 0.0f;
  for (size_t leftIndex = 1; leftIndex <= left.count; ++leftIndex) {
    std::fill(dtwCurrent_.begin(), dtwCurrent_.end(), infinity);
    for (size_t rightIndex = 1; rightIndex <= right.count; ++rightIndex) {
      const float cost = frameDistance(
          left.frames[leftIndex - 1], right.frames[rightIndex - 1]);
      dtwCurrent_[rightIndex] = cost + std::min(
          dtwPrevious_[rightIndex], std::min(
              dtwCurrent_[rightIndex - 1], dtwPrevious_[rightIndex - 1]));
    }
    dtwPrevious_.swap(dtwCurrent_);
  }
  return dtwPrevious_[right.count] /
      static_cast<float>(left.count + right.count);
}

float PersonalWakeWordDetector::calibrationThreshold() {
  std::array<float, 3> distances{};
  size_t distanceCount = 0;
  for (size_t left = 0; left < referenceCount_; ++left) {
    for (size_t right = left + 1; right < referenceCount_; ++right) {
      distances[distanceCount++] =
          dtwDistance(references_[left], references_[right]);
    }
  }
  std::sort(distances.begin(), distances.begin() + distanceCount);
  // The three references are exemplars (normal, quick, normal), not three
  // votes for one average pronunciation. The closest reference pair defines
  // a deliberately narrow personal tolerance; the quick exemplar can then be
  // matched directly without reopening the broad false-positive threshold.
  const float closestReferenceDistance = distanceCount == 0
      ? 0.06f : distances[0];
  return clamp(closestReferenceDistance * 1.18f + 0.008f, 0.065f, 0.105f);
}

WakeWordDetection PersonalWakeWordDetector::evaluateCandidate() {
  if (!ready() || !normalizeAndTrim(&candidate_)) {
    resetCandidate();
    return WakeWordDetection::noMatch();
  }
  ++evaluationCount_;
  lastCandidateFrameCount_ = candidate_.count;
  const size_t minimumFrames = expectedFrameCount_ * 65 / 100;
  const size_t maximumFrames = expectedFrameCount_ * 135 / 100;
  lastDurationAccepted_ = candidate_.count >= minimumFrames &&
      candidate_.count <= maximumFrames;
  if (!lastDurationAccepted_) {
    lastDistance_ = 1.0f;
    resetCandidate();
    return WakeWordDetection::noMatch();
  }
  std::array<float, kRequiredReferenceCount> distances{};
  for (size_t index = 0; index < referenceCount_; ++index) {
    distances[index] = dtwDistance(references_[index], candidate_);
  }
  std::sort(distances.begin(), distances.begin() + referenceCount_);
  // A close match to one deliberately recorded speaking style is sufficient.
  // Requiring two references would reject the intentionally quick exemplar.
  lastDistance_ = distances[0];
  const bool detected = lastDistance_ <= threshold_;
  const float ratio = threshold_ > 0.0f ? lastDistance_ / threshold_ : 2.0f;
  const uint8_t confidence = static_cast<uint8_t>(clamp(
      100.0f - ratio * 50.0f, detected ? 50.0f : 0.0f, 100.0f));
  resetCandidate();
  return detected ? WakeWordDetection::match(confidence)
                  : WakeWordDetection::noMatch();
}

WakeWordDetection PersonalWakeWordDetector::process(const AudioFrame& frame) {
  if (!ready() || calibrating_ || frame.samples == nullptr ||
      frame.sampleCount != kWakeAudioFrameSamples) {
    return WakeWordDetection::noMatch();
  }
  const FeatureFrame feature = extractFeature(frame);
  const float rms = feature.values[0];
  if (ambientFrames_ < kAmbientWarmupFrames) {
    noiseRms_ = clamp(noiseRms_ * 0.95f + rms * 0.05f, 40.0f, 2000.0f);
    ++ambientFrames_;
    return WakeWordDetection::noMatch();
  }
  const float startThreshold = std::max(250.0f, noiseRms_ * 2.8f);

  if (!speechActive_) {
    noiseRms_ = clamp(noiseRms_ * 0.995f + rms * 0.005f, 40.0f, 2000.0f);
    if (rms < startThreshold) return WakeWordDetection::noMatch();
    speechActive_ = true;
    silenceFrames_ = 0;
  }

  if (candidate_.count < kMaximumFrames) {
    candidate_.frames[candidate_.count++] = feature;
  }
  const float silenceThreshold = std::max(180.0f, noiseRms_ * 1.8f);
  silenceFrames_ = rms < silenceThreshold ? silenceFrames_ + 1 : 0;
  if (silenceFrames_ >= kSilenceFramesToFinish ||
      candidate_.count >= kMaximumFrames) {
    speechActive_ = false;
    silenceFrames_ = 0;
    return evaluateCandidate();
  }
  return WakeWordDetection::noMatch();
}

void PersonalWakeWordDetector::resetCandidate() {
  candidate_.count = 0;
  silenceFrames_ = 0;
  speechActive_ = false;
}

}  // namespace nexi
