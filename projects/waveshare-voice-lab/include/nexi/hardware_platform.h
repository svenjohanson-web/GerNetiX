#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"

namespace nexi {

enum class BoardButton : uint8_t {
  Effect,
  Record,
  Volume,
};

// Exclusive owner of the Waveshare board peripherals used by Nexi.  Product
// applications consume this boundary instead of addressing I2C, I2S, codecs,
// GPIOs or the LED strip directly.
class HardwarePlatform final {
 public:
  static HardwarePlatform &instance();

  esp_err_t initializeStatusLeds();
  esp_err_t initializeAudioHardware();
  void shutdown();

  esp_err_t setStatusLeds(
      size_t count, uint8_t red, uint8_t green, uint8_t blue);
  esp_err_t setSpeakerAmplifier(bool enabled);
  esp_err_t setOutputVolume(int percent);
  esp_err_t readButtonPressed(BoardButton button, bool *pressed);
  esp_err_t waitForButtonState(BoardButton button, bool expectedPressed);
  esp_err_t readAudio(void *destination, size_t bytes);
  esp_err_t writeAudio(const void *source, size_t bytes);
  esp_err_t readRtcRegisters(
      uint8_t firstRegister, uint8_t *destination, size_t size);
  esp_err_t writeRtcRegisters(
      uint8_t firstRegister, const uint8_t *source, size_t size);

  static constexpr size_t STATUS_LED_COUNT = 7;
  static constexpr uint8_t STATUS_LED_BRIGHTNESS = 24;

 private:
  HardwarePlatform() = default;
};

}  // namespace nexi
