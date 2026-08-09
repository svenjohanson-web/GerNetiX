#pragma once

#include <Arduino.h>
#include <U8g2lib.h>

class ReactionGame {
 public:
  void reset(uint32_t nowMs);
  void update(bool buttonPressed, uint32_t nowMs);
  void draw(U8G2 &display) const;

 private:
  enum class Phase : uint8_t { Waiting, Ready, Result };

  Phase phase_ = Phase::Waiting;
  uint32_t readyAt_ = 0;
  uint32_t startedAt_ = 0;
  uint32_t reactionMs_ = 0;
};
