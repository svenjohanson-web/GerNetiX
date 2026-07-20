#include "gernetix_flashbox_manifest_validator.h"

#include <mbedtls/base64.h>
#include <mbedtls/md.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>
#include <mbedtls/version.h>

#include <cstring>
#include <vector>

#include "gernetix_flashbox_config.h"

namespace {

String findJsonString(const String& json, const String& key) {
  const String quotedKey = "\"" + key + "\"";
  int keyIndex = json.indexOf(quotedKey);
  if (keyIndex < 0) return "";
  int colonIndex = json.indexOf(':', keyIndex + quotedKey.length());
  if (colonIndex < 0) return "";
  int valueStart = json.indexOf('"', colonIndex + 1);
  if (valueStart < 0) return "";
  String value;
  bool escaping = false;
  for (int index = valueStart + 1; index < json.length(); index += 1) {
    char current = json.charAt(index);
    if (escaping) {
      if (current == 'n') value += '\n';
      else if (current == 'r') value += '\r';
      else if (current == 't') value += '\t';
      else value += current;
      escaping = false;
      continue;
    }
    if (current == '\\') {
      escaping = true;
      continue;
    }
    if (current == '"') return value;
    value += current;
  }
  return "";
}

bool isHttpsUrl(const String& url) {
  return url.startsWith("https://");
}

bool isHexSha256(const String& value) {
  if (value.length() != 64) return false;
  for (size_t index = 0; index < value.length(); index += 1) {
    char current = value.charAt(index);
    bool hex = (current >= '0' && current <= '9') ||
      (current >= 'a' && current <= 'f') ||
      (current >= 'A' && current <= 'F');
    if (!hex) return false;
  }
  return true;
}

String lowerHexSha256(const uint8_t digest[32]) {
  static constexpr char HEX_DIGITS[] = "0123456789abcdef";
  String result;
  result.reserve(64);
  for (size_t index = 0; index < 32; index += 1) {
    result += HEX_DIGITS[(digest[index] >> 4) & 0x0F];
    result += HEX_DIGITS[digest[index] & 0x0F];
  }
  return result;
}

String lowerAscii(const String& value) {
  String result;
  result.reserve(value.length());
  for (size_t index = 0; index < value.length(); index += 1) {
    char current = value.charAt(index);
    if (current >= 'A' && current <= 'Z') current = static_cast<char>(current - 'A' + 'a');
    result += current;
  }
  return result;
}

String buildSignedPayload(const FlashboxManifestValidationResult& result) {
  String payload;
  payload.reserve(512);
  payload += "manifest_type=";
  payload += result.manifestType;
  payload += "\nhardware_profile_id=";
  payload += result.hardwareProfileId;
  payload += "\nartifact_url=";
  payload += result.artifactUrl;
  payload += "\nsha256=";
  payload += lowerAscii(result.expectedSha256);
  payload += "\nsigning_key_id=";
  payload += result.signingKeyId;
  payload += "\nidentity_policy=";
  payload += result.identityPolicy;
  payload += "\ntarget_device_id=";
  payload += result.targetDeviceId;
  payload += "\nuse_case=";
  payload += result.useCase;
  return payload;
}

bool isReleasePublicKeyConfigured() {
  const String key = GERNETIX_RELEASE_PUBLIC_KEY_PEM;
  return key.indexOf("DEVELOPMENT_PLACEHOLDER") < 0 && key.indexOf("BEGIN PUBLIC KEY") >= 0;
}

bool decodeBase64Url(const String& encoded, std::vector<uint8_t>& decoded) {
  String normalized = encoded;
  normalized.replace('-', '+');
  normalized.replace('_', '/');
  while (normalized.length() % 4 != 0) normalized += '=';

  size_t outputLength = 0;
  int rc = mbedtls_base64_decode(
    nullptr,
    0,
    &outputLength,
    reinterpret_cast<const unsigned char*>(normalized.c_str()),
    normalized.length());
  if (rc != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL || outputLength == 0) return false;

  decoded.assign(outputLength, 0);
  rc = mbedtls_base64_decode(
    decoded.data(),
    decoded.size(),
    &outputLength,
    reinterpret_cast<const unsigned char*>(normalized.c_str()),
    normalized.length());
  if (rc != 0) return false;
  decoded.resize(outputLength);
  return true;
}

bool sha256(const uint8_t* data, size_t length, uint8_t digest[32]) {
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
  return mbedtls_sha256(data, length, digest, 0) == 0;
#else
  return mbedtls_sha256_ret(data, length, digest, 0) == 0;
#endif
}

bool verifyManifestSignature(const String& signedPayload, const String& signatureBase64Url) {
  if (!isReleasePublicKeyConfigured()) return false;

  std::vector<uint8_t> signature;
  if (!decodeBase64Url(signatureBase64Url, signature)) return false;

  uint8_t digest[32] = {};
  if (!sha256(reinterpret_cast<const uint8_t*>(signedPayload.c_str()), signedPayload.length(), digest)) {
    return false;
  }

  mbedtls_pk_context publicKey;
  mbedtls_pk_init(&publicKey);
  int parseResult = mbedtls_pk_parse_public_key(
    &publicKey,
    reinterpret_cast<const unsigned char*>(GERNETIX_RELEASE_PUBLIC_KEY_PEM),
    strlen(GERNETIX_RELEASE_PUBLIC_KEY_PEM) + 1);
  if (parseResult != 0) {
    mbedtls_pk_free(&publicKey);
    return false;
  }

  int verifyResult = mbedtls_pk_verify(
    &publicKey,
    MBEDTLS_MD_SHA256,
    digest,
    sizeof(digest),
    signature.data(),
    signature.size());
  mbedtls_pk_free(&publicKey);
  return verifyResult == 0;
}

void fail(FlashboxManifestValidationResult& result, const String& state, const String& error) {
  result.validationState = state;
  result.error = error;
  result.schemaValid = false;
  result.signatureVerified = false;
  result.hashVerified = false;
  result.artifactDownloadAllowed = false;
}

bool validateManifestUseCase(FlashboxManifestValidationResult& result) {
  if (!flashboxIsSupportedManifestType(result.manifestType)) {
    fail(result, "schema_failed", "unsupported_manifest_type");
    return false;
  }
  if (result.manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_INITIAL_BOOTSTRAP &&
      result.identityPolicy != GERNETIX_FLASHBOX_IDENTITY_POLICY_CREATE_NEW) {
    fail(result, "schema_failed", "initial_bootstrap_requires_new_identity_policy");
    return false;
  }
  if (flashboxIsKnownDeviceManifestType(result.manifestType) &&
      result.identityPolicy != GERNETIX_FLASHBOX_IDENTITY_POLICY_PRESERVE_EXISTING) {
    fail(result, "schema_failed", "known_device_flash_requires_preserve_identity_policy");
    return false;
  }
  if (flashboxIsKnownDeviceManifestType(result.manifestType) && result.targetDeviceId.length() == 0) {
    fail(result, "schema_failed", "known_device_flash_requires_target_device_id");
    return false;
  }
  if (result.manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_SELF_UPDATE &&
      result.identityPolicy.length() > 0 &&
      result.identityPolicy != GERNETIX_FLASHBOX_IDENTITY_POLICY_NOT_APPLICABLE) {
    fail(result, "schema_failed", "self_update_identity_policy_must_be_not_applicable");
    return false;
  }
  return true;
}

}  // namespace

bool flashboxIsSupportedManifestType(const String& type) {
  return type == GERNETIX_FLASHBOX_MANIFEST_TYPE_SELF_UPDATE ||
    type == GERNETIX_FLASHBOX_MANIFEST_TYPE_INITIAL_BOOTSTRAP ||
    type == GERNETIX_FLASHBOX_MANIFEST_TYPE_KNOWN_DEVICE_RECOVERY ||
    type == GERNETIX_FLASHBOX_MANIFEST_TYPE_BASISSOFTWARE_REFLASH ||
    type == GERNETIX_FLASHBOX_MANIFEST_TYPE_PROJECT_FIRMWARE;
}

bool flashboxIsKnownDeviceManifestType(const String& type) {
  return type == GERNETIX_FLASHBOX_MANIFEST_TYPE_KNOWN_DEVICE_RECOVERY ||
    type == GERNETIX_FLASHBOX_MANIFEST_TYPE_BASISSOFTWARE_REFLASH ||
    type == GERNETIX_FLASHBOX_MANIFEST_TYPE_PROJECT_FIRMWARE;
}

bool flashboxVerifyArtifactSha256Hex(const uint8_t* data, size_t length, const String& expectedSha256) {
  if (data == nullptr || !isHexSha256(expectedSha256)) return false;

  uint8_t digest[32] = {};
  if (!sha256(data, length, digest)) return false;
  return lowerHexSha256(digest) == lowerAscii(expectedSha256);
}

FlashboxManifestValidationResult flashboxValidateFirmwareManifestContract(const String& manifestJson) {
  FlashboxManifestValidationResult result = {
    "schema_pending",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    false,
    false,
    false,
    false,
  };

  result.manifestType = findJsonString(manifestJson, "manifest_type");
  if (result.manifestType.length() == 0) result.manifestType = findJsonString(manifestJson, "type");
  result.hardwareProfileId = findJsonString(manifestJson, "hardware_profile_id");
  if (result.hardwareProfileId.length() == 0) {
    result.hardwareProfileId = findJsonString(manifestJson, "target_hardware_profile_id");
  }
  result.artifactUrl = findJsonString(manifestJson, "artifact_url");
  if (result.artifactUrl.length() == 0) result.artifactUrl = findJsonString(manifestJson, "firmware_url");
  result.expectedSha256 = findJsonString(manifestJson, "sha256");
  result.signingKeyId = findJsonString(manifestJson, "signing_key_id");
  result.identityPolicy = findJsonString(manifestJson, "identity_policy");
  result.targetDeviceId = findJsonString(manifestJson, "target_device_id");
  result.useCase = findJsonString(manifestJson, "use_case");
  result.signatureBase64Url = findJsonString(manifestJson, "signature");
  if (result.signatureBase64Url.length() == 0) {
    result.signatureBase64Url = findJsonString(manifestJson, "manifest_signature");
  }
  result.signedPayload = findJsonString(manifestJson, "signed_payload");

  if (!validateManifestUseCase(result)) return result;
  if (result.manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_SELF_UPDATE &&
      result.hardwareProfileId != GERNETIX_FLASHBOX_HARDWARE_PROFILE_ID) {
    fail(result, "schema_failed", "self_update_hardware_profile_mismatch");
    return result;
  }
  if (result.hardwareProfileId.length() == 0) {
    fail(result, "schema_failed", "missing_hardware_profile_id");
    return result;
  }
  if (!isHttpsUrl(result.artifactUrl)) {
    fail(result, "schema_failed", "artifact_url_must_be_https");
    return result;
  }
  if (!isHexSha256(result.expectedSha256)) {
    fail(result, "schema_failed", "invalid_or_missing_sha256");
    return result;
  }
  if (result.signingKeyId != GERNETIX_FLASHBOX_RELEASE_PUBLIC_KEY_ID) {
    fail(result, "schema_failed", "unexpected_signing_key_id");
    return result;
  }
  if (result.signatureBase64Url.length() == 0) {
    fail(result, "schema_failed", "missing_manifest_signature");
    return result;
  }

  result.validationState = "schema_checked";
  result.schemaValid = true;
  if (result.signedPayload.length() == 0) result.signedPayload = buildSignedPayload(result);

  result.validationState = "signature_checking";
  if (!isReleasePublicKeyConfigured()) {
    fail(result, "signature_failed", "release_public_key_not_configured");
    return result;
  }
  if (!verifyManifestSignature(result.signedPayload, result.signatureBase64Url)) {
    fail(result, "signature_failed", "manifest_signature_invalid");
    return result;
  }

  result.validationState = "artifact_hash_pending";
  result.signatureVerified = true;
  result.hashVerified = false;
  result.artifactDownloadAllowed = true;
  result.validationState = "ready_for_artifact_download";
  return result;
}
