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
  const projectSources = fs.readFileSync(
    path.join(voiceLabRoot, "sources.cmake"),
    "utf8",
  );
  const componentManifest = fs.readFileSync(
    path.join(firmwareRoot, "src/idf_component.yml"),
    "utf8",
  );

  assert.match(platformio, /\[env:waveshare-esp32-s3-audio-voice-lab\]/);
  assert.match(platformio, /extends = env:esp32-s3-16mb-full/);
  assert.match(platformio, /GERNETIX_PROJECT_SOURCE_DIR=.*projects\/waveshare-voice-lab/);
  assert.match(platformio, /GERNETIX_BASISSOFTWARE_PROFILE_FULL=1/);
  assert.match(platformio, /SDKCONFIG_DEFAULTS="sdkconfig\.esp32-s3-n16r8"/);
  assert.match(platformio, /board_build\.partitions = partitions_nexi_16mb\.csv/);
  assert.doesNotMatch(platformio, /HIESP|esp-sr|srmodels|nexi-wake/);
  assert.match(component, /if\(EXISTS "\$\{CMAKE_CURRENT_SOURCE_DIR\}\/\.\.\/include\/user_project"\)/);
  assert.match(component, /sources\.cmake/);
  assert.match(projectSources, /src\/local_voice_entry\.cpp/);
  assert.match(projectSources, /src\/local_quiz_application\.cpp/);
  assert.match(projectSources, /src\/local_quiz_pack\.cpp/);
  assert.match(projectSources, /src\/local_tone_output\.cpp/);
  assert.match(projectSources, /src\/generated_story_audio\.cpp/);
  assert.match(projectSources, /src\/local_story_application\.cpp/);
  assert.match(projectSources, /src\/local_story_pack\.cpp/);
  assert.match(projectSources, /src\/companion_state\.cpp/);
  assert.match(projectSources, /src\/nvs_companion_state_store\.cpp/);
  assert.match(projectSources, /src\/voice_companion_application\.cpp/);
  assert.match(projectSources, /src\/esp_monotonic_clock\.cpp/);
  assert.match(projectSources, /src\/pcf85063_time\.cpp/);
  assert.match(projectSources, /src\/pcf85063_retained_clock\.cpp/);
  assert.match(projectSources, /src\/local_timer_application\.cpp/);
  assert.match(projectSources, /src\/timer_state\.cpp/);
  assert.match(projectSources, /src\/nvs_timer_state_store\.cpp/);
  assert.match(projectSources, /src\/esp_timer_power_control\.cpp/);
  assert.match(projectSources, /src\/reaction_game_application\.cpp/);
  assert.match(projectSources, /src\/waveshare_reaction_game_feedback\.cpp/);
  assert.match(projectSources, /src\/waveshare_quiz_feedback\.cpp/);
  assert.match(projectSources, /src\/waveshare_story_feedback\.cpp/);
  assert.match(projectSources, /src\/waveshare_companion_feedback\.cpp/);
  assert.match(projectSources, /src\/waveshare_timer_feedback\.cpp/);
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
  assert.match(source, /class WaveshareAudioFrameSource/);
  assert.match(source, /class PersonalWakeWordDetector/);
  assert.doesNotMatch(source, /Hi ESP|EspSrWakeWordDetector|esp_srmodel_init/);
  assert.match(source, /codecSamples_\[sample \* kCodecChannels\] >> 16/);
  assert.match(source, /runLocalVoiceEntryTest\(nexi::ApplicationManager&/);
  assert.match(source, /record '%s' %u times with KEY2/);
  assert.match(source, /MALLOC_CAP_SPIRAM/);
  assert.match(source, /"Hey Nexi, starte das Stimmenstudio"/);
  assert.match(source, /"Hey Nexi, stopp"/);
  assert.match(source, /"Hey Nexi, lauter"/);
  assert.match(source, /"Hey Nexi, leiser"/);
  assert.match(source, /"Hey Nexi, naechster Effekt"/);
  assert.match(source, /"Hey Nexi, starte das Reaktionsspiel"/);
  assert.match(source, /"Hey Nexi, starte das Klangquiz"/);
  assert.match(source, /"Hey Nexi, starte die Geschichten"/);
  assert.match(source, /PersonalWakeWordDetector\(kSentences\[index\]\.phrase, 2\)/);
  assert.match(source, /kVoiceStudioSentenceProfileKey = "studio_s1"/);
  assert.match(source, /kStopSentenceProfileKey = "stop_s1"/);
  assert.match(source, /kLouderSentenceProfileKey = "louder_s1"/);
  assert.match(source, /kQuieterSentenceProfileKey = "quieter_s1"/);
  assert.match(source, /kNextEffectSentenceProfileKey = "effect_s1"/);
  assert.match(source, /kReactionGameSentenceProfileKey = "game_s1"/);
  assert.match(source, /kLocalQuizSentenceProfileKey = "quiz_s1"/);
  assert.match(source, /kLocalStoriesSentenceProfileKey = "stories_s1"/);
  assert.match(source, /Removed obsolete separately trained word profiles/);
  assert.match(source, /LocalVoiceEntry voiceEntry/);
  assert.match(source, /SelectApplication\(VoiceStudio\)/);
  assert.match(source, /ApplicationId::ReactionGame/);
  assert.match(source, /StopApplication/);
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
  assert.match(component,
    /GLOB_RECURSE GERNETIX_PROJECT_SOURCES CONFIGURE_DEPENDS/);
  assert.match(component, /GERNETIX_PROJECT_SOURCE_DIR}\/include/);
  assert.match(entry, /static_assert\(GERNETIX_PROJECT_HOOK_API_VERSION == 1/);
  assert.match(entry, /nexi::startRuntime\(\)/);
  assert.doesNotMatch(entry, /driver\/|esp_codec|i2c_|i2s_/);
});

test("Nexi exposes hardware, audio, intent and application boundaries", () => {
  const expectedPublicContracts = [
    "include/nexi/hardware_platform.h",
    "include/nexi/audio_engine.h",
    "include/nexi/audio_frame_source.h",
    "include/nexi/intent.h",
    "include/nexi/input_provider.h",
    "include/nexi/wake_word_detector.h",
    "include/nexi/wake_word_input_provider.h",
    "include/nexi/wake_session.h",
    "include/nexi/wake_word_pipeline.h",
    "include/nexi/local_voice_entry.h",
    "include/nexi/application.h",
    "include/nexi/application_manager.h",
    "include/nexi/reaction_game_feedback.h",
    "include/nexi/reaction_game_application.h",
    "include/nexi/local_quiz_pack.h",
    "include/nexi/local_quiz_feedback.h",
    "include/nexi/local_quiz_application.h",
    "include/nexi/local_story_pack.h",
    "include/nexi/local_story_feedback.h",
    "include/nexi/local_story_application.h",
    "include/nexi/companion_state.h",
    "include/nexi/companion_state_store.h",
    "include/nexi/companion_feedback.h",
    "include/nexi/voice_companion_application.h",
    "include/nexi/monotonic_clock.h",
    "include/nexi/retained_clock.h",
    "include/nexi/pcf85063_time.h",
    "include/nexi/timer_state.h",
    "include/nexi/timer_state_store.h",
    "include/nexi/timer_power_control.h",
    "include/nexi/local_timer_feedback.h",
    "include/nexi/local_timer_application.h",
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
  const audioFrames = readProjectModule("include/nexi/audio_frame_source.h");
  const intent = readProjectModule("include/nexi/intent.h");
  const input = readProjectModule("include/nexi/input_provider.h");
  const wakeDetector = readProjectModule("include/nexi/wake_word_detector.h");
  const wakeInput = readProjectModule("include/nexi/wake_word_input_provider.h");
  const wakeSession = readProjectModule("include/nexi/wake_session.h");
  const wakePipeline = readProjectModule("include/nexi/wake_word_pipeline.h");
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
  assert.match(audioFrames, /class AudioFrameSource/);
  assert.match(audioFrames, /kWakeAudioSampleRateHz = 16000/);

  assert.match(intent, /enum class IntentType/);
  assert.match(intent, /enum class IntentSource/);
  assert.match(intent, /struct Intent/);
  assert.match(input, /class InputProvider/);
  assert.match(input, /poll\s*\(\s*Intent\s*\*/);
  assert.match(wakeDetector, /class WakeWordDetector/);
  assert.match(wakeInput, /class WakeWordInputProvider/);
  assert.match(wakeSession, /class WakeSession/);
  assert.match(wakePipeline, /class WakeWordPipeline/);
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
    audioFrames,
    wakeDetector,
    wakeInput,
    wakeSession,
    wakePipeline,
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
  assert.match(manifest, /reaction_game: true/);
  assert.match(manifest, /reaction_game_inputs: 3/);
  assert.match(manifest, /reaction_game_persistence: false/);
  assert.match(manifest, /local_quiz: true/);
  assert.match(manifest, /local_quiz_pack_count: 3/);
  assert.match(manifest, /local_quiz_maximum_packs: 4/);
  assert.match(manifest, /local_quiz_total_items: 24/);
  assert.match(manifest, /local_quiz_maximum_total_items: 48/);
  assert.match(manifest, /local_quiz_maximum_items: 12/);
  assert.match(manifest, /local_quiz_persistence: false/);
  assert.match(manifest, /nexi\.sound-memory\.beginner\.de@1:6/);
  assert.match(manifest, /nexi\.sound-memory\.fast\.de@1:9/);
  assert.match(manifest, /nexi\.sound-memory\.deep\.de@1:9/);
  assert.match(manifest, /wake_word: Hey Nexi/);
  assert.match(manifest,
    /voice_sentence_profile_storage: dedicated_local_nvs_quantized_features/);
  assert.match(manifest, /voice_sentence_profile_partition: nexivoice2/);
  assert.match(manifest, /voice_sentence_profile_partition_bytes: 262144/);
  assert.match(manifest, /voice_sentence_profile_legacy_partition: nexivoice/);
  assert.match(manifest, /voice_profile_format_version: 1/);
  assert.match(manifest, /voice_profile_reset: key3_at_startup/);
  assert.match(manifest, /- Hey Nexi, starte das Stimmenstudio/);
  assert.match(manifest, /- Hey Nexi, stopp/);
  assert.match(manifest, /- Hey Nexi, lauter/);
  assert.match(manifest, /- Hey Nexi, leiser/);
  assert.match(manifest, /- Hey Nexi, naechster Effekt/);
  assert.match(manifest, /- Hey Nexi, starte das Reaktionsspiel/);
  assert.match(manifest, /- Hey Nexi, starte das Klangquiz/);
  assert.match(manifest, /voice_sentence_references: 2/);
  assert.match(manifest, /effect_count: 5/);
  assert.match(manifest, /volume_steps: 5/);
  assert.match(manifest, /recording_seconds: 15/);
  assert.match(manifest, /upload_recordings: false/);
  assert.match(manifest, /persist_recordings: false/);

  assert.match(readme, /Nexi Basic ist die lokale, noch cloudfreie erste Produktstufe/);
  assert.match(readme, /KEY3 .* regelt die Wiedergabe in fuenf/);
  assert.match(readme, /Er nimmt\s+nichts auf und loest weder Netzwerkzugriffe noch Audio-Uploads aus/);
  assert.match(readme, /Roh-Audio\s+wird nicht persistiert/);
  assert.match(readme, /KEY3 beim Start/);
  assert.match(readme, /Hey Nexi, starte das Reaktionsspiel/);
  assert.match(readme, /Hey Nexi, starte das Klangquiz/);
});

test("Nexi keeps voice profiles in a dedicated partition without moving applications", () => {
  const partitions = fs.readFileSync(
    path.join(firmwareRoot, "partitions_nexi_16mb.csv"), "utf8");

  assert.match(partitions, /^nvs,\s*data,\s*nvs,\s*0x9000,\s*0x6000/m);
  assert.match(partitions, /^nexivoice,\s*data,\s*nvs,\s*0x11000,\s*0xF000/m);
  assert.match(partitions, /^nexivoice2,\s*data,\s*nvs,\s*0xC20000,\s*0x40000/m);
  assert.match(partitions, /^ota_0,\s*app,\s*ota_0,\s*0x20000,\s*0x600000/m);
  assert.match(partitions, /^ota_1,\s*app,\s*ota_1,\s*0x620000,\s*0x600000/m);
  assert.match(partitions, /^storage,\s*data,\s*spiffs,\s*0xC60000,\s*0x390000/m);
});
