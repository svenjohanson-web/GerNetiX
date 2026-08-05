#include "nexi/privacy_gate.h"

namespace nexi {

PrivacyGate::PrivacyGate(const CapabilityPolicy &policy) : policy_(policy) {
}

void PrivacyGate::activateLocalSession() {
  localSessionActive_ = true;
  cloudAuthorized_ = false;
}

bool PrivacyGate::authorizeCloudForCurrentSession(bool explicitConsent) {
  cloudAuthorized_ = localSessionActive_
      && explicitConsent
      && policy_.cloudConversationAvailable();
  return cloudAuthorized_;
}

void PrivacyGate::endSession() {
  cloudAuthorized_ = false;
  localSessionActive_ = false;
}

bool PrivacyGate::mayCaptureAudio() const {
  return localSessionActive_;
}

bool PrivacyGate::mayTransmitAudio() const {
  return localSessionActive_ && cloudAuthorized_;
}

}  // namespace nexi
