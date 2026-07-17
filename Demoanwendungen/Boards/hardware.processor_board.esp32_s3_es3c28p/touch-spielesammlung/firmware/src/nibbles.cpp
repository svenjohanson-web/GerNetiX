#include "nibbles.h"

#include <cstdio>

namespace {
constexpr int columns = 20;
constexpr int rows = 20;
constexpr int cellSize = 10;

void controls(BoardAdapter& board) {
  board.rectangle(92, 240, 56, 28, BoardAdapter::blue); board.text("^", 114, 244, BoardAdapter::white, 3);
  board.rectangle(30, 276, 56, 32, BoardAdapter::blue); board.text("<", 48, 280, BoardAdapter::white, 3);
  board.rectangle(92, 276, 56, 32, BoardAdapter::blue); board.text("v", 112, 280, BoardAdapter::white, 3);
  board.rectangle(154, 276, 56, 32, BoardAdapter::blue); board.text(">", 172, 280, BoardAdapter::white, 3);
}
}

bool Nibbles::isWall(int x, int y) const {
  if (x < 0 || x >= columns || y < 0 || y >= rows) return true;
  switch ((level_ - 1) % 5) {
    case 0: return false;
    case 1: return x == 10 && (y < 6 || y > 13);
    case 2: return y == 10 && (x < 6 || x > 13);
    case 3: return (x == 10 && (y < 7 || y > 12)) || (y == 10 && (x < 7 || x > 12));
    default: return ((x == 4 || x == 15) && y >= 4 && y <= 15) || ((y == 4 || y == 15) && x >= 4 && x <= 15);
  }
}

void Nibbles::placeFood() {
  for (int attempt = 0; attempt < 400; ++attempt) {
    const int x = (food_.x * 7 + food_.y * 3 + attempt * 11 + 5) % columns;
    const int y = (food_.y * 11 + food_.x * 5 + attempt * 7 + 3) % rows;
    bool occupied = isWall(x, y);
    for (int i = 0; i < length_ && !occupied; ++i) occupied = body_[i].x == x && body_[i].y == y;
    if (!occupied) { food_ = {static_cast<int8_t>(x), static_cast<int8_t>(y)}; return; }
  }
}

void Nibbles::placeSnakeAtLevelStart() {
  int startX = 7;
  int startY = 18;
  dx_ = 1;
  dy_ = 0;
  // The level-two vertical wall and level-four cross need a different
  // starting corridor; otherwise the first automatic move is a collision.
  if (level_ == 2) { startY = 10; }
  if (level_ == 4) { startX = 8; startY = 12; dx_ = 0; dy_ = -1; }
  for (int i = 0; i < length_; ++i) {
    body_[i] = {static_cast<int8_t>(startX - i * dx_), static_cast<int8_t>(startY - i * dy_)};
  }
}

void Nibbles::reset() {
  length_ = 6; growPending_ = 0; score_ = 0; level_ = 1; foodValue_ = 1; running_ = true;
  placeSnakeAtLevelStart();
  food_ = {15, 10}; placeFood();
}

void Nibbles::touch(const TouchPoint& point) {
  if (!running_) { reset(); return; }
  if (point.y >= 270 && point.x < 90 && dx_ != 1) { dx_ = -1; dy_ = 0; }
  else if (point.y >= 270 && point.x > 150 && dx_ != -1) { dx_ = 1; dy_ = 0; }
  else if (point.y < 270 && point.x >= 80 && point.x <= 160 && dy_ != 1) { dx_ = 0; dy_ = -1; }
  else if (point.y >= 270 && point.x >= 80 && point.x <= 160 && dy_ != -1) { dx_ = 0; dy_ = 1; }
}

void Nibbles::tick() {
  if (!running_) return;
  Cell next{static_cast<int8_t>(body_[0].x + dx_), static_cast<int8_t>(body_[0].y + dy_)};
  if (isWall(next.x, next.y)) { running_ = false; return; }
  for (int i = 0; i < length_; ++i) if (body_[i].x == next.x && body_[i].y == next.y) { running_ = false; return; }
  const bool ate = next.x == food_.x && next.y == food_.y;
  if (ate) { growPending_ += foodValue_; score_ += foodValue_ * 10; }
  if (growPending_ > 0 && length_ < 400) { ++length_; --growPending_; }
  for (int i = length_ - 1; i > 0; --i) body_[i] = body_[i - 1];
  body_[0] = next;
  if (ate) {
    if (foodValue_ == 9) { level_ = level_ == 10 ? 1 : level_ + 1; foodValue_ = 1; length_ = 6; placeSnakeAtLevelStart(); }
    else ++foodValue_;
    placeFood();
  }
}

void Nibbles::render(BoardAdapter& board) const {
  board.clear(BoardAdapter::black); board.titleBar(BoardAdapter::blue);
  board.text("NIBBLES", 8, 10, BoardAdapter::yellow, 1); board.text("S:", 92, 10, BoardAdapter::white, 1);
  char score[8]; snprintf(score, sizeof(score), "%d", score_); board.text(score, 110, 10, BoardAdapter::yellow, 1);
  board.text("L:", 162, 10, BoardAdapter::white, 1); char level[4]; snprintf(level, sizeof(level), "%d", level_); board.text(level, 180, 10, BoardAdapter::yellow, 1);
  board.rectangle(18, 34, 204, 204, BoardAdapter::blue);
  for (int y = 0; y < rows; ++y) for (int x = 0; x < columns; ++x) if (isWall(x, y)) board.rectangle(20 + x * cellSize, 36 + y * cellSize, 8, 8, BoardAdapter::cyan);
  board.rectangle(20 + food_.x * cellSize, 36 + food_.y * cellSize, 8, 8, BoardAdapter::red);
  char value[2] = {static_cast<char>('0' + foodValue_), 0}; board.text(value, 22 + food_.x * cellSize, 36 + food_.y * cellSize, BoardAdapter::white, 1);
  for (int i = 0; i < length_; ++i) board.rectangle(20 + body_[i].x * cellSize, 36 + body_[i].y * cellSize, 8, 8, i == 0 ? BoardAdapter::yellow : BoardAdapter::green);
  if (!running_) { board.rectangle(30, 120, 180, 60, BoardAdapter::red); board.text("GAME OVER", 62, 132, BoardAdapter::white, 2); board.text("Pfeil: Neustart", 56, 162, BoardAdapter::white, 1); }
  controls(board); board.present();
}
