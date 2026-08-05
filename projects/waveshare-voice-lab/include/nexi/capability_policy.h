#pragma once

#include <cstdint>

namespace nexi {

enum class Capability : uint32_t {
  VoiceStudio = 1U << 0,
  Oracle = 1U << 1,
  LearningCompanion = 1U << 2,
  VoiceCompanion = 1U << 3,
  CloudConversation = 1U << 4,
  PersistentMemory = 1U << 5,
};

struct CapabilitySnapshot {
  uint32_t revision;
  uint32_t enabled;
  bool accountBound;
  bool providerEnabled;
};

class CapabilityPolicy {
 public:
  static CapabilityPolicy offlineDefault();
  explicit CapabilityPolicy(CapabilitySnapshot snapshot);

  bool allows(Capability capability) const;
  bool cloudConversationAvailable() const;
  const CapabilitySnapshot &snapshot() const;

 private:
  CapabilitySnapshot snapshot_;
};

}  // namespace nexi
