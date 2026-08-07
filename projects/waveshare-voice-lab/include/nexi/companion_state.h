#pragma once

#include <cstddef>
#include <cstdint>

namespace nexi {

struct CompanionState {
  uint8_t energy;
  uint8_t joy;
  uint8_t trust;
  uint32_t interactions;
};

enum class CompanionStateLoadResult : uint8_t {
  Loaded,
  Migrated,
  Missing,
  Invalid,
  Error,
};

class CompanionStateCodec {
 public:
  static constexpr uint8_t kCurrentVersion = 2;
  static constexpr size_t kEncodedSize = 16;
  static constexpr size_t kMaximumEncodedSize = 32;

  static CompanionState defaultState();
  static bool valid(const CompanionState& state);
  static bool encode(const CompanionState& state,
      uint8_t* output, size_t capacity, size_t* size);
  static CompanionStateLoadResult decode(
      const uint8_t* data, size_t size, CompanionState* state);
};

}  // namespace nexi
