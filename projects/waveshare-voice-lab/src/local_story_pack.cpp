#include "nexi/local_story_pack.h"

#include <cstring>

#include "nexi/local_story_audio_assets.h"

namespace nexi {
namespace {

bool hasText(const char* value) {
  return value != nullptr && value[0] != '\0';
}

uint32_t durationSeconds(const LocalStory& story) {
  return static_cast<uint32_t>(
      (story.sampleCount + story.sampleRateHz - 1) / story.sampleRateHz);
}

}  // namespace

bool LocalStoryPackValidator::valid(const LocalStoryPack& pack) {
  if (!hasText(pack.id) || pack.version == 0 || pack.stories == nullptr ||
      pack.storyCount == 0 || pack.storyCount > kMaximumStories) {
    return false;
  }
  for (size_t index = 0; index < pack.storyCount; ++index) {
    const LocalStory& story = pack.stories[index];
    if (!hasText(story.id) || !hasText(story.title) ||
        story.pcm8Samples == nullptr || story.sampleCount == 0 ||
        story.sampleRateHz == 0 ||
        durationSeconds(story) > kMaximumStorySeconds) {
      return false;
    }
    for (size_t previous = 0; previous < index; ++previous) {
      if (std::strcmp(pack.stories[previous].id, story.id) == 0) return false;
    }
  }
  return true;
}

bool LocalStoryCatalogValidator::valid(const LocalStoryCatalog& catalog) {
  if (catalog.packs == nullptr || catalog.packCount == 0 ||
      catalog.packCount > kMaximumPacks) {
    return false;
  }
  size_t totalStories = 0;
  uint32_t totalSeconds = 0;
  for (size_t index = 0; index < catalog.packCount; ++index) {
    const LocalStoryPack& pack = catalog.packs[index];
    if (!LocalStoryPackValidator::valid(pack)) return false;
    for (size_t previous = 0; previous < index; ++previous) {
      if (std::strcmp(catalog.packs[previous].id, pack.id) == 0) return false;
    }
    totalStories += pack.storyCount;
    for (size_t story = 0; story < pack.storyCount; ++story) {
      totalSeconds += durationSeconds(pack.stories[story]);
    }
  }
  return totalStories <= kMaximumTotalStories &&
      totalSeconds <= kMaximumTotalSeconds;
}

const LocalStoryCatalog& builtInLocalStoryCatalog() {
  const LocalStoryAudioAssets& audio = builtInLocalStoryAudioAssets();
  static const LocalStory kWonderStories[] = {
      {"lumi-und-der-stern", "Lumi und der leise Stern",
          audio.lumiUndDerStern.pcm8Samples,
          audio.lumiUndDerStern.sampleCount, kLocalStorySampleRateHz},
      {"milo-und-der-regentakt", "Milo und der Regentakt",
          audio.miloUndDerRegentakt.pcm8Samples,
          audio.miloUndDerRegentakt.sampleCount, kLocalStorySampleRateHz},
  };
  static const LocalStory kCalmStories[] = {
      {"die-kleine-wolke", "Die kleine Wolke",
          audio.dieKleineWolke.pcm8Samples,
          audio.dieKleineWolke.sampleCount, kLocalStorySampleRateHz},
  };
  static const LocalStoryPack kPacks[] = {
      {"nexi.stories.wonder.de", 1, kWonderStories, 2},
      {"nexi.stories.calm.de", 1, kCalmStories, 1},
  };
  static const LocalStoryCatalog kCatalog = {kPacks, 2};
  return kCatalog;
}

}  // namespace nexi
