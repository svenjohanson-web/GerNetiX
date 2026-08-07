#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {
namespace generated_story_audio {

constexpr uint16_t kSampleRateHz = 8000;

extern const int8_t kStoryAudioLumiUndDerStern[];
extern const size_t kStoryAudioLumiUndDerSternSampleCount;

extern const int8_t kStoryAudioMiloUndDerRegentakt[];
extern const size_t kStoryAudioMiloUndDerRegentaktSampleCount;

extern const int8_t kStoryAudioDieKleineWolke[];
extern const size_t kStoryAudioDieKleineWolkeSampleCount;

}  // namespace generated_story_audio
}  // namespace nexi
