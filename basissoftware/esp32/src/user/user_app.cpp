#include "user/user_app.h"

#include "basissoftware/project_hooks.h"

extern "C" void userMain() {
}

extern "C" void userTick() {
}

extern "C" void onProjectInit() {
  userMain();
}

extern "C" void onProjectTick() {
  userTick();
}
