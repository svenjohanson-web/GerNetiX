const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const projectRoot = path.join(repositoryRoot, "projects/waveshare-voice-lab");
const includeRoot = path.join(projectRoot, "include");

test("PCF85063 calendar and retained timer state codecs reject invalid data", (t) => {
  const compiler = process.env.CXX || "c++";
  const probe = spawnSync(compiler, ["--version"], { encoding: "utf8" });
  if (probe.error && probe.error.code === "ENOENT") {
    t.skip(`${compiler} is not installed`);
    return;
  }
  assert.equal(probe.status, 0, probe.stderr);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-rtc-"));
  const harnessPath = path.join(temporaryRoot, "rtc_test.cpp");
  const executablePath = path.join(temporaryRoot, "rtc_test");
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.writeFileSync(harnessPath, String.raw`
#include <array>
#include <cassert>

#include "nexi/pcf85063_time.h"
#include "nexi/timer_state.h"

int main() {
  nexi::RtcCalendarTime leapDay{2028, 2, 29, 23, 59, 58};
  std::array<uint8_t, nexi::Pcf85063TimeCodec::kRegisterCount> registers{};
  assert(nexi::Pcf85063TimeCodec::encode(
      leapDay, registers.data(), registers.size()));
  nexi::RtcCalendarTime decoded{};
  bool oscillatorStopped = true;
  assert(nexi::Pcf85063TimeCodec::decode(
      registers.data(), registers.size(), &decoded, &oscillatorStopped));
  assert(!oscillatorStopped);
  assert(decoded.year == 2028 && decoded.month == 2 && decoded.day == 29);
  assert(decoded.hour == 23 && decoded.minute == 59 && decoded.second == 58);

  uint64_t epoch = 0;
  assert(nexi::Pcf85063TimeCodec::toEpochSeconds(decoded, &epoch));
  nexi::RtcCalendarTime roundTrip{};
  assert(nexi::Pcf85063TimeCodec::fromEpochSeconds(epoch, &roundTrip));
  assert(roundTrip.year == decoded.year && roundTrip.month == decoded.month &&
      roundTrip.day == decoded.day && roundTrip.hour == decoded.hour &&
      roundTrip.minute == decoded.minute && roundTrip.second == decoded.second);

  registers[0] |= 0x80;
  assert(nexi::Pcf85063TimeCodec::decode(
      registers.data(), registers.size(), &decoded, &oscillatorStopped));
  assert(oscillatorStopped);
  registers[0] = 0x7a;
  assert(!nexi::Pcf85063TimeCodec::decode(
      registers.data(), registers.size(), &decoded, &oscillatorStopped));
  assert(!nexi::Pcf85063TimeCodec::valid({2027, 2, 29, 0, 0, 0}));
  assert(!nexi::Pcf85063TimeCodec::fromEpochSeconds(1, &roundTrip));

  const nexi::TimerState running{
      nexi::TimerStoredPhase::Running, 2, epoch + 300, 0, 300};
  std::array<uint8_t, nexi::TimerStateCodec::kEncodedSize> stateBytes{};
  size_t stateSize = 0;
  assert(nexi::TimerStateCodec::encode(
      running, stateBytes.data(), stateBytes.size(), &stateSize));
  assert(stateSize == nexi::TimerStateCodec::kEncodedSize);
  nexi::TimerState restored{};
  assert(nexi::TimerStateCodec::decode(
      stateBytes.data(), stateBytes.size(), &restored) ==
      nexi::TimerStateLoadResult::Loaded);
  assert(restored.deadlineSeconds == running.deadlineSeconds);
  assert(restored.totalSeconds == 300);

  stateBytes[12] ^= 0x40;
  assert(nexi::TimerStateCodec::decode(
      stateBytes.data(), stateBytes.size(), &restored) ==
      nexi::TimerStateLoadResult::Invalid);
  assert(!nexi::TimerStateCodec::valid({
      nexi::TimerStoredPhase::Paused, 0, 0, 61, 60}));
  assert(!nexi::TimerStateCodec::valid({
      nexi::TimerStoredPhase::Running, 3, epoch, 0, 60}));
}
`);

  const compilation = spawnSync(compiler, [
    "-std=c++11",
    "-Wall",
    "-Wextra",
    "-pedantic",
    `-I${includeRoot}`,
    harnessPath,
    path.join(projectRoot, "src/pcf85063_time.cpp"),
    path.join(projectRoot, "src/timer_state.cpp"),
    "-o",
    executablePath,
  ], { encoding: "utf8" });
  assert.equal(compilation.status, 0, compilation.stderr || compilation.stdout);

  const execution = spawnSync(executablePath, [], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr || execution.stdout);
});

test("RTC and deep-sleep adapters stay outside the hardware-free timer core", () => {
  const rtcCodec = fs.readFileSync(
    path.join(projectRoot, "src/pcf85063_time.cpp"), "utf8");
  const rtcAdapter = fs.readFileSync(
    path.join(projectRoot, "src/pcf85063_retained_clock.cpp"), "utf8");
  const sleepAdapter = fs.readFileSync(
    path.join(projectRoot, "src/esp_timer_power_control.cpp"), "utf8");
  const nvsAdapter = fs.readFileSync(
    path.join(projectRoot, "src/nvs_timer_state_store.cpp"), "utf8");

  assert.doesNotMatch(rtcCodec, /driver\/|nvs_|esp_sleep|esp_timer/);
  assert.match(rtcAdapter, /readRtcRegisters/);
  assert.match(rtcAdapter, /kSecondsRegister = 0x04/);
  assert.match(sleepAdapter, /esp_sleep_enable_timer_wakeup/);
  assert.match(sleepAdapter, /esp_deep_sleep_start/);
  assert.match(nvsAdapter, /nexi_timer/);
  assert.match(nvsAdapter, /nvs_erase_key/);
  assert.doesNotMatch(nvsAdapter, /nvs_erase_all|nvs_flash_erase/);
});
