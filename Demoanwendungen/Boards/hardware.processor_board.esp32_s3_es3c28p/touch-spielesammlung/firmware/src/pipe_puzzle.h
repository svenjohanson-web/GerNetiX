#pragma once
#include "board_adapter.h"
class SoundDriver;
class PipePuzzle {
 public:
  void reset(SoundDriver& sound); void touch(const TouchPoint& point); void tick(); void render(BoardAdapter& board) const;
 private:
  static constexpr uint8_t size = 6;
  uint8_t rotate(uint8_t connections) const; bool solvedPath() const;
  SoundDriver* sound_ = nullptr; uint8_t tiles_[size * size]{}; uint16_t moves_ = 0; bool solved_ = false;
};
