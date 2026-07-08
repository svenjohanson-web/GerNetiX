#include <cstring>

#include "esp_check.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "nvs_flash.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"
#include "basissoftware/functions/startCaptiveDnsServer.h"
#include "basissoftware/functions/initWifi.h"

namespace {
constexpr const char *TAG = "initWifi";

void initNvs() {
  esp_err_t status = nvs_flash_init();

  if (status == ESP_ERR_NVS_NO_FREE_PAGES ||
      status == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    status = nvs_flash_init();
  }

  ESP_ERROR_CHECK(status);
}

void copyWifiString(uint8_t *target, size_t targetSize, const char *source) {
  std::strncpy(reinterpret_cast<char *>(target), source, targetSize);
  target[targetSize - 1] = '\0';
}
}

void initWifi() {
  static_assert(sizeof(WIFI_SETUP_AP_SSID) <= sizeof(wifi_ap_config_t::ssid),
                "WiFi setup AP SSID is too long");

  initNvs();

  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());
  esp_netif_create_default_wifi_ap();

  wifi_init_config_t initConfig = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&initConfig));

  wifi_config_t apConfig = {};
  copyWifiString(apConfig.ap.ssid, sizeof(apConfig.ap.ssid), WIFI_SETUP_AP_SSID);
  apConfig.ap.ssid_len = std::strlen(WIFI_SETUP_AP_SSID);
  apConfig.ap.channel = WIFI_SETUP_AP_CHANNEL;
  apConfig.ap.max_connection = WIFI_SETUP_AP_MAX_CONNECTIONS;
  apConfig.ap.ssid_hidden = 0;
  apConfig.ap.authmode = WIFI_AUTH_OPEN;

  if (std::strlen(WIFI_SETUP_AP_PASSWORD) > 0) {
    copyWifiString(
        apConfig.ap.password,
        sizeof(apConfig.ap.password),
        WIFI_SETUP_AP_PASSWORD);
    apConfig.ap.authmode = WIFI_AUTH_WPA2_PSK;
  }

  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &apConfig));
  ESP_ERROR_CHECK(esp_wifi_start());
  startCaptiveDnsServer();

  feedbackInfo(
      TAG,
      "WiFi setup AP started: ssid=%s channel=%u captive=%s",
      WIFI_SETUP_AP_SSID,
      WIFI_SETUP_AP_CHANNEL,
      CAPTIVE_PORTAL_AP_IP);
}
