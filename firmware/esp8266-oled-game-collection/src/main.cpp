#include <Arduino.h>
#include <U8g2lib.h>
#include <Wire.h>

namespace {

constexpr uint8_t kOledSdaPin = D6;
constexpr uint8_t kOledSclPin = D5;
constexpr uint8_t kFlashButtonPin = 0;
constexpr uint16_t kLongPressMs = 650;
constexpr uint16_t kDebounceMs = 25;

U8G2_SSD1306_128X64_NONAME_F_HW_I2C display(U8G2_R0, U8X8_PIN_NONE);

enum class Screen : uint8_t { menu, reactionWait, reactionReady, reactionResult, jump, dodge };

struct ButtonEvent {
  bool released = false;
  bool longPress = false;
};

Screen screen = Screen::menu;
uint8_t selectedGame = 0;
uint32_t screenStartedAt = 0;
uint32_t actionAt = 0;
uint32_t score = 0;
uint32_t randomAt = 0;

int16_t jumpY = 48;
int8_t jumpVelocity = 0;
int16_t obstacleX = 128;
uint8_t dodgeLane = 0;
uint8_t dodgeObstacleLane = 0;

ButtonEvent pollButton() {
  static bool stablePressed = false;
  static bool previousRawPressed = false;
  static uint32_t rawChangedAt = 0;
  static uint32_t pressedAt = 0;

  const uint32_t now = millis();
  const bool rawPressed = digitalRead(kFlashButtonPin) == LOW;
  if (rawPressed != previousRawPressed) {
    previousRawPressed = rawPressed;
    rawChangedAt = now;
  }
  if (now - rawChangedAt < kDebounceMs || rawPressed == stablePressed) return {};

  stablePressed = rawPressed;
  if (stablePressed) {
    pressedAt = now;
    return {};
  }
  return { true, now - pressedAt >= kLongPressMs };
}

void showHeader(const char* title) {
  display.setFont(u8g2_font_6x12_tf);
  display.drawStr(0, 11, title);
  display.drawHLine(0, 14, 128);
}

void showMenu() {
  static const char* games[] = { "Reaktion", "Sprungspiel", "Ausweichen" };
  display.clearBuffer();
  showHeader("GerNetiX Spiele");
  display.setFont(u8g2_font_6x12_tf);
  for (uint8_t index = 0; index < 3; ++index) {
    const uint8_t y = 29 + index * 12;
    if (index == selectedGame) display.drawBox(0, y - 10, 128, 12);
    display.setDrawColor(index == selectedGame ? 0 : 1);
    display.drawStr(10, y, games[index]);
    display.setDrawColor(1);
  }
  display.setFont(u8g2_font_5x8_tf);
  display.drawStr(0, 62, "kurz: waehlen  lang: starten");
  display.sendBuffer();
}

void beginReaction() {
  screen = Screen::reactionWait;
  screenStartedAt = millis();
  randomAt = screenStartedAt + random(1500, 4001);
  score = 0;
}

void beginJump() {
  screen = Screen::jump;
  jumpY = 48;
  jumpVelocity = 0;
  obstacleX = 128;
  score = 0;
  actionAt = millis();
}

void beginDodge() {
  screen = Screen::dodge;
  dodgeLane = 0;
  dodgeObstacleLane = random(0, 2);
  obstacleX = 128;
  score = 0;
  actionAt = millis();
}

void beginSelectedGame() {
  if (selectedGame == 0) beginReaction();
  if (selectedGame == 1) beginJump();
  if (selectedGame == 2) beginDodge();
}

void showReaction() {
  const uint32_t now = millis();
  display.clearBuffer();
  showHeader("Reaktion");
  display.setFont(u8g2_font_6x12_tf);
  if (screen == Screen::reactionWait) {
    display.drawStr(22, 36, "Warte auf GO...");
    if (now >= randomAt) {
      screen = Screen::reactionReady;
      actionAt = now;
    }
  } else if (screen == Screen::reactionReady) {
    display.setFont(u8g2_font_logisoso24_tf);
    display.drawStr(40, 45, "GO!");
  } else {
    char result[18];
    snprintf(result, sizeof(result), "%lu ms", static_cast<unsigned long>(score));
    display.drawStr(33, 35, "Deine Zeit:");
    display.setFont(u8g2_font_logisoso18_tf);
    display.drawStr(25, 56, result);
  }
  display.setFont(u8g2_font_5x8_tf);
  display.drawStr(0, 62, "lang: zurueck ins Menue");
  display.sendBuffer();
}

void showJump() {
  const uint32_t now = millis();
  if (now - actionAt >= 32) {
    actionAt = now;
    jumpVelocity += 1;
    jumpY += jumpVelocity;
    if (jumpY > 48) { jumpY = 48; jumpVelocity = 0; }
    obstacleX -= 3;
    if (obstacleX < -6) { obstacleX = 128; ++score; }
    if (obstacleX < 27 && obstacleX > 13 && jumpY > 34) { beginJump(); }
  }
  display.clearBuffer();
  showHeader("Sprungspiel");
  display.drawHLine(0, 56, 128);
  display.drawBox(16, jumpY - 9, 9, 9);
  display.drawBox(obstacleX, 47, 6, 9);
  char points[12];
  snprintf(points, sizeof(points), "%lu", static_cast<unsigned long>(score));
  display.setFont(u8g2_font_6x12_tf);
  display.drawStr(108, 11, points);
  display.setFont(u8g2_font_5x8_tf);
  display.drawStr(0, 23, "kurz: springen  lang: Menue");
  display.sendBuffer();
}

void showDodge() {
  const uint32_t now = millis();
  if (now - actionAt >= 38) {
    actionAt = now;
    obstacleX -= 3;
    if (obstacleX < -8) {
      obstacleX = 128;
      dodgeObstacleLane = random(0, 2);
      ++score;
    }
    if (obstacleX < 27 && obstacleX > 13 && dodgeLane == dodgeObstacleLane) beginDodge();
  }
  const int playerY = dodgeLane == 0 ? 27 : 46;
  const int obstacleY = dodgeObstacleLane == 0 ? 22 : 41;
  display.clearBuffer();
  showHeader("Ausweichen");
  display.drawHLine(0, 36, 128);
  display.drawDisc(20, playerY, 5);
  display.drawBox(obstacleX, obstacleY, 8, 9);
  char points[12];
  snprintf(points, sizeof(points), "%lu", static_cast<unsigned long>(score));
  display.setFont(u8g2_font_6x12_tf);
  display.drawStr(108, 11, points);
  display.setFont(u8g2_font_5x8_tf);
  display.drawStr(0, 62, "kurz: Spur wechseln  lang: Menue");
  display.sendBuffer();
}

void handleEvent(const ButtonEvent& event) {
  if (!event.released) return;
  if (screen == Screen::menu) {
    if (event.longPress) beginSelectedGame();
    else selectedGame = (selectedGame + 1) % 3;
    return;
  }
  if (event.longPress) { screen = Screen::menu; return; }
  if (screen == Screen::reactionWait) {
    screen = Screen::reactionResult;
    score = 0;
  } else if (screen == Screen::reactionReady) {
    screen = Screen::reactionResult;
    score = millis() - actionAt;
  } else if (screen == Screen::reactionResult) {
    beginReaction();
  } else if (screen == Screen::jump && jumpY >= 47) {
    jumpVelocity = -7;
  } else if (screen == Screen::dodge) {
    dodgeLane = dodgeLane == 0 ? 1 : 0;
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  pinMode(kFlashButtonPin, INPUT_PULLUP);
  Wire.begin(kOledSdaPin, kOledSclPin);
  display.begin();
  display.setContrast(200);
  randomSeed(ESP.getCycleCount());
}

void loop() {
  handleEvent(pollButton());
  if (screen == Screen::menu) showMenu();
  else if (screen == Screen::reactionWait || screen == Screen::reactionReady || screen == Screen::reactionResult) showReaction();
  else if (screen == Screen::jump) showJump();
  else if (screen == Screen::dodge) showDodge();
  delay(8);
}
