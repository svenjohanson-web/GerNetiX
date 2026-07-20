#pragma once

#include <Arduino.h>

struct FlashboxManifestValidationResult {
  String validationState;
  String error;
  String manifestType;
  String hardwareProfileId;
  String artifactUrl;
  String expectedSha256;
  String signingKeyId;
  String identityPolicy;
  String targetDeviceId;
  String useCase;
  String signatureBase64Url;
  String signedPayload;
  bool schemaValid;
  bool signatureVerified;
  bool hashVerified;
  bool artifactDownloadAllowed;
};

bool flashboxIsSupportedManifestType(const String& type);
bool flashboxIsKnownDeviceManifestType(const String& type);
bool flashboxVerifyArtifactSha256Hex(const uint8_t* data, size_t length, const String& expectedSha256);
FlashboxManifestValidationResult flashboxValidateFirmwareManifestContract(const String& manifestJson);
