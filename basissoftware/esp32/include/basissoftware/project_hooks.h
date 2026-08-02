#pragma once

#include <cstddef>

extern "C" void onProjectInit();
extern "C" void onProjectTick();
extern "C" const char *projectRootPageHtml();
extern "C" bool writeProjectStatusJson(char *target, std::size_t targetSize);
