#pragma once

#include <stdint.h>

struct TouchPoint {
  bool pressed;
  int16_t x;
  int16_t y;
};

class BoardAdapter {
 public:
  static constexpr int16_t width = 240;
  static constexpr int16_t height = 320;
  static constexpr uint16_t black = 0x0000;
  static constexpr uint16_t white = 0xFFFF;
  static constexpr uint16_t blue = 0x001F;
  static constexpr uint16_t green = 0x07E0;
  static constexpr uint16_t red = 0xF800;
  static constexpr uint16_t yellow = 0xFFE0;
  static constexpr uint16_t cyan = 0x07FF;
  static constexpr uint16_t magenta = 0xF81F;

  void begin();
  TouchPoint readTouch();
  void clear(uint16_t color);
  void rectangle(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);
  void roundedRectangle(int16_t x, int16_t y, int16_t w, int16_t h, int16_t radius, uint16_t color);
  void circle(int16_t x, int16_t y, int16_t radius, uint16_t color);
  void text(const char* value, int16_t x, int16_t y, uint16_t color, uint8_t size = 1);
  void present();
  void titleBar(uint16_t color);
  void menuCard(int16_t y, uint16_t color, bool selected);
};
