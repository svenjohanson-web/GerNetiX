#pragma once

#include <Arduino.h>

struct FlashboxProvisioningStatus {
  String state;
  String deviceId;
  String mqttBroker;
  bool privateKeyReady;
  bool clientCertificateReady;
  String error;
};

void flashboxProvisioningBegin();
FlashboxProvisioningStatus flashboxProvisioningStatus();
String flashboxProvisioningStatusJson();
String flashboxProvisioningApply(const String& payload, int& statusCode);
String flashboxSignProvisioningChallenge(const String& canonical, const String& requestedDeviceId);
