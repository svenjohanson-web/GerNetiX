#include "basissoftware/functions/updateActuators.h"

void updateActuators() {
  // No generic actuator exists.  Project-specific firmware owns actual GPIO
  // outputs through its project hooks; the basissoftware must not toggle a
  // pin whose function is board-dependent.
}
