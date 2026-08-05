#include "nexi/hardware_platform.h"

#include <array>

#include "basissoftware/feedback.h"
#include "driver/i2c_master.h"
#include "driver/i2s_std.h"
#include "esp_codec_dev.h"
#include "esp_codec_dev_defaults.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "led_strip.h"
#include "nexi/voice_effects.h"

namespace nexi {
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
constexpr size_t OUTPUT_CHANNELS = 2;
constexpr int INPUT_GAIN_DB = 30;
constexpr int SAFE_OUTPUT_VOLUME = 100;
constexpr gpio_num_t STATUS_LED_GPIO = GPIO_NUM_38;
constexpr uint8_t TCA9555_ADDRESS = 0x20;
constexpr uint8_t TCA9555_INPUT_PORT_1 = 0x01;
constexpr uint8_t TCA9555_OUTPUT_PORT_1 = 0x03;
constexpr uint8_t TCA9555_CONFIG_PORT_1 = 0x07;
constexpr uint8_t SPEAKER_PA_MASK = 0x01;  // EXIO8
constexpr uint8_t EFFECT_BUTTON_MASK = 0x02;  // EXIO9 / KEY1
constexpr uint8_t RECORD_BUTTON_MASK = 0x04;  // EXIO10 / KEY2
constexpr uint8_t VOLUME_BUTTON_MASK = 0x08;  // EXIO11 / KEY3

struct ExpectedDevice {
  uint8_t address;
  const char *name;
  const char *role;
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

uint8_t buttonMask(BoardButton button) {
  switch (button) {
    case BoardButton::Effect: return EFFECT_BUTTON_MASK;
    case BoardButton::Record: return RECORD_BUTTON_MASK;
    case BoardButton::Volume: return VOLUME_BUTTON_MASK;
  }
  return 0;
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

bool probeExpectedDevices() {
  unsigned detected = 0;
  for (const auto &device : EXPECTED_DEVICES) {
    const bool present = controlBus != nullptr
        && i2c_master_probe(controlBus, device.address, 50) == ESP_OK;
    if (present) {
      detected++;
      feedbackInfo(TAG, "%s detected at 0x%02X (%s)",
          device.name, device.address, device.role);
    } else {
      feedbackWarning(TAG, "%s missing at 0x%02X (%s)",
          device.name, device.address, device.role);
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

esp_err_t initializeI2s() {
  i2s_chan_config_t channelConfig =
      I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_1, I2S_ROLE_MASTER);
  esp_err_t result = i2s_new_channel(&channelConfig, &txChannel, &rxChannel);
  if (result != ESP_OK) return result;

  i2s_std_config_t streamConfig{};
  streamConfig.clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_SAMPLE_RATE);
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
  format.sample_rate = AUDIO_SAMPLE_RATE;
  format.channel = 2;
  format.bits_per_sample = 32;
  if (esp_codec_dev_open(recordDevice, &format) != ESP_CODEC_DEV_OK) return ESP_FAIL;
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
  if (playData == nullptr || playControl == nullptr || playGpio == nullptr
      || playCodec == nullptr) {
    return ESP_ERR_NO_MEM;
  }

  esp_codec_dev_cfg_t deviceConfig{};
  deviceConfig.codec_if = playCodec;
  deviceConfig.data_if = playData;
  deviceConfig.dev_type = ESP_CODEC_DEV_TYPE_OUT;
  playDevice = esp_codec_dev_new(&deviceConfig);
  if (playDevice == nullptr) return ESP_ERR_NO_MEM;

  esp_codec_dev_sample_info_t format{};
  format.sample_rate = AUDIO_SAMPLE_RATE;
  format.channel = OUTPUT_CHANNELS;
  format.bits_per_sample = 32;
  if (esp_codec_dev_open(playDevice, &format) != ESP_CODEC_DEV_OK) return ESP_FAIL;
  return esp_codec_dev_set_out_vol(playDevice, SAFE_OUTPUT_VOLUME)
      == ESP_CODEC_DEV_OK ? ESP_OK : ESP_FAIL;
}

esp_err_t initializeExpander() {
  i2c_device_config_t config{};
  config.dev_addr_length = I2C_ADDR_BIT_LEN_7;
  config.device_address = TCA9555_ADDRESS;
  config.scl_speed_hz = 400000;
  esp_err_t result = i2c_master_bus_add_device(controlBus, &config, &ioExpander);
  if (result != ESP_OK) return result;

  uint8_t direction = 0;
  result = readExpanderRegister(TCA9555_CONFIG_PORT_1, &direction);
  if (result != ESP_OK) return result;
  direction = static_cast<uint8_t>(direction | EFFECT_BUTTON_MASK
      | RECORD_BUTTON_MASK | VOLUME_BUTTON_MASK);
  return writeExpanderRegister(TCA9555_CONFIG_PORT_1, direction);
}
}  // namespace

HardwarePlatform &HardwarePlatform::instance() {
  static HardwarePlatform platform;
  return platform;
}

esp_err_t HardwarePlatform::initializeStatusLeds() {
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

esp_err_t HardwarePlatform::initializeAudioHardware() {
  esp_err_t result = initializeControlBus();
  if (result != ESP_OK) return result;
  if (!probeExpectedDevices()) return ESP_ERR_NOT_FOUND;
  result = initializeI2s();
  if (result == ESP_OK) result = initializeRecordCodec();
  if (result == ESP_OK) result = initializePlayCodec();
  if (result == ESP_OK) result = initializeExpander();
  if (result == ESP_OK) result = setSpeakerAmplifier(false);
  return result;
}

esp_err_t HardwarePlatform::setStatusLeds(
    size_t count, uint8_t red, uint8_t green, uint8_t blue) {
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

esp_err_t HardwarePlatform::setSpeakerAmplifier(bool enabled) {
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

esp_err_t HardwarePlatform::setOutputVolume(int percent) {
  if (playDevice == nullptr) return ESP_ERR_INVALID_STATE;
  return esp_codec_dev_set_out_vol(playDevice, percent)
      == ESP_CODEC_DEV_OK ? ESP_OK : ESP_FAIL;
}

esp_err_t HardwarePlatform::readButtonPressed(
    BoardButton button, bool *pressed) {
  if (pressed == nullptr) return ESP_ERR_INVALID_ARG;
  const uint8_t mask = buttonMask(button);
  if (mask == 0) return ESP_ERR_INVALID_ARG;
  uint8_t input = 0;
  const esp_err_t result = readExpanderRegister(TCA9555_INPUT_PORT_1, &input);
  if (result == ESP_OK) *pressed = (input & mask) == 0;
  return result;
}

esp_err_t HardwarePlatform::waitForButtonState(
    BoardButton button, bool expectedPressed) {
  unsigned stableChecks = 0;
  while (stableChecks < 3) {
    bool pressed = false;
    const esp_err_t result = readButtonPressed(button, &pressed);
    if (result != ESP_OK) return result;
    stableChecks = pressed == expectedPressed ? stableChecks + 1 : 0;
    vTaskDelay(pdMS_TO_TICKS(20));
  }
  return ESP_OK;
}

esp_err_t HardwarePlatform::readAudio(void *destination, size_t bytes) {
  if (recordDevice == nullptr || destination == nullptr) return ESP_ERR_INVALID_STATE;
  return esp_codec_dev_read(recordDevice, destination, static_cast<int>(bytes))
      == ESP_CODEC_DEV_OK ? ESP_OK : ESP_FAIL;
}

esp_err_t HardwarePlatform::writeAudio(const void *source, size_t bytes) {
  if (playDevice == nullptr || source == nullptr) return ESP_ERR_INVALID_STATE;
  return esp_codec_dev_write(
      playDevice, const_cast<void *>(source), static_cast<int>(bytes))
      == ESP_CODEC_DEV_OK ? ESP_OK : ESP_FAIL;
}

void HardwarePlatform::shutdown() {
  const bool recordCodecOwnedRx = recordDevice != nullptr;
  const bool playCodecOwnedTx = playDevice != nullptr;
  if (ioExpander != nullptr) {
    const esp_err_t result = setSpeakerAmplifier(false);
    if (result != ESP_OK) {
      feedbackWarning(TAG, "Unable to disable speaker amplifier: %s",
          esp_err_to_name(result));
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
  recordCodec = nullptr;
  recordControl = nullptr;
  recordData = nullptr;
  playCodec = nullptr;
  playControl = nullptr;
  playGpio = nullptr;
  playData = nullptr;

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

}  // namespace nexi
