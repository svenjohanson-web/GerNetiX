#pragma once

#include <Arduino.h>

struct FlashboxWritePlan {
  String writeState;
  String writeRoute;
  String error;
  bool writeAllowed;
};

FlashboxWritePlan flashboxPlanWriteAfterArtifactVerified(
  const String& manifestType,
  bool signatureVerified,
  bool hashVerified);
