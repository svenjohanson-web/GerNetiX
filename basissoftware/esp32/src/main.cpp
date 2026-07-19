#include "basissoftware/functions/initPins.h"
#include "basissoftware/functions/initSerial.h"
#include "basissoftware/functions/initWifi.h"
#include "basissoftware/functions/runDiagnostics.h"
#include "basissoftware/functions/startRuntimeTasks.h"
#include "basissoftware/wifi_manager.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "basissoftware/factory_provisioning.h"
#include "basissoftware/serial_provisioning.h"
#if !defined(GERNETIX_BASISSOFTWARE_PROFILE_MEDIUM) && !defined(GERNETIX_BASISSOFTWARE_PROFILE_LOW)
#include "basissoftware/mqtt_ota.h"
#include "basissoftware/ota_update.h"
#endif
#include "basissoftware/project_hooks.h"

extern "C" void app_main() {
  initSerial();
  initPins();
  initWifi();
#if !defined(GERNETIX_DIAGNOSTIC_DISABLE_USB_PROVISIONING) && !defined(GERNETIX_DIAGNOSTIC_DISABLE_SERIAL_PROVISIONING_TASK)
  // The ESP32-S3 native USB receiver is used only while the board is in its
  // initial setup AP.  Once WLAN is known, provisioning continues through the
  // device web server and no permanent USB reader competes with WiFi.
  if (wifiSetupPortalIsActive()) {
    startSerialProvisioning();
  }
#endif
#if !defined(GERNETIX_DIAGNOSTIC_DISABLE_PROVISIONING_NVS)
  applyFactoryProvisioningIfAvailable();
#endif
  runDiagnostics();
  onProjectInit();
#if !defined(GERNETIX_BASISSOFTWARE_PROFILE_MEDIUM) && !defined(GERNETIX_BASISSOFTWARE_PROFILE_LOW)
  confirmRunningOtaImage();
#if !defined(GERNETIX_DIAGNOSTIC_DISABLE_PROVISIONING_NVS)
  startMqttOtaSubscriber();
#endif
#endif
  startRuntimeTasks();

  // Keep the ESP-IDF main task alive.  Returning from app_main() deletes this
  // task; on the ESP32-S3 that left a corrupted scheduler task context after
  // the network/runtime tasks had been created and caused StoreProhibited
  // resets shortly after WiFi connected.
  while (true) {
    vTaskDelay(portMAX_DELAY);
  }
}
