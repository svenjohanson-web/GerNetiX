#pragma once

#include <cstdint>

#include "nexi/intent.h"

namespace nexi {

enum class ApplicationStopReason : uint8_t {
  UserRequest,
  ApplicationSwitch,
  RuntimeShutdown,
  Fault,
};

// Nexi capabilities are state machines behind this contract. They receive
// semantic intents and must not own provisioning, OTA or account networking.
class Application {
 public:
  virtual ~Application() = default;
  virtual ApplicationId id() const = 0;
  virtual bool start(const Intent& trigger) = 0;
  virtual void stop(ApplicationStopReason reason) = 0;
  virtual void handleIntent(const Intent& intent) = 0;
  virtual void tick() = 0;
};

}  // namespace nexi
