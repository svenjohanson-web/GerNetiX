#include "nexi/voice_effects.h"

#include "basissoftware/feedback.h"

namespace nexi {
namespace {
constexpr const char *TAG = "nexiEffects";
constexpr int32_t PLAYBACK_TARGET_PEAK = 22937;
constexpr int32_t MAX_DIGITAL_GAIN = 12;
constexpr size_t ECHO_DELAY_FRAMES = AUDIO_SAMPLE_RATE / 4;

int32_t amplifiedSample(
    const int16_t *recording, size_t frame, const RecordingLevel &level) {
  const size_t input = frame * AUDIO_INPUT_CHANNELS;
  int32_t sample = static_cast<int32_t>(recording[input + level.selectedWord])
      * level.digitalGain;
  if (sample > 32767) sample = 32767;
  if (sample < -32768) sample = -32768;
  return sample;
}
}  // namespace

const char *effectName(VoiceEffect effect) {
  switch (effect) {
    case VoiceEffect::Normal: return "Normal";
    case VoiceEffect::Robot: return "Robot";
    case VoiceEffect::Monster: return "Monster";
    case VoiceEffect::Helium: return "Helium";
    case VoiceEffect::Echo: return "Echo";
    default: return "Unknown";
  }
}

RecordingLevel analyzeRecordingLevel(const int16_t *recording, size_t recordedFrames) {
  RecordingLevel level{0, 0, 1, 1};
  for (size_t frame = 0; frame < recordedFrames; frame++) {
    const size_t input = frame * AUDIO_INPUT_CHANNELS;
    const int32_t mic1 = recording[input + 1];
    const int32_t mic2 = recording[input + 3];
    const int32_t mic1Magnitude = mic1 < 0 ? -mic1 : mic1;
    const int32_t mic2Magnitude = mic2 < 0 ? -mic2 : mic2;
    if (mic1Magnitude > level.mic1Peak) level.mic1Peak = mic1Magnitude;
    if (mic2Magnitude > level.mic2Peak) level.mic2Peak = mic2Magnitude;
  }
  level.selectedWord = level.mic2Peak > level.mic1Peak ? 3 : 1;
  const int32_t selectedPeak = level.selectedWord == 3 ? level.mic2Peak : level.mic1Peak;
  if (selectedPeak > 0 && selectedPeak < PLAYBACK_TARGET_PEAK) {
    level.digitalGain = PLAYBACK_TARGET_PEAK / selectedPeak;
    if (level.digitalGain > MAX_DIGITAL_GAIN) level.digitalGain = MAX_DIGITAL_GAIN;
  }
  feedbackInfo(TAG, "Recording peaks: mic1=%ld mic2=%ld; selected mic%u; playback gain=%ldx",
      static_cast<long>(level.mic1Peak), static_cast<long>(level.mic2Peak),
      level.selectedWord == 1 ? 1U : 2U, static_cast<long>(level.digitalGain));
  return level;
}

size_t effectOutputFrames(VoiceEffect effect, size_t recordedFrames) {
  if (effect == VoiceEffect::Monster) return recordedFrames * 3 / 2;
  if (effect == VoiceEffect::Helium) return recordedFrames / 2;
  return recordedFrames;
}

int32_t effectSample(const int16_t *recording, size_t recordedFrames,
    size_t outputFrame, const RecordingLevel &level, VoiceEffect effect) {
  size_t sourceFrame = outputFrame;
  if (effect == VoiceEffect::Monster) sourceFrame = outputFrame * 2 / 3;
  if (effect == VoiceEffect::Helium) sourceFrame = outputFrame * 2;
  if (sourceFrame >= recordedFrames) sourceFrame = recordedFrames - 1;

  int32_t sample = amplifiedSample(recording, sourceFrame, level);
  if (effect == VoiceEffect::Robot) {
    sample = (sample / 1024) * 1024;
    const size_t halfPeriod = AUDIO_SAMPLE_RATE / 140;
    if (((outputFrame / halfPeriod) & 1U) != 0) sample = -sample;
  } else if (effect == VoiceEffect::Echo && sourceFrame >= ECHO_DELAY_FRAMES) {
    sample += amplifiedSample(recording, sourceFrame - ECHO_DELAY_FRAMES, level) / 2;
  }
  if (sample > 32767) sample = 32767;
  if (sample < -32768) sample = -32768;
  return sample;
}

}  // namespace nexi
