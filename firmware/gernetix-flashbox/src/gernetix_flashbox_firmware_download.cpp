#include "gernetix_flashbox_firmware_download.h"

#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <mbedtls/sha256.h>
#include <mbedtls/version.h>

#include "gernetix/runtime_core.h"
#include "gernetix_flashbox_config.h"
#include "gernetix_flashbox_display.h"
#include "gernetix_flashbox_json_response.h"
#include "gernetix_flashbox_manifest_validator.h"
#include "gernetix_flashbox_write_state_machine.h"

namespace {

FlashboxFirmwareDownloadStatus status = {
  "idle",
  "idle",
  GERNETIX_FLASHBOX_DEFAULT_MANIFEST_URL,
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
  0,
  0,
  0,
  0,
  false,
  false,
  false,
  false,
  false,
};

bool isHttpsUrl(const String& url) {
  return url.startsWith("https://");
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

void resetResult(const String& manifestUrl) {
  status.state = "loading_manifest";
  status.validationState = "manifest_not_checked";
  status.manifestUrl = manifestUrl;
  status.manifestType = "";
  status.artifactUrl = "";
  status.expectedSha256 = "";
  status.signingKeyId = "";
  status.identityPolicy = "";
  status.targetDeviceId = "";
  status.useCase = "";
  status.writeState = "";
  status.writeRoute = "";
  status.error = "";
  status.httpStatus = 0;
  status.artifactHttpStatus = 0;
  status.manifestBytes = 0;
  status.artifactBytes = 0;
  status.manifestLoaded = false;
  status.signatureVerified = false;
  status.hashVerified = false;
  status.artifactDownloadAllowed = false;
  status.artifactWriteAllowed = false;
}

bool validateManifestContract(const String& manifest) {
  FlashboxManifestValidationResult result = flashboxValidateFirmwareManifestContract(manifest);
  status.validationState = result.validationState;
  status.manifestType = result.manifestType;
  status.artifactUrl = result.artifactUrl;
  status.expectedSha256 = result.expectedSha256;
  status.signingKeyId = result.signingKeyId;
  status.identityPolicy = result.identityPolicy;
  status.targetDeviceId = result.targetDeviceId;
  status.useCase = result.useCase;
  status.error = result.error;
  status.signatureVerified = result.signatureVerified;
  status.hashVerified = result.hashVerified;
  status.artifactDownloadAllowed = result.artifactDownloadAllowed;
  status.artifactWriteAllowed = false;
  return result.artifactDownloadAllowed;
}

String nowText() {
  return String(millis());
}

bool updateSha256(mbedtls_sha256_context& context, const uint8_t* data, size_t length) {
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
  return mbedtls_sha256_update(&context, data, length) == 0;
#else
  return mbedtls_sha256_update_ret(&context, data, length) == 0;
#endif
}

bool finishSha256(mbedtls_sha256_context& context, uint8_t digest[32]) {
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
  return mbedtls_sha256_finish(&context, digest) == 0;
#else
  return mbedtls_sha256_finish_ret(&context, digest) == 0;
#endif
}

bool beginSha256(mbedtls_sha256_context& context) {
  mbedtls_sha256_init(&context);
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
  return mbedtls_sha256_starts(&context, 0) == 0;
#else
  return mbedtls_sha256_starts_ret(&context, 0) == 0;
#endif
}

bool markWriteBlocked(const String& reason) {
  FlashboxWritePlan plan = flashboxPlanWriteAfterArtifactVerified(
    status.manifestType,
    status.signatureVerified,
    status.hashVerified);
  status.state = "write_blocked";
  status.validationState = plan.writeState.length() ? plan.writeState : "artifact_verified_write_blocked";
  status.writeState = plan.writeState;
  status.writeRoute = plan.writeRoute;
  status.error = plan.error.length() ? plan.error : reason;
  status.artifactWriteAllowed = plan.writeAllowed;
  flashboxDisplayShowClaimState("Artefakt", "Hash ok. Schreiben ist noch gesperrt.");
  return false;
}

}  // namespace

void flashboxFirmwareDownloadBegin() {
  status.state = "idle";
  status.validationState = "idle";
  status.manifestUrl = GERNETIX_FLASHBOX_DEFAULT_MANIFEST_URL;
  status.artifactWriteAllowed = false;
}

FlashboxFirmwareDownloadStatus flashboxFirmwareDownloadStatus() {
  return status;
}

bool flashboxFetchFirmwareManifest(const String& manifestUrl) {
  resetResult(manifestUrl.length() ? manifestUrl : String(GERNETIX_FLASHBOX_DEFAULT_MANIFEST_URL));
  status.lastCheckedAt = nowText();

  if (!isHttpsUrl(status.manifestUrl)) {
    status.state = "blocked";
    status.error = "manifest_url_must_be_https";
    flashboxDisplayShowError("manifest_url", "Firmware-Manifest muss HTTPS verwenden.");
    return false;
  }

  WiFiClientSecure client;
  client.setCACert(GERNETIX_FLASHBOX_HTTPS_ROOT_CA_PEM);
  HTTPClient http;
  http.setTimeout(GERNETIX_FLASHBOX_HTTPS_TIMEOUT_MS);
  if (!http.begin(client, status.manifestUrl)) {
    status.state = "failed";
    status.error = "manifest_http_begin_failed";
    flashboxDisplayShowError("manifest", "HTTPS-Client konnte nicht gestartet werden.");
    return false;
  }

  status.httpStatus = http.GET();
  if (status.httpStatus != HTTP_CODE_OK) {
    http.end();
    status.state = "failed";
    status.error = "manifest_http_status";
    flashboxDisplayShowError("manifest", "Manifest konnte nicht geladen werden.");
    return false;
  }

  String manifest = http.getString();
  http.end();
  status.manifestBytes = manifest.length();
  if (manifest.length() == 0 || manifest.length() > GERNETIX_FLASHBOX_MAX_MANIFEST_BYTES) {
    status.state = "failed";
    status.error = "manifest_size_invalid";
    flashboxDisplayShowError("manifest", "Manifest ist leer oder zu gross.");
    return false;
  }

  status.manifestLoaded = true;
  status.state = "manifest_loaded";
  if (!validateManifestContract(manifest)) {
    status.state = "blocked";
    flashboxDisplayShowError("manifest", status.error);
    return false;
  }

  status.state = "verified";
  flashboxDisplayShowClaimState("Manifest", "Signatur geprueft, Artefakt-Hash ausstehend.");
  return true;
}

bool flashboxDownloadAndVerifyFirmwareArtifact() {
  status.lastCheckedAt = nowText();
  status.artifactHttpStatus = 0;
  status.artifactBytes = 0;
  status.hashVerified = false;
  status.artifactWriteAllowed = false;

  if (!status.artifactDownloadAllowed || !status.signatureVerified) {
    status.state = "blocked";
    status.validationState = "artifact_download_blocked";
    status.error = "artifact_download_requires_verified_manifest";
    flashboxDisplayShowError("artifact", "Manifest ist nicht verifiziert.");
    return false;
  }
  if (!isHttpsUrl(status.artifactUrl)) {
    status.state = "blocked";
    status.validationState = "artifact_download_blocked";
    status.error = "artifact_url_must_be_https";
    flashboxDisplayShowError("artifact", "Artefakt muss HTTPS verwenden.");
    return false;
  }

  status.state = "artifact_downloading";
  status.validationState = "artifact_streaming_sha256";

  WiFiClientSecure client;
  client.setCACert(GERNETIX_FLASHBOX_HTTPS_ROOT_CA_PEM);
  HTTPClient http;
  http.setTimeout(GERNETIX_FLASHBOX_HTTPS_TIMEOUT_MS);
  if (!http.begin(client, status.artifactUrl)) {
    status.state = "failed";
    status.validationState = "artifact_download_failed";
    status.error = "artifact_http_begin_failed";
    flashboxDisplayShowError("artifact", "HTTPS-Client konnte nicht gestartet werden.");
    return false;
  }

  status.artifactHttpStatus = http.GET();
  if (status.artifactHttpStatus != HTTP_CODE_OK) {
    http.end();
    status.state = "failed";
    status.validationState = "artifact_download_failed";
    status.error = "artifact_http_status";
    flashboxDisplayShowError("artifact", "Artefakt konnte nicht geladen werden.");
    return false;
  }

  mbedtls_sha256_context shaContext;
  if (!beginSha256(shaContext)) {
    http.end();
    status.state = "failed";
    status.validationState = "artifact_hash_failed";
    status.error = "artifact_sha256_begin_failed";
    flashboxDisplayShowError("artifact", "SHA-256 konnte nicht gestartet werden.");
    return false;
  }

  uint8_t buffer[1024] = {};
  WiFiClient* stream = http.getStreamPtr();
  int remaining = http.getSize();
  while (http.connected() && (remaining > 0 || remaining == -1)) {
    size_t available = stream->available();
    if (available == 0) {
      delay(1);
      continue;
    }
    size_t chunkSize = available > sizeof(buffer) ? sizeof(buffer) : available;
    int readBytes = stream->readBytes(buffer, chunkSize);
    if (readBytes <= 0) {
      status.state = "failed";
      status.validationState = "artifact_download_failed";
      status.error = "artifact_stream_read_failed";
      mbedtls_sha256_free(&shaContext);
      http.end();
      flashboxDisplayShowError("artifact", "Artefakt-Stream abgebrochen.");
      return false;
    }
    if (!updateSha256(shaContext, buffer, static_cast<size_t>(readBytes))) {
      status.state = "failed";
      status.validationState = "artifact_hash_failed";
      status.error = "artifact_sha256_update_failed";
      mbedtls_sha256_free(&shaContext);
      http.end();
      flashboxDisplayShowError("artifact", "SHA-256 Update fehlgeschlagen.");
      return false;
    }
    status.artifactBytes += static_cast<size_t>(readBytes);
    if (remaining > 0) remaining -= readBytes;
  }

  uint8_t digest[32] = {};
  if (!finishSha256(shaContext, digest)) {
    mbedtls_sha256_free(&shaContext);
    http.end();
    status.state = "failed";
    status.validationState = "artifact_hash_failed";
    status.error = "artifact_sha256_finish_failed";
    flashboxDisplayShowError("artifact", "SHA-256 Abschluss fehlgeschlagen.");
    return false;
  }
  mbedtls_sha256_free(&shaContext);
  http.end();

  status.validationState = "artifact_hash_checking";
  if (status.artifactBytes == 0) {
    status.state = "failed";
    status.validationState = "artifact_hash_failed";
    status.error = "artifact_empty";
    flashboxDisplayShowError("artifact", "Artefakt ist leer.");
    return false;
  }
  if (lowerHexSha256(digest) != lowerAscii(status.expectedSha256)) {
    status.state = "blocked";
    status.validationState = "artifact_hash_failed";
    status.error = "artifact_sha256_mismatch";
    flashboxDisplayShowError("artifact", "Artefakt-Hash passt nicht.");
    return false;
  }

  status.hashVerified = true;
  status.state = "artifact_verified";
  status.validationState = "artifact_hash_verified";
  return markWriteBlocked("artifact_write_state_machine_not_implemented");
}

String flashboxFirmwareDownloadStatusJson() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "state", status.state.c_str());
  gernetix::runtime::jsonAppendString(writer, "validation_state", status.validationState.c_str());
  gernetix::runtime::jsonAppendString(writer, "manifest_url", status.manifestUrl.c_str());
  gernetix::runtime::jsonAppendString(writer, "manifest_type", status.manifestType.c_str());
  gernetix::runtime::jsonAppendString(writer, "artifact_url", status.artifactUrl.c_str());
  gernetix::runtime::jsonAppendString(writer, "sha256", status.expectedSha256.c_str());
  gernetix::runtime::jsonAppendString(writer, "signing_key_id", status.signingKeyId.c_str());
  gernetix::runtime::jsonAppendString(writer, "identity_policy", status.identityPolicy.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_device_id", status.targetDeviceId.c_str());
  gernetix::runtime::jsonAppendString(writer, "use_case", status.useCase.c_str());
  gernetix::runtime::jsonAppendString(writer, "write_state", status.writeState.c_str());
  gernetix::runtime::jsonAppendString(writer, "write_route", status.writeRoute.c_str());
  gernetix::runtime::jsonAppendString(writer, "error", status.error.c_str());
  gernetix::runtime::jsonAppendString(writer, "last_checked_at_ms", status.lastCheckedAt.c_str());
  flashboxJsonAppendInt(writer, "http_status", status.httpStatus);
  flashboxJsonAppendInt(writer, "artifact_http_status", status.artifactHttpStatus);
  flashboxJsonAppendUnsigned(writer, "manifest_bytes", static_cast<unsigned>(status.manifestBytes));
  flashboxJsonAppendUnsigned(writer, "artifact_bytes", static_cast<unsigned>(status.artifactBytes));
  gernetix::runtime::jsonAppendBool(writer, "manifest_loaded", status.manifestLoaded);
  gernetix::runtime::jsonAppendBool(writer, "signature_verified", status.signatureVerified);
  gernetix::runtime::jsonAppendBool(writer, "hash_verified", status.hashVerified);
  gernetix::runtime::jsonAppendBool(writer, "artifact_download_allowed", status.artifactDownloadAllowed);
  gernetix::runtime::jsonAppendBool(writer, "artifact_write_allowed", status.artifactWriteAllowed);
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}
