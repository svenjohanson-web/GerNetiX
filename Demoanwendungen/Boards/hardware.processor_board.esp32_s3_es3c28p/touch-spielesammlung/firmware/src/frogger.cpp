#include "frogger.h"

#include <cstdio>

namespace {
constexpr int cell = 20;
constexpr int gridX = 30;
constexpr int gridY = 54;
constexpr int cols = 9;
constexpr int rows = 9;
constexpr int boardWidth = cols * cell;
constexpr float carSpeed[] = {1.2f, -1.5f, 1.0f};
constexpr float logSpeed[] = {-0.75f, 0.95f, -1.1f};

float wrap(float value, float limit) { while (value > limit) value -= limit + 44; while (value < -44) value += limit + 44; return value; }
void controls(BoardAdapter& b) {
  b.rectangle(92, 240, 56, 28, BoardAdapter::blue); b.text("^", 114, 244, BoardAdapter::white, 3);
  b.rectangle(30, 276, 56, 32, BoardAdapter::blue); b.text("<", 48, 280, BoardAdapter::white, 3);
  b.rectangle(92, 276, 56, 32, BoardAdapter::blue); b.text("v", 112, 280, BoardAdapter::white, 3);
  b.rectangle(154, 276, 56, 32, BoardAdapter::blue); b.text(">", 172, 280, BoardAdapter::white, 3);
}
bool fullyInsideBoard(int x, int width) { return x >= gridX && x + width <= gridX + boardWidth; }
}

void Frogger::resetRound() { frogX_ = 4; frogY_ = 8; frogPixelX_ = gridX + frogX_ * cell; }
void Frogger::reset() {
  score_ = 0; lives_ = 3; level_ = 1; running_ = true;
  cars_[0] = 10; cars_[1] = 92; cars_[2] = 164;
  logs_[0] = 0; logs_[1] = 72; logs_[2] = 144;
  resetRound();
}
void Frogger::loseLife() { if (--lives_ <= 0) running_ = false; else resetRound(); }

void Frogger::touch(const TouchPoint& point) {
  if (!running_) { reset(); return; }
  if (point.y >= 270 && point.x < 90 && frogX_ > 0) --frogX_;
  else if (point.y >= 270 && point.x > 150 && frogX_ < cols - 1) ++frogX_;
  else if (point.y < 270 && point.x >= 80 && point.x <= 160 && frogY_ > 0) --frogY_;
  else if (point.y >= 270 && point.x >= 80 && point.x <= 160 && frogY_ < rows - 1) ++frogY_;
  frogPixelX_ = gridX + frogX_ * cell;
  if (frogY_ == 0) { score_ += 100; ++level_; resetRound(); }
}

void Frogger::tick() {
  if (!running_) return;
  const float multiplier = 1.0f + (level_ - 1) * 0.08f;
  for (int lane = 0; lane < 3; ++lane) { cars_[lane] = wrap(cars_[lane] + carSpeed[lane] * multiplier, boardWidth); logs_[lane] = wrap(logs_[lane] + logSpeed[lane] * multiplier, boardWidth); }
  if (frogY_ >= 1 && frogY_ <= 3) {
    const int lane = frogY_ - 1; bool onLog = false;
    for (int copy = 0; copy < 2; ++copy) { const float x = gridX + wrap(logs_[lane] + copy * 104, boardWidth); if (frogPixelX_ + 16 > x && frogPixelX_ < x + 62) onLog = true; }
    if (!onLog) { loseLife(); return; }
    frogPixelX_ += logSpeed[lane] * multiplier;
    if (frogPixelX_ < gridX || frogPixelX_ > gridX + (cols - 1) * cell) { loseLife(); return; }
    frogX_ = static_cast<int>((frogPixelX_ - gridX + cell / 2) / cell);
  }
  if (frogY_ >= 5 && frogY_ <= 7) {
    const int lane = frogY_ - 5;
    for (int copy = 0; copy < 2; ++copy) { const float x = gridX + wrap(cars_[lane] + copy * 92, boardWidth); if (frogPixelX_ + 16 > x && frogPixelX_ < x + 34) { loseLife(); return; } }
  }
}

void Frogger::render(BoardAdapter& b) const {
  b.clear(BoardAdapter::black); b.titleBar(BoardAdapter::blue); b.text("FROGGER", 82, 10, BoardAdapter::white, 1);
  char s[8]; snprintf(s, sizeof(s), "Score %d", score_); b.text(s, 10, 34, BoardAdapter::cyan, 1); char l[8]; snprintf(l, sizeof(l), "L %d", lives_); b.text(l, 178, 34, BoardAdapter::red, 1);
  b.rectangle(gridX - 2, gridY - 2, boardWidth + 4, rows * cell + 4, BoardAdapter::white);
  b.rectangle(gridX, gridY, boardWidth, rows * cell, BoardAdapter::green);
  b.rectangle(gridX, gridY + cell, boardWidth, cell * 3, BoardAdapter::blue);
  b.rectangle(gridX, gridY + cell * 5, boardWidth, cell * 3, BoardAdapter::black);
  for (int bay = 0; bay < 5; ++bay) b.roundedRectangle(gridX + bay * 36 + 5, gridY + 3, 18, 14, 5, BoardAdapter::green);
  for (int lane = 0; lane < 3; ++lane) {
    for (int copy = 0; copy < 2; ++copy) {
      int logX = gridX + static_cast<int>(wrap(logs_[lane] + copy * 104, boardWidth));
      if (fullyInsideBoard(logX, 62)) b.roundedRectangle(logX, gridY + (lane + 1) * cell + 3, 62, 14, 6, BoardAdapter::yellow);
      int carX = gridX + static_cast<int>(wrap(cars_[lane] + copy * 92, boardWidth));
      if (fullyInsideBoard(carX, 34)) {
        b.roundedRectangle(carX, gridY + (lane + 5) * cell + 5, 34, 11, 4, lane == 1 ? BoardAdapter::yellow : BoardAdapter::red);
        b.circle(carX + 7, gridY + (lane + 5) * cell + 17, 3, BoardAdapter::black); b.circle(carX + 27, gridY + (lane + 5) * cell + 17, 3, BoardAdapter::black);
      }
    }
  }
  if (running_) { const int x = static_cast<int>(frogPixelX_); const int y = gridY + frogY_ * cell; b.circle(x + 10, y + 10, 8, BoardAdapter::magenta); b.circle(x + 6, y + 6, 2, BoardAdapter::white); b.circle(x + 14, y + 6, 2, BoardAdapter::white); }
  else { b.rectangle(30, 120, 180, 60, BoardAdapter::red); b.text("GAME OVER", 62, 132, BoardAdapter::white, 2); b.text("Pfeil: Neustart", 56, 162, BoardAdapter::white, 1); }
  controls(b); b.present();
}
