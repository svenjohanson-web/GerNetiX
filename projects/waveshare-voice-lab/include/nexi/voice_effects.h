#pragma once

#include <cstddef>
#include <cstdint>

#include "nexi/voice_types.h"

namespace nexi {

constexpr uint32_t AUDIO_SAMPLE_RATE = 16000;
constexpr size_t AUDIO_INPUT_CHANNELS = 4;

const char *effectName(VoiceEffect effect);
RecordingLevel analyzeRecordingLevel(const int16_t *recording, size_t recordedFrames);
size_t effectOutputFrames(VoiceEffect effect, size_t recordedFrames);
int32_t effectSample(const int16_t *recording, size_t recordedFrames,
    size_t outputFrame, const RecordingLevel &level, VoiceEffect effect);

}  // namespace nexi
