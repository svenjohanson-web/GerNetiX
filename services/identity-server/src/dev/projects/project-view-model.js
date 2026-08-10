"use strict";

function createProjectViewModel({ learningProjectRegistry, developmentLessonCatalog, getUserIdeState, normalizeArchitectureDialog, normalizeArchitecturePlantUml, normalizeDataLoggerConfiguration, normalizeHomeAutomationConfiguration, normalizeProjectCommunicationSetup, normalizePwaDashboardConfiguration, normalizeTouchscreenGameConfiguration, stripPlantUmlNotes }) {
function createUserIdeState() {
  const projects = learningProjectRegistry.createProjects(project, step);

  return {
    projectDefinitions: projects,
    lessonManifestOverrides: new Map(),
    workspaceStates: new Map(),
    devices: [
      {
        device_id: "device_verified_1",
        display_name: "Sven ESP32 DevKit",
        hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
        authenticity_status: "gernetix_verified",
        connectivity_status: "online",
        ota_status: "ready",
      },
      {
        device_id: "device_community_1",
        display_name: "Keller Sensor ESP32",
        hardware_profile_id: "hardware.processor_board.esp32_unknown",
        authenticity_status: "community_unverified",
        connectivity_status: "offline",
        ota_status: "unknown",
      },
    ],
    builds: [],
  };
}

function project(slug, title, area, summary, steps, options = {}) {
  const requiredCapabilitiesBySlug = {
    "software-engineering-tamagotchi": [],
    "arduino-blink": ["capability.arduino_framework_runtime", "capability.flash_firmware"],
    "arduino-atmel-bare-metal": ["capability.atmel_avr_bare_metal_runtime", "capability.flash_firmware"],
    "plant-watering-control": ["capability.processor_esp32", "capability.wifi", "capability.digital_output"],
  };
  const accessModelsBySlug = {
    "arduino-blink": "free",
    "software-engineering-tamagotchi": "free",
    "arduino-atmel-bare-metal": "subscription",
    "smart-assistant-ai-automation": "subscription",
    "plant-watering-control": "purchased",
  };
  const learningCategory = normalizeLearningProjectCategory(options.learning_category);
  const learningTags = normalizeLearningProjectTags(options.tags);
  const projectLessonAssignments = Array.isArray(options.project_lesson_assignments)
    ? options.project_lesson_assignments
    : [];
  const developmentLessons = projectLessonAssignments.length
    ? developmentLessonCatalog.resolveProjectLessons(projectLessonAssignments)
    : options.development_lessons || [];
  return {
    slug,
    project_server_id: `project_${slug}`,
    learning_project_id: `learning_project.${slug.replace(/-/g, "_")}`,
    course_id: `course.${slug.replace(/-/g, "_")}`,
    lesson_id: `lesson.${slug.replace(/-/g, "_")}.intro`,
    hardware_profile_id: Object.hasOwn(options, "hardware_profile_id") ? options.hardware_profile_id : "hardware.processor_board.generic_esp_wroom32",
    default_device_id: Object.hasOwn(options, "default_device_id") ? options.default_device_id : "device_verified_1",
    build_config: options.build_config || undefined,
    system_source_id: options.system_source_id || "",
    source_files: options.source_files || [{ path: "src/main.cpp", role: "user_code" }],
    required_capability_ids: Object.hasOwn(options, "required_capability_ids")
      ? options.required_capability_ids
      : (requiredCapabilitiesBySlug[slug] || ["capability.processor_esp32"]),
    access_model: options.access_model || accessModelsBySlug[slug] || "subscription",
    customer_entries: Array.isArray(options.customer_entries) ? options.customer_entries : [],
    learning_category: learningCategory,
    product_stage: String(options.product_stage || ""),
    tags: learningTags,
    project_lesson_assignments: projectLessonAssignments,
    development_lessons: developmentLessons,
    project_story: options.project_story || null,
    title,
    area,
    summary,
    status: "bereit",
    last_build_status: "",
    steps,
  };
}

function normalizeLearningProjectCategory(value) {
  const category = String(value || "").trim();
  const knownCategories = ["software_engineering", "desktop", "embedded", "distributed_system", "mobile"];
  if (!knownCategories.includes(category)) {
    throw new Error(`Unknown learning project category: ${category || "(empty)"}`);
  }
  return category;
}

function normalizeLearningProjectTags(value) {
  const knownTags = [
    "client:mobile",
    "level:beginner",
    "platform:arduino",
    "platform:avr",
    "platform:esp32",
    "platform:raspberry-pi",
    "platform:stm32",
    "protocol:mqtt",
    "runtime:browser",
    "topic:actuators",
    "topic:ai",
    "topic:automation",
    "topic:audio",
    "topic:bare-metal",
    "topic:firmware",
    "topic:home-automation",
    "topic:modeling",
    "topic:motor-control",
    "topic:privacy",
    "topic:programming",
    "topic:requirements-engineering",
    "topic:microcontroller",
    "topic:measurement",
    "topic:radar",
    "topic:radio",
    "topic:camera",
    "topic:networking",
    "topic:sensors",
    "topic:data",
    "topic:databases",
    "topic:embedded-c",
    "topic:embedded-runtime",
    "topic:interrupts",
    "topic:storage",
    "topic:memory",
    "topic:registers",
    "topic:video",
    "topic:web-push",
    "topic:yaml",
  ];
  const tags = Array.from(new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim()).filter(Boolean)));
  const unknownTag = tags.find((tag) => !knownTags.includes(tag));
  if (unknownTag) throw new Error(`Unknown learning project tag: ${unknownTag}`);
  return tags;
}

function ownedCapabilityIds(devices) {
  const capabilities = new Set();
  for (const device of devices) {
    for (const capability of device.technical_capability_ids || []) capabilities.add(`capability.${capability}`);
    if (device.hardware_profile_id === "hardware.processor_board.generic_esp_wroom32") {
      capabilities.add("capability.processor_esp32");
      capabilities.add("capability.wifi");
      if (device.ota_status === "ready") capabilities.add("capability.ota");
    }
  }
  return Array.from(capabilities);
}

function normalizeCapabilityIds(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(list.map((item) => String(item).replace(/^capability\./, "")).filter(Boolean)));
}

function step(title, text, insight) {
  return { title, text, insight };
}

function primarySourcePath(project) {
  return project.source_files?.[0]?.path || "src/main.cpp";
}

function projectViewManifest(project, options = {}) {
  const override = getUserIdeState().lessonManifestOverrides.get(project.slug);
  const learningProjectModel = learningProjectRegistry.getBySlug(project.slug);
  if (learningProjectModel) return learningProjectModel.createViewManifest(project, {
    lessonId: options.lessonId || "",
    override,
    primarySourcePath,
  });

  return {
    schema_version: 1,
    title: `${project.title} Projektansicht`,
    summary: project.summary,
    primary_source_path: primarySourcePath(project),
    mode: "guided_ide",
    views: [
      {
        id: "source-analysis",
        type: "source_analysis",
        title: "Quellcode analysieren",
        summary: "Primaere Projektdatei lesen, verstehen und bearbeiten.",
        source_path: primarySourcePath(project),
      },
      {
        id: "implementation-plan",
        type: "implementation_plan",
        title: "Naechste Schritte",
        summary: "Projektmanifest kann spaeter weitere Erklaerungen, Diagramme und Pruefungen enthalten.",
        payload: {
          tasks: project.steps.map((item) => item.title),
        },
      },
    ],
  };
}

function developmentProjectViewManifest({ title, description = "", source = "", diagram = null, buildConfig = null, architectureDialog = null, templateId = "", templateModelVersion = 1, hardwareConfiguration = null, communicationSetup = null, homeAutomationConfiguration = null, gameConfiguration = null, pwaDashboardConfiguration = null, dataLoggerConfiguration = null, eventConfiguration = null }) {
  const buildable = Boolean(buildConfig);
  const usesProjectTemplate = Boolean(templateId && templateId !== "empty");
  const derivedFrom = diagram?.derived_from || (usesProjectTemplate || buildable ? "project_template" : "persisted_project");
  const plantUmlSource = normalizeArchitecturePlantUml(stripPlantUmlNotes(source || diagram?.source || ""), derivedFrom);
  return {
    schema_version: 1,
    title: `${title || "Entwicklungsprojekt"} Architektur`,
    summary: description || "Projektgebundene Architektur-Discovery mit PlantUML-Skizze.",
    template_id: String(templateId || ""),
    ...(templateId ? { template_ref: { template_id: String(templateId), model_schema_version: Number(templateModelVersion) || 1 } } : {}),
    primary_source_path: buildable ? (buildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp") : "docs/architecture.puml",
    hide_source_editor: !buildable,
    mode: "architecture_discovery",
    ...(architectureDialog ? { architecture_dialog: normalizeArchitectureDialog(architectureDialog, diagram || { source: plantUmlSource }) } : {}),
    ...(communicationSetup ? { communication_setup: normalizeProjectCommunicationSetup(communicationSetup) } : {}),
    ...(homeAutomationConfiguration ? { home_automation_configuration: normalizeHomeAutomationConfiguration(homeAutomationConfiguration) } : {}),
    ...(gameConfiguration ? { game_configuration: normalizeTouchscreenGameConfiguration(gameConfiguration) } : {}),
    ...(pwaDashboardConfiguration ? { pwa_dashboard: normalizePwaDashboardConfiguration(pwaDashboardConfiguration) } : {}),
    ...(dataLoggerConfiguration ? { data_logger: normalizeDataLoggerConfiguration(dataLoggerConfiguration) } : {}),
    ...(eventConfiguration ? { event_configuration: eventConfiguration } : {}),
    views: [
      ...(buildable ? [{
        id: "firmware-source",
        type: "source_analysis",
        title: "IoT-Device 1 User Main",
        summary: "Account- und projektgebundene User-Main; die geschuetzte GerNetiX-Basissoftware wird erst im BuildPackage ergaenzt.",
        source_path: buildConfig.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp",
      }] : []),
      ...(plantUmlSource ? [{
        id: "architecture-diagram",
        type: "plantuml",
        title: diagram?.title || "Architektur-Skizze",
        summary: diagram?.summary || "Aus Architektur-Discovery gespeicherte PlantUML-Skizze.",
        source_path: "docs/architecture.puml",
        validation: { type: "plantuml_contains", must_contain: ["@startuml", "@enduml"] },
        payload: {
          source: plantUmlSource,
          derived_from: derivedFrom,
          ...(diagram?.function_coverage ? { function_coverage: diagram.function_coverage } : {}),
        },
      }] : []),
      ...(hardwareConfiguration ? [{
        id: "hardware-configuration",
        type: "hardware_configuration",
        title: "Hardware-Architektur",
        summary: "Vollstaendige Zuordnung von Prozessoren, Boards, Inventar-Devices, Sensoren, Aktoren, Messschaltungen und Pins.",
        source_path: "Architektur/verdrahtung/hardware.puml",
        payload: hardwareConfiguration,
      }] : []),
      {
        id: "implementation-plan",
        type: "implementation_plan",
        title: "Naechste Schritte",
        summary: "Aus der Zielarchitektur werden spaeter konkrete Umsetzungsschritte abgeleitet.",
        payload: {
          tasks: [
            "Offene Architekturfragen klaeren",
            "Zielsysteme und Datenfluesse bestaetigen",
            "Technologieentscheidungen erst nach Bestaetigung festlegen",
          ],
        },
      },
    ],
  };
}

function initialArchitecturePlantUml(title) {
  return [
    "@startuml",
    `title Architektur-Skizze: ${String(title || "Neues Entwicklungsprojekt").replace(/"/g, "'")}`,
    "",
    "rectangle \"Projektidee / Anforderungen\" as requirements",
    "@enduml",
  ].join("\n");
}

  return {
    createUserIdeState,
    project,
    normalizeLearningProjectCategory,
    normalizeLearningProjectTags,
    ownedCapabilityIds,
    normalizeCapabilityIds,
    step,
    primarySourcePath,
    projectViewManifest,
    developmentProjectViewManifest,
    initialArchitecturePlantUml,
  };
}

module.exports = { createProjectViewModel };
