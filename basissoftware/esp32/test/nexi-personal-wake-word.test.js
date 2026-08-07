const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");

test("personal Hey Nexi profile round-trips without storing PCM", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-personal-wake-"));
  const harnessPath = path.join(temporaryRoot, "personal_wake_test.cpp");
  const executablePath = path.join(temporaryRoot, "personal_wake_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <array>
#include <cassert>
#include <cmath>
#include <cstdint>

#include "nexi/personal_wake_word_detector.h"

constexpr float PI = 3.14159265358979323846f;

void fillFrame(std::array<int16_t, nexi::kWakeAudioFrameSamples>* samples,
    size_t phraseFrame, size_t phraseFrames, int variant, bool matching) {
  float frequency = 3000.0f;
  if (matching) {
    const float progress = static_cast<float>(phraseFrame) /
        static_cast<float>(phraseFrames);
    frequency = progress < 0.21f ? 500.0f
        : progress < 0.50f ? 1000.0f
        : progress < 0.79f ? 2000.0f
        : 500.0f;
  }
  frequency += matching ? static_cast<float>(variant * 4) : 0.0f;
  for (size_t index = 0; index < samples->size(); ++index) {
    const float time = static_cast<float>(
        phraseFrame * samples->size() + index) / 16000.0f;
    (*samples)[index] = static_cast<int16_t>(
        6500.0f * std::sin(2.0f * PI * frequency * time));
  }
}

void calibrate(nexi::PersonalWakeWordDetector* detector, int variant,
    size_t phraseFrames) {
  assert(detector->beginCalibrationSample());
  std::array<int16_t, nexi::kWakeAudioFrameSamples> samples{};
  uint64_t sequence = 0;
  for (size_t frame = 0; frame < 5; ++frame) {
    nexi::AudioFrame audio{samples.data(), samples.size(), sequence++};
    assert(detector->captureCalibrationFrame(audio));
  }
  for (size_t frame = 0; frame < phraseFrames; ++frame) {
    fillFrame(&samples, frame, phraseFrames, variant, true);
    nexi::AudioFrame audio{samples.data(), samples.size(), sequence++};
    assert(detector->captureCalibrationFrame(audio));
  }
  samples.fill(0);
  for (size_t frame = 0; frame < 5; ++frame) {
    nexi::AudioFrame audio{samples.data(), samples.size(), sequence++};
    assert(detector->captureCalibrationFrame(audio));
  }
  const nexi::WakeCalibrationResult result = detector->finishCalibrationSample();
  assert(result.accepted);
}

bool evaluate(nexi::PersonalWakeWordDetector* detector, bool matching,
    size_t phraseFrames = 70) {
  std::array<int16_t, nexi::kWakeAudioFrameSamples> samples{};
  uint64_t sequence = 0;
  bool detected = false;
  for (size_t frame = 0; frame < 55; ++frame) {
    nexi::AudioFrame audio{samples.data(), samples.size(), sequence++};
    detected = detector->process(audio).detected || detected;
  }
  for (size_t frame = 0; frame < phraseFrames; ++frame) {
    fillFrame(&samples, frame, phraseFrames, 0, matching);
    nexi::AudioFrame audio{samples.data(), samples.size(), sequence++};
    detected = detector->process(audio).detected || detected;
  }
  samples.fill(0);
  for (size_t frame = 0; frame < 35; ++frame) {
    nexi::AudioFrame audio{samples.data(), samples.size(), sequence++};
    detected = detector->process(audio).detected || detected;
  }
  return detected;
}

int main() {
  nexi::PersonalWakeWordDetector detector;
  assert(!detector.ready());
  assert(detector.referenceCount() == 0);
  assert(!evaluate(&detector, true));

  calibrate(&detector, -1, 70);
  calibrate(&detector, 0, 55);
  calibrate(&detector, 1, 72);
  assert(detector.ready());
  assert(detector.referenceCount() == 3);
  assert(detector.threshold() >= 0.065f && detector.threshold() <= 0.105f);
  assert(detector.expectedFrameCount() >= 70);
  assert(evaluate(&detector, true));
  assert(evaluate(&detector, true, 55));
  assert(!evaluate(&detector, false));
  assert(!evaluate(&detector, true, 30));
  assert(!detector.lastDurationAccepted());
  assert(detector.evaluationCount() == 4);

  std::array<uint8_t,
      nexi::PersonalWakeWordDetector::kMaximumSerializedProfileBytes> profile{};
  size_t profileSize = 0;
  assert(detector.exportProfile(profile.data(), profile.size(), &profileSize));
  assert(profileSize > 0 && profileSize < profile.size());

  nexi::PersonalWakeWordDetector restored;
  assert(restored.importProfile(profile.data(), profileSize));
  assert(restored.ready());
  assert(restored.referenceCount() == 3);
  assert(restored.expectedFrameCount() == detector.expectedFrameCount());
  assert(evaluate(&restored, true));
  assert(evaluate(&restored, true, 55));

  nexi::PersonalWakeWordDetector wrongPhrase("Stimmenstudio", 3);
  assert(!wrongPhrase.importProfile(profile.data(), profileSize));
  profile[profileSize / 2] ^= 0x5a;
  nexi::PersonalWakeWordDetector corrupted;
  assert(!corrupted.importProfile(profile.data(), profileSize));

  detector.resetCalibration();
  assert(!detector.ready());
  assert(detector.referenceCount() == 0);
}
`);

  const compilation = spawnSync(compiler, [
    "-std=c++11",
    "-Wall",
    "-Wextra",
    "-pedantic",
    `-I${path.join(projectRoot, "include")}`,
    harnessPath,
    path.join(projectRoot, "src/personal_wake_word_detector.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("personal voice profiles serialize features without a network path", () => {
  const source = [
    "include/nexi/personal_wake_word_detector.h",
    "src/personal_wake_word_detector.cpp",
  ].map((relativePath) => fs.readFileSync(
    path.join(projectRoot, relativePath), "utf8",
  )).join("\n");

  assert.match(source, /kRequiredReferenceCount = 3/);
  assert.match(source, /phrase_/);
  assert.match(source, /requiredReferenceCount_/);
  assert.match(source, /dtwDistance/);
  assert.match(source, /kProfileFormatVersion = 1/);
  assert.match(source, /phraseHash/);
  assert.match(source, /checksum/);
  assert.doesNotMatch(source,
    /nvs_|fopen|fstream|Preferences|esp_http|WiFi|socket\s*\(|https?:\/\//);
});

test("firmware stores only versioned feature blobs in its dedicated NVS partition", () => {
  const source = fs.readFileSync(path.join(
    projectRoot, "src/personal_voice_profile_store.cpp"), "utf8");
  assert.match(source, /kPartition = "nexivoice2"/);
  assert.match(source, /kLegacyPartition = "nexivoice"/);
  assert.match(source, /nvs_flash_init_partition/);
  assert.match(source, /nvs_open_from_partition/);
  assert.match(source, /eraseLegacyDefault/);
  assert.match(source, /One-way migration preserves profiles/);
  assert.match(source, /nvs_get_blob/);
  assert.match(source, /nvs_set_blob/);
  assert.match(source, /nvs_erase_key/);
  assert.match(source, /importProfile/);
  assert.match(source, /exportProfile/);
  assert.doesNotMatch(source,
    /AudioFrame|readAudio|writeAudio|esp_http|WiFi|socket\s*\(|https?:\/\//);
});

test("Nexi board setup records and tests Hey Nexi through bounded project serial actions", () => {
  const runtime = fs.readFileSync(path.join(projectRoot, "voice_lab.cpp"), "utf8");
  const entry = fs.readFileSync(path.join(projectRoot, "src/project_entry.cpp"), "utf8");

  assert.match(entry, /projectSerialProvisioningEnabled\(\)[\s\S]*return true/);
  assert.match(entry, /handleProjectSerialCommand[\s\S]*handleVoiceSetupCommand/);
  assert.match(runtime, /nexi_voice_status/);
  assert.match(runtime, /nexi_voice_enroll/);
  assert.match(runtime, /nexi_voice_test/);
  assert.match(runtime, /nexi_voice_reset/);
  assert.match(runtime, /voiceSetupAudio->read/);
  assert.match(runtime, /captureCalibrationFrame/);
  assert.match(runtime, /kPersonalWakeProfileKey = "wake_v1"/);
  assert.match(runtime, /PersonalVoiceProfileStore\(\)\.save/);
  assert.doesNotMatch(runtime, /esp_http_client|https?:\/\/|socket\s*\(/);
});
