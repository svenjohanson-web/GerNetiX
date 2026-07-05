#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "basissoftware/functions/handleNetwork.h"
#include "basissoftware/functions/publishStatus.h"
#include "basissoftware/functions/readSensors.h"
#include "basissoftware/functions/startRuntimeTasks.h"
#include "basissoftware/functions/updateActuators.h"
#include "basissoftware/project_hooks.h"

namespace {
constexpr const char *RUNTIME_TASK_NAME = "runtime";
constexpr uint32_t RUNTIME_TASK_STACK_SIZE = 4096;
constexpr UBaseType_t RUNTIME_TASK_PRIORITY = 5;

void runtimeTask(void *) {
  while (true) {
    handleNetwork();
    readSensors();
    updateActuators();
    onProjectTick();
    publishStatus();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}
}

void startRuntimeTasks() {
  xTaskCreate(
      runtimeTask,
      RUNTIME_TASK_NAME,
      RUNTIME_TASK_STACK_SIZE,
      nullptr,
      RUNTIME_TASK_PRIORITY,
      nullptr);
}
