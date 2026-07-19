#include "basissoftware/provisioning_config.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "nvs.h"
#include "psa/crypto.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"

namespace {
constexpr const char *TAG = "provisioning";
constexpr const char *NVS_NAMESPACE = "prov";
constexpr size_t ECDSA_SIGNATURE_SIZE = 64;

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

constexpr char BASE64_ALPHABET[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

std::string base64Encode(const unsigned char *source, size_t length) {
  std::string result;
  result.reserve(((length + 2) / 3) * 4);
  for (size_t index = 0; index < length; index += 3) {
    const unsigned value = static_cast<unsigned>(source[index]) << 16 |
        (index + 1 < length ? static_cast<unsigned>(source[index + 1]) << 8 : 0) |
        (index + 2 < length ? static_cast<unsigned>(source[index + 2]) : 0);
    result.push_back(BASE64_ALPHABET[(value >> 18) & 0x3f]);
    result.push_back(BASE64_ALPHABET[(value >> 12) & 0x3f]);
    result.push_back(index + 1 < length ? BASE64_ALPHABET[(value >> 6) & 0x3f] : '=');
    result.push_back(index + 2 < length ? BASE64_ALPHABET[value & 0x3f] : '=');
  }
  return result;
}

int base64Value(char value) {
  if (value >= 'A' && value <= 'Z') return value - 'A';
  if (value >= 'a' && value <= 'z') return value - 'a' + 26;
  if (value >= '0' && value <= '9') return value - '0' + 52;
  if (value == '+' || value == '-') return 62;
  if (value == '/' || value == '_') return 63;
  return -1;
}

bool base64Decode(const std::string &source, unsigned char *target, size_t targetSize, size_t &decodedLength) {
  decodedLength = 0;
  unsigned accumulator = 0;
  int bits = 0;
  for (char current : source) {
    if (current == '=' || current == '\r' || current == '\n' || current == ' ') continue;
    const int value = base64Value(current);
    if (value < 0) return false;
    accumulator = (accumulator << 6) | static_cast<unsigned>(value);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (decodedLength >= targetSize) return false;
      target[decodedLength++] = static_cast<unsigned char>((accumulator >> bits) & 0xff);
    }
  }
  return true;
}

std::string pemEncode(const char *label, const unsigned char *der, size_t derLength) {
  const std::string encoded = base64Encode(der, derLength);
  std::string pem = std::string("-----BEGIN ") + label + "-----\n";
  for (size_t index = 0; index < encoded.size(); index += 64) pem += encoded.substr(index, 64) + "\n";
  return pem + "-----END " + label + "-----\n";
}

bool publicPointFromPem(const char *publicKeyPem, unsigned char target[65]) {
  const std::string pem(publicKeyPem == nullptr ? "" : publicKeyPem);
  const size_t begin = pem.find("-----BEGIN PUBLIC KEY-----");
  const size_t end = pem.find("-----END PUBLIC KEY-----");
  if (begin == std::string::npos || end == std::string::npos) return false;
  const size_t contentStart = pem.find('\n', begin);
  if (contentStart == std::string::npos || contentStart >= end) return false;
  unsigned char der[128] = {};
  size_t derLength = 0;
  if (!base64Decode(pem.substr(contentStart + 1, end - contentStart - 1), der, sizeof(der), derLength) ||
      derLength < 65 || der[derLength - 65] != 0x04) return false;
  std::memcpy(target, der + derLength - 65, 65);
  return true;
}

esp_err_t createDeviceKeyPair(std::string &privateKeyPem, std::string &publicKeyPem, std::string &privateRawBase64Url) {
  if (psa_crypto_init() != PSA_SUCCESS) return ESP_FAIL;
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  psa_set_key_type(&attributes, PSA_KEY_TYPE_ECC_KEY_PAIR(PSA_ECC_FAMILY_SECP_R1));
  psa_set_key_bits(&attributes, 256);
  psa_set_key_usage_flags(&attributes, PSA_KEY_USAGE_EXPORT | PSA_KEY_USAGE_SIGN_MESSAGE);
  psa_set_key_algorithm(&attributes, PSA_ALG_ECDSA(PSA_ALG_SHA_256));
  mbedtls_svc_key_id_t key = 0;
  psa_status_t status = psa_generate_key(&attributes, &key);
  unsigned char privateScalar[32] = {};
  unsigned char publicPoint[65] = {};
  size_t privateLength = 0;
  size_t publicLength = 0;
  if (status == PSA_SUCCESS) status = psa_export_key(key, privateScalar, sizeof(privateScalar), &privateLength);
  if (status == PSA_SUCCESS) status = psa_export_public_key(key, publicPoint, sizeof(publicPoint), &publicLength);
  psa_destroy_key(key);
  if (status != PSA_SUCCESS || privateLength != 32 || publicLength != 65) return ESP_FAIL;

  unsigned char publicDer[91] = {
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
  };
  std::memcpy(publicDer + 26, publicPoint, sizeof(publicPoint));
  unsigned char privateDer[121] = {
    0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20,
  };
  std::memcpy(privateDer + 7, privateScalar, sizeof(privateScalar));
  const unsigned char suffix[] = {
    0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0xa1, 0x44, 0x03, 0x42, 0x00,
  };
  std::memcpy(privateDer + 39, suffix, sizeof(suffix));
  std::memcpy(privateDer + 56, publicPoint, sizeof(publicPoint));
  publicKeyPem = pemEncode("PUBLIC KEY", publicDer, sizeof(publicDer));
  privateKeyPem = pemEncode("EC PRIVATE KEY", privateDer, sizeof(privateDer));
  privateRawBase64Url = base64Encode(privateScalar, sizeof(privateScalar));
  for (char &value : privateRawBase64Url) {
    if (value == '+') value = '-';
    if (value == '/') value = '_';
  }
  while (!privateRawBase64Url.empty() && privateRawBase64Url.back() == '=') privateRawBase64Url.pop_back();
  return ESP_OK;
}

esp_err_t ensureDeviceKeyPair(nvs_handle_t handle) {
  char privateKey[512] = {};
  char publicKey[256] = {};
  char privateRaw[64] = {};
  readNvsString(handle, "dev_priv", privateKey, sizeof(privateKey));
  readNvsString(handle, "dev_pub", publicKey, sizeof(publicKey));
  readNvsString(handle, "dev_raw", privateRaw, sizeof(privateRaw));
  if (privateKey[0] != '\0' && publicKey[0] != '\0' && privateRaw[0] != '\0') return ESP_OK;
  std::string privateKeyPem;
  std::string publicKeyPem;
  std::string privateRawBase64Url;
  esp_err_t status = createDeviceKeyPair(privateKeyPem, publicKeyPem, privateRawBase64Url);
  if (status == ESP_OK) status = setNvsString(handle, "dev_priv", privateKeyPem);
  if (status == ESP_OK) status = setNvsString(handle, "dev_pub", publicKeyPem);
  if (status == ESP_OK) status = setNvsString(handle, "dev_raw", privateRawBase64Url);
  return status;
}

bool base64UrlEncode(const unsigned char *source, size_t sourceLength, char *target, size_t targetSize) {
  std::string encoded = base64Encode(source, sourceLength);
  for (char &value : encoded) {
    if (value == '+') value = '-';
    if (value == '/') value = '_';
  }
  while (!encoded.empty() && encoded.back() == '=') encoded.pop_back();
  if (encoded.size() + 1 > targetSize) return false;
  std::memcpy(target, encoded.c_str(), encoded.size() + 1);
  return true;
}

bool base64UrlDecode(const char *source, unsigned char *target, size_t targetSize, size_t &decodedLength) {
  return source != nullptr && base64Decode(source, target, targetSize, decodedLength);
}
}

void loadProvisioningConfigInto(ProvisioningConfig &config) {
  config = {};
  nvs_handle_t handle = 0;
  if (nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle) != ESP_OK) {
    return;
  }

  uint8_t provisioned = 0;
  config.provisioned = nvs_get_u8(handle, "provisioned", &provisioned) == ESP_OK && provisioned == 1;
  readNvsString(handle, "dev_pub", config.devicePublicKeyPem, sizeof(config.devicePublicKeyPem));
  readNvsString(handle, "dev_priv", config.devicePrivateKeyPem, sizeof(config.devicePrivateKeyPem));
  readNvsString(handle, "dev_raw", config.devicePrivateKeyRawBase64Url, sizeof(config.devicePrivateKeyRawBase64Url));
  readNvsString(handle, "mqtt_cert", config.mqttClientCertificatePem, sizeof(config.mqttClientCertificatePem));
  readNvsString(handle, "ota_key_id", config.otaSigningKeyId, sizeof(config.otaSigningKeyId));
  readNvsString(handle, "ota_pub", config.otaSigningPublicKeyPem, sizeof(config.otaSigningPublicKeyPem));
  config.hasDevicePrivateKey = config.devicePrivateKeyPem[0] != '\0';
  config.hasMqttClientCertificate = config.mqttClientCertificatePem[0] != '\0';
  config.hasOtaSigningPublicKey = config.otaSigningPublicKeyPem[0] != '\0';
  readNvsString(handle, "device_id", config.deviceId, sizeof(config.deviceId));
  readNvsString(handle, "serial", config.serialNumber, sizeof(config.serialNumber));
  readNvsString(handle, "hardware", config.hardwareProfileId, sizeof(config.hardwareProfileId));
  readNvsString(handle, "fw_version", config.firmwareVersion, sizeof(config.firmwareVersion));
  readNvsString(handle, "fw_basis", config.firmwareBasis, sizeof(config.firmwareBasis));
  readNvsString(handle, "cred_id", config.credentialId, sizeof(config.credentialId));
  readNvsString(handle, "cred_type", config.credentialType, sizeof(config.credentialType));
  readNvsString(handle, "key_ref", config.keyReference, sizeof(config.keyReference));
  readNvsString(handle, "dm_url", config.deviceManagementUrl, sizeof(config.deviceManagementUrl));
  readNvsString(handle, "bd_url", config.buildDeployUrl, sizeof(config.buildDeployUrl));
  readNvsString(handle, "mqtt_url", config.mqttBrokerUrl, sizeof(config.mqttBrokerUrl));
  readNvsString(handle, "prov_batch", config.provisioningBatchId, sizeof(config.provisioningBatchId));
  readNvsString(handle, "prov_by", config.provisionedBy, sizeof(config.provisionedBy));
  readNvsString(handle, "capabilities", config.capabilities, sizeof(config.capabilities));
  nvs_close(handle);
}

ProvisioningConfig loadProvisioningConfig() {
  ProvisioningConfig config = {};
  loadProvisioningConfigInto(config);
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
  const std::string mqttClientCertificatePem = unescapeJsonString(findStringValue(body, "mqtt_client_certificate_pem"));
  const std::string otaSigningKeyId = unescapeJsonString(findStringValue(body, "ota_signing_key_id"));
  const std::string otaSigningPublicKeyPem = unescapeJsonString(findStringValue(body, "ota_signing_public_key_pem"));
  const std::string deviceManagementUrl = unescapeJsonString(findStringValue(body, "device_management"));
  const std::string buildDeployUrl = unescapeJsonString(findStringValue(body, "build_deploy"));
  const std::string mqttBrokerUrl = unescapeJsonString(findStringValue(body, "mqtt_broker"));
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

  status = ensureDeviceKeyPair(handle);
  if (status == ESP_OK) status = nvs_set_u8(handle, "provisioned", 1);
  if (status == ESP_OK) status = setNvsString(handle, "device_id", deviceId);
  if (status == ESP_OK) status = setNvsString(handle, "serial", serialNumber);
  if (status == ESP_OK) status = setNvsString(handle, "hardware", hardwareProfileId);
  if (status == ESP_OK) status = setNvsString(handle, "fw_version", firmwareVersion);
  if (status == ESP_OK) status = setNvsString(handle, "fw_basis", firmwareBasis);
  if (status == ESP_OK) status = setNvsString(handle, "cred_id", credentialId);
  if (status == ESP_OK) status = setNvsString(handle, "cred_type", credentialType);
  if (status == ESP_OK) status = setNvsString(handle, "key_ref", keyReference);
  if (status == ESP_OK) {
    nvs_erase_key(handle, "dev_secret");
    nvs_erase_key(handle, "secret_sha");
  }
  if (status == ESP_OK && !mqttClientCertificatePem.empty()) status = setNvsString(handle, "mqtt_cert", mqttClientCertificatePem);
  if (status == ESP_OK) status = setNvsString(handle, "ota_key_id", otaSigningKeyId);
  if (status == ESP_OK) status = setNvsString(handle, "ota_pub", otaSigningPublicKeyPem);
  if (status == ESP_OK) status = setNvsString(handle, "dm_url", deviceManagementUrl);
  if (status == ESP_OK) status = setNvsString(handle, "bd_url", buildDeployUrl);
  if (status == ESP_OK) status = setNvsString(handle, "mqtt_url", mqttBrokerUrl);
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

  // This function is called from the HTTP server task.  The complete
  // provisioning record contains certificate/key fields of several KiB and
  // must not be put on that task's stack.
  ProvisioningConfig *config = static_cast<ProvisioningConfig *>(std::calloc(1, sizeof(ProvisioningConfig)));
  if (config == nullptr) {
    target[0] = '\0';
    return 0;
  }
  loadProvisioningConfigInto(*config);
  char deviceName[96] = {};
  char hostname[32] = {};
  writeProvisioningNameValue(deviceName, sizeof(deviceName), *config);
  writeProvisioningHostnameValue(hostname, sizeof(hostname), *config);
  size_t written = 0;
  written += std::snprintf(
      target,
      targetSize,
      "\"provisioningState\":\"%s\"",
      config->provisioned ? "provisioned" : "not_configured");
  if (written >= targetSize) {
    target[targetSize - 1] = '\0';
    std::free(config);
    return targetSize - 1;
  }

  appendJsonString(target, targetSize, written, "displayName", deviceName);
  appendJsonString(target, targetSize, written, "hostname", hostname);
  appendJsonString(target, targetSize, written, "deviceId", config->deviceId);
  appendJsonString(target, targetSize, written, "serialNumber", config->serialNumber);
  appendJsonString(target, targetSize, written, "hardwareProfileId", config->hardwareProfileId);
  appendJsonString(target, targetSize, written, "firmwareVersion", config->firmwareVersion);
  appendJsonString(target, targetSize, written, "firmwareBasis", config->firmwareBasis);
  appendJsonString(target, targetSize, written, "credentialId", config->credentialId);
  appendJsonString(target, targetSize, written, "credentialType", config->credentialType);
  appendJsonString(target, targetSize, written, "keyReference", config->keyReference);
  appendJsonString(target, targetSize, written, "public_key_pem", config->devicePublicKeyPem);
  appendJsonString(target, targetSize, written, "deviceManagementUrl", config->deviceManagementUrl);
  appendJsonString(target, targetSize, written, "buildDeployUrl", config->buildDeployUrl);
  appendJsonString(target, targetSize, written, "mqttBrokerUrl", config->mqttBrokerUrl);
  appendJsonString(target, targetSize, written, "provisioningBatchId", config->provisioningBatchId);
  appendJsonString(target, targetSize, written, "provisionedBy", config->provisionedBy);
  appendJsonString(target, targetSize, written, "capabilities", config->capabilities);
  appendJsonBool(target, targetSize, written, "hasDevicePrivateKey", config->hasDevicePrivateKey);
  appendJsonBool(target, targetSize, written, "hasMqttClientCertificate", config->hasMqttClientCertificate);
  appendJsonBool(target, targetSize, written, "hasOtaSigningPublicKey", config->hasOtaSigningPublicKey);
  appendJsonString(target, targetSize, written, "authenticityProof", config->hasDevicePrivateKey ? "ready" : "missing_device_private_key");
  target[written] = '\0';
  std::free(config);
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
  if (!config.provisioned || !config.hasDevicePrivateKey) {
    feedbackError(TAG, "Challenge proof requested before device key was provisioned");
    return ESP_ERR_INVALID_STATE;
  }

  const std::string canonical = std::string("gernetix-device-auth-v1\n") + challengeId + "\n" + config.deviceId + "\n" + challenge;
  char signature[128] = {};
  const esp_err_t signatureStatus = signDeviceMessageBase64Url(
      canonical.c_str(), canonical.size(), signature, sizeof(signature));
  if (signatureStatus != ESP_OK) return signatureStatus;

  size_t written = 0;
  target[0] = '\0';
  appendJsonString(target, targetSize, written, "device_id", config.deviceId);
  appendJsonString(target, targetSize, written, "serial_number", config.serialNumber);
  appendJsonString(target, targetSize, written, "credential_id", config.credentialId);
  appendJsonString(target, targetSize, written, "challenge_id", challengeId.c_str());
  appendJsonString(target, targetSize, written, "algorithm", "ECDSA_P256_SHA256");
  appendJsonString(target, targetSize, written, "signature", signature);
  target[written] = '\0';

  feedbackInfo(TAG, "Challenge proof created for %s", config.deviceId);
  return ESP_OK;
}

esp_err_t signDeviceMessageBase64Url(
    const char *message,
    size_t messageLength,
    char *target,
    size_t targetSize) {
  if (message == nullptr || messageLength == 0 || target == nullptr || targetSize < 88) {
    return ESP_ERR_INVALID_ARG;
  }

  const ProvisioningConfig config = loadProvisioningConfig();
  if (!config.hasDevicePrivateKey) return ESP_ERR_INVALID_STATE;

  unsigned char privateScalar[32] = {};
  size_t privateScalarLength = 0;
  if (!base64UrlDecode(
          config.devicePrivateKeyRawBase64Url,
          privateScalar,
          sizeof(privateScalar),
          privateScalarLength) || privateScalarLength != sizeof(privateScalar)) return ESP_FAIL;

  psa_key_attributes_t keyAttributes = PSA_KEY_ATTRIBUTES_INIT;
  mbedtls_svc_key_id_t key = 0;
  const psa_algorithm_t algorithm = PSA_ALG_ECDSA(PSA_ALG_SHA_256);

  if (psa_crypto_init() != PSA_SUCCESS) return ESP_FAIL;
  psa_set_key_type(&keyAttributes, PSA_KEY_TYPE_ECC_KEY_PAIR(PSA_ECC_FAMILY_SECP_R1));
  psa_set_key_bits(&keyAttributes, 256);
  psa_set_key_usage_flags(&keyAttributes, PSA_KEY_USAGE_SIGN_MESSAGE);
  psa_set_key_algorithm(&keyAttributes, algorithm);

  psa_status_t status = psa_import_key(
      &keyAttributes, privateScalar, sizeof(privateScalar), &key);
  unsigned char signature[ECDSA_SIGNATURE_SIZE] = {};
  size_t signatureLength = 0;
  if (status == PSA_SUCCESS) {
    status = psa_sign_message(
        key, algorithm,
        reinterpret_cast<const uint8_t *>(message),
        messageLength,
        signature, sizeof(signature), &signatureLength);
    psa_destroy_key(key);
  }
  if (status != PSA_SUCCESS || signatureLength != ECDSA_SIGNATURE_SIZE) return ESP_FAIL;
  return base64UrlEncode(signature, signatureLength, target, targetSize) ? ESP_OK : ESP_FAIL;
}

esp_err_t verifyEcdsaP256SignatureBase64Url(
    const char *publicKeyPem,
    const char *message,
    size_t messageLength,
    const char *signatureBase64Url) {
  if (publicKeyPem == nullptr || message == nullptr || messageLength == 0 || signatureBase64Url == nullptr) {
    return ESP_ERR_INVALID_ARG;
  }
  unsigned char publicPoint[65] = {};
  if (!publicPointFromPem(publicKeyPem, publicPoint)) return ESP_ERR_INVALID_ARG;
  unsigned char signature[ECDSA_SIGNATURE_SIZE] = {};
  size_t signatureLength = 0;
  if (!base64UrlDecode(signatureBase64Url, signature, sizeof(signature), signatureLength) ||
      signatureLength != ECDSA_SIGNATURE_SIZE) {
    return ESP_ERR_INVALID_ARG;
  }
  psa_key_attributes_t attributes = PSA_KEY_ATTRIBUTES_INIT;
  psa_set_key_type(&attributes, PSA_KEY_TYPE_ECC_PUBLIC_KEY(PSA_ECC_FAMILY_SECP_R1));
  psa_set_key_bits(&attributes, 256);
  psa_set_key_usage_flags(&attributes, PSA_KEY_USAGE_VERIFY_MESSAGE);
  psa_set_key_algorithm(&attributes, PSA_ALG_ECDSA(PSA_ALG_SHA_256));
  mbedtls_svc_key_id_t key = 0;
  if (psa_crypto_init() != PSA_SUCCESS) {
    return ESP_FAIL;
  }
  psa_status_t status = psa_import_key(&attributes, publicPoint, sizeof(publicPoint), &key);
  if (status == PSA_SUCCESS) {
    status = psa_verify_message(
        key, PSA_ALG_ECDSA(PSA_ALG_SHA_256),
        reinterpret_cast<const uint8_t *>(message), messageLength,
        signature, signatureLength);
    psa_destroy_key(key);
  }
  return status == PSA_SUCCESS ? ESP_OK : ESP_ERR_INVALID_RESPONSE;
}
