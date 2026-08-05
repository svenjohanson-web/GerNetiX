const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");

test("Nexi intent and application contracts stay portable and allocation-free", () => {
  const files = [
    "include/nexi/intent.h",
    "include/nexi/input_provider.h",
    "include/nexi/application.h",
    "include/nexi/application_manager.h",
    "src/intent.cpp",
    "src/application_manager.cpp",
  ];
  const source = files
    .map((relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8"))
    .join("\n");

  assert.match(source, /enum class IntentType/);
  assert.match(source, /virtual bool poll\(Intent\* intent\) = 0/);
  assert.match(source, /class ApplicationManager/);
  assert.match(source, /kMaxApplications/);
  assert.doesNotMatch(source, /#include\s*[<"](?:vector|string|map|memory|WiFi|HTTPClient)/);
  assert.doesNotMatch(source, /\b(?:malloc|calloc|realloc|free)\s*\(|\bnew\b/);
  assert.doesNotMatch(source, /esp_http|socket\s*\(|https?:\/\//);
});

test("Nexi application manager routes intents and switches applications on a host", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-app-manager-"));
  const harnessPath = path.join(temporaryRoot, "application_manager_test.cpp");
  const executablePath = path.join(temporaryRoot, "application_manager_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <cassert>

#include "nexi/application_manager.h"

class FakeApplication final : public nexi::Application {
 public:
  explicit FakeApplication(nexi::ApplicationId applicationId)
      : applicationId_(applicationId), startCount(0), stopCount(0),
        intentCount(0), tickCount(0), lastStop(nexi::ApplicationStopReason::Fault) {}

  nexi::ApplicationId id() const override { return applicationId_; }
  bool start(const nexi::Intent&) override { ++startCount; return true; }
  void stop(nexi::ApplicationStopReason reason) override {
    ++stopCount;
    lastStop = reason;
  }
  void handleIntent(const nexi::Intent&) override { ++intentCount; }
  void tick() override { ++tickCount; }

  nexi::ApplicationId applicationId_;
  int startCount;
  int stopCount;
  int intentCount;
  int tickCount;
  nexi::ApplicationStopReason lastStop;
};

class OneShotInput final : public nexi::InputProvider {
 public:
  explicit OneShotInput(const nexi::Intent& queued) : queued_(queued), ready_(true) {}
  bool poll(nexi::Intent* intent) override {
    if (!ready_ || intent == nullptr) return false;
    *intent = queued_;
    ready_ = false;
    return true;
  }
 private:
  nexi::Intent queued_;
  bool ready_;
};

int main() {
  nexi::ApplicationManager manager;
  FakeApplication studio(nexi::ApplicationId::VoiceStudio);
  FakeApplication oracle(nexi::ApplicationId::Oracle);

  assert(manager.registerApplication(&studio));
  assert(manager.registerApplication(&oracle));
  assert(!manager.registerApplication(&studio));
  assert(manager.applicationCount() == 2);

  assert(manager.dispatch(nexi::Intent::selectApplication(
      nexi::ApplicationId::VoiceStudio, nexi::IntentSource::Voice)));
  assert(manager.activeApplication() == &studio);
  assert(studio.startCount == 1);

  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::Record, nexi::IntentSource::Voice)));
  assert(studio.intentCount == 1);

  assert(manager.dispatch(nexi::Intent::selectApplication(
      nexi::ApplicationId::Oracle, nexi::IntentSource::Voice)));
  assert(studio.stopCount == 1);
  assert(studio.lastStop == nexi::ApplicationStopReason::ApplicationSwitch);
  assert(manager.activeApplicationId() == nexi::ApplicationId::Oracle);

  OneShotInput stopInput(nexi::Intent::create(
      nexi::IntentType::StopApplication, nexi::IntentSource::Voice));
  assert(manager.registerInputProvider(&stopInput));
  assert(!manager.registerInputProvider(&stopInput));
  manager.tick();
  assert(manager.activeApplication() == nullptr);
  assert(oracle.stopCount == 1);
  assert(oracle.lastStop == nexi::ApplicationStopReason::UserRequest);
  assert(oracle.tickCount == 0);
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
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});
