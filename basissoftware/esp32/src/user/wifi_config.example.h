#pragma once

#define GERNETIX_WIFI_SSID "YOUR_WIFI_SSID"
#define GERNETIX_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define GERNETIX_OTA_HOSTNAME "gernetix-esp32-ota"

// node: connect to an existing WiFi network.
// access_point: create a local setup/provisioning WiFi network.
#define GERNETIX_WIFI_MODE_NODE 1
#define GERNETIX_WIFI_MODE_ACCESS_POINT 2
#define GERNETIX_WIFI_MODE GERNETIX_WIFI_MODE_NODE
#define GERNETIX_WIFI_CONNECT_TIMEOUT_MS 15000

#define GERNETIX_AP_SSID "GerNetiX-Setup"
#define GERNETIX_AP_PASSWORD "gernetix-setup"
#define GERNETIX_AP_CHANNEL 1
#define GERNETIX_AP_HIDDEN false
#define GERNETIX_AP_MAX_CLIENTS 4
