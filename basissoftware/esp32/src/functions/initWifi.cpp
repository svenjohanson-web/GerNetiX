#include "basissoftware/functions/initWifi.h"

#include <cstdarg>
#include <cstdlib>
#include <cstdio>
#include <cstring>

#include "esp_event.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "nvs.h"
#include "nvs_flash.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"
#include "basissoftware/functions/startCaptiveDnsServer.h"
#include "basissoftware/functions/startDeviceWebServer.h"
#include "basissoftware/provisioning_config.h"

void startWifiSetupPortal();

namespace {
constexpr const char *TAG = "initWifi";
constexpr const char *WIFI_NVS_NAMESPACE = "wifi";
constexpr const char *WIFI_NVS_SSID_KEY = "ssid";
constexpr const char *WIFI_NVS_PASSWORD_KEY = "password";
constexpr EventBits_t WIFI_CONNECTED_BIT = BIT0;
constexpr size_t WIFI_SCAN_LIMIT = 16;
constexpr uint32_t WIFI_RECONNECT_DELAYS_MS[] = {1000, 2000, 5000, 10000, 30000, 60000};

enum class StationState {
  Idle,
  Connecting,
  Connected,
  Failed,
};

EventGroupHandle_t wifiEvents = nullptr;
bool wifiStarted = false;
bool setupPortalActive = false;
TaskHandle_t wifiConnectTaskHandle = nullptr;
TaskHandle_t wifiReconnectTaskHandle = nullptr;
StationState stationState = StationState::Idle;
int lastDisconnectReason = 0;
int lastConnectStatus = ESP_OK;
unsigned wifiConnectRetryCount = 0;
esp_netif_t *stationNetif = nullptr;

struct WifiCredentials {
  char ssid[33];
  char password[65];
};

void scheduleWifiReconnect();

uint32_t wifiReconnectDelayMs() {
  const size_t delayCount = sizeof(WIFI_RECONNECT_DELAYS_MS) / sizeof(WIFI_RECONNECT_DELAYS_MS[0]);
  const size_t delayIndex = wifiConnectRetryCount < delayCount ? wifiConnectRetryCount : delayCount - 1;
  return WIFI_RECONNECT_DELAYS_MS[delayIndex];
}

void wifiReconnectTask(void *) {
  const uint32_t delayMs = wifiReconnectDelayMs();
  wifiConnectRetryCount++;
  feedbackWarning(TAG, "WiFi reconnect scheduled: attempt=%u delay_ms=%u reason=%d", wifiConnectRetryCount, delayMs, lastDisconnectReason);
  vTaskDelay(pdMS_TO_TICKS(delayMs));

  if ((xEventGroupGetBits(wifiEvents) & WIFI_CONNECTED_BIT) != 0) {
    wifiReconnectTaskHandle = nullptr;
    vTaskDelete(nullptr);
    return;
  }

  wifiReconnectTaskHandle = nullptr;
  stationState = StationState::Connecting;
  const esp_err_t status = esp_wifi_connect();
  if (status != ESP_OK) {
    lastConnectStatus = status;
    feedbackWarning(TAG, "WiFi reconnect start failed: attempt=%u status=%d", wifiConnectRetryCount, status);
    scheduleWifiReconnect();
  }
  vTaskDelete(nullptr);
}

void scheduleWifiReconnect() {
  if (!wifiStarted || wifiReconnectTaskHandle != nullptr || setupPortalActive) {
    return;
  }
  const BaseType_t created = xTaskCreate(
      wifiReconnectTask,
      "wifi-reconnect",
      3072,
      nullptr,
      5,
      &wifiReconnectTaskHandle);
  if (created != pdPASS) {
    wifiReconnectTaskHandle = nullptr;
    lastConnectStatus = ESP_ERR_NO_MEM;
    feedbackError(TAG, "WiFi reconnect task could not be started");
  }
}

void initNvs() {
  esp_err_t status = nvs_flash_init();

  if (status == ESP_ERR_NVS_NO_FREE_PAGES ||
      status == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    status = nvs_flash_init();
  }

  ESP_ERROR_CHECK(status);
}

void copyWifiString(uint8_t *target, size_t targetSize, const char *source) {
  std::strncpy(reinterpret_cast<char *>(target), source == nullptr ? "" : source, targetSize);
  target[targetSize - 1] = '\0';
}

bool readNvsString(nvs_handle_t handle, const char *key, char *target, size_t targetSize) {
  size_t length = targetSize;
  if (target == nullptr || targetSize == 0 || nvs_get_str(handle, key, target, &length) != ESP_OK) {
    if (target != nullptr && targetSize > 0) {
      target[0] = '\0';
    }
    return false;
  }
  return target[0] != '\0';
}

bool loadWifiCredentials(WifiCredentials &credentials) {
  credentials = {};
  nvs_handle_t handle = 0;
  if (nvs_open(WIFI_NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) {
    return false;
  }

  const bool hasSsid = readNvsString(handle, WIFI_NVS_SSID_KEY, credentials.ssid, sizeof(credentials.ssid));
  readNvsString(handle, WIFI_NVS_PASSWORD_KEY, credentials.password, sizeof(credentials.password));
  nvs_close(handle);
  return hasSsid;
}

void wifiEventHandler(void *, esp_event_base_t eventBase, int32_t eventId, void *eventData) {
  if (eventBase == WIFI_EVENT && eventId == WIFI_EVENT_STA_DISCONNECTED) {
    const wifi_event_sta_disconnected_t *event =
        static_cast<wifi_event_sta_disconnected_t *>(eventData);
    lastDisconnectReason = event == nullptr ? 0 : event->reason;
    xEventGroupClearBits(wifiEvents, WIFI_CONNECTED_BIT);
    stationState = StationState::Connecting;
    feedbackWarning(TAG, "WiFi station disconnected: reason=%d", lastDisconnectReason);
    scheduleWifiReconnect();
    return;
  }

  if (eventBase == IP_EVENT && eventId == IP_EVENT_STA_GOT_IP) {
    const ip_event_got_ip_t *event = static_cast<ip_event_got_ip_t *>(eventData);
    xEventGroupSetBits(wifiEvents, WIFI_CONNECTED_BIT);
    stationState = StationState::Connected;
    lastConnectStatus = ESP_OK;
    lastDisconnectReason = 0;
    wifiConnectRetryCount = 0;
    if (setupPortalActive) {
      const esp_err_t modeStatus = esp_wifi_set_mode(WIFI_MODE_STA);
      if (modeStatus == ESP_OK) {
        setupPortalActive = false;
        feedbackInfo(TAG, "WiFi station recovered; setup AP disabled");
      } else {
        feedbackWarning(TAG, "Setup AP could not be disabled after station recovery: %d", modeStatus);
      }
    }
    feedbackInfo(TAG, "WiFi station connected: " IPSTR, IP2STR(&event->ip_info.ip));
  }
}

void configureSetupAp() {
  wifi_config_t apConfig = {};
  copyWifiString(apConfig.ap.ssid, sizeof(apConfig.ap.ssid), WIFI_SETUP_AP_SSID);
  apConfig.ap.ssid_len = std::strlen(WIFI_SETUP_AP_SSID);
  apConfig.ap.channel = WIFI_SETUP_AP_CHANNEL;
  apConfig.ap.max_connection = WIFI_SETUP_AP_MAX_CONNECTIONS;
  apConfig.ap.ssid_hidden = 0;
  apConfig.ap.authmode = WIFI_AUTH_OPEN;

  if (std::strlen(WIFI_SETUP_AP_PASSWORD) > 0) {
    copyWifiString(apConfig.ap.password, sizeof(apConfig.ap.password), WIFI_SETUP_AP_PASSWORD);
    apConfig.ap.authmode = WIFI_AUTH_WPA2_PSK;
  }

  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &apConfig));
}

esp_err_t setWifiMode(wifi_mode_t mode) {
  const esp_err_t status = esp_wifi_set_mode(mode);
  if (status != ESP_OK) {
    feedbackError(TAG, "esp_wifi_set_mode(%d) failed: %d", static_cast<int>(mode), status);
  }
  return status;
}

void jsonEscapeAppend(char *target, size_t targetSize, size_t &written, const char *value) {
  const char *safeValue = value == nullptr ? "" : value;
  for (const char *cursor = safeValue; *cursor != '\0' && written + 2 < targetSize; cursor++) {
    if (*cursor == '"' || *cursor == '\\') {
      target[written++] = '\\';
    }
    target[written++] = *cursor;
  }
  target[written] = '\0';
}

bool appendFormatted(char *target, size_t targetSize, size_t &written, const char *format, ...) {
  if (written >= targetSize) {
    return false;
  }

  va_list args;
  va_start(args, format);
  const int result = std::vsnprintf(target + written, targetSize - written, format, args);
  va_end(args);

  if (result < 0) {
    return false;
  }

  const size_t appended = static_cast<size_t>(result);
  if (appended >= targetSize - written) {
    written = targetSize - 1;
    target[written] = '\0';
    return false;
  }

  written += appended;
  return true;
}

void wifiConnectTask(void *) {
  vTaskDelay(pdMS_TO_TICKS(3000));
  const esp_err_t status = connectWifiStationFromSavedCredentials(WIFI_CONNECT_TIMEOUT_MS);
  if (status == ESP_OK) {
    feedbackInfo(TAG, "WiFi station connect task completed");
  } else {
    feedbackWarning(TAG, "WiFi station connect task failed: %d; setup AP remains active", status);
    if (!setupPortalActive) {
      ::startWifiSetupPortal();
    }
  }

  wifiConnectTaskHandle = nullptr;
  vTaskDelete(nullptr);
}
}

const char *wifiRuntimeModeName() {
  if (setupPortalActive) {
    return "setup_ap";
  }

  EventBits_t bits = xEventGroupGetBits(wifiEvents);
  return (bits & WIFI_CONNECTED_BIT) != 0 ? "station" : "station_connecting";
}

const char *wifiStationStateName() {
  switch (stationState) {
    case StationState::Connecting:
      return "connecting";
    case StationState::Connected:
      return "connected";
    case StationState::Failed:
      return "failed";
    case StationState::Idle:
    default:
      return "idle";
  }
}

int wifiLastDisconnectReason() {
  return lastDisconnectReason;
}

int wifiLastConnectStatus() {
  return lastConnectStatus;
}

bool wifiSetupPortalIsActive() {
  return setupPortalActive;
}

esp_err_t saveWifiStationCredentials(const char *ssid, const char *password) {
  if (ssid == nullptr || ssid[0] == '\0' || std::strlen(ssid) > 32) {
    return ESP_ERR_INVALID_ARG;
  }

  nvs_handle_t handle = 0;
  esp_err_t status = nvs_open(WIFI_NVS_NAMESPACE, NVS_READWRITE, &handle);
  if (status != ESP_OK) {
    return status;
  }

  status = nvs_set_str(handle, WIFI_NVS_SSID_KEY, ssid);
  if (status == ESP_OK) {
    status = nvs_set_str(handle, WIFI_NVS_PASSWORD_KEY, password == nullptr ? "" : password);
  }
  if (status == ESP_OK) {
    status = nvs_commit(handle);
  }
  nvs_close(handle);

  if (status == ESP_OK) {
    feedbackInfo(TAG, "WiFi credentials saved for ssid=%s", ssid);
  }
  return status;
}

esp_err_t connectWifiStationFromSavedCredentials(uint32_t timeoutMs) {
  WifiCredentials credentials = {};
  if (!loadWifiCredentials(credentials)) {
    feedbackWarning(TAG, "No saved WiFi credentials found");
    stationState = StationState::Failed;
    lastConnectStatus = ESP_ERR_NOT_FOUND;
    return ESP_ERR_NOT_FOUND;
  }

  wifi_config_t staConfig = {};
  copyWifiString(staConfig.sta.ssid, sizeof(staConfig.sta.ssid), credentials.ssid);
  copyWifiString(staConfig.sta.password, sizeof(staConfig.sta.password), credentials.password);
  staConfig.sta.threshold.authmode = WIFI_AUTH_OPEN;

  xEventGroupClearBits(wifiEvents, WIFI_CONNECTED_BIT);
  stationState = StationState::Connecting;
  wifiConnectRetryCount = 0;
  lastDisconnectReason = 0;
  lastConnectStatus = ESP_OK;
  const wifi_mode_t connectMode = setupPortalActive ? WIFI_MODE_APSTA : WIFI_MODE_STA;
  esp_err_t status = setWifiMode(connectMode);
  if (status != ESP_OK) {
    stationState = StationState::Failed;
    lastConnectStatus = status;
    return status;
  }

  status = esp_wifi_set_config(WIFI_IF_STA, &staConfig);
  if (status != ESP_OK) {
    feedbackError(TAG, "esp_wifi_set_config(STA) failed: %d", status);
    stationState = StationState::Failed;
    lastConnectStatus = status;
    return status;
  }

  if (!wifiStarted) {
    status = esp_wifi_start();
    if (status != ESP_OK) {
      feedbackError(TAG, "esp_wifi_start failed: %d", status);
      stationState = StationState::Failed;
      lastConnectStatus = status;
      return status;
    }
    wifiStarted = true;
  }

  feedbackInfo(TAG, "Connecting WiFi station to ssid=%s", credentials.ssid);
  status = esp_wifi_connect();
  if (status != ESP_OK) {
    feedbackError(TAG, "esp_wifi_connect failed: %d", status);
    stationState = StationState::Failed;
    lastConnectStatus = status;
    return status;
  }

  const EventBits_t bits = xEventGroupWaitBits(
      wifiEvents,
      WIFI_CONNECTED_BIT,
      pdFALSE,
      pdTRUE,
      pdMS_TO_TICKS(timeoutMs));

  if ((bits & WIFI_CONNECTED_BIT) == 0) {
    feedbackWarning(TAG, "WiFi station did not connect within %u ms", timeoutMs);
    stationState = StationState::Connecting;
    lastConnectStatus = ESP_ERR_TIMEOUT;
    scheduleWifiReconnect();
    return ESP_ERR_TIMEOUT;
  }

  startDeviceWebServer();

  if (setupPortalActive) {
    feedbackInfo(TAG, "WiFi station connected; shutting down setup AP after status grace period");
    vTaskDelay(pdMS_TO_TICKS(3000));
    status = setWifiMode(WIFI_MODE_STA);
    if (status != ESP_OK) {
      stationState = StationState::Failed;
      lastConnectStatus = status;
      return status;
    }
    setupPortalActive = false;
  }
  return ESP_OK;
}

esp_err_t requestWifiStationConnectFromSavedCredentials() {
  if (wifiConnectTaskHandle != nullptr) {
    feedbackWarning(TAG, "WiFi station connect request ignored: already running");
    return ESP_ERR_INVALID_STATE;
  }

  const BaseType_t created = xTaskCreate(
      wifiConnectTask,
      "wifi-connect",
      4096,
      nullptr,
      5,
      &wifiConnectTaskHandle);
  if (created != pdPASS) {
    wifiConnectTaskHandle = nullptr;
    feedbackError(TAG, "WiFi station connect task could not be started");
    return ESP_ERR_NO_MEM;
  }

  feedbackInfo(TAG, "WiFi station connect task scheduled");
  return ESP_OK;
}

esp_err_t scanWifiNetworksJson(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) {
    return ESP_ERR_INVALID_ARG;
  }

  uint16_t networkCount = WIFI_SCAN_LIMIT;
  wifi_ap_record_t *networks = static_cast<wifi_ap_record_t *>(
      std::calloc(WIFI_SCAN_LIMIT, sizeof(wifi_ap_record_t)));
  if (networks == nullptr) {
    std::snprintf(target, targetSize, "{\"error\":\"scan_buffer_allocation_failed\"}\n");
    return ESP_ERR_NO_MEM;
  }

  wifi_scan_config_t scanConfig = {};

  esp_err_t status = esp_wifi_scan_start(&scanConfig, true);
  if (status != ESP_OK) {
    std::snprintf(target, targetSize, "{\"error\":\"scan_failed\",\"code\":%d}\n", status);
    std::free(networks);
    return status;
  }

  status = esp_wifi_scan_get_ap_records(&networkCount, networks);
  if (status != ESP_OK) {
    std::snprintf(target, targetSize, "{\"error\":\"scan_read_failed\",\"code\":%d}\n", status);
    std::free(networks);
    return status;
  }

  bool truncated = false;
  size_t written = 0;
  appendFormatted(target, targetSize, written, "{\"networks\":[");
  for (uint16_t i = 0; i < networkCount; i++) {
    if (!appendFormatted(target, targetSize, written, "%s{\"ssid\":\"", i == 0 ? "" : ",")) {
      truncated = true;
      break;
    }
    jsonEscapeAppend(target, targetSize, written, reinterpret_cast<const char *>(networks[i].ssid));
    if (!appendFormatted(
            target,
            targetSize,
            written,
            "\",\"rssi\":%d,\"secure\":%s}",
            networks[i].rssi,
            networks[i].authmode == WIFI_AUTH_OPEN ? "false" : "true")) {
      truncated = true;
      break;
    }
  }
  if (!appendFormatted(target, targetSize, written, "],\"truncated\":%s}\n", truncated ? "true" : "false")) {
    std::snprintf(target, targetSize, "{\"error\":\"scan_response_truncated\",\"truncated\":true}\n");
  }
  std::free(networks);
  return ESP_OK;
}

void startWifiSetupPortal() {
  setupPortalActive = true;
  ESP_ERROR_CHECK(setWifiMode(WIFI_MODE_APSTA));
  configureSetupAp();
  if (!wifiStarted) {
    ESP_ERROR_CHECK(esp_wifi_start());
    wifiStarted = true;
  }

  startCaptiveDnsServer();
  startDeviceWebServer();
  feedbackInfo(TAG, "WiFi setup AP started: ssid=%s channel=%u captive=%s", WIFI_SETUP_AP_SSID, WIFI_SETUP_AP_CHANNEL, CAPTIVE_PORTAL_AP_IP);
}

void initWifi() {
  static_assert(sizeof(WIFI_SETUP_AP_SSID) <= sizeof(wifi_ap_config_t::ssid),
                "WiFi setup AP SSID is too long");

  initNvs();

  wifiEvents = xEventGroupCreate();
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());
  esp_netif_create_default_wifi_ap();
  stationNetif = esp_netif_create_default_wifi_sta();
  char stationHostname[32] = {};
  writeProvisioningHostname(stationHostname, sizeof(stationHostname));
  ESP_ERROR_CHECK(esp_netif_set_hostname(stationNetif, stationHostname));
  feedbackInfo(TAG, "WiFi station hostname: %s", stationHostname);

  wifi_init_config_t initConfig = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&initConfig));
  ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));
  feedbackInfo(TAG, "WiFi power save disabled for responsive comfort runtime");
  ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, WIFI_EVENT_STA_DISCONNECTED, wifiEventHandler, nullptr, nullptr));
  ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifiEventHandler, nullptr, nullptr));

  const esp_err_t connectStatus = connectWifiStationFromSavedCredentials(WIFI_CONNECT_TIMEOUT_MS);
  if (connectStatus == ESP_ERR_NOT_FOUND) {
    startWifiSetupPortal();
  } else if (connectStatus != ESP_OK) {
    feedbackWarning(TAG, "Saved WiFi exists; remaining in station mode and reconnecting: %d", connectStatus);
    scheduleWifiReconnect();
  }
}
