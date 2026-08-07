#include "nexi/companion_state.h"

namespace nexi {
namespace {
constexpr uint32_t kMagic = 0x5043584eU;  // NXCP in little-endian bytes.
constexpr size_t kLegacyV1Size = 13;

uint32_t read32(const uint8_t* data) {
  return static_cast<uint32_t>(data[0]) |
      (static_cast<uint32_t>(data[1]) << 8U) |
      (static_cast<uint32_t>(data[2]) << 16U) |
      (static_cast<uint32_t>(data[3]) << 24U);
}

void write32(uint8_t* data, uint32_t value) {
  data[0] = static_cast<uint8_t>(value);
  data[1] = static_cast<uint8_t>(value >> 8U);
  data[2] = static_cast<uint8_t>(value >> 16U);
  data[3] = static_cast<uint8_t>(value >> 24U);
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

CompanionState CompanionStateCodec::defaultState() {
  return {70, 60, 20, 0};
}

bool CompanionStateCodec::valid(const CompanionState& state) {
  return state.energy <= 100 && state.joy <= 100 && state.trust <= 100;
}

bool CompanionStateCodec::encode(const CompanionState& state,
    uint8_t* output, size_t capacity, size_t* size) {
  if (output == nullptr || size == nullptr || capacity < kEncodedSize ||
      !valid(state)) {
    return false;
  }
  write32(output, kMagic);
  output[4] = kCurrentVersion;
  output[5] = state.energy;
  output[6] = state.joy;
  output[7] = state.trust;
  write32(output + 8, state.interactions);
  write32(output + 12, checksum(output, 12));
  *size = kEncodedSize;
  return true;
}

CompanionStateLoadResult CompanionStateCodec::decode(
    const uint8_t* data, size_t size, CompanionState* state) {
  if (data == nullptr || state == nullptr || size < 5 ||
      read32(data) != kMagic) {
    return CompanionStateLoadResult::Invalid;
  }
  if (data[4] == kCurrentVersion && size == kEncodedSize) {
    if (read32(data + 12) != checksum(data, 12)) {
      return CompanionStateLoadResult::Invalid;
    }
    const CompanionState decoded = {
        data[5], data[6], data[7], read32(data + 8)};
    if (!valid(decoded)) return CompanionStateLoadResult::Invalid;
    *state = decoded;
    return CompanionStateLoadResult::Loaded;
  }
  if (data[4] == 1 && size == kLegacyV1Size) {
    if (read32(data + 9) != checksum(data, 9)) {
      return CompanionStateLoadResult::Invalid;
    }
    const uint32_t interactions = static_cast<uint32_t>(data[7]) |
        (static_cast<uint32_t>(data[8]) << 8U);
    const CompanionState migrated = {
        data[5], data[6], 20, interactions};
    if (!valid(migrated)) return CompanionStateLoadResult::Invalid;
    *state = migrated;
    return CompanionStateLoadResult::Migrated;
  }
  return CompanionStateLoadResult::Invalid;
}

}  // namespace nexi
