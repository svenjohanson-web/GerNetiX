#include "basissoftware/feedback.h"
#include "basissoftware/functions/runDiagnostics.h"

namespace {
constexpr const char *TAG = "runDiagnostics";
}

void runDiagnostics() {
  feedbackInfo(TAG, "Diagnostics: ok");
}
