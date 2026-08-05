#pragma once

namespace nexi {

// Starts the product runtime exactly once.  Product modules remain below this
// boundary; provisioning, identity, OTA and recovery stay in the basissoftware.
void startRuntime();
void tickRuntime();

}  // namespace nexi
