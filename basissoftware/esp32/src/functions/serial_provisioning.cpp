#include "basissoftware/serial_provisioning.h"

#include <cstdio>
#include <cstring>

#include "driver/uart.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"
#include "basissoftware/wifi_manager.h"

namespace {
constexpr const char *TAG = "serialProvisioning";
constexpr const char *PROTOCOL_TYPE = "gernetix.serial_provisioning";
constexpr size_t COMMAND_MAX_BYTES = 384;
constexpr size_t WIFI_SCAN_RESPONSE_BYTES = 4096;

bool readJsonString(const char *json, const char *key, char *target, size_t targetSize) {
  if (json == nullptr || key == nullptr || target == nullptr || targetSize < 2) return false;
  const char *position = std::strstr(json, key);
  if (position == nullptr) return false;
  position = std::strchr(position + std::strlen(key), ':');
  if (position == nullptr) return false;
  position = std::strchr(position, '"');
  if (position == nullptr) return false;
  ++position;
  size_t written = 0;
  while (*position != '\0' && *position != '"') {
    char value = *position++;
    if (value == '\\' && *position != '\0') {
      const char escaped = *position++;
      value = escaped == 'n' ? '\n' : escaped == 'r' ? '\r' : escaped == 't' ? '\t' : escaped;
    }
    if (written + 1 >= targetSize) return false;
    target[written++] = value;
  }
  if (*position != '"') return false;
  target[written] = '\0';
  return true;
}

void sendJson(const char *requestId, const char *event, const char *payload) {
  char response[WIFI_SCAN_RESPONSE_BYTES + 192] = {};
  std::snprintf(
      response,
      sizeof(response),
      "{\"type\":\"%s\",\"request_id\":\"%s\",\"event\":\"%s\",\"payload\":%s}\n",
      PROTOCOL_TYPE,
      requestId == nullptr ? "" : requestId,
      event,
      payload == nullptr ? "{}" : payload);
  uart_write_bytes(UART_NUM_0, response, std::strlen(response));
}

void sendError(const char *requestId, const char *code) {
  char payload[128] = {};
  std::snprintf(payload, sizeof(payload), "{\"code\":\"%s\"}", code);
  sendJson(requestId, "error", payload);
}

void handleCommand(const char *command) {
  char type[48] = {};
  char action[32] = {};
  char requestId[64] = {};
  if (!readJsonString(command, "\"type\"", type, sizeof(type))
      || std::strcmp(type, PROTOCOL_TYPE) != 0
      || !readJsonString(command, "\"action\"", action, sizeof(action))
      || !readJsonString(command, "\"request_id\"", requestId, sizeof(requestId))) {
    return;
  }

  if (std::strcmp(action, "wifi_scan") == 0) {
    char scan[WIFI_SCAN_RESPONSE_BYTES] = {};
    const esp_err_t status = scanWifiNetworksJson(scan, sizeof(scan));
    if (status != ESP_OK) {
      sendError(requestId, "wifi_scan_failed");
      return;
    }
    sendJson(requestId, "wifi_networks", scan);
    return;
  }

  if (std::strcmp(action, "wifi_connect") == 0) {
    char ssid[33] = {};
    char password[65] = {};
    if (!readJsonString(command, "\"ssid\"", ssid, sizeof(ssid))
        || !readJsonString(command, "\"password\"", password, sizeof(password))) {
      sendError(requestId, "invalid_wifi_credentials");
      return;
    }
    if (saveWifiStationCredentials(ssid, password) != ESP_OK || requestWifiStationConnectFromSavedCredentials() != ESP_OK) {
      sendError(requestId, "wifi_connect_failed");
      return;
    }
    sendJson(requestId, "wifi_connecting", "{\"stored_only_on_device\":true}");
    return;
  }

  if (std::strcmp(action, "wifi_status") == 0) {
    char payload[160] = {};
    std::snprintf(
        payload,
        sizeof(payload),
        "{\"state\":\"%s\",\"last_disconnect_reason\":%d,\"last_connect_status\":%d}",
        wifiStationStateName(),
        wifiLastDisconnectReason(),
        wifiLastConnectStatus());
    sendJson(requestId, "wifi_status", payload);
    return;
  }

  sendError(requestId, "unsupported_action");
}

void serialProvisioningTask(void *) {
  char command[COMMAND_MAX_BYTES] = {};
  size_t length = 0;
  while (true) {
    uint8_t value = 0;
    const int read = uart_read_bytes(UART_NUM_0, &value, 1, pdMS_TO_TICKS(100));
    if (read <= 0) continue;
    if (value == '\n') {
      command[length] = '\0';
      if (length > 0) handleCommand(command);
      length = 0;
      continue;
    }
    if (value == '\r') continue;
    if (length + 1 >= sizeof(command)) {
      length = 0;
      continue;
    }
    command[length++] = static_cast<char>(value);
  }
}
}

void startSerialProvisioning() {
  uart_config_t config = {};
  config.baud_rate = SERIAL_BAUD_RATE;
  config.data_bits = UART_DATA_8_BITS;
  config.parity = UART_PARITY_DISABLE;
  config.stop_bits = UART_STOP_BITS_1;
  config.flow_ctrl = UART_HW_FLOWCTRL_DISABLE;
  uart_param_config(UART_NUM_0, &config);
  const esp_err_t driverStatus = uart_driver_install(UART_NUM_0, 1024, 0, 0, nullptr, 0);
  if (driverStatus != ESP_OK && driverStatus != ESP_ERR_INVALID_STATE) {
    feedbackWarning(TAG, "Serial provisioning is unavailable: uart driver status=%d", driverStatus);
    return;
  }
  const BaseType_t created = xTaskCreate(serialProvisioningTask, "serial-provisioning", 6144, nullptr, 5, nullptr);
  if (created != pdPASS) {
    feedbackWarning(TAG, "Serial provisioning task could not be started");
    return;
  }
  feedbackInfo(TAG, "Local USB WiFi provisioning is ready");
}
