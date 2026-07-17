#pragma once
#include "board_adapter.h"
#include "frogger.h"
#include "nibbles.h"

class GameApplication {
 public:
  void begin();
  void tick();
 private:
  enum class Screen { boot, menu, nibbles, frogger };
  void renderMenu();
  void renderBoot(uint32_t elapsedMs);
  BoardAdapter board_;
  Nibbles nibbles_;
  Frogger frogger_;
  Screen screen_ = Screen::boot;
  bool wasPressed_ = false;
  uint32_t lastFrameMs_ = 0;
  uint32_t bootStartMs_ = 0;
};
