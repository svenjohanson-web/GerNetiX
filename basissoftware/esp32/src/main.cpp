#include "basissoftware/functions/initPins.h"
#include "basissoftware/functions/initSerial.h"
#include "basissoftware/functions/initWifi.h"
#include "basissoftware/functions/runDiagnostics.h"
#include "basissoftware/functions/startRuntimeTasks.h"
#include "basissoftware/project_hooks.h"

extern "C" void app_main() {
  initSerial();
  initPins();
  initWifi();
  runDiagnostics();
  onProjectInit();
  startRuntimeTasks();
}
