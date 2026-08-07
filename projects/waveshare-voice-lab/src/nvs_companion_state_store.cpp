#include "nexi/nvs_companion_state_store.h"

#include <array>

#include "nvs.h"

namespace nexi {
namespace {
constexpr const char* kNamespace = "nexi_friend";
// The key remains stable across schema versions; the checked blob version
// drives migration so an old state is still discoverable after an update.
constexpr const char* kStateKey = "state";
}

CompanionStateLoadResult NvsCompanionStateStore::load(CompanionState* state) {
  if (state == nullptr) return CompanionStateLoadResult::Error;
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open(kNamespace, NVS_READONLY, &handle);
  if (result == ESP_ERR_NVS_NOT_FOUND) return CompanionStateLoadResult::Missing;
  if (result != ESP_OK) return CompanionStateLoadResult::Error;
  size_t size = 0;
  result = nvs_get_blob(handle, kStateKey, nullptr, &size);
  if (result == ESP_ERR_NVS_NOT_FOUND) {
    nvs_close(handle);
    return CompanionStateLoadResult::Missing;
  }
  if (result != ESP_OK || size == 0 ||
      size > CompanionStateCodec::kMaximumEncodedSize) {
    nvs_close(handle);
    return CompanionStateLoadResult::Invalid;
  }
  std::array<uint8_t, CompanionStateCodec::kMaximumEncodedSize> data{};
  result = nvs_get_blob(handle, kStateKey, data.data(), &size);
  nvs_close(handle);
  return result == ESP_OK
      ? CompanionStateCodec::decode(data.data(), size, state)
      : CompanionStateLoadResult::Error;
}

bool NvsCompanionStateStore::save(const CompanionState& state) {
  std::array<uint8_t, CompanionStateCodec::kEncodedSize> data{};
  size_t size = 0;
  if (!CompanionStateCodec::encode(
          state, data.data(), data.size(), &size)) {
    return false;
  }
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open(kNamespace, NVS_READWRITE, &handle);
  if (result == ESP_OK) result = nvs_set_blob(handle, kStateKey, data.data(), size);
  if (result == ESP_OK) result = nvs_commit(handle);
  if (handle != 0) nvs_close(handle);
  return result == ESP_OK;
}

bool NvsCompanionStateStore::erase() {
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open(kNamespace, NVS_READWRITE, &handle);
  if (result == ESP_ERR_NVS_NOT_FOUND) return true;
  if (result != ESP_OK) return false;
  result = nvs_erase_key(handle, kStateKey);
  if (result == ESP_ERR_NVS_NOT_FOUND) result = ESP_OK;
  if (result == ESP_OK) result = nvs_commit(handle);
  nvs_close(handle);
  return result == ESP_OK;
}

}  // namespace nexi
