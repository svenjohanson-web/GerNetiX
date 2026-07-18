#include "cat_jump.h"

#include "sound_driver.h"

#include <cmath>
#include <cstdio>

namespace {
constexpr float pi = 3.1415926f;
// Mit der wachsenden Hundegeschwindigkeit muss auch der Sprung zügig sein:
// bei 40 ms pro Frame rund 0,9 Sekunden in der Luft.
constexpr uint8_t winAt = 30;

float dogSpeed(uint8_t clearedDogs) { return 3.2f + clearedDogs * 0.26f; }

uint8_t levelFor(uint8_t clearedDogs) {
  return clearedDogs >= 18 ? 3 : (clearedDogs >= 8 ? 2 : 1);
}

void drawCat(BoardAdapter& board, int x, int y) {
  board.roundedRectangle(x + 4, y + 7, 21, 13, 4, BoardAdapter::brandAccent);
  board.rectangle(x + 7, y + 3, 5, 6, BoardAdapter::brandAccent);
  board.rectangle(x + 18, y + 3, 5, 6, BoardAdapter::brandAccent);
  board.circle(x + 10, y + 12, 2, BoardAdapter::white);
  board.circle(x + 20, y + 12, 2, BoardAdapter::white);
  board.rectangle(x, y + 14, 7, 3, BoardAdapter::brandAccent);
  board.rectangle(x + 8, y + 19, 3, 4, BoardAdapter::brandAccent);
  board.rectangle(x + 20, y + 19, 3, 4, BoardAdapter::brandAccent);
}

void drawDog(BoardAdapter& board, int x, int y) {
  board.roundedRectangle(x + 2, y + 8, 21, 11, 3, BoardAdapter::red);
  board.roundedRectangle(x + 18, y + 3, 11, 11, 4, BoardAdapter::red);
  board.circle(x + 25, y + 8, 1, BoardAdapter::brandNavy);
  board.rectangle(x, y + 11, 5, 3, BoardAdapter::red);
  board.rectangle(x + 7, y + 18, 3, 4, BoardAdapter::red);
  board.rectangle(x + 20, y + 18, 3, 4, BoardAdapter::red);
}
}  // namespace

void CatJump::reset(SoundDriver& sound) {
  sound_ = &sound;
  catY_ = groundY - catHeight;
  dogX_ = BoardAdapter::width + 30.0f;
  score_ = 0;
  clearedDogs_ = 0;
  jumpFrame_ = 0;
  jumpDurationFrames_ = jumpDurationForCurrentDog();
  scoreFrames_ = 0;
  jumping_ = false;
  running_ = true;
  won_ = false;
  sound_->play(SoundEffect::gameStart);
}

uint8_t CatJump::jumpDurationForCurrentDog() const {
  const float crossingDistance = catWidth + dogWidth + 32.0f;
  const float frames = crossingDistance / dogSpeed(clearedDogs_) + 6.0f;
  if (frames < 16.0f) return 16;
  if (frames > 32.0f) return 32;
  return static_cast<uint8_t>(frames);
}

void CatJump::touch(const TouchPoint&) {
  if (!running_ || won_) {
    if (sound_) reset(*sound_);
    return;
  }
  if (!jumping_) {
    jumping_ = true;
    jumpFrame_ = 0;
    jumpDurationFrames_ = jumpDurationForCurrentDog();
    if (sound_) sound_->play(SoundEffect::move);
  }
}

void CatJump::tick() {
  if (!running_ || won_) return;

  if (jumping_) {
    const float progress = static_cast<float>(jumpFrame_) / jumpDurationFrames_;
    catY_ = (groundY - catHeight) - std::sin(progress * pi) * 102.0f;
    if (++jumpFrame_ > jumpDurationFrames_) {
      catY_ = groundY - catHeight;
      jumping_ = false;
    }
  }

  // Jeder übersprungene Hund beschleunigt die Runde deutlich. Der Unterschied
  // ist schon nach einem einzelnen Sprung sichtbar und steigt fortlaufend.
  const float speed = dogSpeed(clearedDogs_);
  dogX_ -= speed;
  if (dogX_ < -dogWidth) {
    ++clearedDogs_;
    score_ += 100;
    dogX_ = BoardAdapter::width + 36.0f + (clearedDogs_ * 29U) % 76U;
    if (sound_) sound_->play(SoundEffect::collect);
    if (clearedDogs_ >= winAt) {
      won_ = true;
      return;
    }
  }
  if (++scoreFrames_ >= 8) {
    ++score_;
    scoreFrames_ = 0;
  }

  const int catLeft = catX + 3;
  const int catRight = catX + catWidth - 3;
  const int catTop = static_cast<int>(catY_) + 3;
  const int catBottom = static_cast<int>(catY_) + catHeight;
  const int dogLeft = static_cast<int>(dogX_);
  const int dogRight = dogLeft + dogWidth;
  const int dogTop = groundY - dogHeight + 2;
  const bool hitX = catLeft < dogRight && catRight > dogLeft;
  const bool hitY = catTop < groundY && catBottom > dogTop;
  if (hitX && hitY) {
    running_ = false;
    if (sound_) sound_->play(SoundEffect::gameOver);
  }
}

void CatJump::render(BoardAdapter& board) const {
  board.clear(BoardAdapter::brandNavy);
  board.titleBar(BoardAdapter::brandBlue);
  board.text("CAT JUMP", 8, 10, BoardAdapter::white, 1);
  char status[32];
  std::snprintf(status, sizeof(status), "S:%u  L:%u/3", score_, levelFor(clearedDogs_));
  board.text(status, 118, 10, BoardAdapter::brandAccent, 1);

  board.rectangle(0, groundY, BoardAdapter::width, BoardAdapter::height - groundY, BoardAdapter::brandBlue);
  for (int x = 0; x < BoardAdapter::width; x += 12) {
    board.rectangle(x, groundY + 8, 3, 4, BoardAdapter::brandAccent);
  }
  board.text("Tippen: Katze springt", 38, 48, BoardAdapter::brandAccent, 1);
  drawCat(board, catX, static_cast<int>(catY_));
  drawDog(board, static_cast<int>(dogX_), groundY - dogHeight);

  if (!running_ || won_) {
    board.roundedRectangle(25, 112, 190, 78, 8, BoardAdapter::brandBlue);
    board.text(won_ ? "GESCHAFFT!" : "GAME OVER", 66, 130, BoardAdapter::white, 2);
    board.text("Antippen: Neustart", 51, 164, BoardAdapter::brandAccent, 1);
  }
  board.present();
}
