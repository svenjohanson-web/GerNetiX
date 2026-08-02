#pragma once

#include <Arduino.h>
#include <U8g2lib.h>

class CaveBatGame {
 public:
  void reset();
  bool update(bool buttonHeld, uint32_t elapsedMs);
  void draw(U8G2 &display) const;
  uint16_t score() const { return score_; }

 private:
  float batY_ = 31.0f;
  float velocityY_ = 0.0f;
  float obstacleX_ = 132.0f;
  int16_t gapCenter_ = 32;
  uint16_t score_ = 0;
  bool scoredObstacle_ = false;
};
