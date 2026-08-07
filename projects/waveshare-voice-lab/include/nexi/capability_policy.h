#pragma once

#include <cstdint>

namespace nexi {

enum class Capability : uint32_t {
  VoiceStudio = 1U << 0,
  ReactionGame = 1U << 1,
  LocalQuiz = 1U << 2,
  Oracle = 1U << 3,
  LearningCompanion = 1U << 4,
  VoiceCompanion = 1U << 5,
  CloudConversation = 1U << 6,
  PersistentMemory = 1U << 7,
  LocalStories = 1U << 8,
  LocalTimer = 1U << 9,
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
