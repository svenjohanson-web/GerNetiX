#include "nexi/reaction_game_application.h"

namespace nexi {
namespace {
constexpr uint16_t kMinimumWaitingTicks = 24;
constexpr uint16_t kWaitingJitterTicks = 48;
constexpr uint16_t kReactionTimeoutTicks = 75;
constexpr uint16_t kResultTicks = 20;
}

ReactionGameApplication::ReactionGameApplication(
    const CapabilityPolicy& policy, ReactionGameFeedback& feedback)
    : policy_(policy),
      feedback_(feedback),
      state_(State::Waiting),
      target_(ReactionTarget::Count),
      randomState_(0x4e455849U),
      ticksRemaining_(0),
      successes_(0),
      misses_(0),
      running_(false) {}

ApplicationId ReactionGameApplication::id() const {
  return ApplicationId::ReactionGame;
}

bool ReactionGameApplication::start(const Intent&) {
  if (!policy_.allows(Capability::ReactionGame)) return false;
  successes_ = 0;
  misses_ = 0;
  running_ = true;
  feedback_.gameStarted();
  beginRound();
  return true;
}

void ReactionGameApplication::stop(ApplicationStopReason) {
  if (!running_) return;
  running_ = false;
  target_ = ReactionTarget::Count;
  ticksRemaining_ = 0;
  feedback_.gameStopped();
}

void ReactionGameApplication::handleIntent(const Intent& intent) {
  if (!running_) return;
  ReactionTarget pressed = ReactionTarget::Count;
  if (!targetForIntent(intent, &pressed)) return;

  if (state_ == State::Waiting) {
    finishRound(false, pressed, 0);
    return;
  }
  if (state_ != State::AwaitingReaction) return;

  const uint16_t reactionTicks =
      static_cast<uint16_t>(kReactionTimeoutTicks - ticksRemaining_);
  finishRound(pressed == target_, pressed, reactionTicks);
}

void ReactionGameApplication::tick() {
  if (!running_) return;
  if (ticksRemaining_ > 0) {
    --ticksRemaining_;
    return;
  }

  if (state_ == State::Waiting) {
    target_ = nextTarget();
    state_ = State::AwaitingReaction;
    ticksRemaining_ = kReactionTimeoutTicks;
    feedback_.showTarget(target_);
  } else if (state_ == State::AwaitingReaction) {
    finishRound(false, target_, kReactionTimeoutTicks);
  } else {
    beginRound();
  }
}

bool ReactionGameApplication::running() const { return running_; }
uint16_t ReactionGameApplication::successes() const { return successes_; }
uint16_t ReactionGameApplication::misses() const { return misses_; }
ReactionTarget ReactionGameApplication::currentTarget() const { return target_; }

bool ReactionGameApplication::targetForIntent(
    const Intent& intent, ReactionTarget* target) {
  if (target == nullptr || (intent.source != IntentSource::ServiceButton &&
      intent.source != IntentSource::Test)) {
    return false;
  }
  switch (intent.type) {
    case IntentType::NextEffect:
      *target = ReactionTarget::EffectButton;
      return true;
    case IntentType::Record:
    case IntentType::Confirm:
      *target = ReactionTarget::RecordButton;
      return true;
    case IntentType::AdjustVolume:
      *target = ReactionTarget::VolumeButton;
      return true;
    default:
      return false;
  }
}

uint16_t ReactionGameApplication::nextWaitingTicks() {
  randomState_ = randomState_ * 1664525U + 1013904223U;
  return static_cast<uint16_t>(
      kMinimumWaitingTicks + randomState_ % kWaitingJitterTicks);
}

ReactionTarget ReactionGameApplication::nextTarget() {
  randomState_ = randomState_ * 1664525U + 1013904223U;
  return static_cast<ReactionTarget>(
      randomState_ % static_cast<uint32_t>(ReactionTarget::Count));
}

void ReactionGameApplication::beginRound() {
  state_ = State::Waiting;
  target_ = ReactionTarget::Count;
  ticksRemaining_ = nextWaitingTicks();
  feedback_.showWaiting();
}

void ReactionGameApplication::finishRound(
    bool success, ReactionTarget pressed, uint16_t reactionTicks) {
  if (success) {
    ++successes_;
  } else {
    ++misses_;
  }
  state_ = State::ShowingResult;
  ticksRemaining_ = kResultTicks;
  feedback_.showResult(success, pressed, reactionTicks);
}

}  // namespace nexi
