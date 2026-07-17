#include "board_adapter.h"

#include <Arduino.h>
#include <LovyanGFX.hpp>
#include <Wire.h>

namespace {
constexpr int pin_mosi = 11;
constexpr int pin_miso = 13;
constexpr int pin_sclk = 12;
constexpr int pin_cs = 10;
constexpr int pin_dc = 46;
constexpr int pin_backlight = 45;
constexpr int pin_touch_sda = 16;
constexpr int pin_touch_scl = 15;
constexpr int pin_touch_reset = 18;
constexpr uint8_t touch_address = 0x38;

class Es3c28pDisplay : public lgfx::LGFX_Device {
  lgfx::Panel_ILI9341 panel_;
  lgfx::Bus_SPI bus_;
  lgfx::Light_PWM backlight_;

 public:
  Es3c28pDisplay() {
    auto busConfig = bus_.config();
    busConfig.spi_host = SPI2_HOST;
    busConfig.spi_mode = 0;
    busConfig.freq_write = 27000000;
    busConfig.freq_read = 16000000;
    busConfig.spi_3wire = false;
    busConfig.use_lock = true;
    busConfig.dma_channel = SPI_DMA_CH_AUTO;
    busConfig.pin_sclk = pin_sclk;
    busConfig.pin_mosi = pin_mosi;
    busConfig.pin_miso = pin_miso;
    busConfig.pin_dc = pin_dc;
    bus_.config(busConfig);
    panel_.setBus(&bus_);

    auto panelConfig = panel_.config();
    panelConfig.pin_cs = pin_cs;
    panelConfig.pin_rst = -1;
    panelConfig.pin_busy = -1;
    panelConfig.memory_width = BoardAdapter::width;
    panelConfig.memory_height = BoardAdapter::height;
    panelConfig.panel_width = BoardAdapter::width;
    panelConfig.panel_height = BoardAdapter::height;
    panelConfig.offset_x = 0;
    panelConfig.offset_y = 0;
    panelConfig.offset_rotation = 0;
    panelConfig.readable = false;
    panelConfig.invert = false;
    panelConfig.rgb_order = false;
    panelConfig.dlen_16bit = false;
    panelConfig.bus_shared = true;
    panel_.config(panelConfig);

    auto lightConfig = backlight_.config();
    lightConfig.pin_bl = pin_backlight;
    lightConfig.invert = false;
    lightConfig.freq = 44100;
    lightConfig.pwm_channel = 7;
    backlight_.config(lightConfig);
    panel_.setLight(&backlight_);
    setPanel(&panel_);
  }
};

Es3c28pDisplay display;
lgfx::LGFX_Sprite frameBuffer(&display);
bool frameBufferReady = false;

uint8_t readTouchRegister(uint8_t reg) {
  Wire.beginTransmission(touch_address);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom(touch_address, static_cast<uint8_t>(1)) != 1) return 0;
  return Wire.read();
}
}  // namespace

void BoardAdapter::begin() {
  pinMode(pin_touch_reset, OUTPUT);
  digitalWrite(pin_touch_reset, LOW);
  delay(10);
  digitalWrite(pin_touch_reset, HIGH);
  delay(120);
  Wire.begin(pin_touch_sda, pin_touch_scl);
  Wire.setClock(400000);
  Wire.setTimeOut(50);

  display.init();
  display.setRotation(0);
  display.setBrightness(255);
  // Render every frame in RAM first. Drawing each rectangle directly to the
  // LCD exposed intermediate frames and visibly flickered during gameplay.
  frameBuffer.setColorDepth(16);
  frameBufferReady = frameBuffer.createSprite(width, height) != nullptr;
  if (frameBufferReady) {
    frameBuffer.fillScreen(black);
    frameBuffer.pushSprite(0, 0);
  } else {
    display.fillScreen(black);
  }
}

TouchPoint BoardAdapter::readTouch() {
  if ((readTouchRegister(0x02) & 0x0F) == 0) return {false, 0, 0};
  const int rawX = ((readTouchRegister(0x03) & 0x0F) << 8) | readTouchRegister(0x04);
  const int rawY = ((readTouchRegister(0x05) & 0x0F) << 8) | readTouchRegister(0x06);
  // These axes are physically inverted on the ES3C28P touch overlay.
  return {true, static_cast<int16_t>(constrain(width - 1 - rawX, 0, width - 1)),
          static_cast<int16_t>(constrain(height - 1 - rawY, 0, height - 1))};
}

void BoardAdapter::clear(uint16_t color) {
  if (frameBufferReady) frameBuffer.fillScreen(color); else display.fillScreen(color);
}
void BoardAdapter::rectangle(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  if (frameBufferReady) frameBuffer.fillRect(x, y, w, h, color); else display.fillRect(x, y, w, h, color);
}
void BoardAdapter::roundedRectangle(int16_t x, int16_t y, int16_t w, int16_t h, int16_t radius, uint16_t color) {
  if (frameBufferReady) frameBuffer.fillRoundRect(x, y, w, h, radius, color); else display.fillRoundRect(x, y, w, h, radius, color);
}
void BoardAdapter::circle(int16_t x, int16_t y, int16_t radius, uint16_t color) {
  if (frameBufferReady) frameBuffer.fillCircle(x, y, radius, color); else display.fillCircle(x, y, radius, color);
}
void BoardAdapter::text(const char* value, int16_t x, int16_t y, uint16_t color, uint8_t size) {
  auto& target = frameBufferReady ? static_cast<lgfx::LGFXBase&>(frameBuffer) : static_cast<lgfx::LGFXBase&>(display);
  target.setTextColor(color);
  target.setTextSize(size);
  target.drawString(value, x, y);
}
void BoardAdapter::present() { if (frameBufferReady) frameBuffer.pushSprite(0, 0); }
void BoardAdapter::titleBar(uint16_t color) { rectangle(0, 0, width, 36, color); }
void BoardAdapter::menuCard(int16_t y, uint16_t color, bool selected) {
  rectangle(18, y, width - 36, 74, selected ? white : color);
  rectangle(24, y + 6, width - 48, 62, color);
}
