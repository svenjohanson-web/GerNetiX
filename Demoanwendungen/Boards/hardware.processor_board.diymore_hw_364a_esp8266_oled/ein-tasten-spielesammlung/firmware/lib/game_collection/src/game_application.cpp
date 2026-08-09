#include "game_application.h"

#include "cat_jump.h"
#include "cave_bat.h"
#include "reaction_game.h"

namespace {
constexpr uint8_t BUTTON_PIN = 0;
constexpr uint32_t DEBOUNCE_MS = 25;
constexpr uint32_t LONG_PRESS_MS = 700;
constexpr uint32_t FRAME_MS = 33;

enum class Scene : uint8_t { Menu, Reaction, CatJump, CaveBat, GameOver };

struct ButtonState {
  bool rawPressed = false;
  bool pressed = false;
  bool pressEvent = false;
  bool releaseEvent = false;
  bool longEvent = false;
  bool longConsumed = false;
  uint32_t rawChangedAt = 0;
  uint32_t pressedAt = 0;
};

ButtonState button;
Scene scene = Scene::Menu;
Scene finishedGame = Scene::CatJump;
uint8_t menuSelection = 0;
uint32_t lastFrameAt = 0;
bool pendingGamePress = false;
CatJumpGame catJump;
CaveBatGame caveBat;
ReactionGame reaction;

void updateButton(uint32_t nowMs) {
  button.pressEvent = false;
  button.releaseEvent = false;
  button.longEvent = false;
  const bool rawPressed = digitalRead(BUTTON_PIN) == LOW;
  if (rawPressed != button.rawPressed) {
    button.rawPressed = rawPressed;
    button.rawChangedAt = nowMs;
  }
  if (nowMs - button.rawChangedAt >= DEBOUNCE_MS && button.pressed != button.rawPressed) {
    button.pressed = button.rawPressed;
    if (button.pressed) {
      button.pressEvent = true;
      button.pressedAt = nowMs;
      button.longConsumed = false;
    } else {
      button.releaseEvent = true;
    }
  }
  if (button.pressed && !button.longConsumed && nowMs - button.pressedAt >= LONG_PRESS_MS) {
    button.longConsumed = true;
    button.longEvent = true;
  }
}

void drawMenu(U8G2 &display) {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  display.drawStr(0, 9, "SPIELE");
  display.drawStr(4, 22, menuSelection == 0 ? "> REAKTION" : "  REAKTION");
  display.drawStr(4, 35, menuSelection == 1 ? "> CAT JUMP" : "  CAT JUMP");
  display.drawStr(4, 48, menuSelection == 2 ? "> CAVE BAT" : "  CAVE BAT");
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(0, 61, "kurz:wahl lang:start");
  display.sendBuffer();
}

void startSelectedGame() {
  pendingGamePress = false;
  if (menuSelection == 0) {
    reaction.reset(millis());
    scene = Scene::Reaction;
  } else if (menuSelection == 1) {
    catJump.reset();
    scene = Scene::CatJump;
  } else {
    caveBat.reset();
    scene = Scene::CaveBat;
  }
}

void drawGameOver(U8G2 &display) {
  const uint16_t score = finishedGame == Scene::CatJump ? catJump.score() : caveBat.score();
  char scoreText[20] = {};
  snprintf(scoreText, sizeof(scoreText), "PUNKTE: %u", score);
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  display.drawStr(25, 14, "GAME OVER");
  display.drawStr(31, 31, scoreText);
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(4, 48, "kurz:nochmal");
  display.drawStr(4, 61, "lang:menue");
  display.sendBuffer();
}
}

void gernetixUserApplicationBegin(U8G2 &display) {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  drawMenu(display);
}

void gernetixUserApplicationTick(U8G2 &display, uint32_t nowMs) {
  updateButton(nowMs);
  if (scene == Scene::Menu) {
    if (button.longEvent) startSelectedGame();
    else if (button.releaseEvent && !button.longConsumed) menuSelection = (menuSelection + 1) % 3;
    if (scene == Scene::Menu) drawMenu(display);
    lastFrameAt = nowMs;
    return;
  }
  if (scene == Scene::GameOver) {
    if (button.longEvent) scene = Scene::Menu;
    else if (button.releaseEvent && !button.longConsumed) {
      scene = finishedGame;
      if (scene == Scene::CatJump) catJump.reset(); else caveBat.reset();
    }
    if (scene == Scene::Menu) drawMenu(display); else if (scene == Scene::GameOver) drawGameOver(display);
    lastFrameAt = nowMs;
    return;
  }
  if (button.pressEvent) pendingGamePress = true;
  if (scene == Scene::Reaction) {
    if (button.longEvent) {
      scene = Scene::Menu;
      drawMenu(display);
      lastFrameAt = nowMs;
      return;
    }
    reaction.update(pendingGamePress, nowMs);
    pendingGamePress = false;
    if (nowMs - lastFrameAt >= FRAME_MS || button.pressEvent) {
      lastFrameAt = nowMs;
      reaction.draw(display);
    }
    return;
  }
  if (nowMs - lastFrameAt < FRAME_MS) return;
  const uint32_t elapsedMs = min<uint32_t>(nowMs - lastFrameAt, 80);
  lastFrameAt = nowMs;
  const bool running = scene == Scene::CatJump
      ? catJump.update(pendingGamePress, elapsedMs)
      : caveBat.update(button.pressed, elapsedMs);
  pendingGamePress = false;
  if (!running) {
    finishedGame = scene;
    scene = Scene::GameOver;
    button.longConsumed = false;
    if (button.pressed) button.pressedAt = nowMs;
    drawGameOver(display);
    return;
  }
  if (scene == Scene::CatJump) catJump.draw(display); else caveBat.draw(display);
}
