#include "basissoftware/serial_provisioning.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

#include "soc/soc_caps.h"
#include "driver/uart.h"
#if SOC_USB_SERIAL_JTAG_SUPPORTED
#include "driver/usb_serial_jtag.h"
#endif
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

int serialProvisioningRead(uint8_t *buffer, size_t length, TickType_t timeout) {
#if SOC_USB_SERIAL_JTAG_SUPPORTED
  // USB-Serial/JTAG's blocking receive can hold CPU 0 in this ESP-IDF
  // version.  Poll without a driver wait and always yield in the task below;
  // this keeps the idle task and WiFi scheduler responsive.
  (void)timeout;
  return usb_serial_jtag_read_bytes(buffer, length, 0);
#else
  return uart_read_bytes(UART_NUM_0, buffer, length, timeout);
#endif
}

void serialProvisioningWrite(const char *buffer, size_t length) {
#if SOC_USB_SERIAL_JTAG_SUPPORTED
  usb_serial_jtag_write_bytes(buffer, length, pdMS_TO_TICKS(1000));
  usb_serial_jtag_wait_tx_done(pdMS_TO_TICKS(1000));
#else
  uart_write_bytes(UART_NUM_0, buffer, length);
#endif
}

esp_err_t installSerialProvisioningDriver() {
#if SOC_USB_SERIAL_JTAG_SUPPORTED
  if (usb_serial_jtag_is_driver_installed()) return ESP_OK;
  usb_serial_jtag_driver_config_t config = USB_SERIAL_JTAG_DRIVER_CONFIG_DEFAULT();
  config.rx_buffer_size = 1024;
  config.tx_buffer_size = 512;
  return usb_serial_jtag_driver_install(&config);
#else
  uart_config_t config = {};
  config.baud_rate = SERIAL_BAUD_RATE;
  config.data_bits = UART_DATA_8_BITS;
  config.parity = UART_PARITY_DISABLE;
  config.stop_bits = UART_STOP_BITS_1;
  config.flow_ctrl = UART_HW_FLOWCTRL_DISABLE;
  uart_param_config(UART_NUM_0, &config);
  return uart_driver_install(UART_NUM_0, 1024, 0, 0, nullptr, 0);
#endif
}

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
  char responsePrefix[192] = {};
  std::snprintf(
      responsePrefix,
      sizeof(responsePrefix),
      "{\"type\":\"%s\",\"request_id\":\"%s\",\"event\":\"%s\",\"payload\":",
      PROTOCOL_TYPE,
      requestId == nullptr ? "" : requestId,
      event);
  serialProvisioningWrite(responsePrefix, std::strlen(responsePrefix));
  const char *responsePayload = payload == nullptr ? "{}" : payload;
  // scanWifiNetworksJson() terminates its JSON document with a newline.
  // The envelope is streamed in three writes, so forwarding that newline
  // splits one protocol response into an inner payload line and a lone `}`.
  // Trim only line endings; the outer envelope owns the single final newline.
  size_t responsePayloadLength = std::strlen(responsePayload);
  while (responsePayloadLength > 0
      && (responsePayload[responsePayloadLength - 1] == '\n'
          || responsePayload[responsePayloadLength - 1] == '\r')) {
    --responsePayloadLength;
  }
  serialProvisioningWrite(responsePayload, responsePayloadLength);
  serialProvisioningWrite("}\n", 2);
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
    // A WLAN scan response can be several KiB.  Keeping it on the task stack
    // together with the response envelope exhausted the 6 KiB task stack on
    // the ESP32-S3.  The provisioning task then crashed before it could reply.
    char *scan = static_cast<char *>(std::calloc(WIFI_SCAN_RESPONSE_BYTES, 1));
    if (scan == nullptr) {
      sendError(requestId, "wifi_scan_out_of_memory");
      return;
    }
    const esp_err_t status = scanWifiNetworksJson(scan, WIFI_SCAN_RESPONSE_BYTES);
    if (status != ESP_OK) {
      std::free(scan);
      sendError(requestId, "wifi_scan_failed");
      return;
    }
    sendJson(requestId, "wifi_networks", scan);
    std::free(scan);
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
    // Once WiFi is connected the setup AP is closed.  Stop the USB receiver
    // before it can contend with the running WiFi stack on ESP32-S3.
    if (!wifiSetupPortalIsActive()) {
      feedbackInfo(TAG, "USB WiFi provisioning finished after station connection");
      vTaskDelete(nullptr);
      return;
    }
    uint8_t value = 0;
    const int read = serialProvisioningRead(&value, 1, pdMS_TO_TICKS(100));
    if (read <= 0) {
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }
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
  const esp_err_t driverStatus = installSerialProvisioningDriver();
  if (driverStatus != ESP_OK && driverStatus != ESP_ERR_INVALID_STATE) {
    feedbackWarning(TAG, "Serial provisioning is unavailable: uart driver status=%d", driverStatus);
    return;
  }
  const BaseType_t created = xTaskCreate(serialProvisioningTask, "serial-provisioning", 6144, nullptr, 3, nullptr);
  if (created != pdPASS) {
    feedbackWarning(TAG, "Serial provisioning task could not be started");
    return;
  }
  feedbackInfo(TAG, "Local USB WiFi provisioning is ready");
}
