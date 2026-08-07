#pragma once

#include <cstddef>
#include <cstdint>

#include "nexi/application.h"
#include "nexi/capability_policy.h"
#include "nexi/local_quiz_feedback.h"
#include "nexi/local_quiz_pack.h"

namespace nexi {

class LocalQuizApplication final : public Application {
 public:
  LocalQuizApplication(const CapabilityPolicy& policy,
      const LocalQuizCatalog& catalog, LocalQuizFeedback& feedback);

  ApplicationId id() const override;
  bool start(const Intent& trigger) override;
  void stop(ApplicationStopReason reason) override;
  void handleIntent(const Intent& intent) override;
  void tick() override;

  bool running() const;
  bool completed() const;
  size_t currentItemIndex() const;
  size_t selectedPackIndex() const;
  uint16_t correctAnswers() const;

 private:
  enum class State : uint8_t {
    SelectingPack,
    AwaitingAnswer,
    ShowingAnswer,
    Completed,
  };

  static bool answerForIntent(const Intent& intent, QuizAnswer* answer);
  static bool acceptsServiceInput(const Intent& intent);
  void showSelectedPack();
  void startSelectedPack();
  void presentCurrentItem();
  void finishCurrentItem(bool correct, QuizAnswer answer);

  static constexpr uint16_t kAnswerTimeoutTicks = 125;
  static constexpr uint16_t kResultTicks = 20;

  const CapabilityPolicy& policy_;
  const LocalQuizCatalog& catalog_;
  LocalQuizFeedback& feedback_;
  State state_;
  size_t selectedPackIndex_;
  size_t itemIndex_;
  uint16_t correctAnswers_;
  uint16_t ticksRemaining_;
  bool running_;
};

}  // namespace nexi
