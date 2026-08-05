const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const firmwareRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(firmwareRoot, "../..");
const voiceLabRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");

function collectFiles(root, predicate) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectFiles(absolutePath, predicate);
    return predicate(absolutePath) ? [absolutePath] : [];
  });
}

function readProjectCode() {
  const files = [path.join(voiceLabRoot, "voice_lab.cpp")].concat(
    collectFiles(path.join(voiceLabRoot, "include"), (file) => /\.(h|hpp)$/.test(file)),
    collectFiles(path.join(voiceLabRoot, "src"), (file) => /\.(c|cc|cpp)$/.test(file)),
  );
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}

function readProjectModule(relativePath) {
  return fs.readFileSync(path.join(voiceLabRoot, relativePath), "utf8");
}

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
  const source = readProjectCode();

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
  assert.match(source, /mic1Peak/);
  assert.match(source, /mic2Peak/);
  assert.match(source, /selectedWord/);
  assert.match(source, /MAX_DIGITAL_GAIN = 12/);
  assert.match(source, /secureErase/);
  assert.match(source, /setSpeakerAmplifier\(true\)/);
  assert.match(source, /setSpeakerAmplifier\(false\)/);
  assert.match(source, /STATUS_LED_COUNT = 7/);
  assert.match(source, /BoardButton::Record/);
  assert.match(source, /waitForButtonState/);
  assert.match(source, /waitForUserAction/);
  assert.match(source, /UserAction::EffectChanged/);
  assert.match(source, /UserAction::ModeMenu/);
  assert.match(source, /selectOperatingMode/);
  assert.match(source, /OperatingMode::VoiceStudio/);
  assert.match(source, /OperatingMode::AiStory/);
  assert.match(source, /AI Story mode is not available until the GerNetiX voice service is configured/);
  assert.match(source, /recording retained in volatile PSRAM for effect previews/);
  assert.match(source, /captureWhileRecordButtonHeld/);
  assert.match(source, /enum class VoiceEffect/);
  assert.match(source, /VoiceEffect::Robot/);
  assert.match(source, /VoiceEffect::Monster/);
  assert.match(source, /VoiceEffect::Helium/);
  assert.match(source, /VoiceEffect::Echo/);
  assert.match(source, /recordedFrames \* 3 \/ 2/);
  assert.match(source, /recordedFrames \/ 2/);
  assert.match(source, /ECHO_DELAY_FRAMES = AUDIO_SAMPLE_RATE \/ 4/);
  assert.match(source, /sample = \(sample \/ 1024\) \* 1024/);
  assert.match(source, /OUTPUT_VOLUME_LEVELS\{\{20, 40, 60, 80, 100\}\}/);
  assert.match(source, /volume->muted = !volume->muted/);
  assert.match(source, /esp_codec_dev_set_out_vol/);
  assert.match(source, /UserAction::VolumeChanged/);
  assert.match(source, /Nexi Basic local voice studio is starting/);
  assert.doesNotMatch(source, /esp_http_client|https?:\/\/|socket\(/);
});

test("Nexi uses a versioned project boundary and separately compiled product modules", () => {
  const hooks = fs.readFileSync(
    path.join(firmwareRoot, "include/basissoftware/project_hooks.h"),
    "utf8",
  );
  const weakInit = fs.readFileSync(
    path.join(firmwareRoot, "src/hooks/onProjectInit.cpp"),
    "utf8",
  );
  const component = fs.readFileSync(
    path.join(firmwareRoot, "src/CMakeLists.txt"),
    "utf8",
  );
  const entry = readProjectModule("src/project_entry.cpp");

  assert.match(hooks, /GERNETIX_PROJECT_HOOK_API_VERSION 1/);
  assert.match(weakInit, /__attribute__\(\(weak\)\) void onProjectInit/);
  assert.match(component, /GLOB_RECURSE GERNETIX_PROJECT_SOURCES/);
  assert.match(component, /GERNETIX_PROJECT_SOURCE_DIR}\/include/);
  assert.match(entry, /static_assert\(GERNETIX_PROJECT_HOOK_API_VERSION == 1/);
  assert.match(entry, /nexi::startRuntime\(\)/);
  assert.doesNotMatch(entry, /driver\/|esp_codec|i2c_|i2s_/);
});

test("Nexi exposes hardware, audio, intent and application boundaries", () => {
  const expectedPublicContracts = [
    "include/nexi/hardware_platform.h",
    "include/nexi/audio_engine.h",
    "include/nexi/intent.h",
    "include/nexi/input_provider.h",
    "include/nexi/application.h",
    "include/nexi/application_manager.h",
    "include/nexi/capability_policy.h",
    "include/nexi/privacy_gate.h",
  ];
  for (const relativePath of expectedPublicContracts) {
    assert.ok(
      fs.existsSync(path.join(voiceLabRoot, relativePath)),
      `missing Nexi module contract: ${relativePath}`,
    );
  }

  const hardware = readProjectModule("include/nexi/hardware_platform.h");
  const audio = readProjectModule("include/nexi/audio_engine.h");
  const intent = readProjectModule("include/nexi/intent.h");
  const input = readProjectModule("include/nexi/input_provider.h");
  const application = readProjectModule("include/nexi/application.h");
  const manager = readProjectModule("include/nexi/application_manager.h");
  const capability = readProjectModule("include/nexi/capability_policy.h");
  const privacy = readProjectModule("include/nexi/privacy_gate.h");

  assert.match(hardware, /class HardwarePlatform/);
  assert.match(hardware, /readAudio/);
  assert.match(hardware, /writeAudio/);
  assert.doesNotMatch(hardware, /ApplicationId|IntentType|OperatingMode/);

  assert.match(audio, /class AudioEngine/);
  assert.match(audio, /secureErase/);
  assert.doesNotMatch(audio, /esp_http_client|https?:\/\/|socket\s*\(/);

  assert.match(intent, /enum class IntentType/);
  assert.match(intent, /enum class IntentSource/);
  assert.match(intent, /struct Intent/);
  assert.match(input, /class InputProvider/);
  assert.match(input, /poll\s*\(\s*Intent\s*\*/);
  assert.match(application, /class Application/);
  assert.match(application, /ApplicationStopReason/);
  assert.match(manager, /class ApplicationManager/);
  assert.match(manager, /registerApplication/);
  assert.match(manager, /registerInputProvider/);
  assert.match(manager, /activeApplicationId/);
  assert.match(capability, /class CapabilityPolicy/);
  assert.match(capability, /offlineDefault/);
  assert.match(capability, /cloudConversationAvailable/);
  assert.match(privacy, /class PrivacyGate/);
  assert.match(privacy, /authorizeCloudForCurrentSession/);
  assert.match(privacy, /mayTransmitAudio/);

  const productContracts = [
    intent,
    input,
    application,
    manager,
    capability,
    privacy,
  ].join("\n");
  assert.doesNotMatch(
    productContracts,
    /driver\/|esp_codec|i2c_|i2s_|esp_http_client|socket\s*\(/,
  );
});

test("Nexi project modules remain local-first and do not duplicate basis services", () => {
  const source = readProjectCode();
  const projectEntry = readProjectModule("src/project_entry.cpp");

  assert.doesNotMatch(source, /esp_http_client|https?:\/\/|socket\s*\(/);
  assert.doesNotMatch(
    source,
    /esp_ota_ops|esp_https_ota|esp_wifi_set_config|esp_netif_create_default_wifi/,
  );
  assert.doesNotMatch(projectEntry, /HardwarePlatform|AudioEngine|ApplicationManager/);
});

test("Nexi Basic manifest and project guide describe the local product truthfully", () => {
  const manifest = fs.readFileSync(path.join(voiceLabRoot, "project.yaml"), "utf8");
  const readme = fs.readFileSync(path.join(voiceLabRoot, "README.md"), "utf8");

  assert.match(manifest, /name: Nexi Basic \(Waveshare Voice Lab\)/);
  assert.match(manifest, /id: nexi-basic/);
  assert.match(manifest, /cloud_ai: disabled/);
  assert.match(manifest, /voice_effects: true/);
  assert.match(manifest, /effect_count: 5/);
  assert.match(manifest, /volume_steps: 5/);
  assert.match(manifest, /recording_seconds: 15/);
  assert.match(manifest, /upload_recordings: false/);
  assert.match(manifest, /persist_recordings: false/);

  assert.match(readme, /Nexi Basic ist die lokale, noch cloudfreie erste Produktstufe/);
  assert.match(readme, /KEY3 .* regelt die Wiedergabe in fuenf/);
  assert.match(readme, /Er nimmt\s+nichts auf und loest weder Netzwerkzugriffe noch Audio-Uploads aus/);
});
