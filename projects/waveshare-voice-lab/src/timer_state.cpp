#include "nexi/timer_state.h"

namespace nexi {
namespace {
constexpr uint32_t kMagic = 0x4d54584eU;  // NXTM in little-endian bytes.

uint32_t read32(const uint8_t* data) {
  return static_cast<uint32_t>(data[0]) |
      (static_cast<uint32_t>(data[1]) << 8U) |
      (static_cast<uint32_t>(data[2]) << 16U) |
      (static_cast<uint32_t>(data[3]) << 24U);
}

uint64_t read64(const uint8_t* data) {
  return static_cast<uint64_t>(read32(data)) |
      (static_cast<uint64_t>(read32(data + 4)) << 32U);
}

void write32(uint8_t* data, uint32_t value) {
  data[0] = static_cast<uint8_t>(value);
  data[1] = static_cast<uint8_t>(value >> 8U);
  data[2] = static_cast<uint8_t>(value >> 16U);
  data[3] = static_cast<uint8_t>(value >> 24U);
}

void write64(uint8_t* data, uint64_t value) {
  write32(data, static_cast<uint32_t>(value));
  write32(data + 4, static_cast<uint32_t>(value >> 32U));
}

uint32_t checksum(const uint8_t* data, size_t size) {
  uint32_t hash = 2166136261U;
  for (size_t index = 0; index < size; ++index) {
    hash ^= data[index];
    hash *= 16777619U;
  }
  return hash;
}
}  // namespace

bool TimerStateCodec::valid(const TimerState& state) {
  if (state.presetIndex >= kPresetCount || state.totalSeconds == 0 ||
      state.totalSeconds > kMaximumSeconds) {
    return false;
  }
  if (state.phase == TimerStoredPhase::Running) {
    return state.deadlineSeconds > 0 && state.remainingSeconds == 0;
  }
  if (state.phase == TimerStoredPhase::Paused) {
    return state.deadlineSeconds == 0 && state.remainingSeconds > 0 &&
        state.remainingSeconds <= state.totalSeconds &&
        state.remainingSeconds <= kMaximumSeconds;
  }
  return false;
}

bool TimerStateCodec::encode(const TimerState& state,
    uint8_t* output, size_t capacity, size_t* size) {
  if (output == nullptr || size == nullptr || capacity < kEncodedSize ||
      !valid(state)) {
    return false;
  }
  write32(output, kMagic);
  output[4] = kCurrentVersion;
  output[5] = static_cast<uint8_t>(state.phase);
  output[6] = state.presetIndex;
  output[7] = 0;
  write64(output + 8, state.deadlineSeconds);
  write32(output + 16, state.remainingSeconds);
  write32(output + 20, state.totalSeconds);
  write32(output + 24, checksum(output, 24));
  *size = kEncodedSize;
  return true;
}

TimerStateLoadResult TimerStateCodec::decode(
    const uint8_t* data, size_t size, TimerState* state) {
  if (data == nullptr || state == nullptr || size != kEncodedSize ||
      read32(data) != kMagic || data[4] != kCurrentVersion || data[7] != 0 ||
      read32(data + 24) != checksum(data, 24)) {
    return TimerStateLoadResult::Invalid;
  }
  const TimerState decoded = {
      static_cast<TimerStoredPhase>(data[5]), data[6], read64(data + 8),
      read32(data + 16), read32(data + 20)};
  if (!valid(decoded)) return TimerStateLoadResult::Invalid;
  *state = decoded;
  return TimerStateLoadResult::Loaded;
}

}  // namespace nexi
