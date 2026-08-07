const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");

test("local companion evolves, coalesces saves, migrates and resets", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-companion-"));
  const harnessPath = path.join(temporaryRoot, "voice_companion_test.cpp");
  const executablePath = path.join(temporaryRoot, "voice_companion_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <cassert>
#include <cstddef>
#include <cstdint>

#include "nexi/application_manager.h"
#include "nexi/companion_state.h"
#include "nexi/voice_companion_application.h"

class Store final : public nexi::CompanionStateStore {
 public:
  nexi::CompanionStateLoadResult load(nexi::CompanionState* output) override {
    ++loads;
    if (loadResult == nexi::CompanionStateLoadResult::Loaded ||
        loadResult == nexi::CompanionStateLoadResult::Migrated) {
      *output = stored;
    }
    return loadResult;
  }
  bool save(const nexi::CompanionState& state) override {
    ++saves;
    stored = state;
    return saveResult;
  }
  bool erase() override {
    ++erases;
    return eraseResult;
  }

  nexi::CompanionStateLoadResult loadResult =
      nexi::CompanionStateLoadResult::Missing;
  nexi::CompanionState stored{0, 0, 0, 0};
  bool saveResult = true;
  bool eraseResult = true;
  int loads = 0;
  int saves = 0;
  int erases = 0;
};

class Feedback final : public nexi::CompanionFeedback {
 public:
  void companionStarted(const nexi::CompanionState&,
      nexi::CompanionStateLoadResult value) override {
    ++started;
    loadResult = value;
  }
  void showState(const nexi::CompanionState&, nexi::CompanionMood value) override {
    ++states;
    mood = value;
  }
  void showAction(nexi::CompanionAction value,
      const nexi::CompanionState&, nexi::CompanionMood currentMood) override {
    ++actions;
    action = value;
    mood = currentMood;
  }
  void stateStored(bool value) override {
    ++stored;
    saved = value;
  }
  void companionReset(bool value, const nexi::CompanionState&) override {
    ++resets;
    erased = value;
  }
  void companionStopped() override { ++stopped; }

  int started = 0;
  int states = 0;
  int actions = 0;
  int stored = 0;
  int resets = 0;
  int stopped = 0;
  bool saved = false;
  bool erased = false;
  nexi::CompanionAction action = nexi::CompanionAction::Feed;
  nexi::CompanionMood mood = nexi::CompanionMood::Count;
  nexi::CompanionStateLoadResult loadResult =
      nexi::CompanionStateLoadResult::Error;
};

uint32_t checksum(const uint8_t* data, size_t size) {
  uint32_t hash = 2166136261U;
  for (size_t index = 0; index < size; ++index) {
    hash ^= data[index];
    hash *= 16777619U;
  }
  return hash;
}

void write32(uint8_t* data, uint32_t value) {
  data[0] = static_cast<uint8_t>(value);
  data[1] = static_cast<uint8_t>(value >> 8U);
  data[2] = static_cast<uint8_t>(value >> 16U);
  data[3] = static_cast<uint8_t>(value >> 24U);
}

int main() {
  const nexi::CompanionState initial = nexi::CompanionStateCodec::defaultState();
  assert(initial.energy == 70 && initial.joy == 60 && initial.trust == 20);
  uint8_t encoded[nexi::CompanionStateCodec::kEncodedSize]{};
  size_t encodedSize = 0;
  assert(nexi::CompanionStateCodec::encode(
      initial, encoded, sizeof(encoded), &encodedSize));
  assert(encodedSize == nexi::CompanionStateCodec::kEncodedSize);
  nexi::CompanionState decoded{};
  assert(nexi::CompanionStateCodec::decode(encoded, encodedSize, &decoded) ==
      nexi::CompanionStateLoadResult::Loaded);
  assert(decoded.energy == initial.energy && decoded.joy == initial.joy);
  encoded[6] ^= 1;
  assert(nexi::CompanionStateCodec::decode(encoded, encodedSize, &decoded) ==
      nexi::CompanionStateLoadResult::Invalid);

  // Version 1 had no trust byte and used a 16-bit interaction counter.
  uint8_t legacy[13] = {'N', 'X', 'C', 'P', 1, 44, 55, 7, 0, 0, 0, 0, 0};
  write32(legacy + 9, checksum(legacy, 9));
  assert(nexi::CompanionStateCodec::decode(legacy, sizeof(legacy), &decoded) ==
      nexi::CompanionStateLoadResult::Migrated);
  assert(decoded.energy == 44 && decoded.joy == 55 && decoded.trust == 20);
  assert(decoded.interactions == 7);

  const nexi::CapabilityPolicy policy = nexi::CapabilityPolicy::offlineDefault();
  Store store;
  Feedback feedback;
  nexi::VoiceCompanionApplication companion(policy, store, feedback);
  nexi::ApplicationManager manager;
  assert(manager.registerApplication(&companion));
  assert(manager.dispatch(nexi::Intent::selectApplication(
      nexi::ApplicationId::VoiceCompanion, nexi::IntentSource::Test)));
  assert(companion.running());
  assert(store.loads == 1);
  assert(companion.state().energy == 70);

  // Voice controls cannot accidentally change the local companion.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::NextEffect, nexi::IntentSource::Voice));
  assert(companion.state().interactions == 0);

  // KEY1 plays, KEY2 feeds and rapid actions are coalesced into one save.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::NextEffect, nexi::IntentSource::Test));
  assert(companion.state().energy == 62);
  assert(companion.state().joy == 78);
  assert(companion.state().trust == 23);
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::Record, nexi::IntentSource::Test));
  assert(companion.state().energy == 82);
  assert(companion.state().joy == 80);
  assert(companion.state().interactions == 2);
  assert(companion.dirty());
  for (int tick = 0; tick <= nexi::VoiceCompanionApplication::kSaveDelayTicks;
      ++tick) manager.tick();
  assert(store.saves == 1);
  assert(!companion.dirty());

  // Long KEY3 resets only this module's state.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::ToggleMute, nexi::IntentSource::Test));
  assert(store.erases == 1);
  assert(feedback.erased);
  assert(companion.state().energy == 70);
  assert(companion.state().interactions == 0);

  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::StopApplication, nexi::IntentSource::Test)));
  assert(feedback.stopped == 1);

  // A migrated v1 state is rewritten once in the current format.
  Store migratedStore;
  migratedStore.loadResult = nexi::CompanionStateLoadResult::Migrated;
  migratedStore.stored = {44, 55, 20, 7};
  Feedback migratedFeedback;
  nexi::VoiceCompanionApplication migrated(
      policy, migratedStore, migratedFeedback);
  assert(migrated.start(nexi::Intent::selectApplication(
      nexi::ApplicationId::VoiceCompanion)));
  assert(migrated.dirty());
  for (int tick = 0; tick <= nexi::VoiceCompanionApplication::kSaveDelayTicks;
      ++tick) migrated.tick();
  assert(migratedStore.saves == 1);

  const nexi::CapabilityPolicy deniedPolicy({1, 0, false, false});
  Store deniedStore;
  Feedback deniedFeedback;
  nexi::VoiceCompanionApplication denied(
      deniedPolicy, deniedStore, deniedFeedback);
  assert(!denied.start(nexi::Intent::selectApplication(
      nexi::ApplicationId::VoiceCompanion)));
}
`);

  const compilation = spawnSync(compiler, [
    "-std=c++11",
    "-Wall",
    "-Wextra",
    "-pedantic",
    `-I${includeRoot}`,
    harnessPath,
    path.join(projectRoot, "src/intent.cpp"),
    path.join(projectRoot, "src/application_manager.cpp"),
    path.join(projectRoot, "src/capability_policy.cpp"),
    path.join(projectRoot, "src/companion_state.cpp"),
    path.join(projectRoot, "src/voice_companion_application.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("companion core excludes drivers and network while NVS stays module-scoped", () => {
  const core = [
    "include/nexi/companion_state.h",
    "include/nexi/companion_state_store.h",
    "include/nexi/companion_feedback.h",
    "include/nexi/voice_companion_application.h",
    "src/companion_state.cpp",
    "src/voice_companion_application.cpp",
  ].map((relativePath) => fs.readFileSync(
    path.join(projectRoot, relativePath), "utf8",
  )).join("\n");
  const adapter = fs.readFileSync(path.join(
    projectRoot, "src/nvs_companion_state_store.cpp"), "utf8");

  assert.match(core, /kCurrentVersion = 2/);
  assert.match(core, /kEncodedSize = 16/);
  assert.match(core, /kSaveDelayTicks = 50/);
  assert.doesNotMatch(core,
    /driver\/|freertos|nvs_|esp_http|WiFi|socket\s*\(|https?:\/\//);
  assert.match(adapter, /kNamespace = "nexi_friend"/);
  assert.match(adapter, /kStateKey = "state"/);
  assert.match(adapter, /nvs_erase_key/);
  assert.doesNotMatch(adapter, /nvs_erase_all|nvs_flash_erase/);
});
