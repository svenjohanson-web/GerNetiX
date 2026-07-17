#pragma once
#include "arkanoid.h"
#include "board_adapter.h"
#include "cat_jump.h"
#include "frogger.h"
#include "nibbles.h"
#include "pipe_runner.h"
#include "pipe_puzzle.h"
#include "pac_maze.h"
#include "sound_driver.h"
#include "space_invaders.h"

class GameApplication {
 public:
  void begin();
  void tick();
 private:
  enum class Screen { boot, menu, nibbles, frogger, arkanoid, catJump, spaceInvaders, pipeRunner, pacMaze, pipePuzzle };
  void renderMenu();
  void renderBoot(uint32_t elapsedMs);
  BoardAdapter board_;
  Nibbles nibbles_;
  Frogger frogger_;
  Arkanoid arkanoid_;
  CatJump catJump_;
  SpaceInvaders spaceInvaders_;
  PipeRunner pipeRunner_;
  PipePuzzle pipePuzzle_;
  PacMaze pacMaze_;
  SoundDriver sound_;
  Screen screen_ = Screen::boot;
  bool wasPressed_ = false;
  uint32_t lastFrameMs_ = 0;
  uint32_t bootStartMs_ = 0;
  int16_t touchStartX_ = 0;
  int16_t touchStartY_ = 0;
  int16_t lastTouchY_ = 0;
  uint8_t menuPage_ = 0;
};
