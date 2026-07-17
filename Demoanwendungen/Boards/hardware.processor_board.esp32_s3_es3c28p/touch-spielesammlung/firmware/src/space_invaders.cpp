#include "space_invaders.h"

#include "sound_driver.h"

#include <cstdio>

namespace {
constexpr int invaderGapX = 10;
constexpr int invaderGapY = 16;

void drawInvader(BoardAdapter& board, int x, int y, uint16_t color) {
  board.rectangle(x + 3, y + 2, 12, 9, color);
  board.rectangle(x, y + 5, 18, 4, color);
  board.rectangle(x + 2, y + 10, 4, 2, color);
  board.rectangle(x + 12, y + 10, 4, 2, color);
  board.circle(x + 6, y + 6, 1, BoardAdapter::brandNavy);
  board.circle(x + 12, y + 6, 1, BoardAdapter::brandNavy);
}

void drawShip(BoardAdapter& board, int x, int y) {
  board.rectangle(x - 16, y + 6, 32, 6, BoardAdapter::brandAccent);
  board.rectangle(x - 10, y, 20, 8, BoardAdapter::brandAccent);
  board.rectangle(x - 3, y - 7, 6, 9, BoardAdapter::white);
}
}  // namespace

void SpaceInvaders::reset(SoundDriver& sound) {
  sound_ = &sound;
  invaderX_ = 22;
  invaderY_ = 70;
  direction_ = 1;
  shipX_ = BoardAdapter::width / 2;
  shotX_ = shotY_ = -1;
  score_ = 0;
  remaining_ = rows * columns;
  moveFrames_ = 0;
  shotActive_ = false;
  running_ = true;
  won_ = false;
  for (uint8_t row = 0; row < rows; ++row) {
    for (uint8_t column = 0; column < columns; ++column) invaders_[row][column] = true;
  }
  sound_->play(SoundEffect::gameStart);
}

void SpaceInvaders::touch(const TouchPoint& point) {
  if (!running_ || won_) {
    if (sound_) reset(*sound_);
    return;
  }
  if (point.x < 80) {
    shipX_ = shipX_ > 28 ? shipX_ - 20 : 28;
    if (sound_) sound_->play(SoundEffect::move);
  } else if (point.x > 160) {
    shipX_ = shipX_ < BoardAdapter::width - 28 ? shipX_ + 20 : BoardAdapter::width - 28;
    if (sound_) sound_->play(SoundEffect::move);
  } else if (!shotActive_) {
    shotX_ = shipX_;
    shotY_ = shipY - 12;
    shotActive_ = true;
    if (sound_) sound_->play(SoundEffect::paddle);
  }
}

void SpaceInvaders::tick() {
  if (!running_ || won_) return;
  if (shotActive_) {
    shotY_ -= 9;
    if (shotY_ < 38) {
      shotActive_ = false;
    } else {
      for (uint8_t row = 0; row < rows && shotActive_; ++row) {
        for (uint8_t column = 0; column < columns; ++column) {
          if (!invaders_[row][column]) continue;
          const int x = invaderX_ + column * (invaderWidth + invaderGapX);
          const int y = invaderY_ + row * (invaderHeight + invaderGapY);
          if (shotX_ >= x && shotX_ <= x + invaderWidth && shotY_ >= y && shotY_ <= y + invaderHeight) {
            invaders_[row][column] = false;
            shotActive_ = false;
            score_ += 10;
            --remaining_;
            if (sound_) sound_->play(SoundEffect::brick);
            if (remaining_ == 0) won_ = true;
            break;
          }
        }
      }
    }
  }

  const uint8_t defeated = rows * columns - remaining_;
  const uint8_t interval = defeated < 12 ? 15 - defeated : 4;
  if (++moveFrames_ < interval) return;
  moveFrames_ = 0;

  int minX = BoardAdapter::width;
  int maxX = 0;
  int maxY = 0;
  for (uint8_t row = 0; row < rows; ++row) {
    for (uint8_t column = 0; column < columns; ++column) {
      if (!invaders_[row][column]) continue;
      const int x = invaderX_ + column * (invaderWidth + invaderGapX);
      const int y = invaderY_ + row * (invaderHeight + invaderGapY);
      if (x < minX) minX = x;
      if (x + invaderWidth > maxX) maxX = x + invaderWidth;
      if (y + invaderHeight > maxY) maxY = y + invaderHeight;
    }
  }
  if ((direction_ > 0 && maxX >= BoardAdapter::width - 8) || (direction_ < 0 && minX <= 8)) {
    direction_ = -direction_;
    invaderY_ += 12;
    if (maxY + 12 >= shipY - 20) {
      running_ = false;
      if (sound_) sound_->play(SoundEffect::gameOver);
    }
  } else {
    invaderX_ += direction_ * 8;
    if (sound_) sound_->play(SoundEffect::move);
  }
}

void SpaceInvaders::render(BoardAdapter& board) const {
  board.clear(BoardAdapter::brandNavy);
  board.titleBar(BoardAdapter::brandBlue);
  board.text("SPACE INVADERS", 8, 10, BoardAdapter::white, 1);
  char score[14];
  std::snprintf(score, sizeof(score), "S:%d", score_);
  board.text(score, 154, 10, BoardAdapter::brandAccent, 1);
  for (uint8_t row = 0; row < rows; ++row) {
    for (uint8_t column = 0; column < columns; ++column) {
      if (!invaders_[row][column]) continue;
      const uint16_t color = row == 0 ? BoardAdapter::brandAccent : (row == 1 ? BoardAdapter::green : BoardAdapter::yellow);
      drawInvader(board, invaderX_ + column * (invaderWidth + invaderGapX), invaderY_ + row * (invaderHeight + invaderGapY), color);
    }
  }
  if (shotActive_) board.rectangle(shotX_ - 1, shotY_, 3, 10, BoardAdapter::white);
  drawShip(board, shipX_, shipY);
  board.roundedRectangle(12, 278, 62, 30, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(89, 278, 62, 30, 5, BoardAdapter::brandBlue);
  board.roundedRectangle(166, 278, 62, 30, 5, BoardAdapter::brandBlue);
  board.text("<", 37, 282, BoardAdapter::white, 3);
  board.text("F", 113, 284, BoardAdapter::brandAccent, 2);
  board.text(">", 190, 282, BoardAdapter::white, 3);
  if (!running_ || won_) {
    board.roundedRectangle(25, 126, 190, 78, 8, BoardAdapter::brandBlue);
    board.text(won_ ? "GEWONNEN" : "GAME OVER", 51, 144, BoardAdapter::white, 2);
    board.text("Antippen: Neustart", 51, 176, BoardAdapter::brandAccent, 1);
  }
  board.present();
}
