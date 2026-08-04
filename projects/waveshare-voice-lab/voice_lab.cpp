#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

#include "basissoftware/feedback.h"
#include "driver/i2c_master.h"
#include "driver/i2s_std.h"
#include "esp_codec_dev.h"
#include "esp_codec_dev_defaults.h"
#include "esp_err.h"
#include "esp_heap_caps.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "led_strip.h"

namespace {
constexpr const char *TAG = "voiceLab";
constexpr i2c_port_num_t I2C_PORT = I2C_NUM_0;
constexpr gpio_num_t I2C_SCL = GPIO_NUM_10;
constexpr gpio_num_t I2C_SDA = GPIO_NUM_11;
constexpr gpio_num_t I2S_MCLK = GPIO_NUM_12;
constexpr gpio_num_t I2S_BCLK = GPIO_NUM_13;
constexpr gpio_num_t I2S_WS = GPIO_NUM_14;
constexpr gpio_num_t I2S_DIN = GPIO_NUM_15;
constexpr gpio_num_t I2S_DOUT = GPIO_NUM_16;
constexpr uint32_t SAMPLE_RATE = 16000;
constexpr size_t MAX_RECORD_SECONDS = 15;
constexpr size_t INPUT_CHANNELS = 4;
constexpr size_t OUTPUT_CHANNELS = 2;
constexpr size_t MAX_RECORD_FRAMES = SAMPLE_RATE * MAX_RECORD_SECONDS;
constexpr size_t RECORD_CAPACITY_BYTES =
    MAX_RECORD_FRAMES * INPUT_CHANNELS * sizeof(int16_t);
constexpr size_t MIN_RECORD_FRAMES = SAMPLE_RATE / 10;
constexpr size_t IO_FRAMES = 256;
constexpr int INPUT_GAIN_DB = 30;
constexpr int SAFE_OUTPUT_VOLUME = 100;
constexpr std::array<int, 5> OUTPUT_VOLUME_LEVELS{{20, 40, 60, 80, 100}};
constexpr int32_t PLAYBACK_TARGET_PEAK = 22937;  // 70 percent of int16 full scale
constexpr int32_t MAX_DIGITAL_GAIN = 12;
constexpr gpio_num_t STATUS_LED_GPIO = GPIO_NUM_38;
constexpr size_t STATUS_LED_COUNT = 7;
constexpr uint8_t STATUS_LED_BRIGHTNESS = 24;
constexpr uint8_t TCA9555_ADDRESS = 0x20;
constexpr uint8_t TCA9555_INPUT_PORT_1 = 0x01;
constexpr uint8_t TCA9555_OUTPUT_PORT_1 = 0x03;
constexpr uint8_t TCA9555_CONFIG_PORT_1 = 0x07;
constexpr uint8_t SPEAKER_PA_MASK = 0x01;  // EXIO8
constexpr uint8_t EFFECT_BUTTON_MASK = 0x02;  // EXIO9 / KEY1
constexpr uint8_t RECORD_BUTTON_MASK = 0x04;  // EXIO10 / KEY2
constexpr uint8_t VOLUME_BUTTON_MASK = 0x08;  // EXIO11 / KEY3
constexpr size_t ECHO_DELAY_FRAMES = SAMPLE_RATE / 4;

enum class VoiceEffect : uint8_t {
  Normal,
  Robot,
  Monster,
  Helium,
  Echo,
  Count,
};

enum class UserAction : uint8_t {
  Record,
  EffectChanged,
  VolumeChanged,
  ModeMenu,
};

enum class OperatingMode : uint8_t {
  VoiceStudio,
  AiStory,
  Count,
};

struct ExpectedDevice {
  uint8_t address;
  const char *name;
  const char *role;
};

struct VolumeState {
  size_t levelIndex;
  bool muted;
};

constexpr std::array<ExpectedDevice, 4> EXPECTED_DEVICES{{
    {0x18, "ES8311", "speaker codec"},
    {0x20, "TCA9555", "I/O expander"},
    {0x40, "ES7210", "microphone codec"},
    {0x51, "PCF85063", "RTC"},
}};

i2c_master_bus_handle_t controlBus = nullptr;
i2c_master_dev_handle_t ioExpander = nullptr;
i2s_chan_handle_t txChannel = nullptr;
i2s_chan_handle_t rxChannel = nullptr;
const audio_codec_data_if_t *recordData = nullptr;
const audio_codec_ctrl_if_t *recordControl = nullptr;
const audio_codec_if_t *recordCodec = nullptr;
esp_codec_dev_handle_t recordDevice = nullptr;
const audio_codec_data_if_t *playData = nullptr;
const audio_codec_ctrl_if_t *playControl = nullptr;
const audio_codec_gpio_if_t *playGpio = nullptr;
const audio_codec_if_t *playCodec = nullptr;
esp_codec_dev_handle_t playDevice = nullptr;
led_strip_handle_t statusLeds = nullptr;

esp_err_t setStatusLeds(size_t count, uint8_t red, uint8_t green, uint8_t blue) {
  if (statusLeds == nullptr) return ESP_ERR_INVALID_STATE;
  esp_err_t result = led_strip_clear(statusLeds);
  if (result != ESP_OK) return result;
  if (count > STATUS_LED_COUNT) count = STATUS_LED_COUNT;
  for (size_t index = 0; index < count; index++) {
    result = led_strip_set_pixel(statusLeds, index, red, green, blue);
    if (result != ESP_OK) return result;
  }
  return led_strip_refresh(statusLeds);
}

const char *effectName(VoiceEffect effect) {
  switch (effect) {
    case VoiceEffect::Normal: return "Normal";
    case VoiceEffect::Robot: return "Robot";
    case VoiceEffect::Monster: return "Monster";
    case VoiceEffect::Helium: return "Helium";
    case VoiceEffect::Echo: return "Echo";
    default: return "Unknown";
  }
}

void showReadyEffect(VoiceEffect effect) {
  switch (effect) {
    case VoiceEffect::Normal:
      setStatusLeds(1, 0, STATUS_LED_BRIGHTNESS, 0);
      break;
    case VoiceEffect::Robot:
      setStatusLeds(2, 0, STATUS_LED_BRIGHTNESS, STATUS_LED_BRIGHTNESS);
      break;
    case VoiceEffect::Monster:
      setStatusLeds(3, STATUS_LED_BRIGHTNESS, 0, STATUS_LED_BRIGHTNESS);
      break;
    case VoiceEffect::Helium:
      setStatusLeds(4, STATUS_LED_BRIGHTNESS, STATUS_LED_BRIGHTNESS, 0);
      break;
    case VoiceEffect::Echo:
      setStatusLeds(5, STATUS_LED_BRIGHTNESS, STATUS_LED_BRIGHTNESS, STATUS_LED_BRIGHTNESS);
      break;
    default:
      setStatusLeds(1, 0, STATUS_LED_BRIGHTNESS, 0);
      break;
  }
}

void showVolumeFeedback(const VolumeState &volume) {
  if (volume.muted) {
    setStatusLeds(STATUS_LED_COUNT, STATUS_LED_BRIGHTNESS, STATUS_LED_BRIGHTNESS / 4, 0);
  } else {
    setStatusLeds(volume.levelIndex + 1,
        STATUS_LED_BRIGHTNESS, STATUS_LED_BRIGHTNESS, 0);
  }
}

const char *modeName(OperatingMode mode) {
  return mode == OperatingMode::AiStory ? "AI Story" : "Voice Studio";
}

void showModeSelection(OperatingMode mode) {
  if (mode == OperatingMode::AiStory) {
    setStatusLeds(STATUS_LED_COUNT, STATUS_LED_BRIGHTNESS, 0, STATUS_LED_BRIGHTNESS);
  } else {
    setStatusLeds(STATUS_LED_COUNT, 0, STATUS_LED_BRIGHTNESS, 0);
  }
}

esp_err_t initializeStatusLeds() {
  led_strip_config_t stripConfig{};
  stripConfig.strip_gpio_num = STATUS_LED_GPIO;
  stripConfig.max_leds = STATUS_LED_COUNT;
  stripConfig.led_model = LED_MODEL_WS2812;
  stripConfig.color_component_format = LED_STRIP_COLOR_COMPONENT_FMT_RGB;
  stripConfig.flags.invert_out = false;

  led_strip_rmt_config_t rmtConfig{};
  rmtConfig.clk_src = RMT_CLK_SRC_DEFAULT;
  rmtConfig.resolution_hz = 10 * 1000 * 1000;
  rmtConfig.mem_block_symbols = 0;
  rmtConfig.flags.with_dma = false;
  return led_strip_new_rmt_device(&stripConfig, &rmtConfig, &statusLeds);
}

void secureErase(void *memory, size_t size) {
  volatile uint8_t *bytes = static_cast<volatile uint8_t *>(memory);
  while (size-- > 0) *bytes++ = 0;
}

esp_err_t initializeControlBus() {
  i2c_master_bus_config_t config{};
  config.i2c_port = I2C_PORT;
  config.sda_io_num = I2C_SDA;
  config.scl_io_num = I2C_SCL;
  config.clk_source = I2C_CLK_SRC_DEFAULT;
  config.glitch_ignore_cnt = 7;
  config.flags.enable_internal_pullup = true;
  return i2c_new_master_bus(&config, &controlBus);
}

bool probeAddress(uint8_t address) {
  return controlBus != nullptr && i2c_master_probe(controlBus, address, 50) == ESP_OK;
}

bool probeExpectedDevices() {
  unsigned detected = 0;
  for (const auto &device : EXPECTED_DEVICES) {
    if (probeAddress(device.address)) {
      detected++;
      feedbackInfo(TAG, "%s detected at 0x%02X (%s)", device.name, device.address, device.role);
    } else {
      feedbackWarning(TAG, "%s missing at 0x%02X (%s)", device.name, device.address, device.role);
    }
  }
  feedbackInfo(TAG, "Hardware probe complete: %u/%u expected devices detected",
      detected, static_cast<unsigned>(EXPECTED_DEVICES.size()));
  return detected == EXPECTED_DEVICES.size();
}

esp_err_t readExpanderRegister(uint8_t reg, uint8_t *value) {
  if (ioExpander == nullptr || value == nullptr) return ESP_ERR_INVALID_STATE;
  return i2c_master_transmit_receive(ioExpander, &reg, 1, value, 1, 50);
}

esp_err_t writeExpanderRegister(uint8_t reg, uint8_t value) {
  if (ioExpander == nullptr) return ESP_ERR_INVALID_STATE;
  const uint8_t command[] = {reg, value};
  return i2c_master_transmit(ioExpander, command, sizeof(command), 50);
}

esp_err_t initializeSpeakerAmplifierControl() {
  i2c_device_config_t config{};
  config.dev_addr_length = I2C_ADDR_BIT_LEN_7;
  config.device_address = TCA9555_ADDRESS;
  config.scl_speed_hz = 400000;
  return i2c_master_bus_add_device(controlBus, &config, &ioExpander);
}

esp_err_t configureFunctionButtons() {
  uint8_t direction = 0;
  esp_err_t result = readExpanderRegister(TCA9555_CONFIG_PORT_1, &direction);
  if (result != ESP_OK) return result;
  direction = static_cast<uint8_t>(direction | EFFECT_BUTTON_MASK
      | RECORD_BUTTON_MASK | VOLUME_BUTTON_MASK);
  return writeExpanderRegister(TCA9555_CONFIG_PORT_1, direction);
}

esp_err_t readButtonPressed(uint8_t mask, bool *pressed) {
  if (pressed == nullptr) return ESP_ERR_INVALID_ARG;
  uint8_t input = 0;
  const esp_err_t result = readExpanderRegister(TCA9555_INPUT_PORT_1, &input);
  if (result == ESP_OK) *pressed = (input & mask) == 0;
  return result;
}

esp_err_t waitForButtonState(uint8_t mask, bool expectedPressed) {
  unsigned stableChecks = 0;
  while (stableChecks < 3) {
    bool pressed = false;
    const esp_err_t result = readButtonPressed(mask, &pressed);
    if (result != ESP_OK) return result;
    stableChecks = pressed == expectedPressed ? stableChecks + 1 : 0;
    vTaskDelay(pdMS_TO_TICKS(20));
  }
  return ESP_OK;
}

esp_err_t selectOperatingMode(OperatingMode *mode) {
  if (mode == nullptr) return ESP_ERR_INVALID_ARG;
  *mode = OperatingMode::VoiceStudio;
  showModeSelection(*mode);
  feedbackInfo(TAG,
      "Mode selection: %s; left button changes, middle button confirms", modeName(*mode));
  unsigned recordStableChecks = 0;
  unsigned nextStableChecks = 0;
  while (true) {
    uint8_t input = 0;
    const esp_err_t result = readExpanderRegister(TCA9555_INPUT_PORT_1, &input);
    if (result != ESP_OK) return result;
    const bool confirmPressed = (input & RECORD_BUTTON_MASK) == 0;
    const bool nextPressed = (input & EFFECT_BUTTON_MASK) == 0;
    recordStableChecks = confirmPressed ? recordStableChecks + 1 : 0;
    nextStableChecks = nextPressed ? nextStableChecks + 1 : 0;

    if (recordStableChecks >= 3) {
      const esp_err_t releaseResult = waitForButtonState(RECORD_BUTTON_MASK, false);
      if (releaseResult != ESP_OK) return releaseResult;
      feedbackInfo(TAG, "Mode confirmed: %s", modeName(*mode));
      return ESP_OK;
    }
    if (nextStableChecks >= 3) {
      const uint8_t next = (static_cast<uint8_t>(*mode) + 1)
          % static_cast<uint8_t>(OperatingMode::Count);
      *mode = static_cast<OperatingMode>(next);
      showModeSelection(*mode);
      feedbackInfo(TAG, "Mode selected: %s", modeName(*mode));
      const esp_err_t releaseResult = waitForButtonState(EFFECT_BUTTON_MASK, false);
      if (releaseResult != ESP_OK) return releaseResult;
      nextStableChecks = 0;
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

esp_err_t waitForUserAction(
    VoiceEffect *effect, VolumeState *volume, UserAction *action) {
  if (effect == nullptr || volume == nullptr || action == nullptr) {
    return ESP_ERR_INVALID_ARG;
  }
  unsigned recordStableChecks = 0;
  unsigned effectStableChecks = 0;
  unsigned volumeStableChecks = 0;
  while (true) {
    uint8_t input = 0;
    const esp_err_t result = readExpanderRegister(TCA9555_INPUT_PORT_1, &input);
    if (result != ESP_OK) return result;

    const bool recordPressed = (input & RECORD_BUTTON_MASK) == 0;
    const bool effectPressed = (input & EFFECT_BUTTON_MASK) == 0;
    const bool volumePressed = (input & VOLUME_BUTTON_MASK) == 0;
    recordStableChecks = recordPressed ? recordStableChecks + 1 : 0;
    if (recordStableChecks >= 3) {
      *action = UserAction::Record;
      return ESP_OK;
    }

    if (effectPressed) {
      effectStableChecks++;
      if (effectStableChecks >= 3) {
        unsigned heldChecks = effectStableChecks;
        while (true) {
          bool stillPressed = false;
          const esp_err_t heldResult = readButtonPressed(EFFECT_BUTTON_MASK, &stillPressed);
          if (heldResult != ESP_OK) return heldResult;
          if (!stillPressed) {
            const uint8_t next = (static_cast<uint8_t>(*effect) + 1)
                % static_cast<uint8_t>(VoiceEffect::Count);
            *effect = static_cast<VoiceEffect>(next);
            showReadyEffect(*effect);
            feedbackInfo(TAG, "Effect selected: %s", effectName(*effect));
            *action = UserAction::EffectChanged;
            return ESP_OK;
          }
          heldChecks++;
          if (heldChecks >= 50) {
            const esp_err_t releaseResult = waitForButtonState(EFFECT_BUTTON_MASK, false);
            if (releaseResult != ESP_OK) return releaseResult;
            *action = UserAction::ModeMenu;
            return ESP_OK;
          }
          vTaskDelay(pdMS_TO_TICKS(20));
        }
      }
    } else {
      effectStableChecks = 0;
    }

    if (volumePressed) {
      volumeStableChecks++;
      if (volumeStableChecks >= 3) {
        unsigned heldChecks = volumeStableChecks;
        while (true) {
          bool stillPressed = false;
          const esp_err_t heldResult = readButtonPressed(VOLUME_BUTTON_MASK, &stillPressed);
          if (heldResult != ESP_OK) return heldResult;
          if (!stillPressed) {
            volume->levelIndex = (volume->levelIndex + 1) % OUTPUT_VOLUME_LEVELS.size();
            volume->muted = false;
            *action = UserAction::VolumeChanged;
            return ESP_OK;
          }
          heldChecks++;
          if (heldChecks >= 50) {
            const esp_err_t releaseResult = waitForButtonState(VOLUME_BUTTON_MASK, false);
            if (releaseResult != ESP_OK) return releaseResult;
            volume->muted = !volume->muted;
            *action = UserAction::VolumeChanged;
            return ESP_OK;
          }
          vTaskDelay(pdMS_TO_TICKS(20));
        }
      }
    } else {
      volumeStableChecks = 0;
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

esp_err_t applyOutputVolume(const VolumeState &volume) {
  const int outputVolume = volume.muted ? 0 : OUTPUT_VOLUME_LEVELS[volume.levelIndex];
  const int result = esp_codec_dev_set_out_vol(playDevice, outputVolume);
  if (result != ESP_CODEC_DEV_OK) return ESP_FAIL;
  feedbackInfo(TAG, "Output volume: %d%% (%s)", outputVolume,
      volume.muted ? "muted" : "active");
  return ESP_OK;
}

esp_err_t setSpeakerAmplifier(bool enabled) {
  uint8_t output = 0;
  uint8_t direction = 0;
  esp_err_t result = readExpanderRegister(TCA9555_OUTPUT_PORT_1, &output);
  if (result != ESP_OK) return result;
  result = readExpanderRegister(TCA9555_CONFIG_PORT_1, &direction);
  if (result != ESP_OK) return result;

  output = enabled ? static_cast<uint8_t>(output | SPEAKER_PA_MASK)
                   : static_cast<uint8_t>(output & ~SPEAKER_PA_MASK);
  result = writeExpanderRegister(TCA9555_OUTPUT_PORT_1, output);
  if (result != ESP_OK) return result;

  direction = static_cast<uint8_t>(direction & ~SPEAKER_PA_MASK);
  result = writeExpanderRegister(TCA9555_CONFIG_PORT_1, direction);
  if (result == ESP_OK) {
    feedbackInfo(TAG, "Speaker amplifier %s through TCA9555 EXIO8",
        enabled ? "enabled" : "disabled");
  }
  return result;
}

esp_err_t initializeI2s() {
  i2s_chan_config_t channelConfig = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
  esp_err_t result = i2s_new_channel(&channelConfig, &txChannel, &rxChannel);
  if (result != ESP_OK) return result;

  i2s_std_config_t streamConfig{};
  streamConfig.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE);
  streamConfig.slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
      I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO);
  streamConfig.gpio_cfg.mclk = I2S_MCLK;
  streamConfig.gpio_cfg.bclk = I2S_BCLK;
  streamConfig.gpio_cfg.ws = I2S_WS;
  streamConfig.gpio_cfg.dout = I2S_DOUT;
  streamConfig.gpio_cfg.din = I2S_DIN;
  streamConfig.gpio_cfg.invert_flags.mclk_inv = false;
  streamConfig.gpio_cfg.invert_flags.bclk_inv = false;
  streamConfig.gpio_cfg.invert_flags.ws_inv = false;

  result = i2s_channel_init_std_mode(txChannel, &streamConfig);
  if (result != ESP_OK) return result;
  result = i2s_channel_init_std_mode(rxChannel, &streamConfig);
  if (result != ESP_OK) return result;
  result = i2s_channel_enable(txChannel);
  if (result != ESP_OK) return result;
  return i2s_channel_enable(rxChannel);
}

esp_err_t initializeRecordCodec() {
  audio_codec_i2s_cfg_t dataConfig{};
  dataConfig.port = I2S_NUM_1;
  dataConfig.rx_handle = rxChannel;
  recordData = audio_codec_new_i2s_data(&dataConfig);

  audio_codec_i2c_cfg_t controlConfig{};
  controlConfig.addr = ES7210_CODEC_DEFAULT_ADDR;
  controlConfig.bus_handle = controlBus;
  recordControl = audio_codec_new_i2c_ctrl(&controlConfig);

  es7210_codec_cfg_t codecConfig{};
  codecConfig.ctrl_if = recordControl;
  codecConfig.mic_selected = ES7210_SEL_MIC1 | ES7210_SEL_MIC2
      | ES7210_SEL_MIC3 | ES7210_SEL_MIC4;
  recordCodec = es7210_codec_new(&codecConfig);

  if (recordData == nullptr || recordControl == nullptr || recordCodec == nullptr) {
    return ESP_ERR_NO_MEM;
  }

  esp_codec_dev_cfg_t deviceConfig{};
  deviceConfig.codec_if = recordCodec;
  deviceConfig.data_if = recordData;
  deviceConfig.dev_type = ESP_CODEC_DEV_TYPE_IN;
  recordDevice = esp_codec_dev_new(&deviceConfig);
  if (recordDevice == nullptr) return ESP_ERR_NO_MEM;

  esp_codec_dev_sample_info_t format{};
  format.sample_rate = SAMPLE_RATE;
  format.channel = 2;
  format.bits_per_sample = 32;
  esp_err_t result = esp_codec_dev_open(recordDevice, &format);
  if (result != ESP_CODEC_DEV_OK) return ESP_FAIL;

  for (int channel = 0; channel < 4; channel++) {
    esp_codec_dev_set_in_channel_gain(
        recordDevice, ESP_CODEC_DEV_MAKE_CHANNEL_MASK(channel), INPUT_GAIN_DB);
  }
  return ESP_OK;
}

esp_err_t initializePlayCodec() {
  audio_codec_i2s_cfg_t dataConfig{};
  dataConfig.port = I2S_NUM_1;
  dataConfig.tx_handle = txChannel;
  playData = audio_codec_new_i2s_data(&dataConfig);

  audio_codec_i2c_cfg_t controlConfig{};
  controlConfig.addr = ES8311_CODEC_DEFAULT_ADDR;
  controlConfig.bus_handle = controlBus;
  playControl = audio_codec_new_i2c_ctrl(&controlConfig);
  playGpio = audio_codec_new_gpio();

  es8311_codec_cfg_t codecConfig{};
  codecConfig.codec_mode = ESP_CODEC_DEV_WORK_MODE_DAC;
  codecConfig.ctrl_if = playControl;
  codecConfig.gpio_if = playGpio;
  codecConfig.pa_pin = GPIO_NUM_NC;
  codecConfig.use_mclk = false;
  playCodec = es8311_codec_new(&codecConfig);

  if (playData == nullptr || playControl == nullptr || playGpio == nullptr || playCodec == nullptr) {
    return ESP_ERR_NO_MEM;
  }

  esp_codec_dev_cfg_t deviceConfig{};
  deviceConfig.codec_if = playCodec;
  deviceConfig.data_if = playData;
  deviceConfig.dev_type = ESP_CODEC_DEV_TYPE_OUT;
  playDevice = esp_codec_dev_new(&deviceConfig);
  if (playDevice == nullptr) return ESP_ERR_NO_MEM;

  esp_codec_dev_sample_info_t format{};
  format.sample_rate = SAMPLE_RATE;
  format.channel = OUTPUT_CHANNELS;
  format.bits_per_sample = 32;
  esp_err_t result = esp_codec_dev_open(playDevice, &format);
  if (result != ESP_CODEC_DEV_OK) return ESP_FAIL;
  result = esp_codec_dev_set_out_vol(playDevice, SAFE_OUTPUT_VOLUME);
  return result == ESP_CODEC_DEV_OK ? ESP_OK : ESP_FAIL;
}

void releaseAudioHardware() {
  const bool recordCodecOwnedRx = recordDevice != nullptr;
  const bool playCodecOwnedTx = playDevice != nullptr;
  if (ioExpander != nullptr) {
    const esp_err_t result = setSpeakerAmplifier(false);
    if (result != ESP_OK) {
      feedbackWarning(TAG, "Unable to disable speaker amplifier: %s", esp_err_to_name(result));
    }
  }
  if (recordDevice != nullptr) {
    esp_codec_dev_close(recordDevice);
    esp_codec_dev_delete(recordDevice);
    recordDevice = nullptr;
  }
  if (playDevice != nullptr) {
    esp_codec_dev_close(playDevice);
    esp_codec_dev_delete(playDevice);
    playDevice = nullptr;
  }
  if (recordCodec != nullptr) audio_codec_delete_codec_if(recordCodec);
  if (recordControl != nullptr) audio_codec_delete_ctrl_if(recordControl);
  if (recordData != nullptr) audio_codec_delete_data_if(recordData);
  if (playCodec != nullptr) audio_codec_delete_codec_if(playCodec);
  if (playControl != nullptr) audio_codec_delete_ctrl_if(playControl);
  if (playGpio != nullptr) audio_codec_delete_gpio_if(playGpio);
  if (playData != nullptr) audio_codec_delete_data_if(playData);

  if (rxChannel != nullptr) {
    if (!recordCodecOwnedRx) i2s_channel_disable(rxChannel);
    i2s_del_channel(rxChannel);
    rxChannel = nullptr;
  }
  if (txChannel != nullptr) {
    if (!playCodecOwnedTx) i2s_channel_disable(txChannel);
    i2s_del_channel(txChannel);
    txChannel = nullptr;
  }
  if (ioExpander != nullptr) {
    i2c_master_bus_rm_device(ioExpander);
    ioExpander = nullptr;
  }
  if (controlBus != nullptr) {
    i2c_del_master_bus(controlBus);
    controlBus = nullptr;
  }
  if (statusLeds != nullptr) {
    led_strip_clear(statusLeds);
    led_strip_del(statusLeds);
    statusLeds = nullptr;
  }
}

esp_err_t captureAudioWhilePressed(int16_t *recording, size_t *recordedFrames) {
  if (recordedFrames == nullptr) return ESP_ERR_INVALID_ARG;
  size_t offset = 0;
  unsigned releasedChecks = 0;
  while (offset < RECORD_CAPACITY_BYTES) {
    bool pressed = false;
    const esp_err_t buttonResult = readButtonPressed(RECORD_BUTTON_MASK, &pressed);
    if (buttonResult != ESP_OK) return buttonResult;
    if (!pressed) {
      releasedChecks++;
      if (releasedChecks >= 2) break;
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }
    releasedChecks = 0;
    const size_t bytes = (RECORD_CAPACITY_BYTES - offset) < 4096
        ? (RECORD_CAPACITY_BYTES - offset) : 4096;
    const int readResult = esp_codec_dev_read(
        recordDevice, reinterpret_cast<uint8_t *>(recording) + offset, static_cast<int>(bytes));
    if (readResult != ESP_CODEC_DEV_OK) return ESP_FAIL;
    offset += bytes;
  }
  *recordedFrames = offset / (INPUT_CHANNELS * sizeof(int16_t));
  return ESP_OK;
}

struct RecordingLevel {
  int32_t mic1Peak;
  int32_t mic2Peak;
  size_t selectedWord;
  int32_t digitalGain;
};

RecordingLevel analyzeRecordingLevel(const int16_t *recording, size_t recordedFrames) {
  RecordingLevel level{0, 0, 1, 1};
  for (size_t frame = 0; frame < recordedFrames; frame++) {
    const size_t input = frame * INPUT_CHANNELS;
    const int32_t mic1 = recording[input + 1];
    const int32_t mic2 = recording[input + 3];
    const int32_t mic1Magnitude = mic1 < 0 ? -mic1 : mic1;
    const int32_t mic2Magnitude = mic2 < 0 ? -mic2 : mic2;
    if (mic1Magnitude > level.mic1Peak) level.mic1Peak = mic1Magnitude;
    if (mic2Magnitude > level.mic2Peak) level.mic2Peak = mic2Magnitude;
  }
  level.selectedWord = level.mic2Peak > level.mic1Peak ? 3 : 1;
  const int32_t selectedPeak = level.selectedWord == 3 ? level.mic2Peak : level.mic1Peak;
  if (selectedPeak > 0 && selectedPeak < PLAYBACK_TARGET_PEAK) {
    level.digitalGain = PLAYBACK_TARGET_PEAK / selectedPeak;
    if (level.digitalGain > MAX_DIGITAL_GAIN) level.digitalGain = MAX_DIGITAL_GAIN;
  }
  feedbackInfo(TAG, "Recording peaks: mic1=%ld mic2=%ld; selected mic%u; playback gain=%ldx",
      static_cast<long>(level.mic1Peak), static_cast<long>(level.mic2Peak),
      level.selectedWord == 1 ? 1U : 2U, static_cast<long>(level.digitalGain));
  return level;
}

int32_t amplifiedSample(
    const int16_t *recording, size_t frame, const RecordingLevel &level) {
  const size_t input = frame * INPUT_CHANNELS;
  int32_t sample = static_cast<int32_t>(recording[input + level.selectedWord])
      * level.digitalGain;
  if (sample > 32767) sample = 32767;
  if (sample < -32768) sample = -32768;
  return sample;
}

size_t effectOutputFrames(VoiceEffect effect, size_t recordedFrames) {
  if (effect == VoiceEffect::Monster) return recordedFrames * 3 / 2;
  if (effect == VoiceEffect::Helium) return recordedFrames / 2;
  return recordedFrames;
}

int32_t effectSample(const int16_t *recording, size_t recordedFrames,
    size_t outputFrame, const RecordingLevel &level, VoiceEffect effect) {
  size_t sourceFrame = outputFrame;
  if (effect == VoiceEffect::Monster) sourceFrame = outputFrame * 2 / 3;
  if (effect == VoiceEffect::Helium) sourceFrame = outputFrame * 2;
  if (sourceFrame >= recordedFrames) sourceFrame = recordedFrames - 1;

  int32_t sample = amplifiedSample(recording, sourceFrame, level);
  if (effect == VoiceEffect::Robot) {
    sample = (sample / 1024) * 1024;
    const size_t halfPeriod = SAMPLE_RATE / 140;
    if (((outputFrame / halfPeriod) & 1U) != 0) sample = -sample;
  } else if (effect == VoiceEffect::Echo && sourceFrame >= ECHO_DELAY_FRAMES) {
    sample += amplifiedSample(recording, sourceFrame - ECHO_DELAY_FRAMES, level) / 2;
  }
  if (sample > 32767) sample = 32767;
  if (sample < -32768) sample = -32768;
  return sample;
}

esp_err_t playAudio(const int16_t *recording, size_t recordedFrames,
    const RecordingLevel &level, VoiceEffect effect) {
  std::array<int32_t, IO_FRAMES * OUTPUT_CHANNELS> output{};
  const size_t outputFrames = effectOutputFrames(effect, recordedFrames);
  for (size_t frameOffset = 0; frameOffset < outputFrames; frameOffset += IO_FRAMES) {
    const size_t frameCount = (outputFrames - frameOffset) < IO_FRAMES
        ? (outputFrames - frameOffset) : IO_FRAMES;
    for (size_t frame = 0; frame < frameCount; frame++) {
      // ES7210 exposes the useful microphone words at indices 1 and 3 of
      // each pair of 32-bit stereo slots (Waveshare input format "RMNM").
      // Selecting the stronger channel avoids phase cancellation between
      // the two physically separated microphones.
      const int32_t mono16 = effectSample(
          recording, recordedFrames, frameOffset + frame, level, effect);
      const int32_t mono = mono16 * 65536;
      output[frame * 2] = mono;
      output[frame * 2 + 1] = mono;
    }
    const int result = esp_codec_dev_write(
        playDevice, output.data(), static_cast<int>(frameCount * OUTPUT_CHANNELS * sizeof(int32_t)));
    if (result != ESP_CODEC_DEV_OK) return ESP_FAIL;
  }
  secureErase(output.data(), output.size() * sizeof(output[0]));
  return ESP_OK;
}

esp_err_t playStoredRecording(const int16_t *recording, size_t recordedFrames,
    const RecordingLevel &level, VoiceEffect effect) {
  setStatusLeds(STATUS_LED_COUNT, 0, 0, STATUS_LED_BRIGHTNESS);
  feedbackInfo(TAG, "Playing retained recording with effect: %s", effectName(effect));
  esp_err_t result = setSpeakerAmplifier(true);
  if (result == ESP_OK) {
    vTaskDelay(pdMS_TO_TICKS(50));
    result = playAudio(recording, recordedFrames, level, effect);
  }
  const esp_err_t amplifierResult = setSpeakerAmplifier(false);
  if (result == ESP_OK && amplifierResult != ESP_OK) result = amplifierResult;
  return result;
}

void audioDemoTask(void *) {
  feedbackInfo(TAG, "Nexi Basic local voice studio is starting");
  const esp_err_t ledResult = initializeStatusLeds();
  if (ledResult != ESP_OK) {
    feedbackWarning(TAG, "Status LEDs unavailable: %s", esp_err_to_name(ledResult));
  }
  vTaskDelay(pdMS_TO_TICKS(2000));

  esp_err_t result = initializeControlBus();
  if (result != ESP_OK || !probeExpectedDevices()) {
    feedbackError(TAG, "Audio control hardware is not ready");
    releaseAudioHardware();
    vTaskDelete(nullptr);
    return;
  }

  result = initializeI2s();
  if (result == ESP_OK) result = initializeRecordCodec();
  if (result == ESP_OK) result = initializePlayCodec();
  if (result == ESP_OK) result = initializeSpeakerAmplifierControl();
  if (result == ESP_OK) result = configureFunctionButtons();
  if (result == ESP_OK) result = setSpeakerAmplifier(false);
  if (result != ESP_OK) {
    feedbackError(TAG, "Audio initialization failed: %s", esp_err_to_name(result));
    releaseAudioHardware();
    vTaskDelete(nullptr);
    return;
  }
  vTaskDelay(pdMS_TO_TICKS(50));

  int16_t *recording = static_cast<int16_t *>(
      heap_caps_malloc(RECORD_CAPACITY_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (recording == nullptr) {
    feedbackError(TAG, "Unable to reserve %u bytes of PSRAM for recording",
        static_cast<unsigned>(RECORD_CAPACITY_BYTES));
    releaseAudioHardware();
    vTaskDelete(nullptr);
    return;
  }

  VolumeState volume{OUTPUT_VOLUME_LEVELS.size() - 1, false};

  while (result == ESP_OK) {
    OperatingMode operatingMode = OperatingMode::VoiceStudio;
    result = selectOperatingMode(&operatingMode);
    if (result != ESP_OK) break;

    if (operatingMode == OperatingMode::AiStory) {
      feedbackWarning(TAG,
          "AI Story mode is not available until the GerNetiX voice service is configured");
      for (unsigned blink = 0; blink < 3; blink++) {
        setStatusLeds(STATUS_LED_COUNT, STATUS_LED_BRIGHTNESS, 0, 0);
        vTaskDelay(pdMS_TO_TICKS(200));
        setStatusLeds(0, 0, 0, 0);
        vTaskDelay(pdMS_TO_TICKS(200));
      }
      continue;
    }

    secureErase(recording, RECORD_CAPACITY_BYTES);
    VoiceEffect selectedEffect = VoiceEffect::Normal;
    size_t retainedFrames = 0;
    RecordingLevel retainedLevel{0, 0, 1, 1};
    bool returnToModeMenu = false;
    while (result == ESP_OK && !returnToModeMenu) {
      showReadyEffect(selectedEffect);
      feedbackInfo(TAG,
          "Ready: effect=%s; left selects effect, long left returns to mode menu, "
          "middle records, right controls volume",
          effectName(selectedEffect));
      UserAction action = UserAction::Record;
      result = waitForUserAction(&selectedEffect, &volume, &action);
      if (result != ESP_OK) break;

      if (action == UserAction::ModeMenu) {
        secureErase(recording, RECORD_CAPACITY_BYTES);
        retainedFrames = 0;
        returnToModeMenu = true;
        feedbackInfo(TAG, "Returning to mode selection");
        continue;
      }
      if (action == UserAction::EffectChanged) {
        if (retainedFrames == 0) {
          feedbackInfo(TAG, "No recording retained yet; hold the middle button first");
          continue;
        }
        result = playStoredRecording(
            recording, retainedFrames, retainedLevel, selectedEffect);
        if (result != ESP_OK) break;
        setStatusLeds(STATUS_LED_COUNT, 0, STATUS_LED_BRIGHTNESS, 0);
        vTaskDelay(pdMS_TO_TICKS(300));
        continue;
      }
      if (action == UserAction::VolumeChanged) {
        result = applyOutputVolume(volume);
        if (result != ESP_OK) break;
        showVolumeFeedback(volume);
        vTaskDelay(pdMS_TO_TICKS(500));
        continue;
      }

      setStatusLeds(STATUS_LED_COUNT, STATUS_LED_BRIGHTNESS, 0, 0);
      feedbackInfo(TAG, "Recording while middle button is held");
      retainedFrames = 0;
      secureErase(recording, RECORD_CAPACITY_BYTES);
      result = captureAudioWhilePressed(recording, &retainedFrames);
      if (result != ESP_OK) break;
      result = waitForButtonState(RECORD_BUTTON_MASK, false);
      if (result != ESP_OK) break;

      const unsigned durationMs = static_cast<unsigned>(retainedFrames * 1000 / SAMPLE_RATE);
      feedbackInfo(TAG, "Recording stopped after %u ms", durationMs);
      if (retainedFrames < MIN_RECORD_FRAMES) {
        feedbackWarning(TAG, "Recording was too short; hold the button for at least 100 ms");
        secureErase(recording, RECORD_CAPACITY_BYTES);
        retainedFrames = 0;
        continue;
      }

      retainedLevel = analyzeRecordingLevel(recording, retainedFrames);
      result = playStoredRecording(
          recording, retainedFrames, retainedLevel, selectedEffect);
      if (result != ESP_OK) break;

      setStatusLeds(STATUS_LED_COUNT, 0, STATUS_LED_BRIGHTNESS, 0);
      feedbackInfo(TAG,
          "Playback complete; recording retained in volatile PSRAM for effect previews");
      vTaskDelay(pdMS_TO_TICKS(500));
    }
  }

  secureErase(recording, RECORD_CAPACITY_BYTES);
  heap_caps_free(recording);
  feedbackError(TAG, "Voice Lab stopped after hardware error: %s", esp_err_to_name(result));
  releaseAudioHardware();
  vTaskDelete(nullptr);
}
}

extern "C" void onProjectInit() {
  feedbackInfo(TAG,
      "Nexi Basic starting from the Waveshare Voice Lab with GerNetiX basis software");
  BaseType_t created = xTaskCreate(
      audioDemoTask, "voice-lab-audio", 8192, nullptr, 5, nullptr);
  if (created != pdPASS) feedbackError(TAG, "Unable to start bounded audio demo task");
}

extern "C" void onProjectTick() {
}
