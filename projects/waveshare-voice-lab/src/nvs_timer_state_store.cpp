#include "nexi/nvs_timer_state_store.h"

#include <array>

#include "nvs.h"

namespace nexi {
namespace {
constexpr const char* kNamespace = "nexi_timer";
constexpr const char* kStateKey = "state";
}

TimerStateLoadResult NvsTimerStateStore::load(TimerState* state) {
  if (state == nullptr) return TimerStateLoadResult::Error;
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open(kNamespace, NVS_READONLY, &handle);
  if (result == ESP_ERR_NVS_NOT_FOUND) return TimerStateLoadResult::Missing;
  if (result != ESP_OK) return TimerStateLoadResult::Error;
  size_t size = 0;
  result = nvs_get_blob(handle, kStateKey, nullptr, &size);
  if (result == ESP_ERR_NVS_NOT_FOUND) {
    nvs_close(handle);
    return TimerStateLoadResult::Missing;
  }
  if (result != ESP_OK || size == 0 || size > TimerStateCodec::kMaximumEncodedSize) {
    nvs_close(handle);
    return TimerStateLoadResult::Invalid;
  }
  std::array<uint8_t, TimerStateCodec::kMaximumEncodedSize> data{};
  result = nvs_get_blob(handle, kStateKey, data.data(), &size);
  nvs_close(handle);
  return result == ESP_OK ? TimerStateCodec::decode(data.data(), size, state)
                          : TimerStateLoadResult::Error;
}

bool NvsTimerStateStore::save(const TimerState& state) {
  std::array<uint8_t, TimerStateCodec::kEncodedSize> data{};
  size_t size = 0;
  if (!TimerStateCodec::encode(state, data.data(), data.size(), &size)) {
    return false;
  }
  nvs_handle_t handle = 0;
  esp_err_t result = nvs_open(kNamespace, NVS_READWRITE, &handle);
  if (result == ESP_OK) result = nvs_set_blob(handle, kStateKey, data.data(), size);
  if (result == ESP_OK) result = nvs_commit(handle);
  if (handle != 0) nvs_close(handle);
  return result == ESP_OK;
}

bool NvsTimerStateStore::erase() {
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
