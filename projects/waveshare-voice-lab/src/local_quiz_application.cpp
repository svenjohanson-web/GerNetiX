#include "nexi/local_quiz_application.h"

namespace nexi {

LocalQuizApplication::LocalQuizApplication(const CapabilityPolicy& policy,
    const LocalQuizCatalog& catalog, LocalQuizFeedback& feedback)
    : policy_(policy),
      catalog_(catalog),
      feedback_(feedback),
      state_(State::Completed),
      selectedPackIndex_(0),
      itemIndex_(0),
      correctAnswers_(0),
      ticksRemaining_(0),
      running_(false) {}

ApplicationId LocalQuizApplication::id() const {
  return ApplicationId::LocalQuiz;
}

bool LocalQuizApplication::start(const Intent&) {
  if (!policy_.allows(Capability::LocalQuiz) ||
      !LocalQuizCatalogValidator::valid(catalog_)) {
    return false;
  }
  selectedPackIndex_ = 0;
  itemIndex_ = 0;
  correctAnswers_ = 0;
  running_ = true;
  state_ = State::SelectingPack;
  showSelectedPack();
  return true;
}

void LocalQuizApplication::stop(ApplicationStopReason) {
  if (!running_) return;
  running_ = false;
  ticksRemaining_ = 0;
  feedback_.quizStopped();
}

void LocalQuizApplication::handleIntent(const Intent& intent) {
  if (!running_ || !acceptsServiceInput(intent)) return;
  if (state_ == State::SelectingPack) {
    if (intent.type == IntentType::NextEffect) {
      selectedPackIndex_ = selectedPackIndex_ == 0
          ? catalog_.packCount - 1 : selectedPackIndex_ - 1;
      showSelectedPack();
    } else if (intent.type == IntentType::AdjustVolume) {
      selectedPackIndex_ = (selectedPackIndex_ + 1) % catalog_.packCount;
      showSelectedPack();
    } else if (intent.type == IntentType::Record ||
        intent.type == IntentType::Confirm) {
      startSelectedPack();
    }
    return;
  }
  if (state_ != State::AwaitingAnswer) return;
  QuizAnswer answer = QuizAnswer::Count;
  if (!answerForIntent(intent, &answer)) return;
  const LocalQuizPack& pack = catalog_.packs[selectedPackIndex_];
  finishCurrentItem(answer == pack.items[itemIndex_].correctAnswer, answer);
}

void LocalQuizApplication::tick() {
  if (!running_ || state_ == State::Completed) return;
  if (ticksRemaining_ > 0) {
    --ticksRemaining_;
    return;
  }
  if (state_ == State::AwaitingAnswer) {
    finishCurrentItem(false, QuizAnswer::Count);
    return;
  }

  ++itemIndex_;
  const LocalQuizPack& pack = catalog_.packs[selectedPackIndex_];
  if (itemIndex_ >= pack.itemCount) {
    state_ = State::Completed;
    feedback_.quizCompleted(correctAnswers_, static_cast<uint16_t>(
        catalog_.packs[selectedPackIndex_].itemCount));
    return;
  }
  presentCurrentItem();
}

bool LocalQuizApplication::running() const { return running_; }
bool LocalQuizApplication::completed() const {
  return running_ && state_ == State::Completed;
}
size_t LocalQuizApplication::currentItemIndex() const { return itemIndex_; }
size_t LocalQuizApplication::selectedPackIndex() const {
  return selectedPackIndex_;
}
uint16_t LocalQuizApplication::correctAnswers() const { return correctAnswers_; }

bool LocalQuizApplication::answerForIntent(
    const Intent& intent, QuizAnswer* answer) {
  if (answer == nullptr || !acceptsServiceInput(intent)) return false;
  switch (intent.type) {
    case IntentType::NextEffect:
      *answer = QuizAnswer::Left;
      return true;
    case IntentType::Record:
    case IntentType::Confirm:
      *answer = QuizAnswer::Middle;
      return true;
    case IntentType::AdjustVolume:
      *answer = QuizAnswer::Right;
      return true;
    default:
      return false;
  }
}

bool LocalQuizApplication::acceptsServiceInput(const Intent& intent) {
  return intent.source == IntentSource::ServiceButton ||
      intent.source == IntentSource::Test;
}

void LocalQuizApplication::showSelectedPack() {
  feedback_.showPackSelection(catalog_.packs[selectedPackIndex_],
      selectedPackIndex_ + 1, catalog_.packCount);
}

void LocalQuizApplication::startSelectedPack() {
  const LocalQuizPack& pack = catalog_.packs[selectedPackIndex_];
  itemIndex_ = 0;
  correctAnswers_ = 0;
  feedback_.quizStarted(pack.id, pack.version, pack.itemCount);
  presentCurrentItem();
}

void LocalQuizApplication::presentCurrentItem() {
  const LocalQuizPack& pack = catalog_.packs[selectedPackIndex_];
  state_ = State::AwaitingAnswer;
  ticksRemaining_ = kAnswerTimeoutTicks;
  feedback_.playPrompt(pack.items[itemIndex_], itemIndex_ + 1);
}

void LocalQuizApplication::finishCurrentItem(
    bool correct, QuizAnswer answer) {
  if (correct) ++correctAnswers_;
  state_ = State::ShowingAnswer;
  ticksRemaining_ = kResultTicks;
  feedback_.showAnswer(correct, answer);
}

}  // namespace nexi
