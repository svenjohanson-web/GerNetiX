#pragma once

#include <Arduino.h>
#include <U8g2lib.h>

class CatJumpGame {
 public:
  void reset();
  bool update(bool jumpPressed, uint32_t elapsedMs);
  void draw(U8G2 &display) const;
  uint16_t score() const { return score_; }

 private:
  float catY_ = 49.0f;
  float velocityY_ = 0.0f;
  float dogX_ = 128.0f;
  float speed_ = 2.1f;
  uint16_t score_ = 0;
  bool grounded_ = true;
};
