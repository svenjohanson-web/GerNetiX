#pragma once

#include <cstdint>

constexpr uint32_t SERIAL_BAUD_RATE = 115200;
constexpr uint8_t STATUS_LED_PIN = 2;
constexpr uint32_t STATUS_INTERVAL_MS = 1000;

constexpr char GERNETIX_RUNTIME_NAME[] = "basissoftware/esp32";
constexpr char GERNETIX_FIRMWARE_BASIS[] = "gernetix-runtime-basissoftware";
constexpr char GERNETIX_BASISSOFTWARE_VERSION[] = "0.3.0";
#if defined(GERNETIX_BASISSOFTWARE_PROFILE_MEDIUM)
constexpr char GERNETIX_BASISSOFTWARE_VARIANT[] = "medium";
#elif defined(GERNETIX_BASISSOFTWARE_PROFILE_LOW)
constexpr char GERNETIX_BASISSOFTWARE_VARIANT[] = "low";
#else
constexpr char GERNETIX_BASISSOFTWARE_VARIANT[] = "full";
#endif
constexpr const char *GERNETIX_RUNTIME_VERSION = GERNETIX_BASISSOFTWARE_VERSION;

constexpr char WIFI_SETUP_AP_SSID[] = "GerNetiX-Setup";
constexpr char WIFI_SETUP_AP_PASSWORD[] = "";
constexpr char WIFI_STATION_HOSTNAME[] = "gernetix-esp32";
constexpr uint8_t WIFI_SETUP_AP_CHANNEL = 6;
constexpr uint8_t WIFI_SETUP_AP_MAX_CONNECTIONS = 4;
constexpr char CAPTIVE_PORTAL_AP_IP[] = "192.168.4.1";
constexpr uint16_t CAPTIVE_PORTAL_DNS_PORT = 53;
constexpr uint16_t DEVICE_WEB_SERVER_PORT = 80;
constexpr uint16_t DEVICE_WEB_SERVER_CONTROL_PORT = 32768;
