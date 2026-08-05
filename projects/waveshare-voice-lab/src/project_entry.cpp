#include "basissoftware/feedback.h"
#include "basissoftware/project_hooks.h"
#include "nexi/runtime.h"

namespace {
constexpr const char *TAG = "nexiEntry";
static_assert(GERNETIX_PROJECT_HOOK_API_VERSION == 1,
    "Nexi must be reviewed when the basissoftware project hook changes");
}

extern "C" void onProjectInit() {
  feedbackInfo(TAG, "Nexi project runtime starting through hook API v%d",
      GERNETIX_PROJECT_HOOK_API_VERSION);
  nexi::startRuntime();
}

extern "C" void onProjectTick() {
  nexi::tickRuntime();
}
