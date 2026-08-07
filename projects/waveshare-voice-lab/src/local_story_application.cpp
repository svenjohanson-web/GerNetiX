#include "nexi/local_story_application.h"

namespace nexi {

LocalStoryApplication::LocalStoryApplication(const CapabilityPolicy& policy,
    const LocalStoryCatalog& catalog, LocalStoryFeedback& feedback)
    : policy_(policy),
      catalog_(catalog),
      feedback_(feedback),
      running_(false),
      selectedStoryIndex_(0),
      totalStoryCount_(0) {}

ApplicationId LocalStoryApplication::id() const {
  return ApplicationId::LocalStories;
}

bool LocalStoryApplication::start(const Intent&) {
  if (!policy_.allows(Capability::LocalStories) ||
      !LocalStoryCatalogValidator::valid(catalog_)) {
    return false;
  }
  totalStoryCount_ = 0;
  for (size_t index = 0; index < catalog_.packCount; ++index) {
    totalStoryCount_ += catalog_.packs[index].storyCount;
  }
  selectedStoryIndex_ = 0;
  running_ = totalStoryCount_ != 0;
  if (running_) showSelection();
  return running_;
}

void LocalStoryApplication::stop(ApplicationStopReason) {
  if (!running_) return;
  running_ = false;
  feedback_.storyStopped();
}

void LocalStoryApplication::handleIntent(const Intent& intent) {
  if (!running_ || intent.source != IntentSource::ServiceButton) return;
  switch (intent.type) {
    case IntentType::NextEffect:
      moveSelection(-1);
      break;
    case IntentType::AdjustVolume:
      moveSelection(1);
      break;
    case IntentType::Record:
      playSelection();
      break;
    default:
      break;
  }
}

void LocalStoryApplication::tick() {}

bool LocalStoryApplication::running() const { return running_; }

size_t LocalStoryApplication::selectedStoryIndex() const {
  return selectedStoryIndex_;
}

size_t LocalStoryApplication::totalStoryCount() const {
  return totalStoryCount_;
}

bool LocalStoryApplication::locateStory(size_t flatIndex,
    const LocalStoryPack** pack, const LocalStory** story) const {
  if (pack == nullptr || story == nullptr) return false;
  size_t offset = flatIndex;
  for (size_t index = 0; index < catalog_.packCount; ++index) {
    const LocalStoryPack& candidate = catalog_.packs[index];
    if (offset < candidate.storyCount) {
      *pack = &candidate;
      *story = &candidate.stories[offset];
      return true;
    }
    offset -= candidate.storyCount;
  }
  return false;
}

void LocalStoryApplication::moveSelection(int direction) {
  if (totalStoryCount_ == 0) return;
  if (direction < 0) {
    selectedStoryIndex_ = selectedStoryIndex_ == 0
        ? totalStoryCount_ - 1 : selectedStoryIndex_ - 1;
  } else {
    selectedStoryIndex_ = (selectedStoryIndex_ + 1) % totalStoryCount_;
  }
  showSelection();
}

void LocalStoryApplication::showSelection() {
  const LocalStoryPack* pack = nullptr;
  const LocalStory* story = nullptr;
  if (locateStory(selectedStoryIndex_, &pack, &story)) {
    feedback_.showStorySelection(
        *pack, *story, selectedStoryIndex_ + 1, totalStoryCount_);
  }
}

void LocalStoryApplication::playSelection() {
  const LocalStoryPack* pack = nullptr;
  const LocalStory* story = nullptr;
  if (!locateStory(selectedStoryIndex_, &pack, &story)) return;
  feedback_.storyStarted(*pack, *story);
  const bool played = feedback_.playStory(*story);
  feedback_.storyFinished(*story, played);
  if (running_) showSelection();
}

}  // namespace nexi
