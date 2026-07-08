#pragma once

#include <cstddef>

#include "esp_err.h"

struct ProvisioningConfig {
  bool provisioned;
  bool hasDeviceSecret;
  char deviceId[64];
  char serialNumber[64];
  char hardwareProfileId[96];
  char firmwareVersion[32];
  char firmwareBasis[64];
  char credentialId[96];
  char credentialType[32];
  char keyReference[128];
  char secretSha256[80];
  char deviceManagementUrl[160];
  char buildDeployUrl[160];
  char provisioningBatchId[96];
  char provisionedBy[96];
  char capabilities[160];
};

ProvisioningConfig loadProvisioningConfig();
esp_err_t saveProvisioningPayload(const char *payload, size_t payloadLength);
size_t writeProvisioningDeviceName(char *target, size_t targetSize);
size_t writeProvisioningHostname(char *target, size_t targetSize);
size_t writeProvisioningStatusJson(char *target, size_t targetSize);
esp_err_t writeChallengeProofJson(const char *payload, size_t payloadLength, char *target, size_t targetSize);
