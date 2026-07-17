#pragma once

#include "board_adapter.h"

class SoundDriver;

class Arkanoid {
 public:
  void reset(SoundDriver& sound);
  void touch(const TouchPoint& point);
  void tick();
  void render(BoardAdapter& board) const;

 private:
  static constexpr int brickRows = 5;
  static constexpr int brickColumns = 8;

  void resetBall();
  void resetBricks();
  void loseLife();
  bool allBricksCleared() const;

  bool bricks_[brickRows][brickColumns]{};
  float ballX_ = 120.0f;
  float ballY_ = 190.0f;
  float ballDx_ = 2.1f;
  float ballDy_ = -2.3f;
  float paddleX_ = 98.0f;
  int score_ = 0;
  int lives_ = 3;
  int level_ = 1;
  bool running_ = true;
  SoundDriver* sound_ = nullptr;
};
