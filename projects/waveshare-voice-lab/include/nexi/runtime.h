#pragma once

#include <cstddef>

namespace nexi {

// Starts the product runtime exactly once.  Product modules remain below this
// boundary; provisioning, identity, OTA and recovery stay in the basissoftware.
void startRuntime();
void tickRuntime();
bool handleVoiceSetupCommand(
    const char* action, char* event, std::size_t eventSize,
    char* payload, std::size_t payloadSize);

}  // namespace nexi
