#include "nexi/pcf85063_retained_clock.h"

#include <array>

#include "nexi/hardware_platform.h"
#include "nexi/pcf85063_time.h"

namespace nexi {
namespace {
constexpr uint8_t kControl1Register = 0x00;
constexpr uint8_t kSecondsRegister = 0x04;
constexpr uint8_t kStopMask = 0x20;
}

bool Pcf85063RetainedClock::nowSeconds(uint64_t* seconds) const {
  if (seconds == nullptr) return false;
  std::array<uint8_t, Pcf85063TimeCodec::kRegisterCount> registers{};
  if (HardwarePlatform::instance().readRtcRegisters(
          kSecondsRegister, registers.data(), registers.size()) != ESP_OK) {
    return false;
  }
  RtcCalendarTime time{};
  bool oscillatorStopped = false;
  return Pcf85063TimeCodec::decode(
             registers.data(), registers.size(), &time, &oscillatorStopped) &&
      !oscillatorStopped && Pcf85063TimeCodec::toEpochSeconds(time, seconds);
}

bool Pcf85063RetainedClock::ensureAvailable(uint64_t fallbackSeconds) {
  uint64_t current = 0;
  if (nowSeconds(&current)) return true;
  RtcCalendarTime fallback{};
  std::array<uint8_t, Pcf85063TimeCodec::kRegisterCount> registers{};
  if (!Pcf85063TimeCodec::fromEpochSeconds(fallbackSeconds, &fallback) ||
      !Pcf85063TimeCodec::encode(
          fallback, registers.data(), registers.size())) {
    return false;
  }
  uint8_t control1 = 0;
  auto& hardware = HardwarePlatform::instance();
  if (hardware.readRtcRegisters(kControl1Register, &control1, 1) != ESP_OK) {
    return false;
  }
  control1 = static_cast<uint8_t>(control1 & ~kStopMask);
  return hardware.writeRtcRegisters(kControl1Register, &control1, 1) == ESP_OK &&
      hardware.writeRtcRegisters(
          kSecondsRegister, registers.data(), registers.size()) == ESP_OK;
}

}  // namespace nexi
