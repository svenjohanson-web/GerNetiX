#include "nexi/local_story_audio_assets.h"

#include <cstdint>

namespace nexi {
namespace {

extern const uint8_t kLumiUndDerSternStart[]
    asm("_binary_lumi_und_der_stern_pcm8_start");
extern const uint8_t kLumiUndDerSternEnd[]
    asm("_binary_lumi_und_der_stern_pcm8_end");
extern const uint8_t kMiloUndDerRegentaktStart[]
    asm("_binary_milo_und_der_regentakt_pcm8_start");
extern const uint8_t kMiloUndDerRegentaktEnd[]
    asm("_binary_milo_und_der_regentakt_pcm8_end");
extern const uint8_t kDieKleineWolkeStart[]
    asm("_binary_die_kleine_wolke_pcm8_start");
extern const uint8_t kDieKleineWolkeEnd[]
    asm("_binary_die_kleine_wolke_pcm8_end");

LocalStoryAudioAsset asset(const uint8_t* begin, const uint8_t* end) {
  return {
      reinterpret_cast<const int8_t*>(begin),
      static_cast<size_t>(reinterpret_cast<uintptr_t>(end) -
          reinterpret_cast<uintptr_t>(begin)),
  };
}

}  // namespace

const LocalStoryAudioAssets& builtInLocalStoryAudioAssets() {
  static const LocalStoryAudioAssets assets = {
      asset(kLumiUndDerSternStart, kLumiUndDerSternEnd),
      asset(kMiloUndDerRegentaktStart, kMiloUndDerRegentaktEnd),
      asset(kDieKleineWolkeStart, kDieKleineWolkeEnd),
  };
  return assets;
}

}  // namespace nexi
