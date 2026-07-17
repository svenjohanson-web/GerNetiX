#pragma once

#include "board_adapter.h"

class SoundDriver;

class PipeRunner {
 public:
  void reset(SoundDriver& sound);
  void touch(const TouchPoint& point);
  void tick();
  void render(BoardAdapter& board) const;

 private:
  static constexpr uint8_t nodeCount = 12;

  bool moveForeman(int direction);
  void repairLeakIfPresent();
  void resetRound(bool keepProgress);

  SoundDriver* sound_ = nullptr;
  uint8_t foremanNode_ = 0;
  int8_t plugNode_ = -1;
  int16_t laddermanY_ = 238;
  uint8_t water_ = 48;
  uint8_t lives_ = 3;
  uint8_t pipeLevel_ = 1;
  uint16_t score_ = 0;
  uint8_t tickFrames_ = 0;
  uint8_t leakFrames_ = 0;
  uint8_t intruderFrames_ = 0;
  uint8_t plugSequence_ = 0;
  bool running_ = true;
};
