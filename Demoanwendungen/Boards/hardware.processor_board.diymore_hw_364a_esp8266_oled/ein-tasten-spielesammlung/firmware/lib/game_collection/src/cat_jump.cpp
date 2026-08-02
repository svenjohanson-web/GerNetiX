#include "cat_jump.h"

namespace {
constexpr int16_t CAT_X = 17;
constexpr int16_t CAT_W = 11;
constexpr int16_t CAT_H = 10;
constexpr int16_t GROUND_Y = 60;

bool overlaps(int16_t ax, int16_t ay, int16_t aw, int16_t ah,
              int16_t bx, int16_t by, int16_t bw, int16_t bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

void drawCat(U8G2 &display, int16_t x, int16_t y) {
  display.drawBox(x + 2, y + 3, 8, 6);
  display.drawPixel(x + 2, y + 1);
  display.drawPixel(x + 3, y + 2);
  display.drawPixel(x + 8, y + 2);
  display.drawPixel(x + 9, y + 1);
  display.drawPixel(x + 4, y + 5);
  display.drawPixel(x + 8, y + 5);
  display.drawLine(x + 1, y + 9, x + 1, y + 11);
  display.drawLine(x + 9, y + 9, x + 9, y + 11);
  display.drawPixel(x + 10, y + 7);
  display.drawPixel(x + 11, y + 6);
}

void drawDog(U8G2 &display, int16_t x) {
  const int16_t y = 48;
  display.drawFrame(x, y + 4, 12, 8);
  display.drawBox(x + 8, y, 7, 7);
  display.drawTriangle(x + 9, y, x + 12, y - 4, x + 13, y);
  display.drawPixel(x + 13, y + 2);
  display.drawLine(x + 2, y + 12, x + 2, y + 14);
  display.drawLine(x + 10, y + 12, x + 10, y + 14);
  display.drawLine(x, y + 5, x - 3, y + 2);
}
}

void CatJumpGame::reset() {
  catY_ = 49.0f;
  velocityY_ = 0.0f;
  dogX_ = 128.0f;
  speed_ = 2.1f;
  score_ = 0;
  grounded_ = true;
}

bool CatJumpGame::update(bool jumpPressed, uint32_t elapsedMs) {
  const float frameScale = elapsedMs / 33.0f;
  if (jumpPressed && grounded_) {
    velocityY_ = -5.8f;
    grounded_ = false;
  }
  velocityY_ += 0.42f * frameScale;
  catY_ += velocityY_ * frameScale;
  if (catY_ >= 49.0f) {
    catY_ = 49.0f;
    velocityY_ = 0.0f;
    grounded_ = true;
  }
  dogX_ -= speed_ * frameScale;
  if (dogX_ < -18.0f) {
    dogX_ = 128.0f + static_cast<float>((score_ * 17U) % 24U);
    ++score_;
    speed_ = min(4.0f, 2.1f + score_ * 0.09f);
  }
  return !overlaps(CAT_X + 1, static_cast<int16_t>(catY_) + 1, CAT_W - 2, CAT_H,
                   static_cast<int16_t>(dogX_), 48, 15, 12);
}

void CatJumpGame::draw(U8G2 &display) const {
  char scoreText[12] = {};
  snprintf(scoreText, sizeof(scoreText), "%u", score_);
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(1, 7, "CAT JUMP");
  display.drawStr(111, 7, scoreText);
  display.drawHLine(0, GROUND_Y, 128);
  for (int x = 0; x < 128; x += 16) display.drawPixel(x, 63);
  drawCat(display, CAT_X, static_cast<int16_t>(catY_));
  drawDog(display, static_cast<int16_t>(dogX_));
  display.sendBuffer();
}
