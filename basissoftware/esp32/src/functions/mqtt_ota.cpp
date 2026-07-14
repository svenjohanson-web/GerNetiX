#include "basissoftware/mqtt_ota.h"

#include <cstdio>
#include <cstring>

#include "esp_crt_bundle.h"
#include "freertos/FreeRTOS.h"
#include "mqtt_client.h"

#include "basissoftware/feedback.h"
#include "basissoftware/ota_update.h"
#include "basissoftware/provisioning_config.h"

namespace {
constexpr const char *TAG = "mqttOta";
constexpr size_t MAX_OTA_MESSAGE = 2048;
// TLS, ECDSA validation and the OTA callback share the MQTT task stack.
// ESP-MQTT's 6 KiB default is too small for this authenticated deploy path and
// caused a reboot loop as soon as a retained OTA command was delivered.
constexpr int MQTT_TASK_STACK_SIZE = 12 * 1024;

esp_mqtt_client_handle_t client = nullptr;
char subscriptionTopic[160] = {};
char messageBuffer[MAX_OTA_MESSAGE + 1] = {};
int messageLength = 0;
char mqttState[24] = "not_configured";
portMUX_TYPE stateMux = portMUX_INITIALIZER_UNLOCKED;

bool isPrivateIpv4MqttUrl(const char *url) {
  constexpr char PREFIX[] = "mqtt://";
  if (url == nullptr || std::strncmp(url, PREFIX, sizeof(PREFIX) - 1) != 0) return false;
  const char *host = url + sizeof(PREFIX) - 1;
  const char *hostEnd = std::strchr(host, ':');
  if (hostEnd == nullptr) hostEnd = host + std::strlen(host);
  if (hostEnd == host || std::strchr(hostEnd, '/') != nullptr) return false;
  if (*hostEnd == ':') {
    unsigned port = 0;
    int consumed = 0;
    if (std::sscanf(hostEnd + 1, "%u%n", &port, &consumed) != 1 || port == 0 || port > 65535 || hostEnd[1 + consumed] != '\0') return false;
  }
  unsigned a = 0, b = 0, c = 0, d = 0;
  int consumed = 0;
  if (std::sscanf(host, "%u.%u.%u.%u%n", &a, &b, &c, &d, &consumed) != 4 ||
      host + consumed != hostEnd || a > 255 || b > 255 || c > 255 || d > 255) return false;
  return a == 10 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168);
}

void setState(const char *state) {
  portENTER_CRITICAL(&stateMux);
  std::snprintf(mqttState, sizeof(mqttState), "%s", state == nullptr ? "unknown" : state);
  portEXIT_CRITICAL(&stateMux);
}

bool topicMatches(const esp_mqtt_event_handle_t event) {
  const size_t expectedLength = std::strlen(subscriptionTopic);
  return event->topic != nullptr && event->topic_len == static_cast<int>(expectedLength) &&
      std::memcmp(event->topic, subscriptionTopic, expectedLength) == 0;
}

void receiveOtaMessage(const esp_mqtt_event_handle_t event) {
  if ((event->current_data_offset == 0 && !topicMatches(event)) ||
      event->total_data_len <= 0 || event->total_data_len > static_cast<int>(MAX_OTA_MESSAGE) ||
      event->current_data_offset < 0 || event->data_len < 0 ||
      event->current_data_offset + event->data_len > event->total_data_len) {
    feedbackWarning(TAG, "Rejected MQTT OTA message: topic or payload framing invalid");
    messageLength = 0;
    return;
  }
  if (event->current_data_offset == 0) {
    messageLength = event->total_data_len;
    std::memset(messageBuffer, 0, sizeof(messageBuffer));
  }
  if (messageLength != event->total_data_len) {
    messageLength = 0;
    return;
  }
  std::memcpy(messageBuffer + event->current_data_offset, event->data, event->data_len);
  if (event->current_data_offset + event->data_len != event->total_data_len) return;

  messageBuffer[messageLength] = '\0';
  const esp_err_t status = scheduleOtaUpdate(messageBuffer, static_cast<size_t>(messageLength));
  if (status == ESP_OK) {
    feedbackInfo(TAG, "Authenticated OTA deploy received via MQTT");
  } else {
    feedbackWarning(TAG, "MQTT OTA deploy rejected: %d", status);
  }
  messageLength = 0;
}

void mqttEventHandler(void *, esp_event_base_t, int32_t eventId, void *eventData) {
  const esp_mqtt_event_handle_t event = static_cast<esp_mqtt_event_handle_t>(eventData);
  switch (static_cast<esp_mqtt_event_id_t>(eventId)) {
    case MQTT_EVENT_CONNECTED: {
      const int messageId = esp_mqtt_client_subscribe(client, subscriptionTopic, 1);
      setState(messageId >= 0 ? "subscribing" : "subscribe_failed");
      feedbackInfo(TAG, "MQTT connected; subscribing to %s with QoS 1", subscriptionTopic);
      break;
    }
    case MQTT_EVENT_SUBSCRIBED:
      setState("subscribed");
      feedbackInfo(TAG, "MQTT OTA subscription active");
      break;
    case MQTT_EVENT_DATA:
      receiveOtaMessage(event);
      break;
    case MQTT_EVENT_DISCONNECTED:
      setState("disconnected");
      break;
    case MQTT_EVENT_ERROR:
      setState("error");
      feedbackWarning(TAG, "MQTT transport error");
      break;
    default:
      break;
  }
}
}

esp_err_t startMqttOtaSubscriber() {
  if (client != nullptr) return ESP_OK;
  const ProvisioningConfig config = loadProvisioningConfig();
  if (!config.provisioned || config.deviceId[0] == '\0' || config.mqttBrokerUrl[0] == '\0') {
    setState("not_configured");
    return ESP_ERR_NOT_FOUND;
  }
  const bool secureBroker = std::strncmp(config.mqttBrokerUrl, "mqtts://", 8) == 0;
  if ((!secureBroker && !isPrivateIpv4MqttUrl(config.mqttBrokerUrl)) ||
      (secureBroker && (!config.hasDevicePrivateKey || !config.hasMqttClientCertificate))) {
    setState("invalid_config");
    return ESP_ERR_INVALID_ARG;
  }
  const int topicLength = std::snprintf(
      subscriptionTopic, sizeof(subscriptionTopic), "gernetix/devices/%s/ota", config.deviceId);
  if (topicLength <= 0 || static_cast<size_t>(topicLength) >= sizeof(subscriptionTopic)) {
    setState("invalid_config");
    return ESP_ERR_INVALID_ARG;
  }

  esp_mqtt_client_config_t mqttConfig = {};
  mqttConfig.broker.address.uri = config.mqttBrokerUrl;
  if (secureBroker) {
    mqttConfig.broker.verification.crt_bundle_attach = esp_crt_bundle_attach;
    mqttConfig.credentials.username = config.deviceId;
    mqttConfig.credentials.authentication.certificate = config.mqttClientCertificatePem;
    mqttConfig.credentials.authentication.key = config.devicePrivateKeyPem;
  }
  mqttConfig.credentials.client_id = config.deviceId;
  mqttConfig.session.keepalive = 60;
  mqttConfig.network.reconnect_timeout_ms = 5000;
  mqttConfig.task.stack_size = MQTT_TASK_STACK_SIZE;

  client = esp_mqtt_client_init(&mqttConfig);
  if (client == nullptr) {
    setState("init_failed");
    return ESP_ERR_NO_MEM;
  }
  esp_err_t status = esp_mqtt_client_register_event(client, MQTT_EVENT_ANY, mqttEventHandler, nullptr);
  if (status == ESP_OK) status = esp_mqtt_client_start(client);
  if (status != ESP_OK) {
    esp_mqtt_client_destroy(client);
    client = nullptr;
    setState("start_failed");
    return status;
  }
  setState("connecting");
  feedbackInfo(TAG, "MQTT OTA client started for %s", config.deviceId);
  return ESP_OK;
}

size_t writeMqttOtaStatusJson(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) return 0;
  char state[sizeof(mqttState)] = {};
  portENTER_CRITICAL(&stateMux);
  std::snprintf(state, sizeof(state), "%s", mqttState);
  portEXIT_CRITICAL(&stateMux);
  const int written = std::snprintf(
      target, targetSize, "\"mqtt\":{\"state\":\"%s\",\"topic\":\"%s\"}", state, subscriptionTopic);
  if (written < 0) return 0;
  return static_cast<size_t>(written) < targetSize ? static_cast<size_t>(written) : targetSize - 1;
}

void publishMqttOtaStatus(const char *state, const char *deployId, const char *error) {
  if (client == nullptr || subscriptionTopic[0] == '\0') return;
  char topic[192] = {};
  const ProvisioningConfig config = loadProvisioningConfig();
  if (config.deviceId[0] == '\0') return;
  const int topicLength = std::snprintf(topic, sizeof(topic), "gernetix/devices/%s/status/deployment", config.deviceId);
  if (topicLength <= 0 || static_cast<size_t>(topicLength) >= sizeof(topic)) return;
  char payload[384] = {};
  const int payloadLength = std::snprintf(
      payload, sizeof(payload),
      "{\"device_id\":\"%s\",\"deploy_id\":\"%s\",\"status\":\"%s\",\"error\":\"%s\"}",
      config.deviceId, deployId == nullptr ? "" : deployId, state == nullptr ? "unknown" : state,
      error == nullptr ? "" : error);
  if (payloadLength <= 0 || static_cast<size_t>(payloadLength) >= sizeof(payload)) return;
  esp_mqtt_client_publish(client, topic, payload, payloadLength, 1, 0);
}
