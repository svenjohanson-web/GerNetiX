#include "basissoftware/functions/initPins.h"
#include "basissoftware/functions/initSerial.h"
#include "basissoftware/functions/initWifi.h"
#include "basissoftware/functions/runDiagnostics.h"
#include "basissoftware/functions/startRuntimeTasks.h"
#include "basissoftware/wifi_manager.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "basissoftware/factory_provisioning.h"
#include "basissoftware/crash_diagnostics.h"
#include "basissoftware/serial_provisioning.h"
#if !defined(GERNETIX_BASISSOFTWARE_PROFILE_MEDIUM) && !defined(GERNETIX_BASISSOFTWARE_PROFILE_LOW)
#include "basissoftware/mqtt_ota.h"
#include "basissoftware/ota_update.h"
#endif
#include "basissoftware/project_hooks.h"

extern "C" void app_main() {
  initSerial();
  initializeCrashDiagnostics();
  startCrashDiagnosticsMonitor();
  initPins();
  initWifi();
#if !defined(GERNETIX_DIAGNOSTIC_DISABLE_USB_PROVISIONING) && !defined(GERNETIX_DIAGNOSTIC_DISABLE_SERIAL_PROVISIONING_TASK)
  // The basissoftware receiver normally serves only the initial setup AP.
  // A linked project may explicitly keep the same local USB transport active
  // for a bounded setup protocol; framing and port ownership remain here.
  if (wifiSetupPortalIsActive() || projectSerialProvisioningEnabled()) {
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
  // Der geschuetzte GerNetiX-OTA-Steuerkanal ist Infrastruktur und nicht das
  // optionale, vom Projekt konfigurierte MQTT.  Ein Projekt ohne MQTT muss
  // deshalb weiterhin signierte OTA-Auftraege empfangen koennen.
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
