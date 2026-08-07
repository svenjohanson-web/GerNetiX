#pragma once

#include <cstdint>

#include "nexi/voice_types.h"

namespace nexi {

// Hardware-independent meaning of an input. Drivers translate buttons, touch
// or speech into these values; applications never inspect GPIOs or recognizers.
enum class IntentType : uint8_t {
  None,
  WakeDetected,
  SelectApplication,
  StopApplication,
  Record,
  NextEffect,
  PreviousEffect,
  SetEffect,
  AdjustVolume,
  ToggleMute,
  Confirm,
  Reject,
  Cancel,
  Custom,
};

enum class IntentSource : uint8_t {
  Runtime,
  Voice,
  Touch,
  ServiceButton,
  RemoteConfiguration,
  Test,
};

// A deliberately small value type that can cross task or module boundaries
// without allocation. `value` is interpreted only by the selected intent.
struct Intent {
  IntentType type;
  IntentSource source;
  ApplicationId application;
  int32_t value;
  uint8_t confidence;

  static Intent create(IntentType type,
      IntentSource source = IntentSource::Runtime,
      int32_t value = 0,
      uint8_t confidence = 100);
  static Intent selectApplication(ApplicationId application,
      IntentSource source = IntentSource::Runtime,
      uint8_t confidence = 100);
};

}  // namespace nexi
