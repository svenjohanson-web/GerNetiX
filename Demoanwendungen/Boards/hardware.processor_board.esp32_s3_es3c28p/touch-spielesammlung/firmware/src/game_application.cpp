#include "game_application.h"
extern "C" {
#include "esp_timer.h"
}

void GameApplication::begin() {
  board_.begin();
  sound_.begin();
  bootStartMs_ = static_cast<uint32_t>(esp_timer_get_time() / 1000);
  renderBoot(0);
}

void GameApplication::renderBoot(uint32_t elapsedMs) {
  board_.clear(BoardAdapter::black);
  board_.text("GerNetiX 386 Compatible BIOS", 10, 22, BoardAdapter::white, 1);
  board_.text("Copyright (C) 2026 GerNetiX", 10, 40, BoardAdapter::white, 1);
  if (elapsedMs >= 350) board_.text("CPU: ESP32-S3 240 MHz", 10, 76, BoardAdapter::white, 1);
  if (elapsedMs >= 650) board_.text("Memory Test: 320K OK", 10, 94, BoardAdapter::white, 1);
  if (elapsedMs >= 950) board_.text("Touch controller: OK", 10, 112, BoardAdapter::white, 1);
  if (elapsedMs >= 1250) board_.text("Display adapter: ILI9341V", 10, 130, BoardAdapter::white, 1);
  if (elapsedMs >= 1550) board_.text("Booting GerNetiX DOS...", 10, 166, BoardAdapter::yellow, 1);
  if (elapsedMs >= 1850) board_.text("C:\\> GAMES.EXE", 10, 202, BoardAdapter::green, 1);
  board_.present();
}

void GameApplication::renderMenu() {
  board_.clear(BoardAdapter::brandNavy);
  board_.titleBar(BoardAdapter::brandBlue);
  // The title bar uses the GerNetiX wordmark itself, without inventing an
  // additional icon: the blue X remains the distinctive final letter.
  board_.text("GerNeti", 18, 8, BoardAdapter::white, 2);
  board_.text("X", 102, 8, BoardAdapter::brandAccent, 2);
  board_.text("TON", 136, 8, BoardAdapter::white, 1);
  board_.rectangle(158, 18, 70, 10, BoardAdapter::white);
  board_.rectangle(160, 20, 66, 6, BoardAdapter::brandNavy);
  const int volumeWidth = (64 * sound_.volumePercent()) / 100;
  if (volumeWidth > 0) board_.rectangle(161, 21, volumeWidth, 4, BoardAdapter::brandAccent);
  board_.text("-", 148, 17, BoardAdapter::white, 1);
  board_.text("+", 230, 17, BoardAdapter::white, 1);
  if (menuPage_ == 0) {
    board_.menuCard(48, BoardAdapter::brandBlue, false);
    board_.text("NIBBLES", 42, 60, BoardAdapter::white, 2);
    board_.text("Antippen zum Starten", 42, 86, BoardAdapter::brandAccent, 1);
    board_.menuCard(126, BoardAdapter::brandBlue, false);
    board_.text("FROGGER", 42, 138, BoardAdapter::white, 2);
    board_.text("Antippen zum Starten", 42, 164, BoardAdapter::brandAccent, 1);
    board_.menuCard(204, BoardAdapter::brandBlue, false);
    board_.text("ARKANOID", 42, 216, BoardAdapter::white, 2);
    board_.text("Antippen zum Starten", 42, 242, BoardAdapter::brandAccent, 1);
    board_.text("Nach oben wischen", 60, 286, BoardAdapter::brandAccent, 1);
  } else if (menuPage_ == 1) {
    board_.menuCard(48, BoardAdapter::brandBlue, false);
    board_.text("CAT JUMP", 42, 60, BoardAdapter::white, 2);
    board_.text("Katze springt", 42, 86, BoardAdapter::brandAccent, 1);
    board_.menuCard(126, BoardAdapter::brandBlue, false);
    board_.text("SPACE INVADERS", 42, 138, BoardAdapter::white, 1);
    board_.text("Alien-Welle abwehren", 42, 164, BoardAdapter::brandAccent, 1);
    board_.menuCard(204, BoardAdapter::brandBlue, false);
    board_.text("PIPE CREW", 42, 216, BoardAdapter::white, 2);
    board_.text("Rohrnetz warten", 42, 242, BoardAdapter::brandAccent, 1);
    board_.text("Nach unten wischen", 56, 286, BoardAdapter::brandAccent, 1);
  } else {
    board_.menuCard(48, BoardAdapter::brandBlue, false);
    board_.text("PAC MAZE", 42, 60, BoardAdapter::white, 2);
    board_.text("Punkte sammeln", 42, 86, BoardAdapter::brandAccent, 1);
    board_.menuCard(140, BoardAdapter::brandBlue, false);
    board_.text("PIPE PUZZLE", 42, 152, BoardAdapter::white, 1);
    board_.text("Rohre drehen", 42, 178, BoardAdapter::brandAccent, 1);
    board_.text("Nach unten wischen", 56, 286, BoardAdapter::brandAccent, 1);
  }
  board_.present();
}

void GameApplication::tick() {
  sound_.tick();
  const uint32_t now = static_cast<uint32_t>(esp_timer_get_time() / 1000);
  if (screen_ == Screen::boot) {
    const uint32_t elapsed = now - bootStartMs_;
    if (elapsed >= 2300) { screen_ = Screen::menu; renderMenu(); }
    else renderBoot(elapsed);
    return;
  }
  const TouchPoint touch = board_.readTouch();
  const bool risingTouch = touch.pressed && !wasPressed_;
  const bool fallingTouch = !touch.pressed && wasPressed_;
  if (risingTouch) { touchStartX_ = touch.x; touchStartY_ = touch.y; }
  if (touch.pressed) lastTouchY_ = touch.y;
  wasPressed_ = touch.pressed;
  if (screen_ == Screen::menu && fallingTouch) {
    if (touchStartY_ < 36 && touchStartX_ >= 146 && touchStartX_ <= 236) {
      int volume = ((touchStartX_ - 160) * 100) / 66;
      if (volume < 0) volume = 0;
      if (volume > 100) volume = 100;
      sound_.setVolumePercent(static_cast<uint8_t>(volume));
      renderMenu();
      return;
    }
    const int16_t swipeY = lastTouchY_ - touchStartY_;
    if (swipeY <= -35 && menuPage_ < 2) { ++menuPage_; renderMenu(); return; }
    if (swipeY >= 35 && menuPage_ > 0) { --menuPage_; renderMenu(); return; }
    if (swipeY > -35 && swipeY < 35) {
      if (menuPage_ == 0 && touchStartY_ >= 48 && touchStartY_ < 108) { screen_ = Screen::nibbles; nibbles_.reset(sound_); }
      else if (menuPage_ == 0 && touchStartY_ >= 126 && touchStartY_ < 186) { screen_ = Screen::frogger; frogger_.reset(sound_); }
      else if (menuPage_ == 0 && touchStartY_ >= 204 && touchStartY_ < 264) { screen_ = Screen::arkanoid; arkanoid_.reset(sound_); }
      else if (menuPage_ == 1 && touchStartY_ >= 48 && touchStartY_ < 108) { screen_ = Screen::catJump; catJump_.reset(sound_); }
      else if (menuPage_ == 1 && touchStartY_ >= 126 && touchStartY_ < 186) { screen_ = Screen::spaceInvaders; spaceInvaders_.reset(sound_); }
      else if (menuPage_ == 1 && touchStartY_ >= 204 && touchStartY_ < 264) { screen_ = Screen::pipeRunner; pipeRunner_.reset(sound_); }
      else if (menuPage_ == 2 && touchStartY_ >= 48 && touchStartY_ < 108) { screen_ = Screen::pacMaze; pacMaze_.reset(sound_); }
      else if (menuPage_ == 2 && touchStartY_ >= 140 && touchStartY_ < 200) { screen_ = Screen::pipePuzzle; pipePuzzle_.reset(sound_); }
    }
  } else if (screen_ != Screen::menu && risingTouch) {
    if (touch.y < 36) { screen_ = Screen::menu; renderMenu(); return; }
    if (screen_ == Screen::nibbles) nibbles_.touch(touch);
    else if (screen_ == Screen::frogger) frogger_.touch(touch);
    else if (screen_ == Screen::arkanoid) arkanoid_.touch(touch);
    else if (screen_ == Screen::catJump) catJump_.touch(touch);
    else if (screen_ == Screen::spaceInvaders) spaceInvaders_.touch(touch);
    else if (screen_ == Screen::pipeRunner) pipeRunner_.touch(touch);
    else if (screen_ == Screen::pacMaze) pacMaze_.touch(touch);
    else pipePuzzle_.touch(touch);
  }
  // Die ursprüngliche Spieltaktung bleibt für die Sammlung erhalten.
  // Nur Cat Jump und Space Invaders benötigen einen eigenen Laufzyklus.
  const uint32_t frameIntervalMs = screen_ == Screen::catJump ? 40 :
                                   ((screen_ == Screen::arkanoid || screen_ == Screen::spaceInvaders || screen_ == Screen::frogger || screen_ == Screen::pacMaze) ? 70 : 130);
  if (now - lastFrameMs_ < frameIntervalMs) return;
  lastFrameMs_ = now;
  if (screen_ == Screen::nibbles) { nibbles_.tick(); nibbles_.render(board_); }
  if (screen_ == Screen::frogger) { frogger_.tick(); frogger_.render(board_); }
  if (screen_ == Screen::arkanoid) { arkanoid_.tick(); arkanoid_.render(board_); }
  if (screen_ == Screen::catJump) { catJump_.tick(); catJump_.render(board_); }
  if (screen_ == Screen::spaceInvaders) { spaceInvaders_.tick(); spaceInvaders_.render(board_); }
  if (screen_ == Screen::pipeRunner) { pipeRunner_.tick(); pipeRunner_.render(board_); }
  if (screen_ == Screen::pacMaze) { pacMaze_.tick(); pacMaze_.render(board_); }
  if (screen_ == Screen::pipePuzzle) { pipePuzzle_.tick(); pipePuzzle_.render(board_); }
}
