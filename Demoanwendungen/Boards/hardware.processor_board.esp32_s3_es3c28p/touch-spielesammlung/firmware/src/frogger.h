#pragma once
#include "board_adapter.h"

class SoundDriver;

class Frogger {
 public:
  void reset(SoundDriver& sound);
  void touch(const TouchPoint& point);
  void tick();
 void render(BoardAdapter& board) const;
 private:
  void resetRound();
  void loseLife();
  int frogX_ = 4;
  int frogY_ = 8;
  float frogPixelX_ = 110.0f;
  float cars_[3]{};
  float logs_[3]{};
  int score_ = 0;
  int lives_ = 3;
  int level_ = 1;
  bool running_ = true;
  SoundDriver* sound_ = nullptr;
};
