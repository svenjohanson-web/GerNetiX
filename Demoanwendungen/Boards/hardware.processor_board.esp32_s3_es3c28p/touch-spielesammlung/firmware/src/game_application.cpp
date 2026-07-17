#include "game_application.h"
extern "C" {
#include "esp_timer.h"
}

void GameApplication::begin() {
  board_.begin();
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
  board_.clear(BoardAdapter::black);
  board_.titleBar(BoardAdapter::blue);
  board_.text("SPIELESAMMLUNG", 18, 10, BoardAdapter::white, 1);
  board_.menuCard(78, BoardAdapter::green, false);
  board_.text("NIBBLES", 42, 96, BoardAdapter::black, 2);
  board_.text("Antippen zum Starten", 42, 128, BoardAdapter::black, 1);
  board_.menuCard(180, BoardAdapter::cyan, false);
  board_.text("FROGGER", 42, 198, BoardAdapter::black, 2);
  board_.text("Antippen zum Starten", 42, 230, BoardAdapter::black, 1);
  board_.present();
}

void GameApplication::tick() {
  const uint32_t now = static_cast<uint32_t>(esp_timer_get_time() / 1000);
  if (screen_ == Screen::boot) {
    const uint32_t elapsed = now - bootStartMs_;
    if (elapsed >= 2300) { screen_ = Screen::menu; renderMenu(); }
    else renderBoot(elapsed);
    return;
  }
  const TouchPoint touch = board_.readTouch();
  const bool risingTouch = touch.pressed && !wasPressed_;
  wasPressed_ = touch.pressed;
  if (screen_ == Screen::menu && risingTouch) {
    if (touch.y >= 70 && touch.y < 165) { screen_ = Screen::nibbles; nibbles_.reset(); }
    else if (touch.y >= 165 && touch.y < 275) { screen_ = Screen::frogger; frogger_.reset(); }
  } else if (screen_ != Screen::menu && risingTouch) {
    if (touch.y < 36) { screen_ = Screen::menu; renderMenu(); return; }
    if (screen_ == Screen::nibbles) nibbles_.touch(touch); else frogger_.touch(touch);
  }
  if (now - lastFrameMs_ < 130) return;
  lastFrameMs_ = now;
  if (screen_ == Screen::nibbles) { nibbles_.tick(); nibbles_.render(board_); }
  if (screen_ == Screen::frogger) { frogger_.tick(); frogger_.render(board_); }
}
