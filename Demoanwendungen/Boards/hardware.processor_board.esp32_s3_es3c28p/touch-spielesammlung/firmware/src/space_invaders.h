#pragma once

#include "board_adapter.h"

class SoundDriver;

class SpaceInvaders {
 public:
  void reset(SoundDriver& sound);
  void touch(const TouchPoint& point);
  void tick();
  void render(BoardAdapter& board) const;

 private:
  static constexpr uint8_t rows = 3;
  static constexpr uint8_t columns = 6;
  static constexpr int invaderWidth = 18;
  static constexpr int invaderHeight = 12;
  static constexpr int shipY = 250;

  SoundDriver* sound_ = nullptr;
  bool invaders_[rows][columns]{};
  int invaderX_ = 22;
  int invaderY_ = 70;
  int direction_ = 1;
  int shipX_ = BoardAdapter::width / 2;
  int shotX_ = -1;
  int shotY_ = -1;
  int score_ = 0;
  uint8_t remaining_ = rows * columns;
  uint8_t moveFrames_ = 0;
  bool shotActive_ = false;
  bool running_ = true;
  bool won_ = false;
};
