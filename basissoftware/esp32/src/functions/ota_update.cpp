#include "basissoftware/ota_update.h"

#include <cctype>
#include <cstdio>
#include <cstring>
#include <string>

#include "esp_crt_bundle.h"
#include "esp_https_ota.h"
#include "esp_ota_ops.h"
#include "esp_partition.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs.h"
#include "psa/crypto.h"

#include "basissoftware/feedback.h"
#include "basissoftware/mqtt_ota.h"
#include "basissoftware/provisioning_config.h"

namespace {
constexpr const char *TAG = "otaUpdate";
constexpr const char *NVS_NAMESPACE = "ota_state";
constexpr const char *NVS_SEQUENCE_KEY = "sequence";
constexpr size_t MAX_DEPLOY_ID = 96;
constexpr size_t MAX_FIRMWARE_URL = 320;

struct OtaCommand {
  char deployId[MAX_DEPLOY_ID];
  char firmwareUrl[MAX_FIRMWARE_URL];
  char expectedSha256[65];
  uint64_t sequence;
};

portMUX_TYPE statusMux = portMUX_INITIALIZER_UNLOCKED;
bool otaBusy = false;
char otaState[24] = "idle";
char otaDeployId[MAX_DEPLOY_ID] = {};
char otaError[64] = {};

std::string findStringValue(const std::string &payload, const char *key) {
  const std::string quotedKey = std::string("\"") + key + "\"";
  const size_t keyIndex = payload.find(quotedKey);
  const size_t colonIndex = keyIndex == std::string::npos ? std::string::npos : payload.find(':', keyIndex + quotedKey.size());
  const size_t valueStart = colonIndex == std::string::npos ? std::string::npos : payload.find('"', colonIndex + 1);
  if (valueStart == std::string::npos) return "";
  const size_t valueEnd = payload.find('"', valueStart + 1);
  if (valueEnd == std::string::npos) return "";
  return payload.substr(valueStart + 1, valueEnd - valueStart - 1);
}

bool findUint64Value(const std::string &payload, const char *key, uint64_t &value) {
  const std::string quotedKey = std::string("\"") + key + "\"";
  const size_t keyIndex = payload.find(quotedKey);
  const size_t colonIndex = keyIndex == std::string::npos ? std::string::npos : payload.find(':', keyIndex + quotedKey.size());
  if (colonIndex == std::string::npos) return false;
  size_t cursor = colonIndex + 1;
  while (cursor < payload.size() && std::isspace(static_cast<unsigned char>(payload[cursor]))) cursor++;
  if (cursor == payload.size() || !std::isdigit(static_cast<unsigned char>(payload[cursor]))) return false;
  uint64_t result = 0;
  while (cursor < payload.size() && std::isdigit(static_cast<unsigned char>(payload[cursor]))) {
    const unsigned digit = static_cast<unsigned>(payload[cursor] - '0');
    if (result > (UINT64_MAX - digit) / 10) return false;
    result = result * 10 + digit;
    cursor++;
  }
  value = result;
  return result > 0;
}

bool isHexSha256(const std::string &value) {
  if (value.size() != 64) return false;
  for (char current : value) {
    if (!std::isxdigit(static_cast<unsigned char>(current))) return false;
  }
  return true;
}

bool isDeployId(const std::string &value) {
  if (value.empty() || value.size() >= MAX_DEPLOY_ID) return false;
  for (char current : value) {
    if (!std::isalnum(static_cast<unsigned char>(current)) && current != '-' && current != '_' && current != '.') return false;
  }
  return true;
}

std::string lowerHex(const std::string &value) {
  std::string result = value;
  for (char &current : result) current = static_cast<char>(std::tolower(static_cast<unsigned char>(current)));
  return result;
}

std::string httpsOrigin(const char *configuredUrl) {
  if (configuredUrl == nullptr || std::strncmp(configuredUrl, "https://", 8) != 0) return "";
  const char *path = std::strchr(configuredUrl + 8, '/');
  return path == nullptr ? std::string(configuredUrl) : std::string(configuredUrl, path - configuredUrl);
}

bool isAllowedFirmwareUrl(const std::string &firmwareUrl, const ProvisioningConfig &config) {
  if (firmwareUrl.size() >= MAX_FIRMWARE_URL || firmwareUrl.find('#') != std::string::npos) return false;
  const std::string origin = httpsOrigin(config.buildDeployUrl);
  if (origin.empty() || firmwareUrl.compare(0, origin.size(), origin) != 0) return false;
  return firmwareUrl.size() > origin.size() && firmwareUrl[origin.size()] == '/';
}

bool constantTimeEqual(const char *left, const std::string &right) {
  if (left == nullptr || std::strlen(left) != right.size()) return false;
  unsigned char difference = 0;
  for (size_t index = 0; index < right.size(); index++) {
    difference |= static_cast<unsigned char>(left[index] ^ right[index]);
  }
  return difference == 0;
}

uint64_t readAcceptedSequence() {
  nvs_handle_t handle = 0;
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) return 0;
  uint64_t sequence = 0;
  nvs_get_u64(handle, NVS_SEQUENCE_KEY, &sequence);
  nvs_close(handle);
  return sequence;
}

esp_err_t saveAcceptedSequence(uint64_t sequence) {
  nvs_handle_t handle = 0;
  esp_err_t status = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle);
  if (status == ESP_OK) status = nvs_set_u64(handle, NVS_SEQUENCE_KEY, sequence);
  if (status == ESP_OK) status = nvs_commit(handle);
  if (handle != 0) nvs_close(handle);
  return status;
}

void setStatus(const char *state, const char *deployId, const char *error, bool busy) {
  portENTER_CRITICAL(&statusMux);
  std::snprintf(otaState, sizeof(otaState), "%s", state == nullptr ? "unknown" : state);
  std::snprintf(otaDeployId, sizeof(otaDeployId), "%s", deployId == nullptr ? "" : deployId);
  std::snprintf(otaError, sizeof(otaError), "%s", error == nullptr ? "" : error);
  otaBusy = busy;
  portEXIT_CRITICAL(&statusMux);
  publishMqttOtaStatus(state, deployId, error);
}

void bytesToHex(const unsigned char *bytes, size_t count, char *target, size_t targetSize) {
  static constexpr char HEX[] = "0123456789abcdef";
  if (targetSize < count * 2 + 1) return;
  for (size_t index = 0; index < count; index++) {
    target[index * 2] = HEX[(bytes[index] >> 4) & 0x0f];
    target[index * 2 + 1] = HEX[bytes[index] & 0x0f];
  }
  target[count * 2] = '\0';
}

esp_err_t calculateDownloadedImageSha256(
    const esp_partition_t *partition, size_t imageLength, unsigned char digest[32]) {
  if (partition == nullptr || imageLength == 0 || imageLength > partition->size || digest == nullptr) {
    return ESP_ERR_INVALID_ARG;
  }
  if (psa_crypto_init() != PSA_SUCCESS) return ESP_FAIL;
  psa_hash_operation_t operation = PSA_HASH_OPERATION_INIT;
  if (psa_hash_setup(&operation, PSA_ALG_SHA_256) != PSA_SUCCESS) {
    psa_hash_abort(&operation);
    return ESP_FAIL;
  }
  unsigned char buffer[4096] = {};
  size_t offset = 0;
  while (offset < imageLength) {
    const size_t chunkLength = imageLength - offset < sizeof(buffer) ? imageLength - offset : sizeof(buffer);
    if (esp_partition_read(partition, offset, buffer, chunkLength) != ESP_OK ||
        psa_hash_update(&operation, buffer, chunkLength) != PSA_SUCCESS) {
      psa_hash_abort(&operation);
      return ESP_FAIL;
    }
    offset += chunkLength;
  }
  size_t digestLength = 0;
  const psa_status_t status = psa_hash_finish(&operation, digest, 32, &digestLength);
  psa_hash_abort(&operation);
  return status == PSA_SUCCESS && digestLength == 32 ? ESP_OK : ESP_FAIL;
}

void failUpdate(esp_https_ota_handle_t handle, const OtaCommand &command, const char *error) {
  if (handle != nullptr) esp_https_ota_abort(handle);
  feedbackError(TAG, "OTA deploy %s failed: %s", command.deployId, error);
  setStatus("failed", command.deployId, error, false);
}

void otaTask(void *argument) {
  OtaCommand command = *static_cast<OtaCommand *>(argument);
  delete static_cast<OtaCommand *>(argument);
  setStatus("downloading", command.deployId, "", true);

  esp_http_client_config_t httpConfig = {};
  httpConfig.url = command.firmwareUrl;
  httpConfig.crt_bundle_attach = esp_crt_bundle_attach;
  httpConfig.timeout_ms = 15000;
  httpConfig.keep_alive_enable = true;

  esp_https_ota_config_t otaConfig = {};
  otaConfig.http_config = &httpConfig;

  esp_https_ota_handle_t handle = nullptr;
  esp_err_t status = esp_https_ota_begin(&otaConfig, &handle);
  if (status != ESP_OK) {
    failUpdate(handle, command, "download_start_failed");
    vTaskDelete(nullptr);
    return;
  }

  while ((status = esp_https_ota_perform(handle)) == ESP_ERR_HTTPS_OTA_IN_PROGRESS) {
    taskYIELD();
  }
  if (status != ESP_OK || !esp_https_ota_is_complete_data_received(handle)) {
    failUpdate(handle, command, "download_incomplete");
    vTaskDelete(nullptr);
    return;
  }

  const esp_partition_t *targetPartition = esp_ota_get_next_update_partition(nullptr);
  const int downloadedImageLength = esp_https_ota_get_image_len_read(handle);
  unsigned char digest[32] = {};
  if (downloadedImageLength <= 0 ||
      calculateDownloadedImageSha256(targetPartition, static_cast<size_t>(downloadedImageLength), digest) != ESP_OK) {
    failUpdate(handle, command, "sha256_read_failed");
    vTaskDelete(nullptr);
    return;
  }
  char digestHex[65] = {};
  bytesToHex(digest, sizeof(digest), digestHex, sizeof(digestHex));
  unsigned char espImageDigest[32] = {};
  char espImageDigestHex[65] = {};
  if (!constantTimeEqual(digestHex, command.expectedSha256) &&
      (esp_partition_get_sha256(targetPartition, espImageDigest) != ESP_OK ||
       (bytesToHex(espImageDigest, sizeof(espImageDigest), espImageDigestHex, sizeof(espImageDigestHex)),
        !constantTimeEqual(espImageDigestHex, command.expectedSha256)))) {
    failUpdate(handle, command, "sha256_mismatch");
    vTaskDelete(nullptr);
    return;
  }

  setStatus("verified", command.deployId, "", true);
  status = esp_https_ota_finish(handle);
  handle = nullptr;
  if (status != ESP_OK || saveAcceptedSequence(command.sequence) != ESP_OK) {
    failUpdate(nullptr, command, "activation_failed");
    vTaskDelete(nullptr);
    return;
  }

  feedbackInfo(TAG, "OTA deploy %s verified; rebooting into new slot", command.deployId);
  setStatus("rebooting", command.deployId, "", true);
  vTaskDelay(pdMS_TO_TICKS(500));
  esp_restart();
}
}

esp_err_t scheduleOtaUpdate(const char *payload, size_t payloadLength) {
  if (payload == nullptr || payloadLength == 0 || payloadLength > 2048) return ESP_ERR_INVALID_ARG;
  const std::string body(payload, payloadLength);
  const std::string deployId = findStringValue(body, "deploy_id");
  const std::string firmwareUrl = findStringValue(body, "firmware_url");
  const std::string sha256 = lowerHex(findStringValue(body, "sha256"));
  const std::string authorization = lowerHex(findStringValue(body, "authorization"));
  uint64_t sequence = 0;
  if (!isDeployId(deployId) || !findUint64Value(body, "sequence", sequence) ||
      !isHexSha256(sha256) || !isHexSha256(authorization)) {
    return ESP_ERR_INVALID_ARG;
  }

  const ProvisioningConfig config = loadProvisioningConfig();
  if (!config.provisioned || !config.hasDeviceSecret || !isAllowedFirmwareUrl(firmwareUrl, config)) {
    return ESP_ERR_INVALID_ARG;
  }
  if (sequence <= readAcceptedSequence()) return ESP_ERR_INVALID_STATE;

  char canonical[640] = {};
  const int canonicalLength = std::snprintf(
      canonical, sizeof(canonical), "%s\n%llu\n%s\n%s\n%s",
      deployId.c_str(), static_cast<unsigned long long>(sequence), config.deviceId,
      firmwareUrl.c_str(), sha256.c_str());
  if (canonicalLength <= 0 || static_cast<size_t>(canonicalLength) >= sizeof(canonical)) return ESP_ERR_INVALID_ARG;

  char expectedAuthorization[65] = {};
  if (computeDeviceHmacSha256Hex(canonical, static_cast<size_t>(canonicalLength), expectedAuthorization, sizeof(expectedAuthorization)) != ESP_OK ||
      !constantTimeEqual(expectedAuthorization, authorization)) {
    return ESP_ERR_INVALID_RESPONSE;
  }

  portENTER_CRITICAL(&statusMux);
  const bool busy = otaBusy;
  if (!busy) otaBusy = true;
  portEXIT_CRITICAL(&statusMux);
  if (busy) return ESP_ERR_INVALID_STATE;

  OtaCommand *command = new OtaCommand{};
  if (command == nullptr) {
    setStatus("failed", deployId.c_str(), "allocation_failed", false);
    return ESP_ERR_NO_MEM;
  }
  std::snprintf(command->deployId, sizeof(command->deployId), "%s", deployId.c_str());
  std::snprintf(command->firmwareUrl, sizeof(command->firmwareUrl), "%s", firmwareUrl.c_str());
  std::snprintf(command->expectedSha256, sizeof(command->expectedSha256), "%s", sha256.c_str());
  command->sequence = sequence;
  setStatus("queued", command->deployId, "", true);
  if (xTaskCreate(otaTask, "ota-update", 10240, command, 5, nullptr) != pdPASS) {
    delete command;
    setStatus("failed", deployId.c_str(), "task_start_failed", false);
    return ESP_ERR_NO_MEM;
  }
  return ESP_OK;
}

size_t writeOtaStatusJson(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) return 0;
  char state[sizeof(otaState)] = {};
  char deployId[sizeof(otaDeployId)] = {};
  char error[sizeof(otaError)] = {};
  bool busy = false;
  portENTER_CRITICAL(&statusMux);
  std::snprintf(state, sizeof(state), "%s", otaState);
  std::snprintf(deployId, sizeof(deployId), "%s", otaDeployId);
  std::snprintf(error, sizeof(error), "%s", otaError);
  busy = otaBusy;
  portEXIT_CRITICAL(&statusMux);
  const int written = std::snprintf(
      target, targetSize,
      "\"ota\":{\"state\":\"%s\",\"busy\":%s,\"deployId\":\"%s\",\"error\":\"%s\"}",
      state, busy ? "true" : "false", deployId, error);
  if (written < 0) return 0;
  return static_cast<size_t>(written) < targetSize ? static_cast<size_t>(written) : targetSize - 1;
}

void confirmRunningOtaImage() {
  const esp_partition_t *running = esp_ota_get_running_partition();
  esp_ota_img_states_t state = ESP_OTA_IMG_UNDEFINED;
  if (running == nullptr || esp_ota_get_state_partition(running, &state) != ESP_OK || state != ESP_OTA_IMG_PENDING_VERIFY) return;
  const esp_err_t status = esp_ota_mark_app_valid_cancel_rollback();
  if (status == ESP_OK) {
    feedbackInfo(TAG, "New OTA image confirmed after runtime diagnostics");
    return;
  }
  feedbackError(TAG, "OTA image confirmation failed; rolling back: %d", status);
  esp_ota_mark_app_invalid_rollback_and_reboot();
}
