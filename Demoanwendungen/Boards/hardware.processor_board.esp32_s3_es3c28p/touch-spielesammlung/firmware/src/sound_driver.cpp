#include "sound_driver.h"

#include <driver/gpio.h>
#include <driver/i2c.h>
#include <driver/i2s_std.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

namespace {
constexpr i2s_chan_id_t audioPort = I2S_NUM_0;
constexpr uint32_t sampleRate = 44100;
constexpr int audioEnablePin = 1;
constexpr int i2sMclkPin = 4;
constexpr int i2sBclkPin = 5;
constexpr int i2sDataPin = 8;
constexpr int i2sLrclkPin = 7;
constexpr uint8_t codecAddress = 0x18;
constexpr i2c_port_t i2cPort = I2C_NUM_0;
constexpr int16_t volume = 24000;
constexpr size_t framesPerBuffer = 96;

i2s_chan_handle_t audioChannel = nullptr;

constexpr SoundDriver::Note startNotes[] = {{523, 55}, {659, 55}, {784, 80}};
constexpr SoundDriver::Note moveNotes[] = {{520, 18}};
constexpr SoundDriver::Note collectNotes[] = {{880, 42}, {1320, 55}};
constexpr SoundDriver::Note hitNotes[] = {{180, 85}};
constexpr SoundDriver::Note brickNotes[] = {{1080, 24}};
constexpr SoundDriver::Note paddleNotes[] = {{620, 18}};
constexpr SoundDriver::Note lifeLostNotes[] = {{260, 90}, {190, 110}};
constexpr SoundDriver::Note gameOverNotes[] = {{220, 130}, {165, 180}};

struct SoundSequence { const SoundDriver::Note* notes; uint8_t count; };

SoundSequence sequenceFor(SoundEffect effect) {
  switch (effect) {
    case SoundEffect::gameStart: return {startNotes, 3};
    case SoundEffect::move: return {moveNotes, 1};
    case SoundEffect::collect: return {collectNotes, 2};
    case SoundEffect::hit: return {hitNotes, 1};
    case SoundEffect::brick: return {brickNotes, 1};
    case SoundEffect::paddle: return {paddleNotes, 1};
    case SoundEffect::lifeLost: return {lifeLostNotes, 2};
    case SoundEffect::gameOver: return {gameOverNotes, 2};
  }
  return {nullptr, 0};
}
}  // namespace

bool SoundDriver::writeCodecRegister(uint8_t reg, uint8_t value) {
  const uint8_t payload[] = {reg, value};
  return i2c_master_write_to_device(i2cPort, codecAddress, payload, sizeof(payload), pdMS_TO_TICKS(50)) == ESP_OK;
}

void SoundDriver::begin() {
  gpio_config_t enableConfig = {};
  enableConfig.pin_bit_mask = 1ULL << audioEnablePin;
  enableConfig.mode = GPIO_MODE_OUTPUT;
  gpio_config(&enableConfig);
  gpio_set_level(static_cast<gpio_num_t>(audioEnablePin), 0);
  vTaskDelay(pdMS_TO_TICKS(20));

  i2s_chan_config_t channelConfig = I2S_CHANNEL_DEFAULT_CONFIG(audioPort, I2S_ROLE_MASTER);
  channelConfig.dma_desc_num = 4;
  channelConfig.dma_frame_num = 128;
  if (i2s_new_channel(&channelConfig, &audioChannel, nullptr) != ESP_OK) return;

  i2s_std_config_t streamConfig = {};
  streamConfig.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(sampleRate);
  streamConfig.clk_cfg.mclk_multiple = I2S_MCLK_MULTIPLE_256;
  streamConfig.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
      I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO);
  streamConfig.gpio_cfg.mclk = static_cast<gpio_num_t>(i2sMclkPin);
  streamConfig.gpio_cfg.bclk = static_cast<gpio_num_t>(i2sBclkPin);
  streamConfig.gpio_cfg.ws = static_cast<gpio_num_t>(i2sLrclkPin);
  streamConfig.gpio_cfg.dout = static_cast<gpio_num_t>(i2sDataPin);
  streamConfig.gpio_cfg.din = GPIO_NUM_NC;
  if (i2s_channel_init_std_mode(audioChannel, &streamConfig) != ESP_OK ||
      i2s_channel_enable(audioChannel) != ESP_OK) {
    i2s_del_channel(audioChannel);
    audioChannel = nullptr;
    return;
  }

  // Vollständige ES8311-Initialisierung aus dem funktionierenden
  // ES3C28P-Referenzprojekt. Der Codec erwartet MCLK, Philips-I2S und
  // anschließend den aktivierten DAC-Pfad.
  bool codecReady =
      writeCodecRegister(0x01, 0x30) && writeCodecRegister(0x02, 0x00) &&
      writeCodecRegister(0x03, 0x10) && writeCodecRegister(0x16, 0x24) &&
      writeCodecRegister(0x04, 0x10) && writeCodecRegister(0x05, 0x00) &&
      writeCodecRegister(0x0B, 0x00) && writeCodecRegister(0x0C, 0x00) &&
      writeCodecRegister(0x10, 0x1F) && writeCodecRegister(0x11, 0x7F) &&
      writeCodecRegister(0x00, 0x80);
  vTaskDelay(pdMS_TO_TICKS(10));
  codecReady = codecReady &&
      writeCodecRegister(0x01, 0x3F) && writeCodecRegister(0x02, 0x00) &&
      writeCodecRegister(0x05, 0x00) && writeCodecRegister(0x03, 0x10) &&
      writeCodecRegister(0x04, 0x10) && writeCodecRegister(0x06, 0x03) &&
      writeCodecRegister(0x07, 0x00) && writeCodecRegister(0x08, 0xFF) &&
      writeCodecRegister(0x09, 0x0C) && writeCodecRegister(0x0A, 0x4C) &&
      writeCodecRegister(0x13, 0x10) && writeCodecRegister(0x1B, 0x0A) &&
      writeCodecRegister(0x1C, 0x6A) && writeCodecRegister(0x17, 0xBF) &&
      writeCodecRegister(0x0E, 0x02) && writeCodecRegister(0x12, 0x00) &&
      writeCodecRegister(0x14, 0x1A) && writeCodecRegister(0x0D, 0x01) &&
      writeCodecRegister(0x15, 0x40) && writeCodecRegister(0x31, 0x00) &&
      writeCodecRegister(0x32, 0xBF) && writeCodecRegister(0x37, 0x48) &&
      writeCodecRegister(0x45, 0x00) && writeCodecRegister(0x44, 0x50);
  if (!codecReady) {
    i2s_channel_disable(audioChannel);
    i2s_del_channel(audioChannel);
    audioChannel = nullptr;
    return;
  }
  ready_ = true;
}

void SoundDriver::play(SoundEffect effect) {
  if (!ready_ || volumePercent_ == 0) return;
  const SoundSequence sequence = sequenceFor(effect);
  if (sequence.count == 0) return;
  for (uint8_t index = 0; index < sequence.count; ++index) writeNote(sequence.notes[index]);
}

void SoundDriver::setVolumePercent(uint8_t percent) {
  volumePercent_ = percent > 100 ? 100 : percent;
}

void SoundDriver::writeNote(const Note& note) {
    // Nach einem Effekt wieder echte Stille ausgeben, statt die zuletzt
    // gespeicherten Samples wiederholen zu lassen.
  const uint32_t totalFrames = (sampleRate * note.durationMs) / 1000;
  const uint32_t halfPeriod = sampleRate / (note.frequency * 2);
  uint32_t phase = 0;
  uint32_t framesWritten = 0;
  int16_t samples[framesPerBuffer * 2];
  while (framesWritten < totalFrames) {
    const size_t frames = (totalFrames - framesWritten) < framesPerBuffer ? totalFrames - framesWritten : framesPerBuffer;
    for (size_t frame = 0; frame < frames; ++frame) {
      const int16_t amplitude = static_cast<int16_t>((static_cast<int32_t>(volume) * volumePercent_) / 100);
      const int16_t sample = ((phase / halfPeriod) & 1) ? amplitude : -amplitude;
      samples[frame * 2] = sample;
      samples[frame * 2 + 1] = sample;
      ++phase;
    }
    size_t bytesWritten = 0;
  // Ein 96-Frame-Paket hält bei 44,1 kHz nur rund 2 ms. Ein Timeout von 0
  // lässt deshalb Lücken im DMA-Strom entstehen; hörbar ist das als Knattern.
  // Der wartende Schreibvorgang hält den Stream dagegen kontinuierlich.
    const esp_err_t result = i2s_channel_write(audioChannel, samples, frames * sizeof(int16_t) * 2, &bytesWritten, portMAX_DELAY);
    if (result != ESP_OK || bytesWritten == 0) return;
    framesWritten += frames;
  }
}

void SoundDriver::tick() {
}
