#include "nexi/capability_policy.h"

namespace nexi {
namespace {
constexpr uint32_t bit(Capability capability) {
  return static_cast<uint32_t>(capability);
}
}

CapabilityPolicy CapabilityPolicy::offlineDefault() {
  return CapabilityPolicy({
      1,
      bit(Capability::VoiceStudio) | bit(Capability::ReactionGame) |
          bit(Capability::LocalQuiz) | bit(Capability::LocalStories) |
          bit(Capability::VoiceCompanion) |
          bit(Capability::PersistentMemory) |
          bit(Capability::LocalTimer),
      false,
      false,
  });
}

CapabilityPolicy::CapabilityPolicy(CapabilitySnapshot snapshot)
    : snapshot_(snapshot) {
}

bool CapabilityPolicy::allows(Capability capability) const {
  return (snapshot_.enabled & bit(capability)) != 0;
}

bool CapabilityPolicy::cloudConversationAvailable() const {
  return snapshot_.accountBound
      && snapshot_.providerEnabled
      && allows(Capability::CloudConversation);
}

const CapabilitySnapshot &CapabilityPolicy::snapshot() const {
  return snapshot_;
}

}  // namespace nexi
