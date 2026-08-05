#pragma once

#include "nexi/intent.h"

namespace nexi {

// Implementations are polled by the runtime and may publish at most one intent
// per poll. They retain ownership of their hardware and internal buffers.
class InputProvider {
 public:
  virtual ~InputProvider() = default;
  virtual bool poll(Intent* intent) = 0;
};

}  // namespace nexi
