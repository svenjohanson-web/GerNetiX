#pragma once

#include <Arduino.h>

struct FlashboxTargetSerialStatus {
  String state;
  String transport;
  String usbVid;
  String usbPid;
  String error;
  size_t receivedBytes;
  bool driverInstalled;
  bool targetOpen;
};

void flashboxTargetSerialBegin();
void flashboxTargetSerialLoop();
bool flashboxTargetSerialWrite(const uint8_t* data, size_t dataLength, uint32_t timeoutMs);
FlashboxTargetSerialStatus flashboxTargetSerialStatus();
String flashboxTargetSerialStatusJson();
