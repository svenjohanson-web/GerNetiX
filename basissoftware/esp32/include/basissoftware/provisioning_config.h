#pragma once

#include <cstddef>

#include "esp_err.h"

struct ProvisioningConfig {
  bool provisioned;
  bool hasDevicePrivateKey;
  bool hasMqttClientCertificate;
  bool hasOtaSigningPublicKey;
  char deviceId[64];
  char serialNumber[64];
  char hardwareProfileId[96];
  char firmwareVersion[32];
  char firmwareBasis[64];
  char credentialId[96];
  char credentialType[32];
  char keyReference[128];
  char devicePublicKeyPem[256];
  char devicePrivateKeyPem[512];
  char devicePrivateKeyRawBase64Url[64];
  char mqttClientCertificatePem[2048];
  char otaSigningKeyId[96];
  char otaSigningPublicKeyPem[512];
  char deviceManagementUrl[160];
  char buildDeployUrl[160];
  char mqttBrokerUrl[160];
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
esp_err_t signDeviceMessageBase64Url(const char *message, size_t messageLength, char *target, size_t targetSize);
esp_err_t verifyEcdsaP256SignatureBase64Url(
    const char *publicKeyPem,
    const char *message,
    size_t messageLength,
    const char *signatureBase64Url);
