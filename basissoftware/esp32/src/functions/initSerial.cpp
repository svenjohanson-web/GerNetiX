#include "esp_log.h"
#include "soc/soc_caps.h"
#if SOC_USB_SERIAL_JTAG_SUPPORTED && !defined(GERNETIX_DIAGNOSTIC_DISABLE_USB_PROVISIONING)
#include "driver/usb_serial_jtag.h"
#include "driver/usb_serial_jtag_vfs.h"
#endif

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"
#include "basissoftware/functions/initSerial.h"

namespace {
constexpr const char *TAG = "initSerial";
}

void initSerial() {
#if SOC_USB_SERIAL_JTAG_SUPPORTED && !defined(GERNETIX_DIAGNOSTIC_DISABLE_USB_PROVISIONING)
  // The S3 console is exposed as a secondary USB-Serial-JTAG endpoint.  The
  // provisioning protocol must use that very same driver; installing a
  // second ISR path later corrupts the scheduler when USB traffic starts.
  if (!usb_serial_jtag_is_driver_installed()) {
    usb_serial_jtag_driver_config_t config = USB_SERIAL_JTAG_DRIVER_CONFIG_DEFAULT();
    config.rx_buffer_size = 1024;
    config.tx_buffer_size = 512;
    const esp_err_t status = usb_serial_jtag_driver_install(&config);
    if (status == ESP_OK) {
      usb_serial_jtag_vfs_use_driver();
    }
  } else {
    usb_serial_jtag_vfs_use_driver();
  }
#endif
  esp_log_level_set("*", ESP_LOG_INFO);
  feedbackInfo(TAG, "GerNetiX firmware started at %lu baud", SERIAL_BAUD_RATE);
}
