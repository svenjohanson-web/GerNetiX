#include "reaction_game.h"

void ReactionGame::reset(uint32_t nowMs) {
  randomSeed(micros());
  phase_ = Phase::Waiting;
  readyAt_ = nowMs + static_cast<uint32_t>(random(1500, 4001));
  startedAt_ = 0;
  reactionMs_ = 0;
}

void ReactionGame::update(bool buttonPressed, uint32_t nowMs) {
  if (phase_ == Phase::Waiting) {
    if (buttonPressed) {
      phase_ = Phase::Result;
      reactionMs_ = 0;
    } else if (nowMs >= readyAt_) {
      phase_ = Phase::Ready;
      startedAt_ = nowMs;
    }
    return;
  }
  if (phase_ == Phase::Ready && buttonPressed) {
    phase_ = Phase::Result;
    reactionMs_ = nowMs - startedAt_;
    return;
  }
  if (phase_ == Phase::Result && buttonPressed) reset(nowMs);
}

void ReactionGame::draw(U8G2 &display) const {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  display.drawStr(1, 10, "REAKTION");
  display.drawHLine(0, 13, 128);
  if (phase_ == Phase::Waiting) {
    display.drawStr(20, 37, "Warte auf GO...");
  } else if (phase_ == Phase::Ready) {
    display.setFont(u8g2_font_logisoso24_tf);
    display.drawStr(39, 47, "GO!");
  } else if (reactionMs_ == 0) {
    display.drawStr(16, 34, "Zu frueh!");
    display.setFont(u8g2_font_5x7_tf);
    display.drawStr(10, 48, "kurz: nochmal");
  } else {
    char result[16] = {};
    snprintf(result, sizeof(result), "%lu ms", static_cast<unsigned long>(reactionMs_));
    display.drawStr(22, 31, "Deine Zeit:");
    display.setFont(u8g2_font_logisoso18_tf);
    display.drawStr(28, 54, result);
  }
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(1, 62, "kurz:neu lang:menue");
  display.sendBuffer();
}
