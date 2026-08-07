#include "basissoftware/project_hooks.h"
#include "user/user_app.h"

extern "C" __attribute__((weak)) void userMain() {
}

extern "C" __attribute__((weak)) void onProjectInit() {
  userMain();
}

extern "C" __attribute__((weak)) const char *projectRootPageHtml() {
  return nullptr;
}

extern "C" __attribute__((weak)) bool writeProjectStatusJson(char *target, std::size_t targetSize) {
  if (target != nullptr && targetSize > 0) target[0] = '\0';
  return false;
}

extern "C" __attribute__((weak)) bool projectSerialProvisioningEnabled() {
  return false;
}

extern "C" __attribute__((weak)) bool handleProjectSerialCommand(
    const char *, const char *, char *event, std::size_t eventSize,
    char *payload, std::size_t payloadSize) {
  if (event != nullptr && eventSize > 0) event[0] = '\0';
  if (payload != nullptr && payloadSize > 0) payload[0] = '\0';
  return false;
}
