const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicController = fs.readFileSync(path.resolve(__dirname, "../public/app/development-platform.js"), "utf8");
const publicCss = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
const publicHtml = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const publicApp = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const deviceOnboardingModel = fs.readFileSync(path.resolve(__dirname, "../public/app/device-onboarding-model.js"), "utf8");
const developmentHardwareModel = fs.readFileSync(path.resolve(__dirname, "../public/app/development-hardware-model.js"), "utf8");
const devServer = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const hardwareCatalogSeed = fs.readFileSync(path.resolve(__dirname, "../../hardware-catalog/src/seed.js"), "utf8");

test("restores persisted PlantUML when an existing development project is activated", () => {
  const activateProjectBody = publicController.match(/function activateProject[\s\S]*?\n    }\n\n    function architectureDiagramForProject/)?.[0] || "";
  assert.match(publicController, /function restoreDevelopmentDialog/);
  assert.match(publicController, /architectureDiagram = sanitizeArchitectureDiagram\(dialog\.architectureDiagram\) \|\| architectureDiagramForProject\(project\)/);
  assert.match(publicController, /function stripPlantUmlNotes/);
  assert.match(publicController, /function normalizeArchitecturePlantUml/);
  assert.match(publicController, /function numberGenericIotDeviceInstances/);
  assert.match(publicController, /IoT-Device \$\{instanceNumber\}/);
  assert.match(publicController, /node\|component\|database\|cloud\|queue\|artifact/);
  assert.match(publicController, /\$1rectangle \$2\$3/);
  assert.match(publicController, /ESP32 Datenlogger\/g, "IoT-Device Datenlogger"/);
  assert.match(publicController, /Startarchitektur aus Projekttemplate/);
  assert.match(publicController, /^\s*const source = normalizeArchitecturePlantUml\(stripPlantUmlNotes\(view\?\.payload\?\.source \|\| ""\), derivedFrom\)/m);
  assert.match(publicController, /view\?\.payload\?\.source/);
  assert.match(publicController, /const storedDerivedFrom = view\?\.payload\?\.derived_from \|\| ""/);
  assert.match(publicController, /usesProjectTemplate && \(!storedDerivedFrom \|\| storedDerivedFrom === "persisted_project"\)/);
  assert.doesNotMatch(activateProjectBody, /architectureDiagram = null/);
});

test("starts with visible large project choices without restoring a diagram", () => {
  assert.doesNotMatch(publicController, /if \(!activeProject && lastProject\)/);
  assert.match(publicController, /function enterProjectStart/);
  assert.match(publicController, /activeProjectId = ""/);
  assert.match(publicController, /architectureDiagram = null/);
  assert.match(publicCss, /development-project-start-step \.development-project-choice-panel \{[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(publicCss, /development-project-start-step \.development-project-choice \{[\s\S]*min-height: 132px/);
});

test("separates the architecture discovery step from the active project", () => {
  assert.match(publicHtml, /Architektur-Discovery[\s\S]*id="developmentProjectName"/);
  const sectionHead = publicHtml.match(/<div class="section-head">[\s\S]*?<\/div>\s*<section class="development-platform-layout">/)?.[0] || "";
  assert.match(sectionHead, /Projekt[\s\S]*id="developmentProjectName"/);
  assert.doesNotMatch(sectionHead, /chooseDevelopmentProjectButton/);
  assert.doesNotMatch(sectionHead, /clearDevelopmentChatButton|Dialog leeren/);
  assert.doesNotMatch(publicHtml, /development-project-summary/);
  assert.doesNotMatch(publicHtml, /Aktueller Schritt/);
  assert.doesNotMatch(publicHtml, /developmentAssistantMode/);
});

test("confirms the selected existing project explicitly before continuing", () => {
  assert.match(publicHtml, /id="selectDevelopmentProjectButton"[^>]*>Wählen und weiter<\/button>/);
  assert.match(publicController, /function updateDevelopmentProjectSelection/);
  assert.match(publicController, /selectDevelopmentProjectButton"\)\.addEventListener\("click", selectDevelopmentProject\)/);
});

test("loads the development template catalog from the server model registry", () => {
  assert.match(devServer, /development_project_templates: developmentProjectTemplateCatalog\(\)/);
  assert.match(devServer, /development_project_template_previews: developmentProjectTemplatePreviews\(\)/);
  assert.match(publicApp, /summary\.development_project_template_previews \|\| \[\]/);
  assert.match(publicController, /function setProjectTemplates/);
  assert.match(publicController, /projectTemplates = Object\.fromEntries/);
  assert.match(publicHtml, /<select id="developmentProjectTemplate"><\/select>/);
  assert.match(publicHtml, /id="openDevelopmentTemplateHelpButton"/);
  assert.match(publicHtml, /id="developmentTemplateHelpDialog"/);
  assert.match(publicController, /function openDevelopmentTemplateHelp\(\)/);
  assert.match(publicController, /Premium erforderlich/);
  assert.match(publicController, /templateEntitlementLabel/);
  assert.doesNotMatch(publicHtml, /<option value="esp32_device_only"/);
  assert.doesNotMatch(publicController, /const projectTemplates = \{/);
});

test("persists architecture derivation metadata in the project view manifest", () => {
  assert.match(devServer, /developmentProjectDialog/);
  assert.match(devServer, /handleDevelopmentProjectDialogSave/);
  assert.match(devServer, /architecture_dialog: architectureDialog/);
  assert.match(devServer, /function normalizeArchitectureDialog/);
  assert.match(devServer, /function stripPlantUmlNotes/);
  assert.match(devServer, /function normalizeArchitecturePlantUml/);
  assert.match(devServer, /function numberGenericIotDeviceInstances/);
  assert.match(devServer, /Logische Architektur bleibt notationsoffen/);
  assert.match(devServer, /node\|component\|database\|cloud\|queue\|artifact/);
  assert.match(devServer, /ESP32 Datenlogger\/g, "IoT-Device Datenlogger"/);
  assert.match(devServer, /Startarchitektur aus Projekttemplate/);
  assert.match(devServer, /const plantUmlSource = normalizeArchitecturePlantUml\(stripPlantUmlNotes/);
  assert.doesNotMatch(devServer, /KI-abgeleitete Skizze; Architekturentscheidungen/);
  assert.match(devServer, /template_id: String\(templateId \|\| ""\)/);
  assert.match(devServer, /template_ref: \{ template_id: String\(templateId\), model_schema_version:/);
  assert.match(devServer, /function restoreDevelopmentTemplateReference/);
  assert.match(devServer, /templateArchitecturePlantUml\(developmentProjectTemplate\(template\.id\), project\.title\)/);
  assert.match(devServer, /templateId: template\.id/);
  assert.match(devServer, /templateModelVersion: template\.schemaVersion/);
  assert.match(publicController, /persistDevelopmentDialog/);
  assert.match(publicController, /\/dialog`/);
  assert.match(devServer, /const usesProjectTemplate = Boolean\(templateId && templateId !== "empty"\)/);
  assert.match(devServer, /const derivedFrom = diagram\?\.derived_from \|\| \(usesProjectTemplate \|\| buildable \? "project_template" : "persisted_project"\)/);
  assert.match(devServer, /derived_from: derivedFrom/);
  assert.match(devServer, /diagram\?\.function_coverage/);
});

test("development chat uses a compact arrow send button inside the input", () => {
  assert.match(publicHtml, /development-chat-input-box/);
  assert.match(publicHtml, /development-platform\.js\?v=20260716-02/);
  assert.match(publicHtml, /development-chat-input-box[\s\S]*developmentQuickPrompts[\s\S]*developmentChatInput[\s\S]*developmentChatSubmit/);
  assert.match(publicHtml, /development-send-button/);
  assert.match(publicHtml, /aria-label="Nachricht senden"/);
  assert.match(publicHtml, /&uarr;/);
  assert.doesNotMatch(publicHtml, /id="developmentChatSubmit"[\s\S]*>Senden<\/button>/);
  assert.doesNotMatch(publicHtml, /developmentChatStatus|Bereit fuer Architekturfragen/);
  assert.doesNotMatch(publicController, /setChatStatus/);
  assert.doesNotMatch(publicCss, /\.chat-status/);
  assert.match(publicCss, /\.development-chat-input-box \{[\s\S]*display: grid/);
  assert.match(publicCss, /\.development-send-button \{[\s\S]*border-radius: 999px/);
  assert.match(publicCss, /\.development-quick-prompts \{[\s\S]*display: flex/);
  assert.match(publicCss, /\.development-chat-form textarea \{[\s\S]*background: transparent/);
  assert.match(publicController, /function currentProjectUsesTemplate/);
  assert.match(publicController, /currentProjectTemplateId\(\) === "distributed_home_automation"/);
  assert.match(publicController, /if \(currentProjectUsesTemplate\(\)\) return \[\]/);
  assert.match(publicController, /Ich moechte einen Touchscreen Game Loop/);
  assert.match(publicController, /"Touchscreen Game Loop"/);
  assert.equal((publicController.match(/const usesProjectTemplate = currentProjectUsesTemplate\(\);/g) || []).length, 2);
  assert.match(publicController, /state\.developmentPlatform\.chat = \[\]/);
});

test("uses one component configuration for every template except the game collection", () => {
  assert.match(publicHtml, /id="templateComponentConfiguration"/);
  assert.match(publicHtml, /id="toggleDevelopmentAssistantButton"/);
  assert.match(publicHtml, /id="developmentChatSidebar"[\s\S]*hidden/);
  assert.doesNotMatch(publicHtml, /id="homeAutomationAssistant"/);
  assert.match(publicController, /function usesTemplateComponentConfiguration/);
  assert.match(publicController, /templateId !== "touchscreen_game_collection"/);
  assert.match(publicController, /function renderTemplateComponentConfiguration/);
  assert.match(publicController, /data-template-component-type/);
  assert.match(publicController, /data-template-component-add/);
  assert.match(publicController, /data-template-connection-target/);
  assert.match(publicController, /Bitte waehle die IoT-Steuereinheit/);
  assert.match(publicController, /Bitte waehle eine zulaessige Beziehung fuer diese Komponente/);
  assert.match(publicController, /template-component-connection-hints/);
  assert.match(publicController, /Diese Komponenten haben noch keine zulaessige Verbindung/);
  assert.match(publicController, /DevelopmentComponentMetamodel/);
  assert.match(publicController, /function controlUnitAssignments/);
  assert.match(publicController, /function componentConnectionAssignments/);
  assert.match(publicController, /functionCoverage\.complete/);
  assert.match(publicController, /relationshipRule\.source_type === type/);
  assert.match(publicController, /function appendTemplateComponent/);
  assert.match(publicController, /function toggleDevelopmentAssistant/);
  assert.match(publicController, /assistantOpen: false/);
  assert.match(publicCss, /\.template-component-configuration \{/);
  assert.match(publicCss, /\.template-component-layout \{/);
  assert.match(publicCss, /\.template-component-connection-hints \{/);
});

test("preserves managed event-application component types when PlantUML is reopened", () => {
  assert.match(publicController, /function hardwareComponentType\(label, plantUmlType\)/);
  assert.match(publicController, /projekt\.runtime\.daten.*return "project_runtime_data"/);
  assert.match(publicController, /ereignis\.worker.*return "event_worker"/);
  assert.match(publicController, /ereignis\.dispatcher.*return "event_dispatcher"/);
  assert.match(publicController, /projekt\.push\.versand.*return "notification_service"/);
  assert.match(publicController, /iot\.\?zielger\(\?:ae\|ä\)t.*return "iot_device"/);
});

test("keeps managed services out of the user component configuration", () => {
  assert.match(publicController, /const configurableComponents = components\.filter\(isUserConfigurableComponent\)/);
  assert.match(publicController, /function isUserConfigurableComponent\(component\)/);
  assert.match(publicController, /user_configurable !== false/);
});

test("refreshes legacy templates without exposing infrastructure components", () => {
  assert.match(publicController, /function refreshProjectTemplateDiagram\(diagram, templateId\)/);
  assert.match(publicController, /event_driven_project_application", "iot_datalogger_web_push_pwa/);
  assert.match(publicController, /telemetry\|runtime\|push/);
  assert.match(publicController, /telemetry\|storage\|push/);
  assert.match(publicController, /projectTemplatePreviews\[templateId\]\?\.source/);
});

test("separates project start and initial architecture from configuration", () => {
  assert.match(publicHtml, /id="continueDevelopmentConfigurationButton"[^>]*>Weiter zur Konfiguration<\/button>/);
  assert.match(publicHtml, /development-requirements-panel development-configuration-only/);
  assert.match(publicHtml, /development-chat-sidebar development-configuration-only hidden/);
  assert.match(publicHtml, /saveDevelopmentArchitectureButton" type="button" disabled>Konfiguration speichern<\/button>/);
  assert.match(publicHtml, /acceptDevelopmentArchitectureButton" class="primary" type="button" disabled>Weiter zur Hardware<\/button>/);
  assert.match(publicController, /workflowStep: "project_start"/);
  assert.match(publicController, /function continueToDevelopmentConfiguration/);
  assert.match(publicController, /workflowStep = "configuration"/);
  assert.match(publicController, /function renderWorkflowStep/);
  assert.match(publicCss, /\.development-workspace-panel\.development-project-start-step/);
  assert.match(publicController, /projectTemplatePreviews\[templateInput\.value\]/);
  assert.match(publicController, /target\.classList\.toggle\("hidden", !configurationStep\)/);
  assert.match(publicApp, /enteringDevelopmentPlatform/);
  assert.match(publicApp, /developmentPlatform\(\)\.enterProjectStart\(\)/);
  assert.match(devServer, /template\.id === "empty" \? "" : templateArchitecturePlantUml/);
});

test("requires an explicit template choice before entering project details", () => {
  assert.match(publicController, /`<option value="">Template waehlen<\/option>`/);
  assert.match(publicController, /developmentProjectTemplate"\)\.value = ""/);
  assert.doesNotMatch(publicController, /developmentProjectTemplate"\)\.value = "esp32_device_only"/);
  assert.match(publicController, /const templateSelected = Boolean\(templateInput\.value && templateInput\.value !== "empty"\)/);
  assert.match(publicHtml, /id="developmentProjectDetails"/);
  assert.match(publicController, /details\?\.classList\.toggle\("hidden", choosingTemplate && !templateSelected\)/);
  assert.match(publicController, /titleInput\.disabled = choosingTemplate && !templateSelected/);
  assert.match(publicController, /submitButtons\.forEach/);
  assert.match(publicController, /button\.disabled = choosingTemplate && !templateSelected/);
  assert.match(publicController, /projectPanelMode === "new-template" && !selectedTemplateId/);
  assert.match(publicController, /Bitte waehle zuerst ein Projekttemplate/);
});

test("opens every selected template directly in component configuration", () => {
  assert.doesNotMatch(publicHtml, /data-create-and-continue/);
  assert.match(publicController, /const startsInConfiguration = selectedTemplateId && selectedTemplateId !== "empty"/);
  assert.match(publicController, /workflowStep = startsInConfiguration \? "configuration" : "project_start"/);
  assert.match(publicController, /Konfiguration ist geoeffnet/);
});

test("configures a touchscreen game collection through pattern, games, board and inventory", () => {
  assert.match(publicHtml, /id="touchscreenGameAssistant"/);
  assert.match(publicHtml, /Touchscreen Game Loop/);
  assert.match(publicHtml, /Passendes Board im Inventar/);
  assert.match(publicController, /function renderTouchscreenGameAssistant/);
  assert.match(publicController, /Nibbles/);
  assert.match(publicController, /Snake/);
  assert.match(publicController, /Frogger/);
  assert.match(publicController, /Tic-Tac-Toe/);
  assert.match(publicController, /function touchscreenGameArchitectureDiagram/);
  assert.match(publicController, /actor "Nutzer" as user/);
  assert.match(publicController, /rectangle "Board mit Touchdisplay" as device/);
  assert.doesNotMatch(publicController, /rectangle "Startbildschirm\\nSpielauswahl" as start_screen/);
  assert.match(publicController, /gameConfiguration: state\.developmentPlatform\.gameConfiguration/);
  assert.match(publicApp, /route === "development-platform"\) loadProcessorBoardCatalog/);
  assert.match(devServer, /normalizeTouchscreenGameConfiguration/);
  assert.match(devServer, /selectedGamesHeader\(gameConfiguration\.selected_game_ids\)/);
  assert.match(devServer, /game_inventory_device_not_compatible/);
});

test("development platform scales like a compact workspace", () => {
  assert.match(publicApp, /development-workspace-active", route === "development-platform"/);
  assert.match(publicCss, /\.development-workspace-active \{[\s\S]*min-height: 100dvh;[\s\S]*overflow: auto/);
  assert.match(publicCss, /\.development-workspace-active \.app-shell \{[\s\S]*padding: 4px 8px 8px/);
  assert.match(publicCss, /\.development-workspace-active #developmentPlatformView \{[\s\S]*flex: 1 1 auto;[\s\S]*overflow: visible/);
  assert.match(publicCss, /\.development-workspace-active \.development-platform-layout,[\s\S]*\.development-workspace-active \.development-workspace-panel \{[\s\S]*overflow: visible/);
  assert.match(publicCss, /\.development-workspace-active \.development-workspace-panel \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) clamp\(300px, 26vw, 360px\)/);
  assert.match(publicCss, /\.development-workspace-active \.development-chat-form textarea \{[\s\S]*font-size: 13px/);
  assert.match(publicCss, /\.development-workspace-active \.development-main-workspace \{[\s\S]*minmax\(34px, auto\)/);
  assert.match(publicCss, /\.development-workspace-active \.architecture-diagram-panel \{[\s\S]*overflow: auto/);
  assert.match(publicCss, /\.development-workspace-active \.architecture-diagram-panel \.plantuml-viewer \{[\s\S]*max-height: 58vh/);
  assert.match(publicCss, /\.development-workspace-active \.architecture-diagram-panel \.plantuml-diagram \{[\s\S]*height: 100%;[\s\S]*object-fit: contain/);
  assert.match(publicCss, /\.development-workspace-active \.development-page-actions button \{[\s\S]*font-size: 12px/);
});

test("development platform places requirements and architecture centrally with chat on the right", () => {
  assert.match(publicHtml, /development-main-workspace[\s\S]*developmentRequirementsText[\s\S]*developmentArchitectureDiagram/);
  assert.doesNotMatch(publicHtml.match(/<section id="developmentPlatformView"[\s\S]*?<section id="developmentHardwareView"/)?.[0] || "", /developmentHardwareAllocation/);
  assert.match(publicHtml, /development-chat-sidebar[\s\S]*developmentChatMessages[\s\S]*developmentChatForm/);
  assert.doesNotMatch(publicHtml, /chooseDevelopmentProjectButton/);
  assert.match(publicHtml, /backToDevelopmentProjectStartButton" type="button">Projekt wechseln<\/button>/);
  assert.match(publicHtml, /saveDevelopmentArchitectureButton" type="button" disabled>Konfiguration speichern<\/button>/);
  assert.match(publicHtml, /acceptDevelopmentArchitectureButton" class="primary" type="button" disabled>Weiter zur Hardware<\/button>/);
  assert.doesNotMatch(publicHtml, /startFunctionClarificationButton|startEffectChainButton|Architektur speichern/);
  assert.match(publicCss, /\.development-workspace-panel \{[\s\S]*grid-template-areas:[\s\S]*"project chat"[\s\S]*"main chat"/);
  assert.match(publicCss, /\.development-chat-sidebar \{[\s\S]*grid-area: chat/);
  assert.match(publicCss, /\.development-main-workspace \{[\s\S]*grid-area: main/);
  assert.match(publicController, /function renderRequirementsText/);
  assert.match(publicController, /development-platform\/hardware\/\?project=/);
  assert.match(publicController, /developmentRequirementsText/);
  assert.match(publicController, /function requirementSummaryItems/);
  assert.match(publicController, /Projektkern/);
  assert.match(publicController, /IoT-Devices/);
  assert.doesNotMatch(publicController, /Letzte Nutzeraussage/);
  assert.doesNotMatch(publicController, /Letzte KI-Einordnung/);
  assert.match(publicCss, /\.development-requirements-text \{[\s\S]*display: flex/);
  assert.match(publicCss, /\.development-requirements-text article \{[\s\S]*border-radius: 999px/);
  assert.match(publicCss, /\.chat-message p \{[\s\S]*font-size: 13px/);
  assert.doesNotMatch(publicController, /diagram\.summary \|\| ""/);
  assert.doesNotMatch(publicController, /diagram-card-head/);
  assert.doesNotMatch(publicController, /functionCoverageHint\(diagram\)/);
});

test("hardware allocation is a persisted intermediate view with boards, circuits and pins", () => {
  assert.match(publicHtml, /id="developmentHardwareView"[\s\S]*developmentHardwareArchitecture[\s\S]*developmentHardwareComponents/);
  assert.match(publicHtml, /hardware-overview[\s\S]*developmentHardwareArchitecture[\s\S]*developmentHardwareHints/);
  assert.doesNotMatch(publicHtml, /developmentHardwareWiring/);
  assert.doesNotMatch(publicHtml, /Konkretisierung|Abstrakte Komponenten zuordnen|Boards, Sensoren und Aktoren werden konkretisiert/);
  assert.match(publicHtml, /Hardware speichern/);
  assert.match(publicHtml, /Weiter zur IDE/);
  assert.match(publicApp, /"development-hardware": "developmentHardwareView"/);
  assert.match(publicApp, /development-platform\\\/hardware/);
  assert.match(publicController, /function renderHardwareConfiguration/);
  assert.match(publicController, /processor\.variant === "ESP32" \? "ESP32 \(klassisch\)" : processor\.variant/);
  assert.match(publicController, /data-hardware-processor-help/);
  assert.match(publicController, /openHelpTopic\?\.\("supported-devices"\)/);
  assert.match(publicApp, /openHelpTopic: HelpView\.openDialog/);
  assert.match(hardwareCatalogSeed, /PT1000 Widerstandsthermometer/);
  assert.match(publicController, /Konstantstromquelle \/ Messbruecke/);
  assert.match(publicController, /DC-Motorsteuerung/);
  assert.match(publicController, /function boardPins/);
  assert.match(publicController, /data-hardware-processor/);
  assert.match(publicController, /class="hardware-board-selection"/);
  assert.match(publicController, /class="hardware-sensor-selection"/);
  assert.match(publicController, /class="hardware-table-row hardware-sensor-row"/);
  assert.match(publicController, /class="hardware-inline-assignment"/);
  assert.doesNotMatch(publicController, /hardware-table-head/);
  assert.match(publicController, /Sensorart<select data-hardware-sensor-category/);
  assert.match(publicController, /Hardware Catalog nicht erreichbar/);
  assert.match(publicController, /hardware-catalog-hint/);
  assert.match(publicApp, /sensorCatalogStatus: \{ state: "idle", message: "" \}/);
  assert.match(publicApp, /state\.sensorCatalogStatus = \{ state: "error"/);
  const sensorCatalogLoader = publicApp.match(/async function loadSensorCatalog\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(sensorCatalogLoader, /setInventoryStatus/);
  assert.match(publicController, /Erfassung<select data-hardware-signal-type/);
  assert.match(publicController, /Konkreter Sensor<select data-hardware-field="concrete_type"/);
  assert.match(publicController, /Zyklischer Datenlogger/);
  assert.match(publicController, /data-hardware-property="sampling_interval_value"/);
  assert.match(publicController, /data-hardware-property="samples_per_record"/);
  assert.match(publicController, /Effektivwert \(RMS\)/);
  assert.match(publicController, /Lokale Messwerthistorie/);
  assert.doesNotMatch(publicController, /\["sensor", "actuator"\]\.includes\(component\.abstract_type\).*Beschreibung/);
  assert.match(publicController, /next\.abstract_type === "sensor"\) delete next\.properties\.description/);
  assert.match(publicController, /incremental_ab/);
  assert.match(publicController, /Zuerst Prozessor waehlen/);
  assert.match(publicController, /DevelopmentHardwareModel\.boardsForProcessor/);
  assert.match(publicController, /component\.abstract_type === "iot_device"\) \{[\s\S]*Inventar-Device/);
  assert.doesNotMatch(publicController, /board\.vendor \|\| "Board"/);
  assert.match(publicController, /DevelopmentHardwareModel\.selectionForComponent\(merged, boards\)/);
  assert.match(developmentHardwareModel, /function applyProcessorSelection/);
  assert.match(developmentHardwareModel, /processor_family/);
  assert.match(devServer, /processor_variant: String\(component\.processor_variant/);
  assert.match(devServer, /sensor_category: String\(component\.sensor_category/);
  assert.match(devServer, /signal_type: String\(component\.signal_type/);
  assert.match(devServer, /inventory_device_id: String\(component\.inventory_device_id/);
  assert.match(publicController, /Inventar-Board<select data-hardware-field="inventory_device_id"/);
  assert.match(publicController, /Board und Prozessor werden übernommen\./);
  assert.match(publicController, /inventoryBoard\s*\r?\n\s*\?\s*DevelopmentHardwareModel\.applyProcessorSelection/);
  assert.match(publicController, /function renderHardwareHints/);
  assert.match(publicController, /<h3>Offene Punkte<\/h3>/);
  assert.doesNotMatch(publicController, /<strong>Offen<\/strong>/);
  assert.match(publicController, /function recommendedHardwareAction/);
  assert.match(publicController, /Empfohlene Maßnahme:/);
  assert.match(publicCss, /\.hardware-hint-terminal \{[\s\S]*max-height:[\s\S]*overflow-y: auto/);
  assert.match(publicController, /Die Zuordnung kann bis dahin nachgeholt werden/);
  assert.match(publicController, /Bitte klaere zuerst die offenen Punkte in der Hinweisbox/);
  assert.match(devServer, /component_device_allocations: allocations/);
  assert.doesNotMatch(devServer, /handleProjectDeviceAllocation/);
  assert.match(devServer, /\/api\/platform\/hardware\/sensors/);
  assert.match(devServer, /error: "hardware_catalog_unreachable"/);
  assert.match(devServer, /Sensorarten konnten nicht aus dem Hardware Catalog geladen werden/);
  assert.ok(devServer.indexOf('/api/platform/hardware/sensors') < devServer.indexOf('async function handleDevelopmentProjectDialogSave'));
  assert.match(publicHtml, /development-hardware-model\.js/);
  assert.match(publicController, /hardware-configuration`/);
  assert.match(devServer, /handleDevelopmentProjectHardwareSave/);
  assert.match(devServer, /id: "hardware-configuration"/);
  assert.match(devServer, /Architektur\/verdrahtung\/hardware\.puml/);
  assert.match(devServer, /role: "hardware_architecture_view"/);
  assert.match(devServer, /Hardware-Architektur:/);
  assert.match(devServer, /Inventarzuordnung/);
  assert.match(devServer, /Sensorart:/);
  assert.match(devServer, /Erfassung:/);
  assert.match(devServer, /zweiter Pin:/);
  assert.match(devServer, /Konfiguration\/Hardware\/Schaltungen/);
  assert.match(devServer, /PT1000-Messschaltung/);
  assert.match(publicCss, /\.hardware-component-table \{[\s\S]*min-width: 1380px/);
  assert.match(publicCss, /\.hardware-board-selection \{[\s\S]*grid-template-columns: repeat\(3, minmax\(190px, 1fr\)\)/);
  assert.match(publicCss, /\.hardware-sensor-selection \{[\s\S]*display: contents/);
  assert.match(publicCss, /\.hardware-table-row\.hardware-sensor-row \{[\s\S]*grid-template-columns: minmax\(160px, \.55fr\) minmax\(920px, 3\.45fr\)/);
  assert.match(publicCss, /\.hardware-inline-assignment \{[\s\S]*grid-auto-flow: column/);
  assert.doesNotMatch(publicCss, /\.hardware-signal-chain/);
  assert.match(publicCss, /Hardware-Realisierung folgt derselben dunklen Workspace-Sprache/);
  assert.match(publicCss, /\.hardware-table-row \{[\s\S]*background: #111827;[\s\S]*color: #e5e7eb/);
  assert.match(publicCss, /\.hardware-table-row select,[\s\S]*background: #0b1018;[\s\S]*color: #e5e7eb/);
  assert.match(publicCss, /\.hardware-page-actions \{[\s\S]*background: rgba\(11, 16, 24, \.96\)/);
  assert.match(publicCss, /\.hardware-overview \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(280px, 360px\)/);
  assert.match(publicCss, /\.hardware-guidance-panel \{[\s\S]*background: #0d1520/);
});

test("motor actuators expose a concrete motor controller selection", () => {
  assert.match(publicController, /Synchronmotor \/ BLDC \/ PMSM/);
  assert.match(publicController, /Motorsteuerung<select data-hardware-property="motor_driver_type"/);
  assert.match(publicController, /three_phase_foc/);
  assert.match(publicController, /three_phase_six_step/);
  assert.match(publicController, /Phase V<select data-hardware-property="phase_v_pin"/);
  assert.match(publicController, /Phase W<select data-hardware-property="phase_w_pin"/);
  assert.match(publicController, /Motorsteuerung`/);
  assert.match(devServer, /synchronous_motor_driver/);
});

test("iot device suggestions include common board families", () => {
  assert.match(publicApp, /hardware\.processor_board\.raspberry_pi_zero_2w/);
  assert.match(publicApp, /Arduino Nano R3 \/ ATmega328P/);
  assert.match(publicApp, /ESP-WROOM-32/);
  assert.match(deviceOnboardingModel, /raspberry_pi: "Raspberry Pi"/);
  assert.match(deviceOnboardingModel, /text\.includes\("raspberry"\)/);
});
