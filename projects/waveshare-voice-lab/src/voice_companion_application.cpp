#include "nexi/voice_companion_application.h"

namespace nexi {

VoiceCompanionApplication::VoiceCompanionApplication(
    const CapabilityPolicy& policy, CompanionStateStore& store,
    CompanionFeedback& feedback)
    : policy_(policy),
      store_(store),
      feedback_(feedback),
      state_(CompanionStateCodec::defaultState()),
      saveTicksRemaining_(0),
      running_(false),
      dirty_(false) {}

ApplicationId VoiceCompanionApplication::id() const {
  return ApplicationId::VoiceCompanion;
}

bool VoiceCompanionApplication::start(const Intent&) {
  if (!policy_.allows(Capability::VoiceCompanion) ||
      !policy_.allows(Capability::PersistentMemory)) {
    return false;
  }
  state_ = CompanionStateCodec::defaultState();
  const CompanionStateLoadResult result = store_.load(&state_);
  if (result == CompanionStateLoadResult::Invalid ||
      result == CompanionStateLoadResult::Error) {
    state_ = CompanionStateCodec::defaultState();
  }
  running_ = true;
  dirty_ = result == CompanionStateLoadResult::Migrated;
  saveTicksRemaining_ = dirty_ ? kSaveDelayTicks : 0;
  feedback_.companionStarted(state_, result);
  feedback_.showState(state_, mood());
  return true;
}

void VoiceCompanionApplication::stop(ApplicationStopReason) {
  if (!running_) return;
  if (dirty_) storeNow();
  running_ = false;
  feedback_.companionStopped();
}

void VoiceCompanionApplication::handleIntent(const Intent& intent) {
  if (!running_ || (intent.source != IntentSource::ServiceButton &&
      intent.source != IntentSource::Test)) {
    return;
  }
  if (intent.type == IntentType::ToggleMute) {
    reset();
    return;
  }
  CompanionAction action = CompanionAction::Feed;
  if (actionForIntent(intent, &action)) applyAction(action);
}

void VoiceCompanionApplication::tick() {
  if (!running_ || !dirty_) return;
  if (saveTicksRemaining_ > 0) {
    --saveTicksRemaining_;
    return;
  }
  storeNow();
}

bool VoiceCompanionApplication::running() const { return running_; }
bool VoiceCompanionApplication::dirty() const { return dirty_; }
const CompanionState& VoiceCompanionApplication::state() const { return state_; }

CompanionMood VoiceCompanionApplication::mood() const {
  if (state_.energy <= 25) return CompanionMood::Tired;
  if (state_.joy <= 25) return CompanionMood::Lonely;
  if (state_.trust >= 70 && state_.joy >= 60) return CompanionMood::Happy;
  return CompanionMood::Curious;
}

uint8_t VoiceCompanionApplication::boundedAdd(uint8_t value, int change) {
  const int changed = static_cast<int>(value) + change;
  return static_cast<uint8_t>(changed < 0 ? 0 : changed > 100 ? 100 : changed);
}

bool VoiceCompanionApplication::actionForIntent(
    const Intent& intent, CompanionAction* action) {
  if (action == nullptr) return false;
  switch (intent.type) {
    case IntentType::Record:
      *action = CompanionAction::Feed;
      return true;
    case IntentType::NextEffect:
      *action = CompanionAction::Play;
      return true;
    case IntentType::AdjustVolume:
      *action = CompanionAction::Rest;
      return true;
    default:
      return false;
  }
}

void VoiceCompanionApplication::applyAction(CompanionAction action) {
  switch (action) {
    case CompanionAction::Feed:
      state_.energy = boundedAdd(state_.energy, 20);
      state_.joy = boundedAdd(state_.joy, 2);
      state_.trust = boundedAdd(state_.trust, 2);
      break;
    case CompanionAction::Play:
      state_.energy = boundedAdd(state_.energy, -8);
      state_.joy = boundedAdd(state_.joy, 18);
      state_.trust = boundedAdd(state_.trust, 3);
      break;
    case CompanionAction::Rest:
      state_.energy = boundedAdd(state_.energy, 15);
      state_.joy = boundedAdd(state_.joy, -2);
      state_.trust = boundedAdd(state_.trust, 1);
      break;
  }
  if (state_.interactions != UINT32_MAX) ++state_.interactions;
  scheduleStore();
  feedback_.showAction(action, state_, mood());
}

void VoiceCompanionApplication::reset() {
  const bool erased = store_.erase();
  state_ = CompanionStateCodec::defaultState();
  dirty_ = !erased;
  saveTicksRemaining_ = dirty_ ? kSaveDelayTicks : 0;
  feedback_.companionReset(erased, state_);
  feedback_.showState(state_, mood());
}

void VoiceCompanionApplication::scheduleStore() {
  dirty_ = true;
  saveTicksRemaining_ = kSaveDelayTicks;
}

void VoiceCompanionApplication::storeNow() {
  const bool saved = store_.save(state_);
  dirty_ = false;
  saveTicksRemaining_ = 0;
  feedback_.stateStored(saved);
}

}  // namespace nexi
