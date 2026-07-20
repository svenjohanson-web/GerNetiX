#pragma once

#include <cstddef>

#ifndef GERNETIX_FLASHBOX_FIRMWARE_VERSION
#define GERNETIX_FLASHBOX_FIRMWARE_VERSION "0.1.0-dev"
#endif

#ifndef GERNETIX_FLASHBOX_HARDWARE_PROFILE_ID
#define GERNETIX_FLASHBOX_HARDWARE_PROFILE_ID "hardware.flashbox.esp32_s3_usb_helper"
#endif

static constexpr const char* GERNETIX_FLASHBOX_ROLE = "flashbox";
static constexpr const char* GERNETIX_FLASHBOX_UI_MODE = "displayless_http_serial_helper";
static constexpr const char* GERNETIX_FLASHBOX_HOST_PORT_ROLE = "control_upstream_power_and_service";
static constexpr const char* GERNETIX_FLASHBOX_TARGET_PORT_ROLE = "target_downstream_usb_host";
static constexpr const char* GERNETIX_FLASHBOX_DISCOVERY_SERVICE = "gernetix-flashbox";
static constexpr const char* GERNETIX_FLASHBOX_SETUP_AP_PREFIX = "GerNetiX-Flashbox-";
static constexpr const char* GERNETIX_FLASHBOX_CLAIM_MODE = "wlan_visible_challenge";
static constexpr const char* GERNETIX_FLASHBOX_DEVICE_KEY_POLICY = "device_private_key_non_exportable";
static constexpr const char* GERNETIX_FLASHBOX_RELEASE_PUBLIC_KEY_ID = "gernetix_flashbox_release_key.v1";
static constexpr const char* GERNETIX_FLASHBOX_DEFAULT_MANIFEST_URL = "https://vps.gernetix.example/firmware/flashbox/latest/manifest.json";
static constexpr const char* GERNETIX_FLASHBOX_MANIFEST_TYPE_SELF_UPDATE = "flashbox_self_update";
static constexpr const char* GERNETIX_FLASHBOX_MANIFEST_TYPE_INITIAL_BOOTSTRAP = "initial_bootstrap_flash";
static constexpr const char* GERNETIX_FLASHBOX_MANIFEST_TYPE_KNOWN_DEVICE_RECOVERY = "known_device_recovery_flash";
static constexpr const char* GERNETIX_FLASHBOX_MANIFEST_TYPE_BASISSOFTWARE_REFLASH = "basissoftware_reflash";
static constexpr const char* GERNETIX_FLASHBOX_MANIFEST_TYPE_PROJECT_FIRMWARE = "project_firmware_flash";
static constexpr const char* GERNETIX_FLASHBOX_IDENTITY_POLICY_CREATE_NEW = "create_new_device_identity";
static constexpr const char* GERNETIX_FLASHBOX_IDENTITY_POLICY_PRESERVE_EXISTING = "preserve_existing_device_identity";
static constexpr const char* GERNETIX_FLASHBOX_IDENTITY_POLICY_NOT_APPLICABLE = "not_applicable";
static constexpr const int GERNETIX_FLASHBOX_MAX_CHALLENGE_BYTES = 512;
static constexpr const int GERNETIX_FLASHBOX_MAX_MANIFEST_BYTES = 8192;
static constexpr const int GERNETIX_FLASHBOX_HTTPS_TIMEOUT_MS = 15000;
static constexpr const size_t GERNETIX_FLASHBOX_JSON_RESPONSE_BUFFER_BYTES = 3072;
static constexpr const int GERNETIX_FLASHBOX_TARGET_POLL_INTERVAL_MS = 1000;
static constexpr const char* GERNETIX_FLASHBOX_TARGET_DETECTION_BACKEND = "usb_otg_host_preflight";
static constexpr const char* GERNETIX_FLASHBOX_TARGET_BOOTLOADER_POLICY = "rom_bootloader_required_before_flash";
static constexpr const char* GERNETIX_FLASHBOX_ESPRESSIF_USB_VID_HEX = "303A";
static constexpr const char* GERNETIX_FLASHBOX_USB_SERIAL_BRIDGE_POLICY = "usb_serial_bridge_detected_requires_bootloader_handshake";
static constexpr const char* GERNETIX_FLASHBOX_USB_VBUS_POWER_MODE = "two_usb_s3_helper_target_vbus_pending_verification";
static constexpr const char* GERNETIX_FLASHBOX_USB_TARGET_POWER_POLICY = "unpowered_targets_allowed_only_after_dedicated_target_port_vbus_verification";
static constexpr const char* GERNETIX_FLASHBOX_POWER_SWITCHING_MODE = "two_usb_s3_helper_power_profile_pending_hardware_verification";
static constexpr const char* GERNETIX_FLASHBOX_POWER_SWITCHING_POLICY = "target_vbus_switching_must_be_verified_on_new_two_usb_s3_board";

#ifndef GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN
#define GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN -1
#endif

#ifndef GERNETIX_FLASHBOX_USB_VBUS_BOOST_ENABLE_PIN
#define GERNETIX_FLASHBOX_USB_VBUS_BOOST_ENABLE_PIN -1
#endif

#ifndef GERNETIX_FLASHBOX_USB_VBUS_SOURCE_SELECT_PIN
#define GERNETIX_FLASHBOX_USB_VBUS_SOURCE_SELECT_PIN -1
#endif

#ifndef GERNETIX_FLASHBOX_USB_VBUS_CURRENT_LIMIT_ENABLE_PIN
#define GERNETIX_FLASHBOX_USB_VBUS_CURRENT_LIMIT_ENABLE_PIN -1
#endif

#ifndef GERNETIX_FLASHBOX_BATTERY_ADC_PIN
#define GERNETIX_FLASHBOX_BATTERY_ADC_PIN -1
#endif

#ifndef GERNETIX_FLASHBOX_BATTERY_VOLTAGE_DIVIDER_NUMERATOR
#define GERNETIX_FLASHBOX_BATTERY_VOLTAGE_DIVIDER_NUMERATOR 2
#endif

#ifndef GERNETIX_FLASHBOX_BATTERY_VOLTAGE_DIVIDER_DENOMINATOR
#define GERNETIX_FLASHBOX_BATTERY_VOLTAGE_DIVIDER_DENOMINATOR 1
#endif

#ifndef GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED
#define GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED 1
#endif

#ifndef GERNETIX_FLASHBOX_DISPLAY_ENABLED
#define GERNETIX_FLASHBOX_DISPLAY_ENABLED 0
#endif

#ifndef GERNETIX_FLASHBOX_DISPLAY_DRIVER_ILI9341
#define GERNETIX_FLASHBOX_DISPLAY_DRIVER_ILI9341 0
#endif

static constexpr const char* GERNETIX_FLASHBOX_DISPLAY_PROFILE_ID = "display.none.displayless_helper";

// Development placeholder only.
// The production key must be replaced by the GerNetiX release public key.
static constexpr const char* GERNETIX_RELEASE_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\n"
  "DEVELOPMENT_PLACEHOLDER_REPLACE_WITH_PRODUCTION_RELEASE_PUBLIC_KEY\n"
  "-----END PUBLIC KEY-----\n";

// Development placeholder only.
// Replace with a pinned production CA or pinned GerNetiX TLS trust anchor before production release.
static constexpr const char* GERNETIX_FLASHBOX_HTTPS_ROOT_CA_PEM =
  "-----BEGIN CERTIFICATE-----\n"
  "DEVELOPMENT_PLACEHOLDER_REPLACE_WITH_PRODUCTION_TLS_ROOT_CA\n"
  "-----END CERTIFICATE-----\n";
