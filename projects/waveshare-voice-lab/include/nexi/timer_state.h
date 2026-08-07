#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

enum class TimerStoredPhase : uint8_t { Running = 1, Paused = 2 };

struct TimerState {
  TimerStoredPhase phase;
  uint8_t presetIndex;
  uint64_t deadlineSeconds;
  uint32_t remainingSeconds;
  uint32_t totalSeconds;
};

enum class TimerStateLoadResult : uint8_t {
  Loaded,
  Missing,
  Invalid,
  Error,
};

class TimerStateCodec {
 public:
  static constexpr uint8_t kCurrentVersion = 1;
  static constexpr size_t kEncodedSize = 28;
  static constexpr size_t kMaximumEncodedSize = 32;
  static constexpr uint32_t kMaximumSeconds = 24U * 60U * 60U;
  static constexpr uint8_t kPresetCount = 3;

  static bool valid(const TimerState& state);
  static bool encode(const TimerState& state,
      uint8_t* output, size_t capacity, size_t* size);
  static TimerStateLoadResult decode(
      const uint8_t* data, size_t size, TimerState* state);
};

}  // namespace nexi
