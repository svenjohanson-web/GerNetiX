#include "arkanoid.h"
#include "sound_driver.h"

#include <cstdio>

namespace {
constexpr int fieldX = 12;
constexpr int fieldY = 44;
constexpr int fieldWidth = 216;
constexpr int fieldHeight = 184;
constexpr int brickX = 18;
constexpr int brickY = 52;
constexpr int brickWidth = 23;
constexpr int brickHeight = 11;
constexpr int brickGap = 3;
constexpr int paddleWidth = 44;
constexpr int paddleHeight = 7;
constexpr int paddleY = 214;
constexpr int ballRadius = 4;

uint16_t brickColor(int row) {
  switch (row) {
    case 0: return BoardAdapter::red;
    case 1: return BoardAdapter::yellow;
    case 2: return BoardAdapter::green;
    case 3: return BoardAdapter::cyan;
    default: return BoardAdapter::magenta;
  }
}

float clampFloat(float value, float minimum, float maximum) {
  return value < minimum ? minimum : (value > maximum ? maximum : value);
}

void controls(BoardAdapter& board) {
  board.text("Schlaeger: links / rechts", 47, 244, BoardAdapter::white, 1);
  board.rectangle(30, 270, 82, 34, BoardAdapter::blue);
  board.text("<", 62, 274, BoardAdapter::white, 3);
  board.rectangle(128, 270, 82, 34, BoardAdapter::blue);
  board.text(">", 160, 274, BoardAdapter::white, 3);
}
}  // namespace

void Arkanoid::resetBricks() {
  for (int row = 0; row < brickRows; ++row) {
    for (int column = 0; column < brickColumns; ++column) bricks_[row][column] = true;
  }
}

void Arkanoid::resetBall() {
  paddleX_ = fieldX + (fieldWidth - paddleWidth) / 2;
  ballX_ = paddleX_ + paddleWidth / 2;
  ballY_ = paddleY - ballRadius - 2;
  ballDx_ = level_ % 2 ? 2.1f : -2.1f;
  const int speedLevel = level_ - 1 < 4 ? level_ - 1 : 4;
  ballDy_ = -2.3f - speedLevel * 0.15f;
}

void Arkanoid::reset(SoundDriver& sound) {
  sound_ = &sound;
  score_ = 0;
  lives_ = 3;
  level_ = 1;
  running_ = true;
  resetBricks();
  resetBall();
  sound_->play(SoundEffect::gameStart);
}

void Arkanoid::loseLife() {
  if (--lives_ <= 0) {
    running_ = false;
    if (sound_) sound_->play(SoundEffect::gameOver);
    return;
  }
  if (sound_) sound_->play(SoundEffect::lifeLost);
  resetBall();
}

bool Arkanoid::allBricksCleared() const {
  for (int row = 0; row < brickRows; ++row) {
    for (int column = 0; column < brickColumns; ++column) if (bricks_[row][column]) return false;
  }
  return true;
}

void Arkanoid::touch(const TouchPoint& point) {
  if (!running_) {
    if (sound_) reset(*sound_);
    return;
  }
  if (point.y >= 265) {
    paddleX_ += point.x < 120 ? -26 : 26;
  } else {
    paddleX_ = point.x - paddleWidth / 2;
  }
  paddleX_ = clampFloat(paddleX_, static_cast<float>(fieldX), static_cast<float>(fieldX + fieldWidth - paddleWidth));
}

void Arkanoid::tick() {
  if (!running_) return;

  ballX_ += ballDx_;
  ballY_ += ballDy_;
  if (ballX_ - ballRadius <= fieldX) {
    ballX_ = fieldX + ballRadius;
    ballDx_ = std::abs(ballDx_);
  } else if (ballX_ + ballRadius >= fieldX + fieldWidth) {
    ballX_ = fieldX + fieldWidth - ballRadius;
    ballDx_ = -std::abs(ballDx_);
  }
  if (ballY_ - ballRadius <= fieldY) {
    ballY_ = fieldY + ballRadius;
    ballDy_ = std::abs(ballDy_);
  }

  if (ballDy_ > 0 && ballY_ + ballRadius >= paddleY && ballY_ - ballRadius <= paddleY + paddleHeight &&
      ballX_ + ballRadius >= paddleX_ && ballX_ - ballRadius <= paddleX_ + paddleWidth) {
    ballY_ = paddleY - ballRadius;
    const float offset = (ballX_ - (paddleX_ + paddleWidth / 2)) / (paddleWidth / 2);
    ballDx_ = clampFloat(offset * 3.6f, -3.6f, 3.6f);
    if (std::abs(ballDx_) < 0.8f) ballDx_ = ballDx_ < 0 ? -0.8f : 0.8f;
    ballDy_ = -std::abs(ballDy_);
    if (sound_) sound_->play(SoundEffect::paddle);
  }

  for (int row = 0; row < brickRows; ++row) {
    for (int column = 0; column < brickColumns; ++column) {
      if (!bricks_[row][column]) continue;
      const int x = brickX + column * (brickWidth + brickGap);
      const int y = brickY + row * (brickHeight + brickGap);
      if (ballX_ + ballRadius < x || ballX_ - ballRadius > x + brickWidth || ballY_ + ballRadius < y || ballY_ - ballRadius > y + brickHeight) continue;
      bricks_[row][column] = false;
      score_ += (brickRows - row) * 10;
      ballDy_ = -ballDy_;
      if (sound_) sound_->play(SoundEffect::brick);
      if (allBricksCleared()) {
        ++level_;
        resetBricks();
        resetBall();
        if (sound_) sound_->play(SoundEffect::collect);
      }
      return;
    }
  }

  if (ballY_ - ballRadius > fieldY + fieldHeight) loseLife();
}

void Arkanoid::render(BoardAdapter& board) const {
  board.clear(BoardAdapter::black);
  board.titleBar(BoardAdapter::blue);
  board.text("ARKANOID", 8, 10, BoardAdapter::white, 1);
  char score[14];
  snprintf(score, sizeof(score), "S:%d", score_);
  board.text(score, 96, 10, BoardAdapter::yellow, 1);
  char state[14];
  snprintf(state, sizeof(state), "L:%d  %d", lives_, level_);
  board.text(state, 168, 10, BoardAdapter::white, 1);

  board.rectangle(fieldX - 2, fieldY - 2, fieldWidth + 4, fieldHeight + 4, BoardAdapter::white);
  board.rectangle(fieldX, fieldY, fieldWidth, fieldHeight, BoardAdapter::black);
  for (int row = 0; row < brickRows; ++row) {
    for (int column = 0; column < brickColumns; ++column) {
      if (bricks_[row][column]) {
        board.roundedRectangle(brickX + column * (brickWidth + brickGap), brickY + row * (brickHeight + brickGap), brickWidth, brickHeight, 2, brickColor(row));
      }
    }
  }
  board.roundedRectangle(static_cast<int>(paddleX_), paddleY, paddleWidth, paddleHeight, 3, BoardAdapter::cyan);
  board.circle(static_cast<int>(ballX_), static_cast<int>(ballY_), ballRadius, BoardAdapter::white);

  if (!running_) {
    board.rectangle(30, 120, 180, 60, BoardAdapter::red);
    board.text("GAME OVER", 62, 132, BoardAdapter::white, 2);
    board.text("Antippen: Neustart", 50, 162, BoardAdapter::white, 1);
  }
  controls(board);
  board.present();
}
