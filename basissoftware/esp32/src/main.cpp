#include "basissoftware/functions/initPins.h"
#include "basissoftware/functions/initSerial.h"
#include "basissoftware/functions/initWifi.h"
#include "basissoftware/functions/runDiagnostics.h"
#include "basissoftware/functions/startRuntimeTasks.h"
#include "basissoftware/factory_provisioning.h"
#if !defined(GERNETIX_BASISSOFTWARE_PROFILE_MEDIUM) && !defined(GERNETIX_BASISSOFTWARE_PROFILE_LOW)
#include "basissoftware/mqtt_ota.h"
#include "basissoftware/ota_update.h"
#endif
#include "basissoftware/project_hooks.h"

extern "C" void app_main() {
  initSerial();
  initPins();
  initWifi();
  applyFactoryProvisioningIfAvailable();
  runDiagnostics();
  onProjectInit();
#if !defined(GERNETIX_BASISSOFTWARE_PROFILE_MEDIUM) && !defined(GERNETIX_BASISSOFTWARE_PROFILE_LOW)
  confirmRunningOtaImage();
  startMqttOtaSubscriber();
#endif
  startRuntimeTasks();
}
