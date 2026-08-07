#pragma once

#include "nexi/personal_wake_word_detector.h"

namespace nexi {

enum class VoiceProfileLoadResult {
  Loaded,
  Missing,
  Invalid,
  Error,
};

// Device-local NVS adapter for versioned, quantized acoustic features. Raw
// audio never crosses this boundary.
class PersonalVoiceProfileStore final {
 public:
  VoiceProfileLoadResult load(
      const char* key, PersonalWakeWordDetector* detector) const;
  bool save(const char* key, const PersonalWakeWordDetector& detector) const;
  bool erase(const char* key) const;
  bool eraseLegacyDefault(const char* key) const;
  bool eraseAll() const;
};

}  // namespace nexi
