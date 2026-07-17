#pragma once

#include "board_adapter.h"

class SoundDriver;

class CatJump {
 public:
  void reset(SoundDriver& sound);
  void touch(const TouchPoint& point);
  void tick();
  void render(BoardAdapter& board) const;

 private:
  static constexpr int groundY = 272;
  static constexpr int catX = 30;
  static constexpr int catWidth = 30;
  static constexpr int catHeight = 22;
  static constexpr int dogWidth = 32;
  static constexpr int dogHeight = 22;

  SoundDriver* sound_ = nullptr;
  float catY_ = groundY - catHeight;
  float dogX_ = BoardAdapter::width + 30.0f;
  uint16_t score_ = 0;
  uint8_t clearedDogs_ = 0;
  uint8_t jumpFrame_ = 0;
  uint8_t scoreFrames_ = 0;
  bool jumping_ = false;
  bool running_ = true;
  bool won_ = false;
};
