#include "user/user_app.h"

#include "basissoftware/project_hooks.h"

extern "C" void userMain() {
}

extern "C" void userTick() {
}

extern "C" __attribute__((weak)) void onProjectInit() {
  userMain();
}

extern "C" __attribute__((weak)) void onProjectTick() {
  userTick();
}
