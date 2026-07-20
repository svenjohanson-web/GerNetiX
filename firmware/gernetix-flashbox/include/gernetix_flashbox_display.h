#pragma once

#include <Arduino.h>

void flashboxDisplayBegin();
void flashboxDisplayShowBoot(const String& serialNumber, const String& firmwareVersion);
void flashboxDisplayShowNetwork(const String& setupSsid);
void flashboxDisplayShowWifiDisconnected(const String& setupSsid, const String& scannedSsids);
void flashboxDisplayShowWifiConnected(const String& ssid, const String& ipAddress);
void flashboxDisplayShowClaimState(const String& claimState, const String& detail);
void flashboxDisplayShowTargetState(const String& targetState, const String& detail);
void flashboxDisplayShowError(const String& code, const String& detail);
void flashboxDisplayLoop();
