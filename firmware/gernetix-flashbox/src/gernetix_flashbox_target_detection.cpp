#include "gernetix_flashbox_target_detection.h"

#include "gernetix/runtime_core.h"
#include "gernetix_flashbox_config.h"
#include "gernetix_flashbox_display.h"
#include "gernetix_flashbox_json_response.h"

#if GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED
#include "esp_err.h"
#include "esp_intr_alloc.h"
#include "usb/usb_host.h"
#endif

namespace {

FlashboxTargetDeviceStatus status = {
  "idle",
  "not_connected",
  "unknown",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  GERNETIX_FLASHBOX_TARGET_DETECTION_BACKEND,
  GERNETIX_FLASHBOX_USB_VBUS_POWER_MODE,
  GERNETIX_FLASHBOX_USB_TARGET_POWER_POLICY,
  "",
  "",
  "",
  0,
  false,
  GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN >= 0,
  false,
  false,
};

unsigned long lastPollAt = 0;
String lastDisplayState;

#if GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED
usb_host_client_handle_t usbClientHandle = nullptr;
bool usbHostInstalled = false;
bool usbClientRegistered = false;
#endif

String nowText() {
  return String(millis());
}

String hex4(uint16_t value) {
  static constexpr char HEX_DIGITS[] = "0123456789ABCDEF";
  String result;
  result.reserve(4);
  result += HEX_DIGITS[(value >> 12) & 0x0F];
  result += HEX_DIGITS[(value >> 8) & 0x0F];
  result += HEX_DIGITS[(value >> 4) & 0x0F];
  result += HEX_DIGITS[value & 0x0F];
  return result;
}

bool isLikelyEspressifRomBootloader(uint16_t vid, uint16_t pid) {
  if (vid != 0x303A) return false;
  // Espressif native USB ROM / USB-Serial-JTAG devices share the Espressif VID.
  // The exact PID is board/chip/ROM dependent; the Flashbox treats it as a
  // bootloader candidate until the next preflight reads chip metadata.
  return pid != 0;
}

struct UsbTargetClassification {
  const char* targetKind;
  const char* targetDisplayName;
  const char* serialBridge;
  const char* chipFamily;
  const char* bootloaderState;
  const char* recommendedAction;
  const char* error;
  bool espRomBootloaderLikely;
};

UsbTargetClassification classifyUsbTarget(uint16_t vid, uint16_t pid) {
  if (vid == 0x303A) {
    const bool likelyBootloader = isLikelyEspressifRomBootloader(vid, pid);
    return {
      "esp32_native_usb",
      "ESP32 native USB",
      "native_usb",
      "esp32_s2_s3_c3_c6_candidate",
      likelyBootloader ? "rom_bootloader_candidate" : "esp32_native_usb_detected",
      "Wenn kein Flash moeglich ist: BOOT halten und RESET druecken.",
      likelyBootloader ? "chip_profile_read_not_implemented" : "native_usb_bootloader_state_unknown",
      likelyBootloader,
    };
  }
  if (vid == 0x1A86 && (pid == 0x7523 || pid == 0x5523 || pid == 0x55D4)) {
    return {
      "usb_serial_bridge",
      "Arduino Nano / ESP via CH340",
      pid == 0x55D4 ? "wch_ch9102" : "wch_ch340",
      "arduino_nano_esp32_esp8266_candidate",
      "serial_bridge_detected",
      "Board ggf. per BOOT/RESET in den Bootloader bringen.",
      "serial_bootloader_handshake_not_implemented",
      false,
    };
  }
  if (vid == 0x10C4 && (pid == 0xEA60 || pid == 0xEA70)) {
    return {
      "usb_serial_bridge",
      "ESP32 / ESP8266 via CP210x",
      "silabs_cp210x",
      "esp32_esp8266_candidate",
      "serial_bridge_detected",
      "Board ggf. per BOOT/RESET in den Bootloader bringen.",
      "serial_bootloader_handshake_not_implemented",
      false,
    };
  }
  if (vid == 0x0403 && (pid == 0x6001 || pid == 0x6015)) {
    return {
      "usb_serial_bridge",
      "Arduino / ESP via FTDI",
      "ftdi_usb_serial",
      "arduino_esp_candidate",
      "serial_bridge_detected",
      "Board ggf. per BOOT/RESET in den Bootloader bringen.",
      "serial_bootloader_handshake_not_implemented",
      false,
    };
  }
  if (vid == 0x2341 || vid == 0x2A03) {
    return {
      "arduino_usb_device",
      "Arduino USB device",
      "arduino_usb",
      "arduino_candidate",
      "arduino_usb_detected",
      "Arduino erkannt. Flash-Unterstuetzung folgt nach Protokollauswahl.",
      "arduino_flash_protocol_not_implemented",
      false,
    };
  }
  if (vid == 0x067B && pid == 0x2303) {
    return {
      "usb_serial_bridge",
      "Arduino / ESP via Prolific",
      "prolific_pl2303",
      "arduino_esp_candidate",
      "serial_bridge_detected",
      "Board ggf. per BOOT/RESET in den Bootloader bringen.",
      "serial_bootloader_handshake_not_implemented",
      false,
    };
  }
  return {
    "unknown_usb_device",
    "Unbekanntes USB-Geraet",
    "",
    "unknown",
    "unknown_usb_device",
    "Anderes Kabel/Board pruefen oder spaeter Support-Matrix erweitern.",
    "unsupported_or_unknown_usb_device",
    false,
  };
}

void setNoTarget() {
  status.state = "waiting_for_target";
  status.connectionState = "not_connected";
  status.bootloaderState = "not_detected";
  status.targetKind = "";
  status.targetDisplayName = "";
  status.serialBridge = "";
  status.chipFamily = "";
  status.usbVid = "";
  status.usbPid = "";
  status.usbAddress = "";
  status.vbusPowerMode = GERNETIX_FLASHBOX_USB_VBUS_POWER_MODE;
  status.targetPowerPolicy = GERNETIX_FLASHBOX_USB_TARGET_POWER_POLICY;
  status.vbusControlAvailable = GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN >= 0;
  status.recommendedAction = status.vbusControlAvailable
    ? "Zielboard am Target-USB-Port verbinden; VBUS-Schaltung wird ueberwacht."
    : "Target-USB-VBUS der neuen Zwei-USB-S3-Flashbox ist noch nicht verifiziert; Zielboard extern versorgen oder Hardwaretest abwarten.";
  status.error = "";
  status.detectedDeviceCount = 0;
  status.targetConnected = false;
  status.espRomBootloaderLikely = false;
  status.targetFlashPreflightAllowed = false;
}

void setDetectedCandidate(uint16_t vid, uint16_t pid, uint8_t address) {
  const UsbTargetClassification classification = classifyUsbTarget(vid, pid);
  status.state = "target_device_detected";
  status.connectionState = "connected";
  status.bootloaderState = classification.bootloaderState;
  status.targetKind = classification.targetKind;
  status.targetDisplayName = classification.targetDisplayName;
  status.serialBridge = classification.serialBridge;
  status.chipFamily = classification.chipFamily;
  status.usbVid = hex4(vid);
  status.usbPid = hex4(pid);
  status.usbAddress = String(address);
  status.vbusPowerMode = GERNETIX_FLASHBOX_USB_VBUS_POWER_MODE;
  status.targetPowerPolicy = GERNETIX_FLASHBOX_USB_TARGET_POWER_POLICY;
  status.vbusControlAvailable = GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN >= 0;
  status.recommendedAction = classification.recommendedAction;
  status.lastSeenAtMs = nowText();
  status.detectedDeviceCount = 1;
  status.targetConnected = true;
  status.espRomBootloaderLikely = classification.espRomBootloaderLikely;
  status.targetFlashPreflightAllowed = false;
  status.error = classification.error;
}

#if GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED
void readUsbDeviceDescriptor(uint8_t deviceAddress) {
  if (!usbClientHandle) return;

  usb_device_handle_t deviceHandle = nullptr;
  esp_err_t openResult = usb_host_device_open(usbClientHandle, deviceAddress, &deviceHandle);
  if (openResult != ESP_OK || deviceHandle == nullptr) {
    status.state = "target_descriptor_failed";
    status.connectionState = "connected";
    status.bootloaderState = "descriptor_unavailable";
    status.usbAddress = String(deviceAddress);
    status.targetConnected = true;
    status.targetFlashPreflightAllowed = false;
    status.error = "usb_device_open_failed";
    status.lastSeenAtMs = nowText();
    return;
  }

  const usb_device_desc_t* descriptor = nullptr;
  esp_err_t descriptorResult = usb_host_get_device_descriptor(deviceHandle, &descriptor);
  if (descriptorResult != ESP_OK || descriptor == nullptr) {
    status.state = "target_descriptor_failed";
    status.connectionState = "connected";
    status.bootloaderState = "descriptor_unavailable";
    status.usbAddress = String(deviceAddress);
    status.targetConnected = true;
    status.targetFlashPreflightAllowed = false;
    status.error = "usb_descriptor_read_failed";
    status.lastSeenAtMs = nowText();
    usb_host_device_close(usbClientHandle, deviceHandle);
    return;
  }

  setDetectedCandidate(descriptor->idVendor, descriptor->idProduct, deviceAddress);
  usb_host_device_close(usbClientHandle, deviceHandle);
}

void usbClientEventCallback(const usb_host_client_event_msg_t* eventMessage, void* arg) {
  (void)arg;
  if (eventMessage == nullptr) return;

  if (eventMessage->event == USB_HOST_CLIENT_EVENT_NEW_DEV) {
    readUsbDeviceDescriptor(eventMessage->new_dev.address);
    return;
  }

  if (eventMessage->event == USB_HOST_CLIENT_EVENT_DEV_GONE) {
    setNoTarget();
  }
}

bool ensureUsbHostStarted() {
  if (!usbHostInstalled) {
    usb_host_config_t hostConfig = {};
    hostConfig.skip_phy_setup = false;
    hostConfig.intr_flags = ESP_INTR_FLAG_LEVEL1;
    esp_err_t installResult = usb_host_install(&hostConfig);
    if (installResult != ESP_OK && installResult != ESP_ERR_INVALID_STATE) {
      status.state = "usb_host_failed";
      status.error = "usb_host_install_failed";
      status.targetFlashPreflightAllowed = false;
      return false;
    }
    usbHostInstalled = true;
  }

  if (!usbClientRegistered) {
    usb_host_client_config_t clientConfig = {};
    clientConfig.is_synchronous = false;
    clientConfig.max_num_event_msg = 5;
    clientConfig.async.client_event_callback = usbClientEventCallback;
    clientConfig.async.callback_arg = nullptr;
    esp_err_t registerResult = usb_host_client_register(&clientConfig, &usbClientHandle);
    if (registerResult != ESP_OK || usbClientHandle == nullptr) {
      status.state = "usb_host_failed";
      status.error = "usb_host_client_register_failed";
      status.targetFlashPreflightAllowed = false;
      return false;
    }
    usbClientRegistered = true;
  }

  return true;
}
#endif

void showDisplayIfChanged() {
  String displayState = status.state + "|" + status.bootloaderState + "|" + status.usbVid + ":" + status.usbPid;
  if (displayState == lastDisplayState) return;
  lastDisplayState = displayState;

  if (!status.targetConnected) {
    flashboxDisplayShowTargetState("Kein Zielgeraet", status.recommendedAction + "\nPower: " + status.vbusPowerMode);
    return;
  }

  String detail = status.targetDisplayName +
    "\nUSB " + status.usbVid + ":" + status.usbPid +
    "\nAddr: " + status.usbAddress +
    "\n" + status.bootloaderState;
  flashboxDisplayShowTargetState("Ziel erkannt", detail);
}

void pollUsbOtgBackend() {
#if GERNETIX_FLASHBOX_USB_OTG_DETECTION_ENABLED
  if (!ensureUsbHostStarted()) return;
  uint32_t hostEvents = 0;
  usb_host_lib_handle_events(0, &hostEvents);
  if (usbClientHandle) {
    usb_host_client_handle_events(usbClientHandle, 0);
  }
  if (!status.targetConnected && status.state != "usb_host_failed") {
    setNoTarget();
  }
#else
  setNoTarget();
#endif
}

}  // namespace

void flashboxTargetDetectionBegin() {
  status.state = "starting";
  status.connectionState = "not_connected";
  status.bootloaderState = "unknown";
  status.targetKind = "";
  status.targetDisplayName = "";
  status.serialBridge = "";
  status.detectionBackend = GERNETIX_FLASHBOX_TARGET_DETECTION_BACKEND;
  status.vbusPowerMode = GERNETIX_FLASHBOX_USB_VBUS_POWER_MODE;
  status.targetPowerPolicy = GERNETIX_FLASHBOX_USB_TARGET_POWER_POLICY;
  status.vbusControlAvailable = GERNETIX_FLASHBOX_USB_VBUS_POWER_SWITCH_PIN >= 0;
  status.recommendedAction = "Target-USB-VBUS der neuen Zwei-USB-S3-Flashbox ist noch nicht verifiziert; Zielboard extern versorgen oder Hardwaretest abwarten.";
  status.error = "";
  status.lastSeenAtMs = "";
  status.detectedDeviceCount = 0;
  status.targetConnected = false;
  status.espRomBootloaderLikely = false;
  status.targetFlashPreflightAllowed = false;
  setNoTarget();
  showDisplayIfChanged();
}

void flashboxTargetDetectionLoop() {
  const unsigned long now = millis();
  if (now - lastPollAt < GERNETIX_FLASHBOX_TARGET_POLL_INTERVAL_MS) return;
  lastPollAt = now;
  pollUsbOtgBackend();
  showDisplayIfChanged();
}

FlashboxTargetDeviceStatus flashboxTargetDetectionStatus() {
  return status;
}

String flashboxTargetDetectionStatusJson() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "state", status.state.c_str());
  gernetix::runtime::jsonAppendString(writer, "connection_state", status.connectionState.c_str());
  gernetix::runtime::jsonAppendString(writer, "bootloader_state", status.bootloaderState.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_kind", status.targetKind.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_display_name", status.targetDisplayName.c_str());
  gernetix::runtime::jsonAppendString(writer, "serial_bridge", status.serialBridge.c_str());
  gernetix::runtime::jsonAppendString(writer, "chip_family", status.chipFamily.c_str());
  gernetix::runtime::jsonAppendString(writer, "usb_vid", status.usbVid.c_str());
  gernetix::runtime::jsonAppendString(writer, "usb_pid", status.usbPid.c_str());
  gernetix::runtime::jsonAppendString(writer, "usb_address", status.usbAddress.c_str());
  gernetix::runtime::jsonAppendString(writer, "detection_backend", status.detectionBackend.c_str());
  gernetix::runtime::jsonAppendString(writer, "vbus_power_mode", status.vbusPowerMode.c_str());
  gernetix::runtime::jsonAppendString(writer, "target_power_policy", status.targetPowerPolicy.c_str());
  gernetix::runtime::jsonAppendString(writer, "bootloader_policy", GERNETIX_FLASHBOX_TARGET_BOOTLOADER_POLICY);
  gernetix::runtime::jsonAppendString(writer, "usb_serial_bridge_policy", GERNETIX_FLASHBOX_USB_SERIAL_BRIDGE_POLICY);
  gernetix::runtime::jsonAppendString(writer, "recommended_action", status.recommendedAction.c_str());
  gernetix::runtime::jsonAppendString(writer, "error", status.error.c_str());
  gernetix::runtime::jsonAppendString(writer, "last_seen_at_ms", status.lastSeenAtMs.c_str());
  flashboxJsonAppendInt(writer, "detected_device_count", status.detectedDeviceCount);
  gernetix::runtime::jsonAppendBool(writer, "target_connected", status.targetConnected);
  gernetix::runtime::jsonAppendBool(writer, "vbus_control_available", status.vbusControlAvailable);
  gernetix::runtime::jsonAppendBool(writer, "esp_rom_bootloader_likely", status.espRomBootloaderLikely);
  gernetix::runtime::jsonAppendBool(writer, "target_flash_preflight_allowed", status.targetFlashPreflightAllowed);
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}
