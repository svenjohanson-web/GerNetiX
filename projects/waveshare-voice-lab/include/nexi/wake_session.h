#pragma once

#include <cstdint>

#include "nexi/intent.h"

namespace nexi {

enum class WakeSessionState : uint8_t {
  Idle,
  ListeningForCommand,
};

enum class WakeSessionCloseReason : uint8_t {
  Timeout,
  Cancelled,
};

enum class WakeSessionEvent : uint8_t {
  None,
  Opened,
  ClosedByTimeout,
  ClosedByCancel,
};

// Runtime adapters map these callbacks to LEDs or tones. Tests can record the
// same calls without depending on GPIOs or an audio codec.
class WakeSessionFeedback {
 public:
  virtual ~WakeSessionFeedback() = default;
  virtual void onWakeSessionOpened() = 0;
  virtual void onWakeSessionClosed(WakeSessionCloseReason reason) = 0;
};

class WakeSession {
 public:
  explicit WakeSession(
      uint32_t commandWindowMs, WakeSessionFeedback* feedback = nullptr);

  WakeSessionEvent handle(const Intent& intent, uint32_t nowMs);
  WakeSessionEvent tick(uint32_t nowMs);
  WakeSessionState state() const;
  bool isListeningForCommand() const;

 private:
  WakeSessionEvent close(WakeSessionCloseReason reason);

  uint32_t commandWindowMs_;
  uint32_t openedAtMs_;
  WakeSessionState state_;
  WakeSessionFeedback* feedback_;
};

}  // namespace nexi
