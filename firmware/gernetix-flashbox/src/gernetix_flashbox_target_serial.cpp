#include "gernetix_flashbox_target_serial.h"

#include <cstdlib>

#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "usb/cdc_acm_host.h"
#include "usb/usb_host.h"

#include "gernetix/runtime_core.h"
#include "gernetix_flashbox_json_response.h"
#include "gernetix_flashbox_target_detection.h"

namespace {

FlashboxTargetSerialStatus status = {
  "starting",
  "usb_cdc_acm_host",
  "",
  "",
  "",
  0,
  false,
  false,
};

cdc_acm_dev_hdl_t cdcDevice = nullptr;
TaskHandle_t usbHostEventTask = nullptr;
unsigned long lastAttemptAt = 0;

uint16_t parseUsbHex(const String& value) {
  return static_cast<uint16_t>(std::strtoul(value.c_str(), nullptr, 16));
}

bool supportsEspressifSerialTransport(const FlashboxTargetDeviceStatus& target) {
  return target.targetKind == "esp32_native_usb" ||
    (target.targetKind == "usb_serial_bridge" && target.chipFamily.indexOf("esp") >= 0);
}

bool onCdcData(const uint8_t* data, size_t dataLength, void* userArg) {
  (void)data;
  (void)userArg;
  status.receivedBytes += dataLength;
  return true;
}

void onCdcEvent(const cdc_acm_host_dev_event_data_t* event, void* userArg) {
  (void)userArg;
  if (event == nullptr) return;
  if (event->type == CDC_ACM_HOST_DEVICE_DISCONNECTED) {
    cdcDevice = nullptr;
    status.targetOpen = false;
    status.state = "target_disconnected";
    status.error = "";
  }
  if (event->type == CDC_ACM_HOST_ERROR) {
    status.state = "cdc_transport_error";
    status.error = "cdc_acm_host_error";
  }
}

void usbHostEvents(void* argument) {
  (void)argument;
  while (true) {
    uint32_t eventFlags = 0;
    usb_host_lib_handle_events(portMAX_DELAY, &eventFlags);
    if (eventFlags & USB_HOST_LIB_EVENT_FLAGS_NO_CLIENTS) usb_host_device_free_all();
  }
}

bool ensureCdcDriver() {
  if (status.driverInstalled) return true;
  cdc_acm_host_driver_config_t config = {};
  config.driver_task_stack_size = 4096;
  config.driver_task_priority = 20;
  config.xCoreID = tskNO_AFFINITY;
  const esp_err_t result = cdc_acm_host_install(&config);
  if (result != ESP_OK && result != ESP_ERR_INVALID_STATE) {
    status.state = "cdc_driver_failed";
    status.error = "cdc_acm_host_install_failed";
    return false;
  }
  status.driverInstalled = true;
  if (usbHostEventTask == nullptr) {
    const BaseType_t taskCreated = xTaskCreate(usbHostEvents, "flashbox-usb-host", 4096, nullptr, 20, &usbHostEventTask);
    if (taskCreated != pdPASS) {
      status.state = "cdc_driver_failed";
      status.error = "usb_host_event_task_create_failed";
      return false;
    }
  }
  return true;
}

void closeCdcTarget() {
  if (cdcDevice != nullptr) cdc_acm_host_close(cdcDevice);
  cdcDevice = nullptr;
  status.targetOpen = false;
}

void openDetectedTarget(const FlashboxTargetDeviceStatus& target) {
  const uint16_t vid = parseUsbHex(target.usbVid);
  const uint16_t pid = parseUsbHex(target.usbPid);
  if (vid == 0 || pid == 0) return;

  cdc_acm_host_device_config_t config = {};
  config.connection_timeout_ms = 1000;
  config.out_buffer_size = 1024;
  config.in_buffer_size = 1024;
  config.user_arg = nullptr;
  config.event_cb = onCdcEvent;
  config.data_cb = onCdcData;

  const esp_err_t result = cdc_acm_host_open_vendor_specific(vid, pid, 0, &config, &cdcDevice);
  status.usbVid = target.usbVid;
  status.usbPid = target.usbPid;
  if (result != ESP_OK || cdcDevice == nullptr) {
    status.state = "cdc_target_open_failed";
    status.error = "cdc_acm_host_open_failed";
    cdcDevice = nullptr;
    status.targetOpen = false;
    return;
  }

  // Deliberately do not toggle DTR/RTS here.  The later Espressif ROM
  // bootloader client owns reset/boot sequencing and may only do so after a
  // verified manifest and target preflight.
  status.state = "cdc_target_ready";
  status.error = "";
  status.targetOpen = true;
}

}  // namespace

void flashboxTargetSerialBegin() {
  status.state = "waiting_for_usb_host";
  status.error = "";
  status.receivedBytes = 0;
}

void flashboxTargetSerialLoop() {
  // Target detection installs the Host Library immediately before this loop.
  // Start the shared Host event task even when no target is connected yet;
  // otherwise the first USB connection could never reach the detector.
  if (!ensureCdcDriver()) return;
  const FlashboxTargetDeviceStatus target = flashboxTargetDetectionStatus();
  if (!target.targetConnected || !supportsEspressifSerialTransport(target)) {
    closeCdcTarget();
    status.state = target.targetConnected ? "target_transport_not_supported" : "waiting_for_target";
    status.error = target.targetConnected ? "target_is_not_an_esp_serial_candidate" : "";
    return;
  }
  if (status.targetOpen) return;
  if (millis() - lastAttemptAt < 1000) return;
  lastAttemptAt = millis();
  openDetectedTarget(target);
}

bool flashboxTargetSerialWrite(const uint8_t* data, size_t dataLength, uint32_t timeoutMs) {
  if (cdcDevice == nullptr || data == nullptr || dataLength == 0) return false;
  const esp_err_t result = cdc_acm_host_data_tx_blocking(cdcDevice, data, dataLength, timeoutMs);
  if (result == ESP_OK) return true;
  status.state = "cdc_transport_error";
  status.error = "cdc_acm_host_tx_failed";
  return false;
}

FlashboxTargetSerialStatus flashboxTargetSerialStatus() {
  return status;
}

String flashboxTargetSerialStatusJson() {
  gernetix::runtime::JsonWriter writer = flashboxJsonResponseWriter();
  gernetix::runtime::jsonBegin(writer);
  gernetix::runtime::jsonAppendString(writer, "state", status.state.c_str());
  gernetix::runtime::jsonAppendString(writer, "transport", status.transport.c_str());
  gernetix::runtime::jsonAppendString(writer, "usb_vid", status.usbVid.c_str());
  gernetix::runtime::jsonAppendString(writer, "usb_pid", status.usbPid.c_str());
  gernetix::runtime::jsonAppendString(writer, "error", status.error.c_str());
  flashboxJsonAppendUnsigned(writer, "received_bytes", static_cast<unsigned>(status.receivedBytes));
  gernetix::runtime::jsonAppendBool(writer, "driver_installed", status.driverInstalled);
  gernetix::runtime::jsonAppendBool(writer, "target_open", status.targetOpen);
  gernetix::runtime::jsonEnd(writer);
  return flashboxJsonResponseString();
}
