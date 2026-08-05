#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

enum class VoiceEffect : uint8_t {
  Normal,
  Robot,
  Monster,
  Helium,
  Echo,
  Count,
};

enum class UserAction : uint8_t {
  Record,
  EffectChanged,
  VolumeChanged,
  ModeMenu,
};

enum class OperatingMode : uint8_t {
  VoiceStudio,
  AiStory,
  Count,
};

enum class ApplicationId : uint8_t {
  VoiceStudio,
  AiStory,
  Oracle,
  LearningCompanion,
  VoiceCompanion,
  Count,
};

struct VolumeState {
  size_t levelIndex;
  bool muted;
};

struct RecordingLevel {
  int32_t mic1Peak;
  int32_t mic2Peak;
  size_t selectedWord;
  int32_t digitalGain;
};

}  // namespace nexi
