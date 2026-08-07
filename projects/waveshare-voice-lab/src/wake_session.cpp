#include "nexi/wake_session.h"

namespace nexi {

WakeSession::WakeSession(uint32_t commandWindowMs, WakeSessionFeedback* feedback)
    : commandWindowMs_(commandWindowMs),
      openedAtMs_(0),
      state_(WakeSessionState::Idle),
      feedback_(feedback) {}

WakeSessionEvent WakeSession::handle(const Intent& intent, uint32_t nowMs) {
  if (intent.type == IntentType::WakeDetected) {
    if (state_ != WakeSessionState::Idle) return WakeSessionEvent::None;
    openedAtMs_ = nowMs;
    state_ = WakeSessionState::ListeningForCommand;
    if (feedback_ != nullptr) feedback_->onWakeSessionOpened();
    return WakeSessionEvent::Opened;
  }

  if (intent.type == IntentType::Cancel &&
      state_ == WakeSessionState::ListeningForCommand) {
    return close(WakeSessionCloseReason::Cancelled);
  }
  return WakeSessionEvent::None;
}

WakeSessionEvent WakeSession::tick(uint32_t nowMs) {
  if (state_ != WakeSessionState::ListeningForCommand) {
    return WakeSessionEvent::None;
  }
  if (static_cast<uint32_t>(nowMs - openedAtMs_) < commandWindowMs_) {
    return WakeSessionEvent::None;
  }
  return close(WakeSessionCloseReason::Timeout);
}

WakeSessionState WakeSession::state() const { return state_; }

bool WakeSession::isListeningForCommand() const {
  return state_ == WakeSessionState::ListeningForCommand;
}

WakeSessionEvent WakeSession::close(WakeSessionCloseReason reason) {
  state_ = WakeSessionState::Idle;
  if (feedback_ != nullptr) feedback_->onWakeSessionClosed(reason);
  return reason == WakeSessionCloseReason::Timeout
      ? WakeSessionEvent::ClosedByTimeout
      : WakeSessionEvent::ClosedByCancel;
}

}  // namespace nexi
