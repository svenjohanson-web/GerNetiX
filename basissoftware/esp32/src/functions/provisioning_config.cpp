#include "basissoftware/provisioning_config.h"

#include <cstdio>
#include <cstring>
#include <string>

#include "nvs.h"
#include "psa/crypto.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"

namespace {
constexpr const char *TAG = "provisioning";
constexpr const char *NVS_NAMESPACE = "prov";
constexpr size_t DEVICE_SECRET_SIZE = 128;

void copyString(char *target, size_t targetSize, const char *source) {
  if (target == nullptr || targetSize == 0) {
    return;
  }
  std::snprintf(target, targetSize, "%s", source == nullptr ? "" : source);
}

bool isHostnameChar(char value) {
  return (value >= 'a' && value <= 'z') ||
         (value >= '0' && value <= '9') ||
         value == '-';
}

char toLowerAscii(char value) {
  return value >= 'A' && value <= 'Z' ? static_cast<char>(value - 'A' + 'a') : value;
}

void appendHostnamePart(char *target, size_t targetSize, size_t &written, const char *value) {
  if (target == nullptr || targetSize == 0 || value == nullptr) {
    return;
  }
  bool previousDash = written == 0 || target[written - 1] == '-';
  for (const char *cursor = value; *cursor != '\0' && written + 1 < targetSize; cursor++) {
    char next = toLowerAscii(*cursor);
    if (!isHostnameChar(next)) {
      next = '-';
    }
    if (next == '-' && previousDash) {
      continue;
    }
    target[written++] = next;
    previousDash = next == '-';
  }
  while (written > 0 && target[written - 1] == '-') {
    written--;
  }
  target[written] = '\0';
}

std::string findStringValue(const std::string &payload, const char *key) {
  const std::string quotedKey = std::string("\"") + key + "\"";
  const size_t keyIndex = payload.find(quotedKey);
  if (keyIndex == std::string::npos) {
    return "";
  }
  const size_t colonIndex = payload.find(':', keyIndex + quotedKey.size());
  if (colonIndex == std::string::npos) {
    return "";
  }
  const size_t valueStart = payload.find('"', colonIndex + 1);
  if (valueStart == std::string::npos) {
    return "";
  }
  size_t valueEnd = valueStart + 1;
  while (valueEnd < payload.size()) {
    if (payload[valueEnd] == '"' && payload[valueEnd - 1] != '\\') {
      return payload.substr(valueStart + 1, valueEnd - valueStart - 1);
    }
    valueEnd++;
  }
  return "";
}

std::string unescapeJsonString(const std::string &value) {
  std::string result;
  result.reserve(value.size());
  bool escaping = false;
  for (char current : value) {
    if (escaping) {
      switch (current) {
        case 'n':
          result.push_back('\n');
          break;
        case 'r':
          result.push_back('\r');
          break;
        case 't':
          result.push_back('\t');
          break;
        case '"':
        case '\\':
        case '/':
          result.push_back(current);
          break;
        default:
          result.push_back(current);
          break;
      }
      escaping = false;
      continue;
    }
    if (current == '\\') {
      escaping = true;
      continue;
    }
    result.push_back(current);
  }
  return result;
}

std::string findJsonArrayAsList(const std::string &payload, const char *key) {
  const std::string quotedKey = std::string("\"") + key + "\"";
  const size_t keyIndex = payload.find(quotedKey);
  if (keyIndex == std::string::npos) {
    return "";
  }
  const size_t colonIndex = payload.find(':', keyIndex + quotedKey.size());
  const size_t arrayStart = payload.find('[', colonIndex);
  const size_t arrayEnd = payload.find(']', arrayStart);
  if (colonIndex == std::string::npos || arrayStart == std::string::npos || arrayEnd == std::string::npos) {
    return "";
  }

  std::string values;
  size_t cursor = arrayStart + 1;
  while (cursor < arrayEnd) {
    const size_t valueStart = payload.find('"', cursor);
    if (valueStart == std::string::npos || valueStart >= arrayEnd) {
      break;
    }
    size_t valueEnd = valueStart + 1;
    while (valueEnd < arrayEnd) {
      if (payload[valueEnd] == '"' && payload[valueEnd - 1] != '\\') {
        if (!values.empty()) {
          values += ",";
        }
        values += unescapeJsonString(payload.substr(valueStart + 1, valueEnd - valueStart - 1));
        cursor = valueEnd + 1;
        break;
      }
      valueEnd++;
    }
    if (valueEnd >= arrayEnd) {
      break;
    }
  }
  return values;
}

esp_err_t setNvsString(nvs_handle_t handle, const char *key, const std::string &value) {
  return nvs_set_str(handle, key, value.c_str());
}

void readNvsString(nvs_handle_t handle, const char *key, char *target, size_t targetSize) {
  size_t length = targetSize;
  if (nvs_get_str(handle, key, target, &length) != ESP_OK) {
    copyString(target, targetSize, "");
  }
}

std::string escapeJsonString(const char *value) {
  std::string escaped;
  const char *safeValue = value == nullptr ? "" : value;
  for (const char *cursor = safeValue; *cursor != '\0'; cursor++) {
    switch (*cursor) {
      case '"':
        escaped += "\\\"";
        break;
      case '\\':
        escaped += "\\\\";
        break;
      case '\n':
        escaped += "\\n";
        break;
      case '\r':
        escaped += "\\r";
        break;
      case '\t':
        escaped += "\\t";
        break;
      default:
        escaped.push_back(*cursor);
        break;
    }
  }
  return escaped;
}

void appendJsonString(char *target, size_t targetSize, size_t &written, const char *key, const char *value) {
  const std::string escapedValue = escapeJsonString(value);
  const int result = std::snprintf(
      target + written,
      targetSize > written ? targetSize - written : 0,
      "%s\"%s\":\"%s\"",
      written > 1 ? "," : "",
      key,
      escapedValue.c_str());
  if (result > 0) {
    written += static_cast<size_t>(result);
    if (written >= targetSize) {
      written = targetSize - 1;
    }
  }
}

void appendJsonBool(char *target, size_t targetSize, size_t &written, const char *key, bool value) {
  const int result = std::snprintf(
      target + written,
      targetSize > written ? targetSize - written : 0,
      "%s\"%s\":%s",
      written > 1 ? "," : "",
      key,
      value ? "true" : "false");
  if (result > 0) {
    written += static_cast<size_t>(result);
    if (written >= targetSize) {
      written = targetSize - 1;
    }
  }
}

void writeProvisioningNameValue(char *target, size_t targetSize, const ProvisioningConfig &config) {
  if (target == nullptr || targetSize == 0) {
    return;
  }
  if (config.serialNumber[0] != '\0') {
    std::snprintf(target, targetSize, "GerNetiX %s", config.serialNumber);
    return;
  }
  if (config.deviceId[0] != '\0') {
    std::snprintf(target, targetSize, "GerNetiX %s", config.deviceId);
    return;
  }
  copyString(target, targetSize, WIFI_STATION_HOSTNAME);
}

void writeProvisioningHostnameValue(char *target, size_t targetSize, const ProvisioningConfig &config) {
  if (target == nullptr || targetSize == 0) {
    return;
  }
  target[0] = '\0';
  if (config.serialNumber[0] == '\0' && config.deviceId[0] == '\0') {
    copyString(target, targetSize, WIFI_STATION_HOSTNAME);
    return;
  }
  size_t written = 0;
  appendHostnamePart(target, targetSize, written, "gernetix");
  if (written + 1 < targetSize) {
    target[written++] = '-';
    target[written] = '\0';
  }
  appendHostnamePart(target, targetSize, written, config.serialNumber[0] != '\0' ? config.serialNumber : config.deviceId);
  if (written == 0) {
    copyString(target, targetSize, WIFI_STATION_HOSTNAME);
  }
}

bool readDeviceSecret(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) {
    return false;
  }
  target[0] = '\0';
  nvs_handle_t handle = 0;
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) {
    return false;
  }
  readNvsString(handle, "dev_secret", target, targetSize);
  nvs_close(handle);
  return target[0] != '\0';
}

void bytesToHex(const unsigned char *bytes, size_t byteCount, char *target, size_t targetSize) {
  static constexpr char HEX[] = "0123456789abcdef";
  if (target == nullptr || targetSize == 0) {
    return;
  }
  const size_t maxBytes = (targetSize - 1) / 2;
  const size_t safeByteCount = byteCount < maxBytes ? byteCount : maxBytes;
  for (size_t i = 0; i < safeByteCount; i++) {
    target[i * 2] = HEX[(bytes[i] >> 4) & 0x0F];
    target[i * 2 + 1] = HEX[bytes[i] & 0x0F];
  }
  target[safeByteCount * 2] = '\0';
}
}

ProvisioningConfig loadProvisioningConfig() {
  ProvisioningConfig config = {};
  nvs_handle_t handle = 0;
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) {
    return config;
  }

  uint8_t provisioned = 0;
  config.provisioned = nvs_get_u8(handle, "provisioned", &provisioned) == ESP_OK && provisioned == 1;
  char deviceSecret[DEVICE_SECRET_SIZE] = {};
  readNvsString(handle, "dev_secret", deviceSecret, sizeof(deviceSecret));
  config.hasDeviceSecret = deviceSecret[0] != '\0';
  readNvsString(handle, "device_id", config.deviceId, sizeof(config.deviceId));
  readNvsString(handle, "serial", config.serialNumber, sizeof(config.serialNumber));
  readNvsString(handle, "hardware", config.hardwareProfileId, sizeof(config.hardwareProfileId));
  readNvsString(handle, "fw_version", config.firmwareVersion, sizeof(config.firmwareVersion));
  readNvsString(handle, "fw_basis", config.firmwareBasis, sizeof(config.firmwareBasis));
  readNvsString(handle, "cred_id", config.credentialId, sizeof(config.credentialId));
  readNvsString(handle, "cred_type", config.credentialType, sizeof(config.credentialType));
  readNvsString(handle, "key_ref", config.keyReference, sizeof(config.keyReference));
  readNvsString(handle, "secret_sha", config.secretSha256, sizeof(config.secretSha256));
  readNvsString(handle, "dm_url", config.deviceManagementUrl, sizeof(config.deviceManagementUrl));
  readNvsString(handle, "bd_url", config.buildDeployUrl, sizeof(config.buildDeployUrl));
  readNvsString(handle, "prov_batch", config.provisioningBatchId, sizeof(config.provisioningBatchId));
  readNvsString(handle, "prov_by", config.provisionedBy, sizeof(config.provisionedBy));
  readNvsString(handle, "capabilities", config.capabilities, sizeof(config.capabilities));
  nvs_close(handle);
  return config;
}

esp_err_t saveProvisioningPayload(const char *payload, size_t payloadLength) {
  if (payload == nullptr || payloadLength == 0) {
    return ESP_ERR_INVALID_ARG;
  }

  const std::string body(payload, payloadLength);
  const std::string deviceId = unescapeJsonString(findStringValue(body, "device_id"));
  const std::string serialNumber = unescapeJsonString(findStringValue(body, "serial_number"));
  const std::string hardwareProfileId = unescapeJsonString(findStringValue(body, "hardware_profile_id"));
  const std::string firmwareVersion = unescapeJsonString(findStringValue(body, "version"));
  const std::string firmwareBasis = unescapeJsonString(findStringValue(body, "basis"));
  const std::string credentialId = unescapeJsonString(findStringValue(body, "credential_id"));
  const std::string credentialType = unescapeJsonString(findStringValue(body, "credential_type"));
  const std::string keyReference = unescapeJsonString(findStringValue(body, "key_reference"));
  const std::string secretSha256 = unescapeJsonString(findStringValue(body, "secret_sha256"));
  const std::string oneTimeDeviceSecret = unescapeJsonString(findStringValue(body, "one_time_device_secret"));
  const std::string deviceSecret = unescapeJsonString(findStringValue(body, "device_secret"));
  const std::string deviceManagementUrl = unescapeJsonString(findStringValue(body, "device_management"));
  const std::string buildDeployUrl = unescapeJsonString(findStringValue(body, "build_deploy"));
  const std::string provisioningBatchId = unescapeJsonString(findStringValue(body, "batch_id"));
  const std::string provisionedBy = unescapeJsonString(findStringValue(body, "provisioned_by"));
  const std::string capabilities = findJsonArrayAsList(body, "capabilities");

  if (deviceId.empty() || serialNumber.empty() || credentialId.empty()) {
    feedbackError(TAG, "Provisioning payload is missing device_id, serial_number or credential_id");
    return ESP_ERR_INVALID_ARG;
  }

  nvs_handle_t handle = 0;
  esp_err_t status = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle);
  if (status != ESP_OK) {
    return status;
  }

  status = nvs_set_u8(handle, "provisioned", 1);
  if (status == ESP_OK) status = setNvsString(handle, "device_id", deviceId);
  if (status == ESP_OK) status = setNvsString(handle, "serial", serialNumber);
  if (status == ESP_OK) status = setNvsString(handle, "hardware", hardwareProfileId);
  if (status == ESP_OK) status = setNvsString(handle, "fw_version", firmwareVersion);
  if (status == ESP_OK) status = setNvsString(handle, "fw_basis", firmwareBasis);
  if (status == ESP_OK) status = setNvsString(handle, "cred_id", credentialId);
  if (status == ESP_OK) status = setNvsString(handle, "cred_type", credentialType);
  if (status == ESP_OK) status = setNvsString(handle, "key_ref", keyReference);
  if (status == ESP_OK) status = setNvsString(handle, "secret_sha", secretSha256);
  if (status == ESP_OK && !oneTimeDeviceSecret.empty()) status = setNvsString(handle, "dev_secret", oneTimeDeviceSecret);
  if (status == ESP_OK && !deviceSecret.empty()) status = setNvsString(handle, "dev_secret", deviceSecret);
  if (status == ESP_OK) status = setNvsString(handle, "dm_url", deviceManagementUrl);
  if (status == ESP_OK) status = setNvsString(handle, "bd_url", buildDeployUrl);
  if (status == ESP_OK) status = setNvsString(handle, "prov_batch", provisioningBatchId);
  if (status == ESP_OK) status = setNvsString(handle, "prov_by", provisionedBy);
  if (status == ESP_OK) status = setNvsString(handle, "capabilities", capabilities);
  if (status == ESP_OK) status = nvs_commit(handle);
  nvs_close(handle);

  if (status == ESP_OK) {
    feedbackInfo(TAG, "Provisioning config stored for %s", deviceId.c_str());
  }
  return status;
}

size_t writeProvisioningDeviceName(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) {
    return 0;
  }
  const ProvisioningConfig config = loadProvisioningConfig();
  writeProvisioningNameValue(target, targetSize, config);
  return std::strlen(target);
}

size_t writeProvisioningHostname(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) {
    return 0;
  }
  const ProvisioningConfig config = loadProvisioningConfig();
  writeProvisioningHostnameValue(target, targetSize, config);
  return std::strlen(target);
}

size_t writeProvisioningStatusJson(char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) {
    return 0;
  }

  const ProvisioningConfig config = loadProvisioningConfig();
  char deviceName[96] = {};
  char hostname[32] = {};
  writeProvisioningNameValue(deviceName, sizeof(deviceName), config);
  writeProvisioningHostnameValue(hostname, sizeof(hostname), config);
  size_t written = 0;
  written += std::snprintf(
      target,
      targetSize,
      "\"provisioningState\":\"%s\"",
      config.provisioned ? "provisioned" : "not_configured");
  if (written >= targetSize) {
    target[targetSize - 1] = '\0';
    return targetSize - 1;
  }

  appendJsonString(target, targetSize, written, "displayName", deviceName);
  appendJsonString(target, targetSize, written, "hostname", hostname);
  appendJsonString(target, targetSize, written, "deviceId", config.deviceId);
  appendJsonString(target, targetSize, written, "serialNumber", config.serialNumber);
  appendJsonString(target, targetSize, written, "hardwareProfileId", config.hardwareProfileId);
  appendJsonString(target, targetSize, written, "firmwareVersion", config.firmwareVersion);
  appendJsonString(target, targetSize, written, "firmwareBasis", config.firmwareBasis);
  appendJsonString(target, targetSize, written, "credentialId", config.credentialId);
  appendJsonString(target, targetSize, written, "credentialType", config.credentialType);
  appendJsonString(target, targetSize, written, "keyReference", config.keyReference);
  appendJsonString(target, targetSize, written, "deviceManagementUrl", config.deviceManagementUrl);
  appendJsonString(target, targetSize, written, "buildDeployUrl", config.buildDeployUrl);
  appendJsonString(target, targetSize, written, "provisioningBatchId", config.provisioningBatchId);
  appendJsonString(target, targetSize, written, "provisionedBy", config.provisionedBy);
  appendJsonString(target, targetSize, written, "capabilities", config.capabilities);
  appendJsonBool(target, targetSize, written, "hasDeviceSecret", config.hasDeviceSecret);
  appendJsonString(target, targetSize, written, "authenticityProof", config.hasDeviceSecret ? "ready" : "missing_device_secret");
  target[written] = '\0';
  return written;
}

esp_err_t writeChallengeProofJson(const char *payload, size_t payloadLength, char *target, size_t targetSize) {
  if (payload == nullptr || payloadLength == 0 || target == nullptr || targetSize == 0) {
    return ESP_ERR_INVALID_ARG;
  }

  const std::string body(payload, payloadLength);
  const std::string challengeId = unescapeJsonString(findStringValue(body, "challenge_id"));
  const std::string challenge = unescapeJsonString(findStringValue(body, "challenge"));
  if (challenge.empty()) {
    feedbackError(TAG, "Challenge payload is missing challenge");
    return ESP_ERR_INVALID_ARG;
  }

  const ProvisioningConfig config = loadProvisioningConfig();
  char deviceSecret[DEVICE_SECRET_SIZE] = {};
  if (!config.provisioned || !readDeviceSecret(deviceSecret, sizeof(deviceSecret))) {
    feedbackError(TAG, "Challenge proof requested before device secret was provisioned");
    return ESP_ERR_INVALID_STATE;
  }

  unsigned char hmac[32] = {};
  size_t hmacLength = 0;
  psa_key_attributes_t keyAttributes = PSA_KEY_ATTRIBUTES_INIT;
  mbedtls_svc_key_id_t key = 0;
  const psa_algorithm_t algorithm = PSA_ALG_HMAC(PSA_ALG_SHA_256);

  if (psa_crypto_init() != PSA_SUCCESS) {
    return ESP_FAIL;
  }
  psa_set_key_type(&keyAttributes, PSA_KEY_TYPE_HMAC);
  psa_set_key_bits(&keyAttributes, std::strlen(deviceSecret) * 8);
  psa_set_key_usage_flags(&keyAttributes, PSA_KEY_USAGE_SIGN_MESSAGE);
  psa_set_key_algorithm(&keyAttributes, algorithm);

  psa_status_t status = psa_import_key(
      &keyAttributes,
      reinterpret_cast<const uint8_t *>(deviceSecret),
      std::strlen(deviceSecret),
      &key);
  if (status == PSA_SUCCESS) {
    status = psa_mac_compute(
        key,
        algorithm,
        reinterpret_cast<const uint8_t *>(challenge.c_str()),
        challenge.size(),
        hmac,
        sizeof(hmac),
        &hmacLength);
    psa_destroy_key(key);
  }
  if (status != PSA_SUCCESS || hmacLength != sizeof(hmac)) {
    return ESP_FAIL;
  }

  char hmacHex[65] = {};
  bytesToHex(hmac, sizeof(hmac), hmacHex, sizeof(hmacHex));

  size_t written = 0;
  target[0] = '\0';
  appendJsonString(target, targetSize, written, "device_id", config.deviceId);
  appendJsonString(target, targetSize, written, "serial_number", config.serialNumber);
  appendJsonString(target, targetSize, written, "credential_id", config.credentialId);
  appendJsonString(target, targetSize, written, "challenge_id", challengeId.c_str());
  appendJsonString(target, targetSize, written, "algorithm", "HMAC_SHA256");
  appendJsonString(target, targetSize, written, "hmac", hmacHex);
  target[written] = '\0';

  feedbackInfo(TAG, "Challenge proof created for %s", config.deviceId);
  return ESP_OK;
}
