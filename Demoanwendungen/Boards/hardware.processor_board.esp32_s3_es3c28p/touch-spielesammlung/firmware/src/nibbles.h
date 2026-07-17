#pragma once
#include "board_adapter.h"

class Nibbles {
 public:
  void reset();
  void touch(const TouchPoint& point);
  void tick();
  void render(BoardAdapter& board) const;

 private:
  struct Cell { int8_t x; int8_t y; };
  bool isWall(int x, int y) const;
  void placeFood();
  void placeSnakeAtLevelStart();
  Cell body_[400]{};
  Cell food_{14, 9};
  int length_ = 6;
  int growPending_ = 0;
  int score_ = 0;
  int level_ = 1;
  int foodValue_ = 1;
  int dx_ = 1;
  int dy_ = 0;
  bool running_ = true;
};
