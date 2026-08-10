"use strict";

const { createLearningProjectRegistry } = require("../../../../shared/learning/learning-project-registry");
const { createArduinoBlinkCourseModel } = require("../project-models/arduino-blink-course");
const { createArduinoAtmelBareMetalCourseModel } = require("../project-models/arduino-atmel-bare-metal-course");
const { createTamagotchiEntryCourseModel } = require("../project-models/tamagotchi-entry-course");
const { createNexiCourseModel } = require("../project-models/nexi-course");
const { createSmartAssistantCourseModel } = require("../project-models/smart-assistant-course");
const { createButtonToSmartphoneNotificationCourseModel } = require("../project-models/button-to-smartphone-notification-course");
const { createHomeAutomationNetworkCourseModel } = require("../project-models/home-automation-network-course");
const { createHomeAutomationSensorsCourseModel } = require("../project-models/home-automation-sensors-course");
const { createMotorControlBasicsCourseModel } = require("../project-models/motor-control-basics-course");
const { createProximitySensorRadarCourseModel } = require("../project-models/proximity-sensor-radar-course");
const { createProgrammingFundamentalsCourseModel } = require("../project-models/programming-fundamentals-course");
const { createMicrocontrollerFundamentalsCourseModel } = require("../project-models/microcontroller-fundamentals-course");
const { createUmlFundamentalsCourseModel } = require("../project-models/uml-fundamentals-course");
const { createRequirementsWorkshopCourseModel } = require("../project-models/requirements-workshop-course");
const { createYamlFundamentalsCourseModel } = require("../project-models/yaml-fundamentals-course");
const { createStorageLearningStoryCourseModel } = require("../project-models/storage-learning-story-course");
const { createRadioTechnologiesCourseModel } = require("../project-models/radio-technologies-course");
const { createMeasurementToolsBasicsCourseModel } = require("../project-models/measurement-tools-basics-course");
const { createEsp32CameraStreamingCourseModel } = require("../project-models/esp32-camera-streaming-course");
const { createPlantWateringControlCourseModel } = require("../project-models/plant-watering-control-course");
const { createEmbeddedRuntimeAndInterruptsCourseModel } = require("../project-models/embedded-runtime-and-interrupts-course");
const { createEmbeddedCHardwareControlCourseModel } = require("../project-models/embedded-c-hardware-control-course");
const { createAvrFrameworkResourceBudgetCourseModel } = require("../project-models/avr-framework-resource-budget-course");

const definitions = [
  ["arduinoBlinkCourseModel", () => createArduinoBlinkCourseModel()],
  ["arduinoAtmelBareMetalCourseModel", () => createArduinoAtmelBareMetalCourseModel()],
  ["tamagotchiEntryCourseModel", ({ readWorkspaceText }) => createTamagotchiEntryCourseModel({ readWorkspaceText })],
  ["nexiCourseModel", () => createNexiCourseModel()],
  ["smartAssistantCourseModel", () => createSmartAssistantCourseModel()],
  ["buttonToSmartphoneNotificationCourseModel", () => createButtonToSmartphoneNotificationCourseModel()],
  ["homeAutomationNetworkCourseModel", () => createHomeAutomationNetworkCourseModel()],
  ["homeAutomationSensorsCourseModel", () => createHomeAutomationSensorsCourseModel()],
  ["motorControlBasicsCourseModel", () => createMotorControlBasicsCourseModel()],
  ["proximitySensorRadarCourseModel", () => createProximitySensorRadarCourseModel()],
  ["programmingFundamentalsCourseModel", () => createProgrammingFundamentalsCourseModel()],
  ["microcontrollerFundamentalsCourseModel", () => createMicrocontrollerFundamentalsCourseModel()],
  ["umlFundamentalsCourseModel", () => createUmlFundamentalsCourseModel()],
  ["requirementsWorkshopCourseModel", () => createRequirementsWorkshopCourseModel()],
  ["yamlFundamentalsCourseModel", () => createYamlFundamentalsCourseModel()],
  ["storageLearningStoryCourseModel", () => createStorageLearningStoryCourseModel()],
  ["radioTechnologiesCourseModel", () => createRadioTechnologiesCourseModel()],
  ["measurementToolsBasicsCourseModel", () => createMeasurementToolsBasicsCourseModel()],
  ["esp32CameraStreamingCourseModel", () => createEsp32CameraStreamingCourseModel()],
  ["plantWateringControlCourseModel", () => createPlantWateringControlCourseModel()],
  ["embeddedRuntimeAndInterruptsCourseModel", () => createEmbeddedRuntimeAndInterruptsCourseModel()],
  ["embeddedCHardwareControlCourseModel", () => createEmbeddedCHardwareControlCourseModel()],
  ["avrFrameworkResourceBudgetCourseModel", () => createAvrFrameworkResourceBudgetCourseModel()],
];

function createLearningProjectModels({ readWorkspaceText }) {
  const coreRegistry = createLearningProjectRegistry({
    context: { readWorkspaceText },
    validateProduct: validateCourseModel,
  });
  for (const [key, create] of definitions) coreRegistry.register({ key, create });

  const models = coreRegistry.createAll();
  const namedModels = Object.fromEntries(definitions.map(([key]) => [key, coreRegistry.getByKey(key)]));
  const learningProjectRegistry = Object.freeze({
    models,
    getBySlug: (slug) => coreRegistry.getBySlug(slug),
    createProjects: (project, step) => models.map((model) => model.createProject(project, step)),
  });

  return { ...namedModels, learningProjectRegistry };
}

function validateCourseModel(model, definition) {
  for (const method of ["createProject", "createSources", "createViewManifest"]) {
    if (typeof model?.[method] !== "function") {
      throw new TypeError(`Learning project ${definition.key} must implement ${method}()`);
    }
  }
}

module.exports = { createLearningProjectModels, validateCourseModel };
