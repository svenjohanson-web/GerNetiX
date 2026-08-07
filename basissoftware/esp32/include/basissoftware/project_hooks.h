#pragma once

#include <cstddef>

// Stable ABI boundary between the independently runnable GerNetiX
// basissoftware and exactly one optional project runtime.  Increasing this
// value means that a project package has to be rebuilt against the new hook
// contract.  The weak implementations in src/hooks keep the basissoftware
// fully runnable when no project implementation is linked.
#define GERNETIX_PROJECT_HOOK_API_VERSION 2

extern "C" void onProjectInit();
extern "C" void onProjectTick();
extern "C" const char *projectRootPageHtml();
extern "C" bool writeProjectStatusJson(char *target, std::size_t targetSize);
// Optional local-USB extension. The basissoftware owns framing and transport;
// a project may only handle named actions and return a bounded JSON payload.
extern "C" bool projectSerialProvisioningEnabled();
extern "C" bool handleProjectSerialCommand(
    const char *action, const char *command,
    char *event, std::size_t eventSize,
    char *payload, std::size_t payloadSize);
