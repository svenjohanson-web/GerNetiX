#pragma once

#include <cstddef>

#include "nexi/application.h"
#include "nexi/capability_policy.h"
#include "nexi/local_story_feedback.h"
#include "nexi/local_story_pack.h"

namespace nexi {

class LocalStoryApplication final : public Application {
 public:
  LocalStoryApplication(const CapabilityPolicy& policy,
      const LocalStoryCatalog& catalog, LocalStoryFeedback& feedback);

  ApplicationId id() const override;
  bool start(const Intent& trigger) override;
  void stop(ApplicationStopReason reason) override;
  void handleIntent(const Intent& intent) override;
  void tick() override;

  bool running() const;
  size_t selectedStoryIndex() const;
  size_t totalStoryCount() const;

 private:
  bool locateStory(size_t flatIndex, const LocalStoryPack** pack,
      const LocalStory** story) const;
  void moveSelection(int direction);
  void showSelection();
  void playSelection();

  const CapabilityPolicy& policy_;
  const LocalStoryCatalog& catalog_;
  LocalStoryFeedback& feedback_;
  bool running_;
  size_t selectedStoryIndex_;
  size_t totalStoryCount_;
};

}  // namespace nexi
