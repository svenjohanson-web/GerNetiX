#pragma once

#include <Arduino.h>

struct FlashboxTargetDeviceStatus {
  String state;
  String connectionState;
  String bootloaderState;
  String targetKind;
  String targetDisplayName;
  String serialBridge;
  String chipFamily;
  String usbVid;
  String usbPid;
  String usbAddress;
  String detectionBackend;
  String vbusPowerMode;
  String targetPowerPolicy;
  String recommendedAction;
  String error;
  String lastSeenAtMs;
  int detectedDeviceCount;
  bool targetConnected;
  bool vbusControlAvailable;
  bool espRomBootloaderLikely;
  bool targetFlashPreflightAllowed;
};

void flashboxTargetDetectionBegin();
void flashboxTargetDetectionLoop();
FlashboxTargetDeviceStatus flashboxTargetDetectionStatus();
String flashboxTargetDetectionStatusJson();
