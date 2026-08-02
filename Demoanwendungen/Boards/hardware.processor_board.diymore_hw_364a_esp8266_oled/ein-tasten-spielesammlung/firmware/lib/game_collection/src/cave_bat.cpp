#include "cave_bat.h"

namespace {
constexpr int16_t BAT_X = 22;
constexpr int16_t BAT_W = 11;
constexpr int16_t BAT_H = 7;
constexpr int16_t GAP_HALF = 13;
constexpr int16_t OBSTACLE_W = 9;

void drawBat(U8G2 &display, int16_t x, int16_t y) {
  display.drawDisc(x + 5, y + 3, 2);
  display.drawTriangle(x + 4, y + 3, x, y, x + 1, y + 6);
  display.drawTriangle(x + 6, y + 3, x + 10, y, x + 9, y + 6);
  display.drawPixel(x + 4, y + 2);
  display.drawPixel(x + 6, y + 2);
}

void drawCaveEdge(U8G2 &display) {
  display.drawHLine(0, 0, 128);
  display.drawHLine(0, 63, 128);
  for (int16_t x = 0; x < 128; x += 16) {
    display.drawTriangle(x, 0, x + 5, 0, x + 2, 5);
    display.drawTriangle(x + 8, 63, x + 13, 63, x + 10, 58);
  }
}
}

void CaveBatGame::reset() {
  batY_ = 31.0f;
  velocityY_ = 0.0f;
  obstacleX_ = 132.0f;
  gapCenter_ = 32;
  score_ = 0;
  scoredObstacle_ = false;
}

bool CaveBatGame::update(bool buttonHeld, uint32_t elapsedMs) {
  const float frameScale = elapsedMs / 33.0f;
  velocityY_ += (buttonHeld ? -0.34f : 0.27f) * frameScale;
  velocityY_ = constrain(velocityY_, -3.2f, 3.2f);
  batY_ += velocityY_ * frameScale;
  obstacleX_ -= (2.0f + min<uint16_t>(score_, 18) * 0.055f) * frameScale;
  if (!scoredObstacle_ && obstacleX_ + OBSTACLE_W < BAT_X) {
    ++score_;
    scoredObstacle_ = true;
  }
  if (obstacleX_ < -OBSTACLE_W) {
    obstacleX_ = 132.0f;
    gapCenter_ = 21 + static_cast<int16_t>((score_ * 19U + 7U) % 23U);
    scoredObstacle_ = false;
  }
  if (batY_ <= 5.0f || batY_ + BAT_H >= 59.0f) return false;
  const int16_t obstacleX = static_cast<int16_t>(obstacleX_);
  const bool horizontalHit = BAT_X + BAT_W > obstacleX && BAT_X < obstacleX + OBSTACLE_W;
  const bool outsideGap = batY_ < gapCenter_ - GAP_HALF || batY_ + BAT_H > gapCenter_ + GAP_HALF;
  return !(horizontalHit && outsideGap);
}

void CaveBatGame::draw(U8G2 &display) const {
  char scoreText[12] = {};
  snprintf(scoreText, sizeof(scoreText), "%u", score_);
  const int16_t x = static_cast<int16_t>(obstacleX_);
  const int16_t topHeight = gapCenter_ - GAP_HALF;
  const int16_t bottomY = gapCenter_ + GAP_HALF;
  display.clearBuffer();
  drawCaveEdge(display);
  if (x < 128 && x + OBSTACLE_W > 0) {
    display.drawBox(x, 0, OBSTACLE_W, max<int16_t>(0, topHeight));
    display.drawTriangle(x - 3, topHeight - 1, x + OBSTACLE_W + 2, topHeight - 1, x + OBSTACLE_W / 2, topHeight + 5);
    display.drawBox(x, bottomY, OBSTACLE_W, 64 - bottomY);
    display.drawTriangle(x - 3, bottomY, x + OBSTACLE_W + 2, bottomY, x + OBSTACLE_W / 2, bottomY - 5);
  }
  drawBat(display, BAT_X, static_cast<int16_t>(batY_));
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(2, 9, "CAVE BAT");
  display.drawStr(114, 9, scoreText);
  display.sendBuffer();
}
