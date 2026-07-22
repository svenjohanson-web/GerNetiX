#include "gernetix_flashbox_provisioning.h"

#include <Preferences.h>
#include <mbedtls/base64.h>
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/ecp.h>
#include <mbedtls/entropy.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>
#include <mbedtls/version.h>

#include <vector>

#include "gernetix/runtime_core.h"
#include "gernetix_flashbox_json_response.h"

namespace {

Preferences preferences;
FlashboxProvisioningStatus state = { "not_provisioned", "", "", false, false, "" };

String jsonString(const String& json, const char* key) {
  const String marker = String("\"") + key + "\"";
  const int keyAt = json.indexOf(marker);
  const int colon = keyAt < 0 ? -1 : json.indexOf(':', keyAt + marker.length());
  const int start = colon < 0 ? -1 : json.indexOf('"', colon + 1);
  if (start < 0) return "";
  String value;
  bool escaping = false;
  for (int index = start + 1; index < json.length(); index += 1) {
    const char current = json.charAt(index);
    if (escaping) { value += current == 'n' ? '\n' : current; escaping = false; continue; }
    if (current == '\\') { escaping = true; continue; }
    if (current == '"') return value;
    value += current;
  }
  return "";
}

bool seedDrbg(mbedtls_ctr_drbg_context& drbg, mbedtls_entropy_context& entropy) {
  static const char purpose[] = "gernetix-flashbox-p256";
  return mbedtls_ctr_drbg_seed(&drbg, mbedtls_entropy_func, &entropy,
    reinterpret_cast<const unsigned char*>(purpose), sizeof(purpose) - 1) == 0;
}

bool generatePrivateKey(String& privateKey, String& publicKey) {
  mbedtls_entropy_context entropy; mbedtls_entropy_init(&entropy);
  mbedtls_ctr_drbg_context drbg; mbedtls_ctr_drbg_init(&drbg);
  mbedtls_pk_context key; mbedtls_pk_init(&key);
  bool ok = seedDrbg(drbg, entropy) && mbedtls_pk_setup(&key, mbedtls_pk_info_from_type(MBEDTLS_PK_ECKEY)) == 0;
  if (ok) ok = mbedtls_ecp_gen_key(MBEDTLS_ECP_DP_SECP256R1, mbedtls_pk_ec(key), mbedtls_ctr_drbg_random, &drbg) == 0;
  unsigned char privateBuffer[2048] = {}; unsigned char publicBuffer[1024] = {};
  if (ok) ok = mbedtls_pk_write_key_pem(&key, privateBuffer, sizeof(privateBuffer)) == 0;
  if (ok) ok = mbedtls_pk_write_pubkey_pem(&key, publicBuffer, sizeof(publicBuffer)) == 0;
  if (ok) { privateKey = reinterpret_cast<char*>(privateBuffer); publicKey = reinterpret_cast<char*>(publicBuffer); }
  mbedtls_pk_free(&key); mbedtls_ctr_drbg_free(&drbg); mbedtls_entropy_free(&entropy);
  return ok;
}

String base64Url(const uint8_t* data, size_t length) {
  size_t outputLength = 0;
  if (mbedtls_base64_encode(nullptr, 0, &outputLength, data, length) != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL) return "";
  std::vector<unsigned char> encoded(outputLength + 1, 0);
  if (mbedtls_base64_encode(encoded.data(), encoded.size(), &outputLength, data, length) != 0) return "";
  String result(reinterpret_cast<char*>(encoded.data())); result.replace('+', '-'); result.replace('/', '_');
  while (result.endsWith("=")) result.remove(result.length() - 1);
  return result;
}

void loadState() {
  state.deviceId = preferences.getString("device_id", "");
  state.mqttBroker = preferences.getString("mqtt_broker", "");
  state.privateKeyReady = preferences.getString("p256_key", "").length() > 0;
  state.clientCertificateReady = preferences.getString("mqtt_cert", "").length() > 0;
  state.state = state.clientCertificateReady ? "provisioned" : (state.privateKeyReady ? "identity_ready" : "not_provisioned");
}

bool ensureKey() {
  if (preferences.getString("p256_key", "").length() > 0) return true;
  String privateKey, publicKey;
  if (!generatePrivateKey(privateKey, publicKey)) { state.error = "p256_key_generation_failed"; return false; }
  // The key is never returned by an HTTP endpoint. Production hardware must enable NVS/flash encryption.
  if (!preferences.putString("p256_key", privateKey) || !preferences.putString("p256_pub", publicKey)) { state.error = "p256_key_store_failed"; return false; }
  return true;
}

}  // namespace

void flashboxProvisioningBegin() {
  preferences.begin("gnx-prov", false);
  loadState();
}

FlashboxProvisioningStatus flashboxProvisioningStatus() { return state; }

String flashboxProvisioningStatusJson() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "state", state.state.c_str());
  gernetix::runtime::jsonAppendString(writer, "device_id", state.deviceId.c_str());
  gernetix::runtime::jsonAppendString(writer, "mqtt_broker", state.mqttBroker.c_str());
  gernetix::runtime::jsonAppendBool(writer, "private_key_ready", state.privateKeyReady);
  gernetix::runtime::jsonAppendBool(writer, "mqtt_client_certificate_ready", state.clientCertificateReady);
  gernetix::runtime::jsonAppendString(writer, "error", state.error.c_str());
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}

String flashboxProvisioningApply(const String& payload, int& statusCode) {
  const String deviceId = jsonString(payload, "device_id");
  const String broker = jsonString(payload, "mqtt_broker");
  const String certificate = jsonString(payload, "mqtt_client_certificate_pem");
  if (deviceId.length() == 0) { statusCode = 400; return "{\"error\":\"missing_device_id\"}"; }
  if (!ensureKey()) { statusCode = 500; return "{\"error\":\"p256_key_generation_failed\"}"; }
  const String storedDeviceId = preferences.getString("device_id", "");
  if (storedDeviceId.length() > 0 && storedDeviceId != deviceId) { statusCode = 409; return "{\"error\":\"device_id_already_provisioned\"}"; }
  preferences.putString("device_id", deviceId);
  if (broker.length() > 0) preferences.putString("mqtt_broker", broker);
  if (certificate.length() > 0) preferences.putString("mqtt_cert", certificate);
  loadState(); statusCode = 200;
  String body = "{\"public_key_pem\":\"" + gernetix::runtime::jsonEscapeArduino(preferences.getString("p256_pub", "")) + "\",\"state\":\"" + state.state + "\"}";
  return body;
}

String flashboxSignProvisioningChallenge(const String& canonical, const String& requestedDeviceId) {
  if (requestedDeviceId.length() == 0 || requestedDeviceId != preferences.getString("device_id", "") || !ensureKey()) return "";
  uint8_t digest[32] = {};
#if defined(MBEDTLS_VERSION_MAJOR) && MBEDTLS_VERSION_MAJOR >= 3
  if (mbedtls_sha256(reinterpret_cast<const unsigned char*>(canonical.c_str()), canonical.length(), digest, 0) != 0) return "";
#else
  if (mbedtls_sha256_ret(reinterpret_cast<const unsigned char*>(canonical.c_str()), canonical.length(), digest, 0) != 0) return "";
#endif
  mbedtls_entropy_context entropy; mbedtls_entropy_init(&entropy); mbedtls_ctr_drbg_context drbg; mbedtls_ctr_drbg_init(&drbg); mbedtls_pk_context key; mbedtls_pk_init(&key);
  const String privateKey = preferences.getString("p256_key", "");
  bool ok = seedDrbg(drbg, entropy) && mbedtls_pk_parse_key(&key, reinterpret_cast<const unsigned char*>(privateKey.c_str()), privateKey.length() + 1, nullptr, 0) == 0;
  mbedtls_mpi r, s; mbedtls_mpi_init(&r); mbedtls_mpi_init(&s);
  if (ok) ok = mbedtls_ecdsa_sign(&mbedtls_pk_ec(key)->grp, &r, &s, &mbedtls_pk_ec(key)->d, digest, sizeof(digest), mbedtls_ctr_drbg_random, &drbg) == 0;
  uint8_t raw[64] = {}; if (ok) ok = mbedtls_mpi_write_binary(&r, raw, 32) == 0 && mbedtls_mpi_write_binary(&s, raw + 32, 32) == 0;
  const String signature = ok ? base64Url(raw, sizeof(raw)) : "";
  mbedtls_mpi_free(&r); mbedtls_mpi_free(&s); mbedtls_pk_free(&key); mbedtls_ctr_drbg_free(&drbg); mbedtls_entropy_free(&entropy);
  return signature;
}
