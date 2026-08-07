#pragma once

#include "nexi/local_story_feedback.h"

namespace nexi {

class WaveshareStoryFeedback final : public LocalStoryFeedback {
 public:
  void showStorySelection(const LocalStoryPack& pack,
      const LocalStory& story, size_t storyNumber, size_t storyCount) override;
  void storyStarted(const LocalStoryPack& pack,
      const LocalStory& story) override;
  bool playStory(const LocalStory& story) override;
  void storyFinished(const LocalStory& story, bool played) override;
  void storyStopped() override;
};

}  // namespace nexi
