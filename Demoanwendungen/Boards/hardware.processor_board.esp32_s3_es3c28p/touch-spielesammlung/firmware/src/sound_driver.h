#pragma once

#include <stdint.h>

enum class SoundEffect : uint8_t { gameStart, move, collect, hit, brick, paddle, lifeLost, gameOver };

class SoundDriver {
 public:
  struct Note { uint16_t frequency; uint16_t durationMs; };

  void begin();
  void tick();
  void play(SoundEffect effect);
  void setVolumePercent(uint8_t percent);
  uint8_t volumePercent() const { return volumePercent_; }

 private:
  void writeNote(const Note& note);
  bool writeCodecRegister(uint8_t reg, uint8_t value);
  bool ready_ = false;
  uint8_t volumePercent_ = 70;
};
