#pragma once

#include "board_adapter.h"

class SoundDriver;

class PacMaze {
 public:
  void reset(SoundDriver& sound);
  void touch(const TouchPoint& point);
  void tick();
  void render(BoardAdapter& board) const;

 private:
  static constexpr uint8_t rows = 15;
  static constexpr uint8_t columns = 19;

  struct Ghost {
    int8_t x;
    int8_t y;
    int8_t homeX;
    int8_t homeY;
    int8_t direction;
    uint16_t color;
  };

  bool isWall(int x, int y) const;
  bool move(int8_t& x, int8_t& y, int direction) const;
  void resetPositions();
  void collideWithGhosts();

  SoundDriver* sound_ = nullptr;
  bool pellets_[rows][columns]{};
  bool powerPellets_[rows][columns]{};
  Ghost ghosts_[4]{{7, 6, 7, 6, 1, BoardAdapter::red},
                   {8, 6, 8, 6, 0, BoardAdapter::brandAccent},
                   {9, 6, 9, 6, 1, BoardAdapter::green},
                   {11, 7, 11, 7, 0, BoardAdapter::yellow}};
  int8_t pacX_ = 7;
  int8_t pacY_ = 7;
  int8_t currentDirection_ = 0;
  int8_t wantedDirection_ = 0;
  uint16_t score_ = 0;
  uint8_t lives_ = 3;
  uint8_t pacFrames_ = 0;
  uint8_t ghostFrames_ = 0;
  uint8_t powerFrames_ = 0;
  uint8_t spawnProtectionFrames_ = 0;
  bool running_ = true;
  bool won_ = false;
};
