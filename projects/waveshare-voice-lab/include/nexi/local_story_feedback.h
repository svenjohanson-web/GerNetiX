#pragma once

#include <cstddef>

#include "nexi/local_story_pack.h"

namespace nexi {

class LocalStoryFeedback {
 public:
  virtual ~LocalStoryFeedback() = default;
  virtual void showStorySelection(const LocalStoryPack& pack,
      const LocalStory& story, size_t storyNumber, size_t storyCount) = 0;
  virtual void storyStarted(const LocalStoryPack& pack,
      const LocalStory& story) = 0;
  virtual bool playStory(const LocalStory& story) = 0;
  virtual void storyFinished(const LocalStory& story, bool played) = 0;
  virtual void storyStopped() = 0;
};

}  // namespace nexi
