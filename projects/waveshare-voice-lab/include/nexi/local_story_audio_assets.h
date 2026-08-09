#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

constexpr uint16_t kLocalStorySampleRateHz = 8000;

struct LocalStoryAudioAsset {
  const int8_t* pcm8Samples;
  size_t sampleCount;
};

struct LocalStoryAudioAssets {
  LocalStoryAudioAsset lumiUndDerStern;
  LocalStoryAudioAsset miloUndDerRegentakt;
  LocalStoryAudioAsset dieKleineWolke;
};

const LocalStoryAudioAssets& builtInLocalStoryAudioAssets();

}  // namespace nexi
