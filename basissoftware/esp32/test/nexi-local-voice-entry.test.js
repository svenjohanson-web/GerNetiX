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

test("complete Hey Nexi sentences route intents without an artificial pause", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-voice-entry-"));
  const harnessPath = path.join(temporaryRoot, "local_voice_entry_test.cpp");
  const executablePath = path.join(temporaryRoot, "local_voice_entry_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <array>
#include <cassert>

#include "nexi/application_manager.h"
#include "nexi/local_voice_entry.h"
#include "scripted_wake_word_detector.h"

class Studio final : public nexi::Application {
 public:
  nexi::ApplicationId id() const override {
    return nexi::ApplicationId::VoiceStudio;
  }
  bool start(const nexi::Intent& trigger) override {
    ++starts;
    source = trigger.source;
    return true;
  }
  void stop(nexi::ApplicationStopReason reason) override {
    ++stops;
    stopReason = reason;
  }
  void handleIntent(const nexi::Intent&) override {}
  void tick() override {}
  int starts = 0;
  int stops = 0;
  nexi::IntentSource source = nexi::IntentSource::Runtime;
  nexi::ApplicationStopReason stopReason = nexi::ApplicationStopReason::Fault;
};

nexi::AudioFrame frame(uint64_t sequence) {
  static std::array<int16_t, nexi::kWakeAudioFrameSamples> samples{};
  return {samples.data(), samples.size(), sequence};
}

int main() {
  nexi_test::ScriptedWakeWordDetector studioSentence(2, 1, 87);
  nexi_test::ScriptedWakeWordDetector stopSentence(21, 1, 89);
  nexi_test::ScriptedWakeWordDetector louderSentence(30, 1, 86);
  nexi_test::ScriptedWakeWordDetector quieterSentence(31, 1, 85);
  nexi_test::ScriptedWakeWordDetector effectSentence(32, 1, 84);
  nexi_test::ScriptedWakeWordDetector gameSentence(33, 1, 88);
  nexi_test::ScriptedWakeWordDetector quizSentence(34, 1, 88);
  nexi::LocalVoiceEntry entry;
  assert(entry.registerSentence(&stopSentence,
      nexi::Intent::create(nexi::IntentType::StopApplication)));
  assert(entry.registerSentence(&studioSentence,
      nexi::Intent::selectApplication(nexi::ApplicationId::VoiceStudio)));
  assert(entry.registerSentence(&louderSentence,
      nexi::Intent::create(nexi::IntentType::AdjustVolume,
          nexi::IntentSource::Runtime, 1)));
  assert(entry.registerSentence(&quieterSentence,
      nexi::Intent::create(nexi::IntentType::AdjustVolume,
          nexi::IntentSource::Runtime, -1)));
  assert(entry.registerSentence(&effectSentence,
      nexi::Intent::create(nexi::IntentType::NextEffect)));
  assert(entry.registerSentence(&gameSentence,
      nexi::Intent::selectApplication(nexi::ApplicationId::ReactionGame)));
  assert(entry.registerSentence(&quizSentence,
      nexi::Intent::selectApplication(nexi::ApplicationId::LocalQuiz)));
  assert(entry.sentenceCount() == 7);
  assert(!entry.registerSentence(&studioSentence,
      nexi::Intent::create(nexi::IntentType::Custom)));
  nexi::Intent intent = nexi::Intent::create(nexi::IntentType::None);

  assert(!entry.process(frame(1), &intent));
  assert(entry.process(frame(2), &intent));
  assert(intent.type == nexi::IntentType::SelectApplication);
  assert(intent.application == nexi::ApplicationId::VoiceStudio);
  assert(intent.source == nexi::IntentSource::Voice);
  assert(intent.confidence == 87);

  Studio studio;
  nexi::ApplicationManager manager;
  assert(manager.registerApplication(&studio));
  assert(manager.dispatch(intent));
  assert(manager.activeApplicationId() == nexi::ApplicationId::VoiceStudio);
  assert(studio.starts == 1);
  assert(studio.source == nexi::IntentSource::Voice);

  nexi::Intent volumeIntent = nexi::Intent::create(nexi::IntentType::None);
  assert(entry.process(frame(30), &volumeIntent));
  assert(volumeIntent.type == nexi::IntentType::AdjustVolume);
  assert(volumeIntent.value == 1);
  assert(volumeIntent.source == nexi::IntentSource::Voice);
  assert(entry.process(frame(31), &volumeIntent));
  assert(volumeIntent.type == nexi::IntentType::AdjustVolume);
  assert(volumeIntent.value == -1);
  assert(entry.process(frame(32), &volumeIntent));
  assert(volumeIntent.type == nexi::IntentType::NextEffect);
  assert(entry.process(frame(33), &volumeIntent));
  assert(volumeIntent.type == nexi::IntentType::SelectApplication);
  assert(volumeIntent.application == nexi::ApplicationId::ReactionGame);
  assert(entry.process(frame(34), &volumeIntent));
  assert(volumeIntent.type == nexi::IntentType::SelectApplication);
  assert(volumeIntent.application == nexi::ApplicationId::LocalQuiz);

  nexi::Intent stopIntent = nexi::Intent::create(nexi::IntentType::None);
  assert(entry.process(frame(21), &stopIntent));
  assert(stopIntent.type == nexi::IntentType::StopApplication);
  assert(stopIntent.source == nexi::IntentSource::Voice);
  assert(stopIntent.confidence == 89);
  assert(manager.dispatch(stopIntent));
  assert(manager.activeApplication() == nullptr);
  assert(studio.stops == 1);
  assert(studio.stopReason == nexi::ApplicationStopReason::UserRequest);

  nexi_test::ScriptedWakeWordDetector absentStudio(50, 1, 90);
  nexi::LocalVoiceEntry ignoredEntry;
  assert(ignoredEntry.registerSentence(&absentStudio,
      nexi::Intent::create(nexi::IntentType::Custom)));
  nexi::Intent ignored = nexi::Intent::create(nexi::IntentType::None);
  assert(!ignoredEntry.process(frame(1), &ignored));
  assert(ignored.type == nexi::IntentType::None);
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
    path.join(projectRoot, "src/local_voice_entry.cpp"),
    path.join(projectRoot, "src/application_manager.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("local voice entry contains no network, persistence or account path", () => {
  const source = [
    "include/nexi/local_voice_entry.h",
    "src/local_voice_entry.cpp",
  ].map((relativePath) => fs.readFileSync(
    path.join(projectRoot, relativePath), "utf8",
  )).join("\n");

  assert.match(source, /complete utterance/);
  assert.match(source, /kMaximumSentences = 8/);
  assert.match(source, /registerSentence/);
  assert.match(source, /IntentSource::Voice/);
  assert.doesNotMatch(source,
    /nvs_|fopen|fstream|Preferences|esp_http|WiFi|socket\s*\(|https?:\/\//);
});
