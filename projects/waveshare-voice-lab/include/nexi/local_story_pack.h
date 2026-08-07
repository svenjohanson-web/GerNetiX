#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

struct LocalStory {
  const char* id;
  const char* title;
  const int8_t* pcm8Samples;
  size_t sampleCount;
  uint16_t sampleRateHz;
};

struct LocalStoryPack {
  const char* id;
  uint16_t version;
  const LocalStory* stories;
  size_t storyCount;
};

class LocalStoryPackValidator {
 public:
  static constexpr size_t kMaximumStories = 4;
  static constexpr uint32_t kMaximumStorySeconds = 45;
  static bool valid(const LocalStoryPack& pack);
};

struct LocalStoryCatalog {
  const LocalStoryPack* packs;
  size_t packCount;
};

class LocalStoryCatalogValidator {
 public:
  static constexpr size_t kMaximumPacks = 4;
  static constexpr size_t kMaximumTotalStories = 12;
  static constexpr uint32_t kMaximumTotalSeconds = 120;
  static bool valid(const LocalStoryCatalog& catalog);
};

const LocalStoryCatalog& builtInLocalStoryCatalog();

}  // namespace nexi
