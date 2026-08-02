#include "basissoftware/feedback.h"

namespace {
constexpr const char *TAG = "provisioningProject";
}

extern "C" void userMain() {
  feedbackInfo(TAG, "Provisioning background project started");
}

extern "C" void userTick() {
}
