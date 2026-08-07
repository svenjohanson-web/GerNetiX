const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");

test("local reaction game has deterministic rounds, feedback and clean stop", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-reaction-"));
  const harnessPath = path.join(temporaryRoot, "reaction_game_test.cpp");
  const executablePath = path.join(temporaryRoot, "reaction_game_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <cassert>

#include "nexi/application_manager.h"
#include "nexi/reaction_game_application.h"

class Feedback final : public nexi::ReactionGameFeedback {
 public:
  void gameStarted() override { ++started; }
  void showWaiting() override { ++waiting; }
  void showTarget(nexi::ReactionTarget value) override {
    ++targets;
    target = value;
  }
  void showResult(bool value, nexi::ReactionTarget, uint16_t ticks) override {
    ++results;
    success = value;
    reactionTicks = ticks;
  }
  void gameStopped() override { ++stopped; }

  int started = 0;
  int waiting = 0;
  int targets = 0;
  int results = 0;
  int stopped = 0;
  bool success = false;
  uint16_t reactionTicks = 0;
  nexi::ReactionTarget target = nexi::ReactionTarget::Count;
};

nexi::Intent intentFor(nexi::ReactionTarget target) {
  switch (target) {
    case nexi::ReactionTarget::EffectButton:
      return nexi::Intent::create(nexi::IntentType::NextEffect,
          nexi::IntentSource::ServiceButton);
    case nexi::ReactionTarget::RecordButton:
      return nexi::Intent::create(nexi::IntentType::Record,
          nexi::IntentSource::ServiceButton);
    case nexi::ReactionTarget::VolumeButton:
      return nexi::Intent::create(nexi::IntentType::AdjustVolume,
          nexi::IntentSource::ServiceButton, 1);
    default:
      return nexi::Intent::create(nexi::IntentType::None);
  }
}

int main() {
  const nexi::CapabilityPolicy policy = nexi::CapabilityPolicy::offlineDefault();
  Feedback feedback;
  nexi::ReactionGameApplication game(policy, feedback);
  nexi::ApplicationManager manager;
  assert(game.id() == nexi::ApplicationId::ReactionGame);
  assert(manager.registerApplication(&game));
  assert(manager.dispatch(nexi::Intent::selectApplication(
      nexi::ApplicationId::ReactionGame, nexi::IntentSource::Voice)));
  assert(game.running());
  assert(feedback.started == 1);
  assert(feedback.waiting == 1);

  // Spoken global controls do not count as physical reaction inputs.
  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::NextEffect, nexi::IntentSource::Voice)));
  assert(game.misses() == 0);

  // A button during the hidden waiting interval is a false start.
  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::Record, nexi::IntentSource::ServiceButton)));
  assert(game.misses() == 1);
  assert(feedback.results == 1);
  assert(!feedback.success);

  for (int tick = 0; tick < 200 && feedback.targets == 0; ++tick) {
    manager.tick();
  }
  assert(feedback.targets == 1);
  const nexi::ReactionTarget target = game.currentTarget();
  assert(target != nexi::ReactionTarget::Count);

  manager.tick();
  assert(manager.dispatch(intentFor(target)));
  assert(game.successes() == 1);
  assert(feedback.results == 2);
  assert(feedback.success);
  assert(feedback.reactionTicks > 0);

  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::StopApplication, nexi::IntentSource::Voice)));
  assert(!game.running());
  assert(manager.activeApplication() == nullptr);
  assert(feedback.stopped == 1);

  const nexi::CapabilityPolicy denied({1, 0, false, false});
  Feedback deniedFeedback;
  nexi::ReactionGameApplication deniedGame(denied, deniedFeedback);
  assert(!deniedGame.start(nexi::Intent::selectApplication(
      nexi::ApplicationId::ReactionGame)));
  assert(deniedFeedback.started == 0);
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
    path.join(projectRoot, "src/reaction_game_application.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("reaction game core has no driver, network or persistence dependency", () => {
  const source = [
    "include/nexi/reaction_game_feedback.h",
    "include/nexi/reaction_game_application.h",
    "src/reaction_game_application.cpp",
  ].map((relativePath) => fs.readFileSync(
    path.join(projectRoot, relativePath), "utf8",
  )).join("\n");

  assert.match(source, /class ReactionGameApplication/);
  assert.match(source, /ApplicationId::ReactionGame/);
  assert.match(source, /Capability::ReactionGame/);
  assert.doesNotMatch(source,
    /driver\/|freertos|nvs_|esp_http|WiFi|socket\s*\(|https?:\/\//);
});
