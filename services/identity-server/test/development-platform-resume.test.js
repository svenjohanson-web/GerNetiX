const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicController = fs.readFileSync(path.resolve(__dirname, "../public/app/development-platform.js"), "utf8");
const publicRuntimeUtils = fs.readFileSync(path.resolve(__dirname, "../public/app/app-runtime-utils.js"), "utf8");
const publicCss = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
const publicHtml = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const publicApp = readPlatformAppSource();
const deviceOnboardingModel = fs.readFileSync(path.resolve(__dirname, "../public/app/device-onboarding-model.js"), "utf8");
const developmentHardwareModel = fs.readFileSync(path.resolve(__dirname, "../public/app/development-hardware-model.js"), "utf8");
const developmentComponentMetamodel = fs.readFileSync(path.resolve(__dirname, "../public/app/development-component-metamodel.js"), "utf8");
const devServer = [
  "../src/dev/server/project-routes.js",
  "../src/dev/server/hardware-routes.js",
  "../src/dev-server.js",
].map((file) => fs.readFileSync(path.resolve(__dirname, file), "utf8")).join("\n");
const hardwareCatalogSeed = fs.readFileSync(path.resolve(__dirname, "../../hardware-catalog/src/seed.js"), "utf8");

test("wires all development platform controller dependencies", () => {
  const controllerCreation = publicApp.match(/DevelopmentPlatform\.create\(\{[\s\S]*?\n    \}\)/)?.[0] || "";
  assert.match(controllerCreation, /postJson,/);
  assert.match(controllerCreation, /deleteJson,/);
  assert.match(controllerCreation, /loadProcessorBoardCatalog,/);
  assert.match(controllerCreation, /openHelpTopic: InformationView\.openDialog/);
  assert.match(publicApp, /loadPlatformScript\("\/app\/development-platform\.js\?v=20260806-project-summary-lazy-1"\)/);
});

test("restores persisted PlantUML when an existing development project is activated", () => {
  const activateProjectBody = publicController.match(/function activateProject[\s\S]*?\n    }\n\n    function architectureDiagramForProject/)?.[0] || "";
  assert.match(publicController, /function restoreDevelopmentDialog/);
  assert.match(publicController, /const storedDiagram = sanitizeArchitectureDiagram\(dialog\.architectureDiagram\)/);
  assert.match(publicController, /architectureDiagram = refreshProjectTemplateDiagram\([\s\S]*storedDiagram \|\| architectureDiagramForProject\(project\)/);
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

test("keeps the project choice surface consistent with the dark workspace", () => {
  const choiceSurfaceRule = publicCss.match(/\.development-project-header > \.development-project-choice-panel:not\(\.hidden\),[\s\S]*?\{([^}]*)\}/)?.[1] || "";
  assert.match(choiceSurfaceRule, /background: #111827/);
  assert.doesNotMatch(choiceSurfaceRule, /background: #fff/);
  assert.match(publicHtml, /app\.css\?v=20260808-learning-progress-map-2/);
});

test("separates the architecture discovery step from the active project", () => {
  assert.match(publicHtml, /Architektur-Discovery[\s\S]*id="developmentProjectName"/);
  const sectionHead = publicHtml.match(/<div class="section-head">[\s\S]*?<\/div>\s*<section class="development-platform-layout">/)?.[0] || "";
  assert.match(sectionHead, /development-current-project hidden[\s\S]*id="developmentProjectName"><\/strong>/);
  assert.match(publicController, /closest\("\.development-current-project"\)\?\.classList\.toggle\("hidden", !activeProject\)/);
  assert.doesNotMatch(sectionHead, /chooseDevelopmentProjectButton/);
  assert.doesNotMatch(sectionHead, /clearDevelopmentChatButton|Dialog leeren/);
  assert.doesNotMatch(publicHtml, /development-project-summary/);
  assert.doesNotMatch(publicHtml, /Aktueller Schritt/);
  assert.doesNotMatch(publicHtml, /developmentAssistantMode/);
});

test("opens selected and last existing development projects directly in the IDE", () => {
  assert.match(publicHtml, /id="selectDevelopmentProjectButton"[^>]*>In IDE öffnen<\/button>/);
  assert.match(publicController, /function updateDevelopmentProjectSelection/);
  assert.match(publicController, /selectDevelopmentProjectButton"\)\.addEventListener\("click", selectDevelopmentProject\)/);
  assert.match(publicController, /async function continueLastProject\(\)[\s\S]*await openExistingDevelopmentProject\(storedProjectId\)/);
  assert.match(publicController, /async function selectDevelopmentProject\(\)[\s\S]*await openExistingDevelopmentProject\(projectId\)/);
  assert.match(publicController, /async function openExistingDevelopmentProject\(projectId\)[\s\S]*await openProjectInIde\(projectId\)/);
  assert.doesNotMatch(publicController.match(/async function continueLastProject[\s\S]*?\n    \}/)?.[0] || "", /activateProject/);
  assert.doesNotMatch(publicController.match(/async function selectDevelopmentProject[\s\S]*?\n    \}/)?.[0] || "", /activateProject/);
  assert.match(publicController, /data-configure-development-project/);
  assert.match(publicController, />In IDE oeffnen<\/button>/);
  assert.match(publicController, />Konfiguration<\/button>/);
  assert.match(publicController, /if \(openButton\) \{ await openExistingDevelopmentProject\(openButton\.dataset\.openDevelopmentProject\)/);
  assert.match(publicController, /if \(configureButton\) \{ await activateProject\(configureButton\.dataset\.configureDevelopmentProject\)/);
  assert.match(publicController, /async function activateProject\(projectId\)[\s\S]*await loadProjectDetail\(projectId\)/);
});

test("never traps an account without development projects in the open or manage panels", () => {
  assert.match(publicHtml, /id="developmentProjectOpenEmpty"/);
  assert.match(publicHtml, /Noch kein Entwicklungsprojekt vorhanden/);
  assert.match(publicHtml, /data-development-project-back>Zurück zur Auswahl/);
  assert.doesNotMatch(publicHtml, /data-development-project-new-empty/);
  assert.doesNotMatch(publicHtml, /data-development-project-new-template/);
  assert.match(publicController, /function handleProjectPanelNavigation/);
  assert.match(publicController, /showProjectPanel\("choice"\)/);
  assert.match(publicController, /developmentProjectOpenSelection"\)\.classList\.toggle\("hidden", projects\.length === 0\)/);
  assert.match(publicController, /developmentProjectOpenEmpty"\)\.classList\.toggle\("hidden", projects\.length > 0\)/);
  assert.match(publicController, /Noch keine eigenen Entwicklungsprojekte vorhanden/);
  assert.match(publicController, /<h3>Entwicklungsprojekte verwalten<\/h3>/);
  assert.match(publicController, /Erstellt: <time datetime=/);
  assert.match(publicController, /Zuletzt bearbeitet: <time datetime=/);
  assert.match(publicController, /formatDevelopmentProjectDate\(project\.createdAt\)/);
  assert.match(publicController, /formatDevelopmentProjectDate\(project\.updatedAt\)/);
  assert.doesNotMatch(publicController, /project\.description \|\| "Keine Beschreibung\."/);
  assert.doesNotMatch(publicHtml, /<script[^>]+development-platform\.js/);
});

test("loads the development template catalog from the server model registry", () => {
  assert.match(devServer, /if \(sections\.has\("development"\)\) \{[\s\S]*payload\.development_project_templates = developmentProjectTemplateCatalog\(\)/);
  assert.match(devServer, /payload\.development_project_template_previews = developmentProjectTemplatePreviews\(\)/);
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

test("creates a board-bound AI playground through the existing project and repository flow", () => {
  assert.match(publicHtml, /id="developmentProjectBoardField"/);
  assert.match(publicController, /boardSelectionRequired: template\.board_selection_required === true/);
  assert.match(publicController, /board_profile_id: boardInput\.value/);
  assert.match(publicController, /Welche Experimente passen zu den Funktionen meines Boards/);
  assert.match(publicController, /assistantOpen = selectedTemplateId === "ai_board_playground"/);
  assert.match(devServer, /template\.id === "ai_board_playground"/);
  assert.match(devServer, /board_playground_board_unavailable/);
  assert.match(devServer, /board_configuration: compilerBoardConfiguration\(null, selectedPlaygroundBoard\)/);
  assert.match(devServer, /software_unit_id: "board_playground"/);
  assert.match(devServer, /templateVariant = selectedPlaygroundBoard/);
});

test("persists architecture derivation metadata in the project view manifest", () => {
  assert.match(devServer, /development-projects\\\/\(\[\^\/\]\+\)\\\/dialog/);
  assert.match(devServer, /handleDevelopmentProjectDialogSave/);
  assert.match(devServer, /architecture_dialog: architectureDialog/);
  assert.match(devServer, /function normalizeArchitectureDialog/);
  assert.match(devServer, /function projectViewManifestForClient/);
  assert.match(devServer, /viewManifest\.architecture_dialog\.messages\.slice\(-12\)/);
  assert.match(devServer, /input\.messages\.slice\(-12\)/);
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

test("refreshes legacy camera template architecture to IoT-device aggregates without board boundaries", () => {
  assert.match(publicController, /"esp32_camera_to_touch_display"/);
  assert.match(publicController, /\/\^project_template\/\.test\(diagram\.derived_from \|\| ""\)/);
  assert.match(publicController, /camera_app\|display_app\|camera_board\|display_board/);
  assert.match(publicController, /projectTemplatePreviews\[templateId\]\?\.source/);
});

test("development chat uses a compact arrow send button inside the input", () => {
  assert.match(publicHtml, /development-chat-input-box/);
  assert.match(publicApp, /developmentPlatform\(\)\.init\(\)/);
  assert.match(publicHtml, /development-chat-input-box[\s\S]*developmentQuickPrompts[\s\S]*developmentChatInput[\s\S]*developmentChatSubmit/);
  assert.match(publicHtml, /development-send-button/);
  assert.match(publicHtml, /aria-label="Nachricht senden"/);
  assert.match(publicHtml, /&uarr;/);
  assert.doesNotMatch(publicHtml, /id="developmentChatSubmit"[^>]*>Senden<\/button>/);
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
  assert.match(publicController, />Sensor anschliessen</);
  assert.match(publicController, />Aktor anschliessen</);
  assert.match(publicController, /Anschlussweg zum Prozessor \/ Board/);
  assert.match(publicController, /Direkt anschliessen/);
  assert.match(publicController, /Ueber eine zusaetzliche Schaltung/);
  assert.match(publicController, /data-template-component-connection-mode/);
  assert.match(publicController, /ueber Zusatzschaltung/);
  assert.match(publicController, /function componentConnectionModeAssignments/);
  assert.match(publicController, /data-template-component-add/);
  assert.match(publicController, /data-template-connection-target/);
  assert.match(publicController, /data-template-connection-option/);
  assert.match(publicController, /querySelectorAll\("\[data-template-connection-option\]:checked"\)/);
  assert.match(publicController, /Bitte waehle mindestens eine zulaessige Beziehung/);
  assert.match(publicController, /relations\.join\("\\n"\)/);
  assert.match(publicController, /Bitte waehle die IoT-Steuereinheit/);
  assert.match(publicController, /Bitte waehle mindestens eine zulaessige Beziehung fuer diese Komponente/);
  assert.match(publicController, /template-component-connection-hints/);
  assert.match(publicController, /Diese Komponenten haben noch keine zulaessige Verbindung/);
  assert.match(publicController, /componentTypeForPlantUml\(label, plantUmlType, componentId\)/);
  assert.match(publicController, /DevelopmentComponentMetamodel/);
  assert.match(publicController, /function controlUnitAssignments/);
  assert.match(publicController, /function componentConnectionAssignments/);
  assert.match(publicController, /functionCoverage\.complete/);
  assert.match(publicController, /relationshipRule\.source_type === type/);
  assert.match(publicController, /function appendTemplateComponent/);
  assert.match(publicController, /data-template-component-remove/);
  assert.match(publicController, /function removeTemplateComponent\(componentId\)/);
  assert.match(publicController, /relation\[1\] !== componentId && relation\[2\] !== componentId/);
  assert.match(publicController, /item\.component_id !== componentId && item\.target_device_id !== componentId/);
  assert.match(publicController, /function toggleDevelopmentAssistant/);
  assert.match(publicController, /assistantOpen: false/);
  assert.match(publicCss, /\.template-component-configuration \{/);
  assert.match(publicCss, /\.template-component-layout \{/);
  assert.match(publicCss, /\.template-component-connection-hints \{/);
  assert.match(publicCss, /\.template-component-connections \{/);
  assert.match(publicCss, /\.template-component-remove \{/);
});

test("keeps the selected component type when a custom label does not describe it", () => {
  assert.match(publicController, /hardwareComponentType\(label, match\[1\], match\[3\]\)/);
  assert.match(developmentComponentMetamodel, /\["iot_device", "sensor", "actuator", "mobile_app", "smartphone_app", "browser_app", "desktop_app", "server_api"\]/);
  assert.match(developmentComponentMetamodel, /alias === type \|\| alias\.startsWith\(`\$\{type\}_`\)/);
});

test("preserves managed event-application component types when PlantUML is reopened", () => {
  assert.match(publicController, /function hardwareComponentType\(label, plantUmlType, componentId = ""\)/);
  assert.match(developmentComponentMetamodel, /projekt\.runtime\.daten.*return "project_runtime_data"/);
  assert.match(developmentComponentMetamodel, /ereignis\.worker.*return "event_worker"/);
  assert.match(developmentComponentMetamodel, /ereignis\.dispatcher.*return "event_dispatcher"/);
  assert.match(developmentComponentMetamodel, /projekt\.push\.versand.*return "notification_service"/);
  assert.match(developmentComponentMetamodel, /iot\.\?zielger\(\?:ae\|ä\)t.*return "iot_device"/);
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
  assert.match(publicHtml, /development-chat-sidebar development-configuration-only[^\"]*hidden/);
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
  const projectForm = publicHtml.match(/<form id="developmentProjectForm"[\s\S]*?<\/form>/)?.[0] || "";
  const projectDetails = projectForm.match(/<div id="developmentProjectDetails">[\s\S]*?<\/div>/)?.[0] || "";
  assert.match(projectForm, /class="button-row development-project-form-actions"[\s\S]*data-development-project-back/);
  assert.doesNotMatch(projectDetails, /data-development-project-back/);
});

test("opens every selected template directly in component configuration", () => {
  assert.doesNotMatch(publicHtml, /data-create-and-continue/);
  assert.match(publicController, /const startsInConfiguration = selectedTemplateId && selectedTemplateId !== "empty"/);
  assert.match(publicController, /workflowStep = startsInConfiguration \? "configuration" : "project_start"/);
  assert.match(publicController, /Konfiguration ist geoeffnet/);
});

test("configures a touchscreen game collection through games, board and inventory", () => {
  assert.match(publicHtml, /id="touchscreenGameAssistant"/);
  assert.doesNotMatch(publicHtml, /Spiel-Pattern|Pattern waehlen|Touchscreen Game Loop/);
  assert.match(publicHtml, /Passendes Board im Inventar/);
  assert.match(publicHtml, /aria-label="Hinweis zum Touch-Display-Board"[\s\S]*Dieses Board wird als Kompilierungsparameter verwendet/);
  assert.match(publicHtml, /aria-label="Hinweis zum Inventar-Board"[\s\S]*für OTA-Updates und den Kompatibilitätscheck relevant/);
  assert.match(publicCss, /\.home-automation-label-title \{[\s\S]*inline-flex/);
  assert.match(publicController, /function renderTouchscreenGameAssistant/);
  assert.match(publicController, /data-game-board-configuration-host/);
  assert.match(publicController, /renderDevelopmentBoardConfiguration\(\{[\s\S]*component_id: "touchscreen-game-board"/);
  assert.match(publicController, /function saveTouchscreenGameBoardConfiguration/);
  assert.match(publicController, /Account-Board und Projektsnapshot sind gespeichert/);
  assert.match(publicController, /gameConfiguration\.board_configuration\?\.source === "custom_draft"/);
  assert.match(publicController, /component\.board_configuration\.account_board_id = savedBoard\.account_board_id/);
  assert.match(publicController, /Nibbles/);
  assert.match(publicController, /Snake/);
  assert.match(publicController, /Frogger/);
  assert.match(publicController, /Tic-Tac-Toe/);
  assert.match(publicController, /function touchscreenGameArchitectureDiagram/);
  assert.match(publicController, /actor "Nutzer" as user/);
  assert.match(publicController, /rectangle "Board mit Touchdisplay" as device/);
  assert.doesNotMatch(publicController, /rectangle "Startbildschirm\\nSpielauswahl" as start_screen/);
  assert.match(publicController, /gameConfiguration: state\.developmentPlatform\.gameConfiguration/);
  assert.match(publicApp, /route === "development-platform"\) \{[\s\S]*loadProcessorBoardCatalog\(\);[\s\S]*loadBoardFeatureCatalog\(\)/);
  assert.match(devServer, /normalizeTouchscreenGameConfiguration/);
  assert.match(devServer, /gameConfiguration\?\.board_configuration\?\.source === "custom_draft"/);
  assert.match(devServer, /board_configuration: normalizeDevelopmentBoardConfiguration\(input\.board_configuration, input\.board_profile_id\)/);
  assert.match(devServer, /mergeSelectedGamesHeader\(gameConfiguration\.selected_game_ids, existingSelectedGames\?\.content\)/);
  assert.match(devServer, /game_inventory_device_not_compatible/);
});

test("development platform scales like a compact workspace", () => {
  assert.match(publicApp, /development-workspace-active", route === "development-platform"/);
  assert.match(publicCss, /\.development-workspace-active \{[\s\S]*min-height: 100dvh;[\s\S]*overflow: auto/);
  assert.match(publicCss, /\.development-workspace-active \.app-shell \{[\s\S]*padding: 4px 8px 8px/);
  assert.match(publicCss, /\.development-workspace-active \.topbar \{[\s\S]*position: sticky;[\s\S]*top: 4px;[\s\S]*z-index: 40/);
  assert.match(publicCss, /\.development-workspace-active \.app-menu \{[\s\S]*position: fixed;[\s\S]*top: 54px;[\s\S]*z-index: 50/);
  assert.match(publicCss, /\.development-workspace-active #developmentPlatformView \{[\s\S]*flex: 1 1 auto;[\s\S]*overflow: visible/);
  assert.match(publicCss, /\.development-workspace-active \.development-platform-layout,[\s\S]*\.development-workspace-active \.development-workspace-panel \{[\s\S]*overflow: visible/);
  assert.match(publicCss, /\.development-workspace-active \.development-workspace-panel \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) clamp\(300px, 26vw, 360px\)/);
  assert.match(publicCss, /\.development-workspace-active \.development-chat-form textarea \{[\s\S]*font-size: 13px/);
  assert.match(publicCss, /\.development-workspace-active \.development-main-workspace \{[\s\S]*minmax\(34px, auto\)/);
  assert.match(publicCss, /\.development-workspace-active \.architecture-diagram-panel \{[\s\S]*overflow: auto/);
  assert.match(publicCss, /\.development-workspace-active \.architecture-diagram-panel \.plantuml-viewer \{[\s\S]*height: 100%;[\s\S]*max-height: none/);
  assert.match(publicCss, /\.development-workspace-active \.architecture-diagram-panel \.plantuml-diagram \{[\s\S]*height: 100%;[\s\S]*object-fit: contain/);
  assert.match(publicController, /themedPlantUmlSource\(source\)/);
  assert.match(publicRuntimeUtils, /function themedPlantUmlSource/);
  assert.match(publicRuntimeUtils, /skinparam backgroundColor transparent/);
  assert.match(publicRuntimeUtils, /skinparam rectangleBackgroundColor #1E3A5F/);
  assert.match(publicRuntimeUtils, /skinparam rectangleBorderColor #67E8F9/);
  assert.match(publicHtml, /app\.css\?v=20260808-learning-progress-map-2/);
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
  assert.match(publicController, /backToDevelopmentArchitectureButton[\s\S]*openDevelopmentArchitectureFromHardware/);
  assert.match(publicController, /editExternalHardwareArchitectureButton[\s\S]*openDevelopmentArchitectureFromHardware/);
  assert.match(publicController, /function openDevelopmentArchitectureFromHardware\(\)[\s\S]*view=architecture/);
  assert.match(publicController, /function openArchitecture\(projectId\)[\s\S]*workflowStep = "configuration"[\s\S]*restoreDevelopmentDialog\(project\)/);
  assert.match(publicApp, /requestedArchitectureProjectId[\s\S]*developmentPlatform\(\)\.openArchitecture\(requestedArchitectureProjectId\)/);
  assert.match(publicHtml, /id="developmentHardwareView"[\s\S]*developmentHardwareArchitecture[\s\S]*developmentHardwareComponents/);
  assert.match(publicHtml, /hardware-overview[\s\S]*developmentHardwareArchitecture[\s\S]*developmentHardwareComponents[\s\S]*developmentHardwareHints[\s\S]*developmentHardwareValidationSummary[\s\S]*continueDevelopmentHardwareButton/);
  assert.doesNotMatch(publicHtml, /developmentHardwareWiring/);
  assert.doesNotMatch(publicHtml, /Konkretisierung|Abstrakte Komponenten zuordnen|Boards, Sensoren und Aktoren werden konkretisiert/);
  assert.match(publicHtml, /Hardware speichern/);
  assert.match(publicHtml, /Weiter zur IDE/);
  assert.match(publicHtml, /Externe Hardware in der Architektur bearbeiten/);
  assert.match(publicHtml, /Neue externe Sensoren und Aktoren werden zuerst in der Architektur ergänzt und verbunden/);
  assert.match(publicApp, /"development-hardware": "developmentHardwareView"/);
  assert.match(publicApp, /development-platform\\\/hardware/);
  assert.match(publicController, /function renderHardwareConfiguration/);
  assert.match(publicController, /processor\.variant === "ESP32" \? "ESP32 \(klassisch\)" : processor\.variant/);
  assert.match(publicController, /data-hardware-processor-help/);
  assert.match(publicController, /openHelpTopic\?\.\("supported-devices"\)/);
  assert.match(publicApp, /openHelpTopic: InformationView\.openDialog/);
  assert.match(hardwareCatalogSeed, /PT1000 Widerstandsthermometer/);
  assert.match(publicController, /Konstantstromquelle \/ Messbruecke/);
  assert.match(publicController, /DC-Motorsteuerung/);
  assert.match(publicController, /function boardPins/);
  assert.match(publicController, /data-hardware-processor/);
  assert.match(publicController, /class="hardware-board-selection"/);
  assert.match(publicController, /class="hardware-table-row hardware-iot-row"/);
  assert.match(publicController, /startsWith\("integrated_"\)[\s\S]*Bestandteil der gewählten Boardkonfiguration/);
  assert.match(publicController, /Eigenschaften und Pins kommen aus der Boardkonfiguration/);
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
  assert.match(publicController, /data-hardware-property="connection_mode"/);
  assert.match(publicController, /data-hardware-property="circuit_label"/);
  assert.match(publicController, /function requiresAdditionalCircuit/);
  assert.match(publicController, /function hardwareConnectionPathAssessment/);
  assert.match(publicController, /Eine grundsaetzlich passende Prozessorschnittstelle ist vorhanden/);
  assert.match(publicController, /keine passende Prozessorschnittstelle gefunden/);
  assert.match(publicController, /sensor_interface_circuit/);
  assert.match(devServer, /properties\?\.connection_mode === "additional_circuit"/);
  assert.match(devServer, /actuator_interface_circuit/);
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
  assert.match(publicController, /function renderHardwareValidationSummary/);
  assert.match(publicController, /function highlightHardwareValidationIssues/);
  assert.match(publicController, /continueButton\.disabled = !validation\.complete/);
  assert.match(publicController, /hardware-required-field/);
  assert.match(publicController, /<h3>Offene Punkte<\/h3>/);
  assert.doesNotMatch(publicController, /<strong>Offen<\/strong>/);
  assert.match(publicController, /function recommendedHardwareAction/);
  assert.match(publicController, /Empfohlene Maßnahme:/);
  assert.match(publicCss, /\.hardware-hint-terminal \{[\s\S]*max-height:[\s\S]*overflow-y: auto/);
  assert.match(publicCss, /\.hardware-validation-summary \{/);
  assert.match(publicCss, /\.hardware-required-field select/);
  assert.match(publicController, /Die Zuordnung kann bis dahin nachgeholt werden/);
  assert.match(publicController, /Bitte klaere zuerst die offenen Punkte in der Hinweisbox/);
  assert.match(devServer, /component_device_allocations: allocations/);
  assert.doesNotMatch(devServer, /handleProjectDeviceAllocation/);
  assert.match(devServer, /\/api\/platform\/hardware\/sensors/);
  assert.match(devServer, /error: "hardware_catalog_unreachable"/);
  assert.match(devServer, /Sensorarten konnten nicht aus dem Hardware Catalog geladen werden/);
  assert.ok(devServer.indexOf('/api/platform/hardware/sensors') < devServer.indexOf('async function handleDevelopmentProjectDialogSave'));
  assert.match(publicApp, /loadPlatformScript\("\/app\/development-hardware-model\.js/);
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
  assert.match(publicCss, /\.hardware-board-selection \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(min\(190px, 100%\), 1fr\)\)/);
  assert.match(publicCss, /\.hardware-sensor-selection \{[\s\S]*display: contents/);
  assert.match(publicCss, /\.hardware-component-table \{[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*max-width: 100%/);
  assert.match(publicCss, /\.hardware-table-row\.hardware-sensor-row \{[\s\S]*grid-template-columns: minmax\(140px, \.55fr\) minmax\(0, 3\.45fr\)/);
  assert.match(publicCss, /\.hardware-table-row\.hardware-iot-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(publicCss, /\.hardware-iot-row \.hardware-component-identity \{[\s\S]*display: flex/);
  assert.match(publicCss, /@media \(max-width: 1180px\) \{[\s\S]*\.hardware-table-row,[\s\S]*grid-template-columns: minmax\(140px, \.65fr\) minmax\(0, 1\.35fr\)/);
  assert.match(publicCss, /@media \(max-width: 720px\) \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(publicCss, /\.hardware-component-table \{[\s\S]{0,160}min-width: 1380px/);
  assert.match(publicCss, /\.hardware-inline-assignment \{[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(min\(170px, 100%\), 1fr\)\)/);
  assert.match(publicCss, /\.hardware-component-section-head \{[\s\S]*justify-content: space-between/);
  assert.doesNotMatch(publicCss, /\.hardware-signal-chain/);
  assert.match(publicCss, /Hardware-Realisierung folgt derselben dunklen Workspace-Sprache/);
  assert.match(publicCss, /\.hardware-table-row \{[\s\S]*background: #111827;[\s\S]*color: #e5e7eb/);
  assert.match(publicCss, /\.hardware-table-row select,[\s\S]*background: #0b1018;[\s\S]*color: #e5e7eb/);
  assert.match(publicCss, /\.hardware-page-actions \{[\s\S]*background: rgba\(11, 16, 24, \.96\)/);
  assert.match(publicCss, /\.hardware-overview \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(publicCss, /\.hardware-guidance-panel \{[\s\S]*background: #0d1520/);
});

test("delivers hardware architecture atomically with the persisted project", () => {
  assert.match(publicController, /persistedConfiguration \? project\.hardwareArchitecture : diagram/);
  assert.doesNotMatch(publicController, /renderPersistedHardwareArchitecture/);
  assert.doesNotMatch(publicController, /Hardware-Architektur konnte nicht geladen werden/);
  assert.doesNotMatch(devServer, /registerProjectPattern\("GET", \/\^\\\/api\\\/platform\\\/development-projects/);
  assert.match(devServer, /hardwareArchitecture: hardwareConfiguration \? \{/);
  assert.match(devServer, /hardwareWiringPlantUml\(hardwareConfiguration, project\.title\)/);
});

test("selected catalog boards expose editable defaults and require an explicitly saved custom board", () => {
  assert.match(publicApp, /if \(route === "development-hardware"\) \{[\s\S]*loadBoardFeatureCatalog\(\)/);
  assert.match(publicApp, /routeName\(\) === "development-hardware"\) developmentPlatform\(\)\.renderHardwareConfiguration\(\)/);
  assert.match(publicController, /selectedBoard \? renderDevelopmentBoardConfiguration\(component, selectedBoard\) : ""/);
  assert.match(publicController, /function renderDevelopmentBoardConfiguration/);
  assert.match(publicController, /board\?\.default_instance_configuration\?\.board_features/);
  assert.match(publicController, /Katalogwerte sind die unveränderte Ausgangskonfiguration/);
  assert.match(publicController, /Aktiv[\s\S]*Komponente[\s\S]*Art[\s\S]*Treiber[\s\S]*Anschluss[\s\S]*Pin-Zuordnung[\s\S]*Größe \/ Wert/);
  assert.match(publicController, /Geändert · Speichern erforderlich/);
  assert.match(publicController, /data-custom-board-name/);
  assert.match(publicController, /data-save-custom-board/);
  assert.match(publicController, /versionierte Boardkonfiguration in deinem Account und ein fester Snapshot im Projekt/);
  assert.match(publicController, /\["account", "custom"\]\.includes\(previous\.source\)/);
  assert.match(publicController, /\/api\/platform\/account-board-configurations/);
  assert.match(publicController, /component\.board_configuration\.source = "account"/);
  assert.match(publicController, /component\.board_configuration\.account_board_version = savedBoard\.version/);
  assert.match(publicController, /await saveHardwareConfiguration\(false\)/);
  assert.match(publicController, /geänderte Boardkonfiguration als eigenes Board speichern/);
  assert.match(publicCss, /\.development-board-configuration\.has-modifications \{ border-color: #f59e0b/);
  assert.match(publicCss, /\.development-board-feature-table tr\.is-modified \{ background: rgba\(245, 158, 11, \.08\)/);
  assert.match(devServer, /error: "custom_board_not_saved"/);
  assert.match(devServer, /board_configuration: abstractType === "iot_device" \? normalizeDevelopmentBoardConfiguration/);
  assert.match(devServer, /schema_version: 6,[\s\S]*components/);
  assert.match(devServer, /component\.hardware_scope = boardFeatureId \? "board_integrated" : "board_external"/);
  assert.match(devServer, /component\.board_feature_id = boardFeatureId/);
  assert.match(devServer, /\["account", "project", "custom"\]\.includes\(source\)/);
  assert.match(devServer, /compilerBoardConfiguration/);
  assert.match(devServer, /configuredFlashValue = selectedBoardConfiguration\?\.board_features\?\.flash\?\.value/);
  assert.match(devServer, /\[4, 8, 16\]\.includes\(configuredFlashSizeMb\)/);
  assert.match(devServer, /gameConfiguration = existingManifest\.template_id === "touchscreen_game_collection"/);
  assert.match(devServer, /board_profile_id: selectedBoard\?\.hardware_item_id/);
});

test("keeps the effective ES3C28P compiler configuration coupled to the selected board", () => {
  assert.match(devServer, /esp32_s3_es3c28p\|es3c28p/);
  assert.match(devServer, /environment: "es3c28p", flash_size_mb: 16/);
  assert.match(devServer, /user_source_path: existing\?\.user_source_path \|\| "Komponenten\/IoT-Device 1\/src\/user_main\.cpp"/);
  assert.match(devServer, /firmware_basis_id !== "gernetix-runtime-basissoftware"/);
  assert.match(devServer, /existing\?\.firmware_basis_id === "gernetix-runtime-basissoftware"[\s\S]*board: "4d_systems_esp32s3_gen4_r8n16"[\s\S]*firmware_basis_variant: "full"/);
  assert.match(devServer, /touchscreenGameBuildConfigurationProblems/);
  assert.match(devServer, /error: "touchscreen_game_build_configuration_invalid"/);
  assert.match(devServer, /for \(const requiredPath of \["src\/user_main\.cpp", "src\/board_adapter\.cpp", "src\/game_application\.cpp"\]\)/);
  assert.match(devServer, /board_build\\\.flash_size/);
  assert.match(devServer, /partitions_full_16mb\\\.csv/);
  assert.match(devServer, /GERNETIX_BASISSOFTWARE_PROFILE_FULL=1/);
  assert.match(devServer, /template_id === "touchscreen_game_collection"\) return project\.build_config/);
  assert.match(devServer, /!buildConfig\.firmware_basis_id && !files\["platformio\.ini"\]/);
});

test("motor actuators defer their board-pin specialization to the separate IDE driver view", () => {
  assert.match(publicController, /Synchronmotor \/ BLDC \/ PMSM/);
  assert.match(publicController, /Motor- und Pinbelegung werden anschließend in der IDE-Treiberverwaltung konfiguriert/);
  assert.match(publicController, /Die konkreten Boardpins hängen vom gewählten Motortreiber ab/);
  assert.doesNotMatch(publicController, /Motorsteuerung<select data-hardware-property="motor_driver_type"/);
  assert.match(publicApp, /three_phase_foc/);
  assert.match(publicApp, /three_phase_six_step/);
  assert.match(publicApp, /PWM Phase V/);
  assert.match(publicApp, /PWM Phase W/);
  assert.match(publicApp, /motor_driver_type/);
  assert.match(devServer, /synchronous_motor_driver/);
});

test("iot device suggestions use board families from the hardware catalog only", () => {
  assert.doesNotMatch(publicApp, /function fallbackProcessorBoards/);
  assert.match(publicController, /return Array\.isArray\(state\.processorBoards\) \? state\.processorBoards : \[\]/);
  assert.match(deviceOnboardingModel, /raspberry_pi: "Raspberry Pi"/);
  assert.match(deviceOnboardingModel, /text\.includes\("raspberry"\)/);
});

test("development project management opens an existing application without mixing it into editing", () => {
  assert.match(publicController, /hasProjectApp\(project\)[\s\S]*data-open-development-application/);
  assert.match(publicController, /data-open-development-project[\s\S]*data-open-development-application/);
  assert.match(publicController, /navigate\(`\/app\/project-app\/\?project=\$\{encodeURIComponent\(applicationButton\.dataset\.openDevelopmentApplication\)\}`\)/);
});
