#include "basissoftware/project_hooks.h"
#include "user/user_app.h"

extern "C" __attribute__((weak)) void userTick() {
}

extern "C" __attribute__((weak)) void onProjectTick() {
  userTick();
}
