#include "basissoftware/project_hooks.h"

extern "C" __attribute__((weak)) void onProjectInit() {
}

extern "C" __attribute__((weak)) const char *projectRootPageHtml() {
  return nullptr;
}

extern "C" __attribute__((weak)) bool writeProjectStatusJson(char *target, std::size_t targetSize) {
  if (target != nullptr && targetSize > 0) target[0] = '\0';
  return false;
}
