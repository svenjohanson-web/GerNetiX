const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const firmwareRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(firmwareRoot, "../..");

test("Waveshare Voice Lab uses the full basis software and the N16R8 target", () => {
  const platformio = fs.readFileSync(path.join(firmwareRoot, "platformio.ini"), "utf8");
  const component = fs.readFileSync(path.join(firmwareRoot, "src/CMakeLists.txt"), "utf8");
  const componentManifest = fs.readFileSync(
    path.join(firmwareRoot, "src/idf_component.yml"),
    "utf8",
  );

  assert.match(platformio, /\[env:waveshare-esp32-s3-audio-voice-lab\]/);
  assert.match(platformio, /extends = env:esp32-s3-16mb-full/);
  assert.match(platformio, /GERNETIX_PROJECT_SOURCE_DIR=.*projects\/waveshare-voice-lab/);
  assert.match(platformio, /GERNETIX_BASISSOFTWARE_PROFILE_FULL=1/);
  assert.match(component, /if\(EXISTS "\$\{CMAKE_CURRENT_SOURCE_DIR\}\/\.\.\/include\/user_project"\)/);
  assert.match(component, /esp_codec_dev/);
  assert.match(componentManifest, /espressif\/esp_codec_dev: \^1\.6\.2/);
  assert.match(componentManifest, /espressif\/led_strip: \^3\.0\.1~1/);
});

test("Waveshare Voice Lab probes the documented audio control devices", () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, "projects/waveshare-voice-lab/voice_lab.cpp"),
    "utf8",
  );

  assert.match(source, /GPIO_NUM_10/);
  assert.match(source, /GPIO_NUM_11/);
  assert.match(source, /\{0x18, "ES8311"/);
  assert.match(source, /\{0x20, "TCA9555"/);
  assert.match(source, /\{0x40, "ES7210"/);
  assert.match(source, /\{0x51, "PCF85063"/);
  assert.match(source, /extern "C" void onProjectInit\(\)/);
  assert.match(source, /driver\/i2c_master\.h/);
  assert.match(source, /i2c_master_probe/);
  assert.doesNotMatch(source, /driver\/i2c\.h/);
  assert.match(source, /MAX_RECORD_SECONDS = 15/);
  assert.match(source, /MALLOC_CAP_SPIRAM/);
  assert.match(source, /esp_codec_dev_read/);
  assert.match(source, /esp_codec_dev_write/);
  assert.match(source, /recording\[input \+ 1\]/);
  assert.match(source, /recording\[input \+ 3\]/);
  assert.match(source, /level\.selectedWord == 3 \? level\.mic2Peak : level\.mic1Peak/);
  assert.match(source, /recording\[input \+ level\.selectedWord\]/);
  assert.match(source, /MAX_DIGITAL_GAIN = 12/);
  assert.match(source, /secureErase\(recording, RECORD_CAPACITY_BYTES\)/);
  assert.match(source, /TCA9555_OUTPUT_PORT_1 = 0x03/);
  assert.match(source, /TCA9555_CONFIG_PORT_1 = 0x07/);
  assert.match(source, /SPEAKER_PA_MASK = 0x01/);
  assert.match(source, /setSpeakerAmplifier\(true\)/);
  assert.match(source, /setSpeakerAmplifier\(false\)/);
  assert.match(source, /SAFE_OUTPUT_VOLUME = 100/);
  assert.match(source, /Recording peaks: mic1=%ld mic2=%ld; selected mic%u; playback gain=%ldx/);
  assert.match(source, /STATUS_LED_GPIO = GPIO_NUM_38/);
  assert.match(source, /STATUS_LED_COUNT = 7/);
  assert.match(source, /RECORD_BUTTON_MASK = 0x04/);
  assert.match(source, /EFFECT_BUTTON_MASK = 0x02/);
  assert.match(source, /waitForButtonState\(RECORD_BUTTON_MASK, false\)/);
  assert.match(source, /waitForUserAction\(&selectedEffect, &action\)/);
  assert.match(source, /UserAction::EffectChanged/);
  assert.match(source, /UserAction::ModeMenu/);
  assert.match(source, /selectOperatingMode\(&operatingMode\)/);
  assert.match(source, /OperatingMode::VoiceStudio/);
  assert.match(source, /OperatingMode::AiStory/);
  assert.match(source, /AI Story mode is not available until the GerNetiX voice service is configured/);
  assert.match(source, /heldChecks >= 50/);
  assert.match(source, /playStoredRecording\(\s*recording, retainedFrames, retainedLevel, selectedEffect\)/);
  assert.match(source, /recording retained in volatile PSRAM for effect previews/);
  assert.match(source, /captureAudioWhilePressed/);
  assert.match(source, /setStatusLeds\(STATUS_LED_COUNT, STATUS_LED_BRIGHTNESS, 0, 0\)/);
  assert.match(source, /enum class VoiceEffect/);
  assert.match(source, /VoiceEffect::Robot/);
  assert.match(source, /VoiceEffect::Monster/);
  assert.match(source, /VoiceEffect::Helium/);
  assert.match(source, /VoiceEffect::Echo/);
  assert.match(source, /recordedFrames \* 3 \/ 2/);
  assert.match(source, /recordedFrames \/ 2/);
  assert.match(source, /ECHO_DELAY_FRAMES = SAMPLE_RATE \/ 4/);
  assert.match(source, /sample = \(sample \/ 1024\) \* 1024/);
});
