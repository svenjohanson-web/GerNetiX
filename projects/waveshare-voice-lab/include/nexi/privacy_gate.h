#pragma once

#include "nexi/capability_policy.h"

namespace nexi {

class PrivacyGate {
 public:
  explicit PrivacyGate(const CapabilityPolicy &policy);

  void activateLocalSession();
  bool authorizeCloudForCurrentSession(bool explicitConsent);
  void endSession();

  bool mayCaptureAudio() const;
  bool mayTransmitAudio() const;

 private:
  const CapabilityPolicy &policy_;
  bool localSessionActive_ = false;
  bool cloudAuthorized_ = false;
};

}  // namespace nexi
