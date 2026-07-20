#pragma once

#include <Arduino.h>

struct FlashboxFirmwareDownloadStatus {
  String state;
  String validationState;
  String manifestUrl;
  String manifestType;
  String artifactUrl;
  String expectedSha256;
  String signingKeyId;
  String identityPolicy;
  String targetDeviceId;
  String useCase;
  String writeState;
  String writeRoute;
  String error;
  String lastCheckedAt;
  int httpStatus;
  int artifactHttpStatus;
  size_t manifestBytes;
  size_t artifactBytes;
  bool manifestLoaded;
  bool signatureVerified;
  bool hashVerified;
  bool artifactDownloadAllowed;
  bool artifactWriteAllowed;
};

void flashboxFirmwareDownloadBegin();
FlashboxFirmwareDownloadStatus flashboxFirmwareDownloadStatus();
bool flashboxFetchFirmwareManifest(const String& manifestUrl);
bool flashboxDownloadAndVerifyFirmwareArtifact();
String flashboxFirmwareDownloadStatusJson();
