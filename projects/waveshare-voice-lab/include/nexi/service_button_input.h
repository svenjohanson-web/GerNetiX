#pragma once

#include <cstdint>

#include "nexi/input_provider.h"

namespace nexi {

// Optional service/recovery input for the reference board. Normal Nexi use is
// intentionally independent from buttons; a future voice provider emits the
// same intents through InputProvider.
class ServiceButtonInput final : public InputProvider {
 public:
  ServiceButtonInput();
  bool poll(Intent *intent) override;

 private:
  struct ButtonState {
    bool sampled;
    bool stable;
    uint8_t stableChecks;
    uint16_t heldChecks;
  };

  enum class Edge : uint8_t { None, Pressed, Released };

  static Edge update(ButtonState *state, bool sampled);

  ButtonState record_;
  ButtonState effect_;
  ButtonState volume_;
};

}  // namespace nexi
