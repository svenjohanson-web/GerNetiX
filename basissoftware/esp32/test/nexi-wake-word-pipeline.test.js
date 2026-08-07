const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");
const supportRoot = path.join(__dirname, "support");

function createPcm16Wav({ sampleRateHz, channels, sampleCount, sampleValue }) {
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRateHz, 24);
  buffer.writeUInt32LE(sampleRateHz * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  for (let offset = 44; offset < buffer.length; offset += 2) {
    buffer.writeInt16LE(sampleValue, offset);
  }
  return buffer;
}

test("Nexi wake-word core stays bounded, local and hardware-independent", () => {
  const relativePaths = [
    "include/nexi/audio_frame_source.h",
    "include/nexi/wake_word_detector.h",
    "include/nexi/wake_word_input_provider.h",
    "include/nexi/wake_session.h",
    "include/nexi/wake_word_pipeline.h",
    "src/wake_word_input_provider.cpp",
    "src/wake_session.cpp",
    "src/wake_word_pipeline.cpp",
  ];
  const source = relativePaths
    .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
    .join("\n");

  assert.match(source, /kWakeAudioSampleRateHz = 16000/);
  assert.match(source, /kWakeAudioFrameSamples = 160/);
  assert.match(source, /IntentType::WakeDetected/);
  assert.match(source, /class WakeSessionFeedback/);
  assert.doesNotMatch(source, /#include\s*[<"](?:fstream|vector|string|map|memory|WiFi|HTTPClient)/);
  assert.doesNotMatch(source, /\b(?:malloc|calloc|realloc|free)\s*\(|\bnew\b/);
  assert.doesNotMatch(source, /esp_http|socket\s*\(|https?:\/\//);
});

test("recorded WAV reaches one WakeDetected intent and a bounded command window", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-wake-word-"));
  const harnessPath = path.join(temporaryRoot, "wake_word_test.cpp");
  const executablePath = path.join(temporaryRoot, "wake_word_test");
  const validWavPath = path.join(temporaryRoot, "valid.wav");
  const stereoWavPath = path.join(temporaryRoot, "stereo.wav");
  const invalidWavPath = path.join(temporaryRoot, "invalid.wav");
  const truncatedWavPath = path.join(temporaryRoot, "truncated.wav");
  const missingWavPath = path.join(temporaryRoot, "missing.wav");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, "fixtures/nexi-wake-mono-16k.json"),
    "utf8",
  ));
  fs.writeFileSync(validWavPath, createPcm16Wav(fixture));
  fs.writeFileSync(stereoWavPath, createPcm16Wav({ ...fixture, channels: 2 }));
  fs.writeFileSync(invalidWavPath, Buffer.from("not a wav", "ascii"));
  fs.writeFileSync(
    truncatedWavPath,
    createPcm16Wav(fixture).subarray(0, 44 + 20),
  );

  fs.writeFileSync(harnessPath, String.raw`
#include <cassert>

#include "nexi/intent.h"
#include "nexi/wake_session.h"
#include "nexi/wake_word_input_provider.h"
#include "nexi/wake_word_pipeline.h"
#include "recorded_wav_frame_source.h"
#include "scripted_wake_word_detector.h"

class RecordingFeedback final : public nexi::WakeSessionFeedback {
 public:
  RecordingFeedback() : opened(0), closed(0),
      lastReason(nexi::WakeSessionCloseReason::Cancelled) {}
  void onWakeSessionOpened() override { ++opened; }
  void onWakeSessionClosed(nexi::WakeSessionCloseReason reason) override {
    ++closed;
    lastReason = reason;
  }
  int opened;
  int closed;
  nexi::WakeSessionCloseReason lastReason;
};

int main(int argc, char** argv) {
  assert(argc == 6);

  nexi_test::RecordedWavFrameSource source(argv[1]);
  assert(source.valid());
  nexi_test::ScriptedWakeWordDetector detector(1, 2, 93);
  nexi::WakeWordInputProvider provider(source, detector);

  nexi::Intent intent = nexi::Intent::create(nexi::IntentType::None);
  assert(!provider.poll(&intent));
  assert(provider.poll(&intent));
  assert(intent.type == nexi::IntentType::WakeDetected);
  assert(intent.source == nexi::IntentSource::Voice);
  assert(intent.confidence == 93);
  assert(!provider.poll(&intent));
  assert(!provider.poll(&intent));
  assert(!provider.poll(&intent));

  RecordingFeedback feedback;
  nexi::WakeSession session(3000, &feedback);
  assert(session.state() == nexi::WakeSessionState::Idle);
  assert(session.handle(intent, 100) == nexi::WakeSessionEvent::Opened);
  assert(session.isListeningForCommand());
  assert(feedback.opened == 1);
  assert(session.handle(intent, 200) == nexi::WakeSessionEvent::None);
  assert(feedback.opened == 1);
  assert(session.tick(3099) == nexi::WakeSessionEvent::None);
  assert(session.tick(3100) == nexi::WakeSessionEvent::ClosedByTimeout);
  assert(session.state() == nexi::WakeSessionState::Idle);
  assert(feedback.closed == 1);
  assert(feedback.lastReason == nexi::WakeSessionCloseReason::Timeout);

  assert(session.handle(intent, 5000) == nexi::WakeSessionEvent::Opened);
  const nexi::Intent cancel = nexi::Intent::create(
      nexi::IntentType::Cancel, nexi::IntentSource::Voice);
  assert(session.handle(cancel, 5100) == nexi::WakeSessionEvent::ClosedByCancel);
  assert(feedback.closed == 2);
  assert(feedback.lastReason == nexi::WakeSessionCloseReason::Cancelled);

  nexi_test::RecordedWavFrameSource pipelineSource(argv[1]);
  nexi_test::ScriptedWakeWordDetector pipelineDetector(1, 2, 88);
  RecordingFeedback pipelineFeedback;
  nexi::WakeWordPipeline pipeline(
      pipelineSource, pipelineDetector, 3000, &pipelineFeedback);
  assert(pipeline.tick(0) == nexi::WakeSessionEvent::None);
  assert(pipeline.tick(10) == nexi::WakeSessionEvent::Opened);
  assert(pipeline.isListeningForCommand());
  assert(pipeline.tick(20) == nexi::WakeSessionEvent::None);
  assert(pipeline.tick(3010) == nexi::WakeSessionEvent::ClosedByTimeout);
  assert(!pipeline.isListeningForCommand());

  nexi_test::RecordedWavFrameSource stereo(argv[2]);
  assert(!stereo.valid());
  assert(stereo.error() == nexi_test::RecordedWavError::UnsupportedFormat);
  nexi_test::RecordedWavFrameSource invalid(argv[3]);
  assert(!invalid.valid());
  assert(invalid.error() == nexi_test::RecordedWavError::InvalidContainer);
  nexi_test::RecordedWavFrameSource truncated(argv[4]);
  assert(truncated.valid());
  nexi::AudioFrame truncatedFrame{nullptr, 0, 0};
  assert(!truncated.read(&truncatedFrame));
  assert(truncated.error() == nexi_test::RecordedWavError::TruncatedAudioData);
  nexi_test::RecordedWavFrameSource missing(argv[5]);
  assert(!missing.valid());
  assert(missing.error() == nexi_test::RecordedWavError::CannotOpen);
}
`);

  const compilation = spawnSync(compiler, [
    "-std=c++11",
    "-Wall",
    "-Wextra",
    "-pedantic",
    `-I${includeRoot}`,
    `-I${supportRoot}`,
    harnessPath,
    path.join(projectRoot, "src/intent.cpp"),
    path.join(projectRoot, "src/wake_word_input_provider.cpp"),
    path.join(projectRoot, "src/wake_session.cpp"),
    path.join(projectRoot, "src/wake_word_pipeline.cpp"),
    path.join(supportRoot, "recorded_wav_frame_source.cc"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(
    executablePath,
    [validWavPath, stereoWavPath, invalidWavPath, truncatedWavPath, missingWavPath],
    { encoding: "utf8" },
  );
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});
