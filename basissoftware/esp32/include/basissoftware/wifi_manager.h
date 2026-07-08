#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"

constexpr uint32_t WIFI_CONNECT_TIMEOUT_MS = 10000;

void initWifi();
const char *wifiRuntimeModeName();
bool wifiSetupPortalIsActive();
const char *wifiStationStateName();
int wifiLastDisconnectReason();
int wifiLastConnectStatus();
esp_err_t saveWifiStationCredentials(const char *ssid, const char *password);
esp_err_t scanWifiNetworksJson(char *target, size_t targetSize);
esp_err_t connectWifiStationFromSavedCredentials(uint32_t timeoutMs);
esp_err_t requestWifiStationConnectFromSavedCredentials();
