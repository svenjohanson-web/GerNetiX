#include "nexi/personal_voice_profile_store.h"

#include <cstring>

#include "esp_heap_caps.h"
#include "nvs.h"
#include "nvs_flash.h"

namespace nexi {
namespace {
constexpr const char* kPartition = "nexivoice2";
constexpr const char* kLegacyPartition = "nexivoice";
constexpr const char* kNamespace = "profiles";

esp_err_t ensurePartition(const char* partition, bool allowRepair) {
  esp_err_t result = nvs_flash_init_partition(partition);
  if (allowRepair && (result == ESP_ERR_NVS_NO_FREE_PAGES ||
      result == ESP_ERR_NVS_NEW_VERSION_FOUND)) {
    result = nvs_flash_erase_partition(partition);
    if (result == ESP_OK) result = nvs_flash_init_partition(partition);
  }
  return result;
}

esp_err_t ensureProfilePartition() {
  return ensurePartition(kPartition, true);
}

uint8_t* allocateProfileBuffer() {
  return static_cast<uint8_t*>(heap_caps_malloc(
      PersonalWakeWordDetector::kMaximumSerializedProfileBytes,
      MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
}

void releaseProfileBuffer(uint8_t* buffer) {
  if (buffer == nullptr) return;
  std::memset(buffer, 0,
      PersonalWakeWordDetector::kMaximumSerializedProfileBytes);
  heap_caps_free(buffer);
}

VoiceProfileLoadResult loadFromPartition(
    const char* partition, const char* key,
    PersonalWakeWordDetector* detector) {
  nvs_handle_t handle = 0;
  const esp_err_t openResult = nvs_open_from_partition(
      partition, kNamespace, NVS_READONLY, &handle);
  if (openResult == ESP_ERR_NVS_NOT_FOUND) return VoiceProfileLoadResult::Missing;
  if (openResult != ESP_OK) return VoiceProfileLoadResult::Error;

  size_t size = 0;
  esp_err_t result = nvs_get_blob(handle, key, nullptr, &size);
  if (result == ESP_ERR_NVS_NOT_FOUND) {
    nvs_close(handle);
    return VoiceProfileLoadResult::Missing;
  }
  if (result != ESP_OK || size == 0 ||
      size > PersonalWakeWordDetector::kMaximumSerializedProfileBytes) {
    nvs_close(handle);
    return VoiceProfileLoadResult::Invalid;
  }
  uint8_t* buffer = allocateProfileBuffer();
  if (buffer == nullptr) {
    nvs_close(handle);
    return VoiceProfileLoadResult::Error;
  }
  result = nvs_get_blob(handle, key, buffer, &size);
  nvs_close(handle);
  const bool imported = result == ESP_OK && detector->importProfile(buffer, size);
  releaseProfileBuffer(buffer);
  return result != ESP_OK ? VoiceProfileLoadResult::Error
                          : imported ? VoiceProfileLoadResult::Loaded
                                     : VoiceProfileLoadResult::Invalid;
}

bool eraseFromPartition(const char* partition, const char* key) {
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open_from_partition(
      partition, kNamespace, NVS_READWRITE, &handle);
  if (result == ESP_ERR_NVS_NOT_FOUND) return true;
  if (result != ESP_OK) return false;
  result = nvs_erase_key(handle, key);
  if (result == ESP_ERR_NVS_NOT_FOUND) result = ESP_OK;
  if (result == ESP_OK) result = nvs_commit(handle);
  nvs_close(handle);
  return result == ESP_OK;
}
}  // namespace

VoiceProfileLoadResult PersonalVoiceProfileStore::load(
    const char* key, PersonalWakeWordDetector* detector) const {
  if (key == nullptr || detector == nullptr) return VoiceProfileLoadResult::Error;
  if (ensureProfilePartition() != ESP_OK) return VoiceProfileLoadResult::Error;
  VoiceProfileLoadResult result = loadFromPartition(kPartition, key, detector);
  if (result != VoiceProfileLoadResult::Missing) return result;

  // One-way migration preserves profiles written by the first dedicated
  // 60-KiB partition layout. The old copy is erased only after the new write.
  if (ensurePartition(kLegacyPartition, false) != ESP_OK) return result;
  result = loadFromPartition(kLegacyPartition, key, detector);
  if (result == VoiceProfileLoadResult::Loaded && save(key, *detector)) {
    eraseFromPartition(kLegacyPartition, key);
  }
  return result;
}

bool PersonalVoiceProfileStore::save(
    const char* key, const PersonalWakeWordDetector& detector) const {
  if (key == nullptr || !detector.ready()) return false;
  if (ensureProfilePartition() != ESP_OK) return false;
  uint8_t* buffer = allocateProfileBuffer();
  if (buffer == nullptr) return false;
  size_t size = 0;
  const bool exported = detector.exportProfile(
      buffer, PersonalWakeWordDetector::kMaximumSerializedProfileBytes, &size);
  if (!exported) {
    releaseProfileBuffer(buffer);
    return false;
  }
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open_from_partition(
      kPartition, kNamespace, NVS_READWRITE, &handle);
  if (result == ESP_OK) result = nvs_set_blob(handle, key, buffer, size);
  if (result == ESP_OK) result = nvs_commit(handle);
  if (handle != 0) nvs_close(handle);
  releaseProfileBuffer(buffer);
  return result == ESP_OK;
}

bool PersonalVoiceProfileStore::erase(const char* key) const {
  if (key == nullptr) return false;
  if (ensureProfilePartition() != ESP_OK) return false;
  const bool currentErased = eraseFromPartition(kPartition, key);
  const bool legacyReady = ensurePartition(kLegacyPartition, false) == ESP_OK;
  return currentErased && (!legacyReady || eraseFromPartition(kLegacyPartition, key));
}

bool PersonalVoiceProfileStore::eraseLegacyDefault(const char* key) const {
  if (key == nullptr) return false;
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open("nexi_voice", NVS_READWRITE, &handle);
  if (result == ESP_ERR_NVS_NOT_FOUND) return true;
  if (result != ESP_OK) return false;
  result = nvs_erase_key(handle, key);
  if (result == ESP_ERR_NVS_NOT_FOUND) result = ESP_OK;
  if (result == ESP_OK) result = nvs_commit(handle);
  nvs_close(handle);
  return result == ESP_OK;
}

bool PersonalVoiceProfileStore::eraseAll() const {
  if (ensureProfilePartition() != ESP_OK) return false;
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open_from_partition(
      kPartition, kNamespace, NVS_READWRITE, &handle);
  if (result != ESP_OK) return result == ESP_ERR_NVS_NOT_FOUND;
  result = nvs_erase_all(handle);
  if (result == ESP_OK) result = nvs_commit(handle);
  nvs_close(handle);
  const bool currentErased = result == ESP_OK;
  if (ensurePartition(kLegacyPartition, false) != ESP_OK) return currentErased;
  nvs_handle_t legacyHandle = 0;
  result = nvs_open_from_partition(
      kLegacyPartition, kNamespace, NVS_READWRITE, &legacyHandle);
  if (result == ESP_ERR_NVS_NOT_FOUND) return currentErased;
  if (result != ESP_OK) return false;
  result = nvs_erase_all(legacyHandle);
  if (result == ESP_OK) result = nvs_commit(legacyHandle);
  nvs_close(legacyHandle);
  return currentErased && result == ESP_OK;
}

}  // namespace nexi
