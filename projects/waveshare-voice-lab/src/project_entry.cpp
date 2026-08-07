#include "basissoftware/feedback.h"
#include "basissoftware/project_hooks.h"
#include "nexi/runtime.h"

namespace {
constexpr const char *TAG = "nexiEntry";
static_assert(GERNETIX_PROJECT_HOOK_API_VERSION == 2,
    "Nexi must be reviewed when the basissoftware project hook changes");
}

extern "C" bool projectSerialProvisioningEnabled() {
  return true;
}

extern "C" bool handleProjectSerialCommand(
    const char* action, const char*, char* event, std::size_t eventSize,
    char* payload, std::size_t payloadSize) {
  return nexi::handleVoiceSetupCommand(
      action, event, eventSize, payload, payloadSize);
}

extern "C" void onProjectInit() {
  feedbackInfo(TAG, "Nexi project runtime starting through hook API v%d",
      GERNETIX_PROJECT_HOOK_API_VERSION);
  nexi::startRuntime();
}

extern "C" void onProjectTick() {
  nexi::tickRuntime();
}
