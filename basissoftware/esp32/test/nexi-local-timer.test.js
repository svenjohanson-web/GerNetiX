const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");

test("local timer selects, pauses, extends, alarms and acknowledges", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-timer-"));
  const harnessPath = path.join(temporaryRoot, "local_timer_test.cpp");
  const executablePath = path.join(temporaryRoot, "local_timer_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <cassert>

#include "nexi/application_manager.h"
#include "nexi/local_timer_application.h"

class Clock final : public nexi::MonotonicClock {
 public:
  uint64_t nowMilliseconds() const override { return now; }
  uint64_t now = 1000;
};

class RetainedClock final : public nexi::RetainedClock {
 public:
  bool nowSeconds(uint64_t* seconds) const override {
    if (!available || seconds == nullptr) return false;
    *seconds = now;
    return true;
  }
  bool ensureAvailable(uint64_t fallback) override {
    if (!available) {
      available = true;
      now = fallback;
    }
    return true;
  }
  uint64_t now = 946684800ULL;
  bool available = true;
};

class Store final : public nexi::TimerStateStore {
 public:
  nexi::TimerStateLoadResult load(nexi::TimerState* output) override {
    if (!present) return nexi::TimerStateLoadResult::Missing;
    *output = state;
    return nexi::TimerStateLoadResult::Loaded;
  }
  bool save(const nexi::TimerState& next) override {
    state = next;
    present = true;
    ++saves;
    return writable;
  }
  bool erase() override {
    present = false;
    ++erases;
    return true;
  }
  nexi::TimerState state{};
  bool present = false;
  bool writable = true;
  int saves = 0;
  int erases = 0;
};

class Power final : public nexi::TimerPowerControl {
 public:
  bool enterDeepSleep(uint32_t seconds) override {
    ++sleeps;
    wakeAfter = seconds;
    return accepted;
  }
  int sleeps = 0;
  uint32_t wakeAfter = 0;
  bool accepted = true;
};

class Feedback final : public nexi::LocalTimerFeedback {
 public:
  void showPreset(uint32_t seconds, size_t number, size_t count) override {
    ++presets;
    presetSeconds = seconds;
    presetNumber = number;
    presetCount = count;
  }
  void timerStarted(uint32_t seconds) override {
    ++starts;
    startedSeconds = seconds;
  }
  void timerRestored(uint32_t remaining, bool isPaused) override {
    ++restored;
    remainingSeconds = remaining;
    paused = isPaused;
  }
  void timerProgress(
      uint32_t remaining, uint32_t total, bool isPaused) override {
    ++progress;
    remainingSeconds = remaining;
    totalSeconds = total;
    paused = isPaused;
  }
  void timerAdjusted(uint32_t remaining) override {
    ++adjusted;
    adjustedSeconds = remaining;
  }
  void timerCancelled() override { ++cancelled; }
  void alarmPulse() override { ++alarms; }
  void alarmAcknowledged() override { ++acknowledged; }
  void timerSleeping(uint32_t remaining) override {
    ++sleeping;
    sleepSeconds = remaining;
  }
  void persistenceUnavailable() override { ++persistenceErrors; }
  void sleepUnavailable() override { ++sleepErrors; }
  void timerStopped() override { ++stopped; }

  int presets = 0;
  int starts = 0;
  int progress = 0;
  int adjusted = 0;
  int cancelled = 0;
  int alarms = 0;
  int acknowledged = 0;
  int stopped = 0;
  int restored = 0;
  int sleeping = 0;
  int persistenceErrors = 0;
  int sleepErrors = 0;
  uint32_t presetSeconds = 0;
  uint32_t startedSeconds = 0;
  uint32_t remainingSeconds = 0;
  uint32_t totalSeconds = 0;
  uint32_t adjustedSeconds = 0;
  uint32_t sleepSeconds = 0;
  size_t presetNumber = 0;
  size_t presetCount = 0;
  bool paused = false;
};

nexi::Intent key(nexi::IntentType type) {
  return nexi::Intent::create(type, nexi::IntentSource::Test, 1);
}

int main() {
  const nexi::CapabilityPolicy policy = nexi::CapabilityPolicy::offlineDefault();
  Clock clock;
  RetainedClock retained;
  Store store;
  Power power;
  Feedback feedback;
  nexi::LocalTimerApplication timer(
      policy, clock, retained, store, power, feedback);
  nexi::ApplicationManager manager;
  assert(manager.registerApplication(&timer));
  assert(manager.dispatch(nexi::Intent::selectApplication(
      nexi::ApplicationId::LocalTimer, nexi::IntentSource::Test)));
  assert(timer.running());
  assert(feedback.presetSeconds == 60);
  assert(feedback.presetCount == 3);

  // Spoken global controls do not operate timer buttons.
  manager.dispatch(nexi::Intent::create(
      nexi::IntentType::AdjustVolume, nexi::IntentSource::Voice, 1));
  assert(timer.selectedPresetIndex() == 0);

  // KEY3 selects three minutes, KEY2 starts.
  manager.dispatch(key(nexi::IntentType::AdjustVolume));
  assert(timer.selectedPresetIndex() == 1);
  assert(feedback.presetSeconds == 180);
  manager.dispatch(key(nexi::IntentType::Record));
  assert(timer.timerActive());
  assert(feedback.startedSeconds == 180);
  assert(timer.remainingSeconds() == 180);
  assert(store.present);
  assert(store.state.phase == nexi::TimerStoredPhase::Running);

  clock.now += 30000;
  manager.tick();
  assert(timer.remainingSeconds() == 150);
  retained.now += 30;

  // KEY2 pauses; elapsed wall time no longer consumes the timer.
  manager.dispatch(key(nexi::IntentType::Record));
  assert(timer.paused());
  assert(feedback.paused);
  assert(store.state.phase == nexi::TimerStoredPhase::Paused);
  assert(store.state.remainingSeconds == 150);
  clock.now += 100000;
  manager.tick();
  assert(timer.remainingSeconds() == 150);

  // KEY3 adds one minute while paused, KEY2 resumes.
  manager.dispatch(key(nexi::IntentType::AdjustVolume));
  assert(timer.remainingSeconds() == 210);
  assert(feedback.adjustedSeconds == 210);
  manager.dispatch(key(nexi::IntentType::Record));
  assert(!timer.paused());

  // Long KEY3 saves the deadline before requesting timer-based deep sleep.
  manager.dispatch(key(nexi::IntentType::ToggleMute));
  assert(power.sleeps == 1);
  assert(power.wakeAfter == 210);
  assert(feedback.sleeping == 1);

  clock.now += 210000;
  manager.tick();
  assert(timer.alarming());
  assert(feedback.alarms == 1);
  clock.now += nexi::LocalTimerApplication::kAlarmIntervalMilliseconds;
  manager.tick();
  assert(feedback.alarms == 2);

  // Any service key acknowledges and returns to preset selection.
  manager.dispatch(key(nexi::IntentType::Record));
  assert(!timer.alarming());
  assert(!timer.timerActive());
  assert(feedback.acknowledged == 1);
  assert(!store.present);

  // KEY1 cancels an active timer without stopping the app.
  manager.dispatch(key(nexi::IntentType::Record));
  assert(timer.timerActive());
  manager.dispatch(key(nexi::IntentType::NextEffect));
  assert(!timer.timerActive());
  assert(feedback.cancelled == 1);

  assert(manager.dispatch(nexi::Intent::create(
      nexi::IntentType::StopApplication, nexi::IntentSource::Test)));
  assert(!timer.running());
  assert(feedback.stopped == 1);

  const nexi::CapabilityPolicy denied({1, 0, false, false});
  Feedback deniedFeedback;
  nexi::LocalTimerApplication deniedTimer(
      denied, clock, retained, store, power, deniedFeedback);
  assert(!deniedTimer.start(nexi::Intent::selectApplication(
      nexi::ApplicationId::LocalTimer)));

  // A persisted running deadline turns directly into an alarm after reboot.
  Store rebootStore;
  rebootStore.save({nexi::TimerStoredPhase::Running, 0,
      retained.now + 60, 0, 60});
  retained.now += 60;
  Feedback rebootFeedback;
  Power rebootPower;
  nexi::LocalTimerApplication rebooted(
      policy, clock, retained, rebootStore, rebootPower, rebootFeedback);
  assert(rebooted.start(nexi::Intent::selectApplication(
      nexi::ApplicationId::LocalTimer, nexi::IntentSource::Test)));
  assert(rebooted.alarming());
  assert(rebootFeedback.restored == 1);
  assert(rebootFeedback.alarms == 1);
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
    path.join(projectRoot, "src/timer_state.cpp"),
    path.join(projectRoot, "src/local_timer_application.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("timer core uses bounded clock, state and power ports without drivers", () => {
  const core = [
    "include/nexi/monotonic_clock.h",
    "include/nexi/retained_clock.h",
    "include/nexi/timer_state_store.h",
    "include/nexi/timer_power_control.h",
    "include/nexi/local_timer_feedback.h",
    "include/nexi/local_timer_application.h",
    "src/local_timer_application.cpp",
  ].map((relativePath) => fs.readFileSync(
    path.join(projectRoot, relativePath), "utf8",
  )).join("\n");
  const adapter = fs.readFileSync(path.join(
    projectRoot, "src/esp_monotonic_clock.cpp"), "utf8");

  assert.match(core, /kPresetSeconds/);
  assert.match(core, /kMaximumDurationSeconds = 24U \* 60U \* 60U/);
  assert.match(core, /kAlarmIntervalMilliseconds = 3000/);
  assert.doesNotMatch(core,
    /driver\/|freertos|nvs\.h|esp_sleep|esp_timer_get_time|esp_http|WiFi|socket\s*\(|https?:\/\//);
  assert.match(adapter, /esp_timer_get_time/);
  assert.doesNotMatch(adapter, /nvs_|esp_http|WiFi|socket\s*\(/);
});
