const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { normalizeAppPath } = require("../src/dev/http-utils");

const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const app = readPlatformAppSource();
const learningController = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-controller.js"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("learning area leads with a dedicated project catalog", () => {
  const catalogPosition = html.indexOf("Lernprojekt-Katalog");
  const personalPosition = html.indexOf("Meine Lernprojekte");
  assert.ok(catalogPosition > 0);
  assert.ok(personalPosition > catalogPosition);
  assert.match(html, /id="projectList" class="project-grid learning-catalog-grid"/);
});

test("catalog cards show only the learning offer, not implementation facts", () => {
  const renderer = app.match(/function renderProjects\(\)[\s\S]*?\nfunction renderLearningProjectOverview/)?.[0] || "";
  assert.match(renderer, /data-open-learning-project-overview/);
  assert.match(renderer, /learningAccessLabel\(project\.accessModel\)/);
  assert.match(renderer, /learningHeadlineLabel\(project\)/);
  assert.doesNotMatch(renderer, /Projekt ansehen|learning-project-tile-link/);
  assert.doesNotMatch(renderer, /Lernprojekt starten/);
  assert.doesNotMatch(renderer, /project\.type \|\| "Lernprojekt"/);
  assert.doesNotMatch(renderer, /Lernschritte/);
  assert.doesNotMatch(renderer, /Umgebung/);
  assert.doesNotMatch(renderer, /Hardware/);
  assert.doesNotMatch(renderer, /Projektdateien/);
});

test("catalog classifies free, purchased and subscription access", () => {
  assert.match(app, /free: "Frei verfügbar"/);
  assert.match(app, /purchased: "Kurs gekauft"/);
  assert.match(app, /subscription: "Im Abo enthalten"/);
  assert.match(app, /en: \{ free: "Available free"/);
  assert.match(app, /nl: \{ free: "Gratis beschikbaar"/);
});

test("categories and controlled tags classify only learning projects", () => {
  const tamagotchi = require("../src/dev/project-models/tamagotchi-entry-course.json");
  const smartAssistant = require("../src/dev/project-models/smart-assistant-course.json");
  const notification = require("../src/dev/project-models/button-to-smartphone-notification-course.json");
  assert.equal(tamagotchi.project.learning_category, "software_engineering");
  assert.equal(smartAssistant.project.learning_category, "distributed_system");
  assert.ok(notification.project.tags.includes("platform:esp32"));
  assert.match(html, /id="learningCatalogCategory"/);
  assert.match(html, /value="software_engineering" data-i18n="learning\.category\.software">Software Engineering/);
  assert.match(app, /software_engineering: "Software Engineering"/);
  assert.match(server, /"software_engineering", "desktop", "embedded", "distributed_system", "mobile"/);
  assert.match(html, /id="learningCatalogTag"/);
  assert.match(app, /project\.learningCategory === state\.learningCatalogCategory/);
  assert.match(app, /project\.tags\?\.includes\(state\.learningCatalogTag\)/);
  assert.match(server, /project\.learning_project_id\?\.startsWith\("learning_project\."\)/);
  assert.doesNotMatch(server, /learningCategory: project\.development_category/);
});

test("creates an account-bound project from the catalog before opening it", () => {
  assert.match(learningController, /\/api\/platform\/learning-projects\/\$\{encodeURIComponent\(selectedProject\.id\)\}\/start/);
  assert.match(learningController, /project\.projectOrigin === "account_project"/);
  assert.match(learningController, /if \(!isLearningProject\(project\)\) return;/);
  assert.doesNotMatch(learningController, /project\?\.type === "learning_project"/);
});

test("opens the learning workspace before saving initial progress", () => {
  const openMethod = learningController.match(/async function open\(projectId, options = \{\}\) \{[\s\S]*?\n    \}/)?.[0] || "";
  assert.ok(openMethod.indexOf("navigate(") < openMethod.indexOf("saveStep("));
  assert.match(openMethod, /\.catch\(\(error\) => showError\(error\)\)/);
});

test("shows immediate feedback while a learning project is materialized", () => {
  assert.match(app, /data-learning-project-start-status/);
  assert.match(app, /Projekt wird vorbereitet/);
  assert.match(app, /button\.disabled = true/);
  assert.match(app, /await learningProject\(\)\.open/);
});

test("does not resynchronize an unchanged learning project on every start", () => {
  assert.match(server, /async function synchronizeLearningProjectOnStart/);
  assert.match(server, /if \(!needsManifestSync && !needsSourceSync && !needsLegacyNexiCheck\) return project/);
});

test("keeps the catalog and the active learning project in separate views", () => {
  assert.match(html, /id="learnView"[\s\S]*?id="projectList"/);
  assert.match(html, /id="learningProjectOverviewView"[\s\S]*?id="learningProjectOverview"/);
  assert.match(html, /id="learningProjectView"[\s\S]*?id="learningProjectWorkspace"/);
  assert.match(app, /"learning-project-overview": "learningProjectOverviewView"/);
  assert.match(app, /"learning-project": "learningProjectView"/);
  assert.match(learningController, /navigate\(`\/app\/learning-project\/\?project=/);
  assert.equal(normalizeAppPath("/app/learning-project-overview/"), "/index.html");
  assert.equal(normalizeAppPath("/app/learning-project-overview"), "/index.html");
});

test("catalog includes the button-to-smartphone notification learning project", () => {
  assert.match(server, /button-to-smartphone-notification/);
  assert.match(server, /createButtonToSmartphoneNotificationCourseModel/);
});

test("catalog includes a free browser-based YAML fundamentals project", () => {
  const course = require("../src/dev/project-models/yaml-fundamentals-course.json");
  const model = require("../src/dev/project-models/yaml-fundamentals-course");
  assert.equal(course.project.slug, "yaml-fundamentals");
  assert.equal(course.project.hardware_profile_id, "runtime.browser_text");
  assert.deepEqual(course.project.required_capability_ids, []);
  assert.equal(course.project.access_model, "free");
  assert.equal(course.view_manifest.primary_source_path, "projekt.yaml");
  assert.ok(course.project.tags.includes("topic:yaml"));
  assert.match(JSON.stringify(course.view_manifest), /Einrückung bildet Hierarchie/);
  assert.match(JSON.stringify(course.view_manifest), /typische Stolperfallen/i);
  assert.equal(typeof model.createYamlFundamentalsCourseModel, "function");
  const created = model.createYamlFundamentalsCourseModel().createProject(
    (slug, title, area, summary, steps, options) => ({ slug, title, area, summary, steps, ...options }),
    (title, text, insight) => ({ title, text, insight }),
  );
  assert.deepEqual(created.required_capability_ids, []);
  assert.match(server, /createYamlFundamentalsCourseModel/);
  assert.match(server, /yamlFundamentalsCourseModel\.createProject/);
  assert.match(server, /"topic:yaml"/);
});

test("catalog includes the free browser-based radio technologies project", () => {
  const course = require("../src/dev/project-models/radio-technologies-course.json");
  const model = require("../src/dev/project-models/radio-technologies-course");
  assert.equal(course.project.slug, "radio-technologies");
  assert.equal(course.project.hardware_profile_id, "runtime.browser_text");
  assert.deepEqual(course.project.required_capability_ids, []);
  assert.equal(course.project.access_model, "free");
  assert.ok(course.project.tags.includes("topic:radio"));
  assert.deepEqual(
    course.view_manifest.views
      .filter((view) => ["bluetooth", "wifi", "lora", "zigbee", "nfc", "rc-radio"].includes(view.id))
      .map((view) => view.id),
    ["bluetooth", "wifi", "lora", "zigbee", "nfc", "rc-radio"],
  );
  assert.match(JSON.stringify(course.view_manifest), /Jede Funkübertragung kann gestört werden/);
  assert.match(JSON.stringify(course.view_manifest), /ziviles Passagierflugzeug/);
  assert.equal(typeof model.createRadioTechnologiesCourseModel, "function");
  assert.match(server, /createRadioTechnologiesCourseModel/);
  assert.match(server, /radioTechnologiesCourseModel\.createProject/);
});

test("button-to-smartphone course starts with a simulated button and serial-monitor lab", () => {
  const course = require("../src/dev/project-models/button-to-smartphone-notification-course.json");
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  assert.equal(course.view_manifest.views[0].id, "goal");
  assert.equal(course.view_manifest.views[1].id, "read-button-pin");
  assert.equal(course.view_manifest.views[1].type, "device_lab");
  assert.match(JSON.stringify(course.view_manifest.views[0]), /inventory_board_selection/);
  assert.match(JSON.stringify(course.view_manifest.views[1]), /button_input_lab/);
  assert.match(guidedView, /Per USB flashen/);
  assert.match(guidedView, /Per OTA flashen/);
  assert.match(guidedView, /Serial Monitor/);
  assert.match(guidedView, /Bitte wähle jetzt dein ESP-Board/);
  assert.match(guidedView, /Schritt 1: Boardkonfiguration auswählen/);
  assert.match(guidedView, /GerNetiX- oder eigenes Account-Board/);
  assert.match(guidedView, /board_profile_id: boardProfileId/);
  assert.match(guidedView, /learning-projects\/\$\{encodeURIComponent\(project\.id\)\}\/device/);
  assert.match(server, /handleLearningProjectDeviceAssign/);
});

test("button-to-smartphone course tests the local board webserver before PWA push", () => {
  const course = require("../src/dev/project-models/button-to-smartphone-notification-course.json");
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  const localWebserverIndex = course.view_manifest.views.findIndex((view) => view.id === "local-webserver");
  const pushIndex = course.view_manifest.views.findIndex((view) => view.id === "push-boundary");
  assert.ok(localWebserverIndex >= 0);
  assert.ok(localWebserverIndex < pushIndex);
  assert.equal(course.view_manifest.schema_version, 4);
  assert.equal(course.view_manifest.views[localWebserverIndex].payload.artifact.type, "project_webserver_lab");
  assert.match(guidedView, /Firmware bauen/);
  assert.match(guidedView, /Webserver öffnen/);
  assert.match(guidedView, /openGuidedWebserverPopup/);
  assert.match(server, /canonicalManifest\?\.schema_version[\s\S]*project\.view_manifest\?\.schema_version/);
});

test("button-to-smartphone course uses its guided learning entry instead of the generic source analysis", () => {
  const courseModel = require("../src/dev/project-models/button-to-smartphone-notification-course");
  const manifest = courseModel.createButtonToSmartphoneNotificationCourseModel().createViewManifest(
    { source_files: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp" }] },
    { primarySourcePath: (project) => project.source_files[0].path },
  );
  assert.equal(manifest.views[0].id, "goal");
  assert.equal(manifest.views[1].id, "read-button-pin");
  assert.equal(manifest.views[0].payload.artifact.type, "inventory_board_selection");
  assert.match(server, /project\.slug === buttonToSmartphoneNotificationCourseModel\.slug/);
});

test("guided navigation renders the following learning step even if progress persistence is temporarily unavailable", () => {
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  const completion = guidedView.match(/async function completeIdeGuidedStep[\s\S]*?\n    \}/)?.[0] || "";
  assert.ok(completion.indexOf("renderProjectViewManifest") < completion.indexOf("await saveIdeGuidedProgress"));
  assert.match(completion, /Lernfortschritt konnte nicht gespeichert werden/);
});

test("learning progress persists the current lesson and exact step through the project server", () => {
  const controller = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-controller.js"), "utf8");
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  assert.match(server, /\/learning-progress\?user_id=/);
  assert.match(server, /method: "PUT"[\s\S]*current_lesson_id:[\s\S]*current_step_id:/);
  assert.doesNotMatch(server, /learningProgress: new Map/);
  assert.match(controller, /currentLessonId: currentView\.lesson_id/);
  assert.match(controller, /currentStepId: currentView\.id/);
  assert.match(guidedView, /currentLessonId: currentView\.lesson_id/);
  assert.match(guidedView, /completedStepIds:/);
});

test("button-to-smartphone course provides a project-local user source on the FULL basis software", () => {
  const course = require("../src/dev/project-models/button-to-smartphone-notification-course.json");
  const model = require("../src/dev/project-models/button-to-smartphone-notification-course");
  assert.equal(course.project.build_config.firmware_basis_variant, "full");
  assert.equal(course.project.build_config.user_source_path, "Komponenten/IoT-Device 1/src/user_main.cpp");
  assert.match(course.sources.find((source) => source.path.endsWith("user_main.cpp")).content, /extern \"C\" void userMain\(\)/);
  const sources = model.createButtonToSmartphoneNotificationCourseModel().createSources({ projectId: "learning_example" });
  assert.match(sources.find((source) => source.path.endsWith("project_config.h")).content, /learning_example/);
});

test("server creates one account-bound project per started catalog course", () => {
  assert.match(server, /handleLearningProjectStart/);
  assert.match(server, /learning_project_not_found/);
  assert.match(server, /crypto\.randomUUID\(\)/);
  assert.match(server, /project_origin: "account_project"/);
});

test("keeps the existing Tamagotchi course as an account project instead of hiding it as a catalog template", () => {
  assert.match(server, /catalog_\$\{definition\.slug\}/);
  assert.match(server, /learning_project\.software_engineering_tamagotchi/);
  assert.match(server, /isEstablishedLearningProject\(project\)/);
});

test("uses the complete thirteen-step Tamagotchi learning sequence", () => {
  const course = require("../src/dev/project-models/tamagotchi-entry-course.json");
  const courseModel = fs.readFileSync(path.resolve(__dirname, "../src/dev/project-models/tamagotchi-entry-course.js"), "utf8");
  assert.equal(course.view_manifest.views.length, 13);
  assert.match(courseModel, /modelData\.view_manifest\.views\.map\(\(view\) => step\(view\.title, view\.summary, ""\)\)/);
});

test("renders the manifest artifact viewer instead of reducing a guided project to plain step text", () => {
  const learningView = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-view.js"), "utf8");
  assert.match(learningView, /id="learningProjectArtifact"/);
  assert.match(learningController, /renderGuidedProject\(localizedProject\)/);
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  assert.match(guidedView, /renderProjectViewManifest\(project, targetSelector = "#ideProjectViewManifest"\)/);
  assert.match(guidedView, /guided-code-viewer/);
});

test("asks for learning-project feedback once after the final completed step", () => {
  const learningView = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-view.js"), "utf8");
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  assert.match(learningController, /showRating: learningProjectCompleted\(project\) && project\.learningFeedbackSubmitted !== true/);
  assert.match(learningController, /function learningProjectCompleted/);
  assert.match(learningController, /project\.learningFeedbackSubmitted = true/);
  assert.match(learningView, /showRating \? `<section class="learning-rating"/);
  assert.match(guidedView, /learning-progress-updated/);
  assert.match(server, /hasSubmittedLearningFeedback/);
});

test("balances the guided learning workspace and keeps optional AI help outside the task column", () => {
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
  const runner = guidedView.match(/function renderProjectViewManifest[\s\S]*?function renderGuidedCodeAssistant/)?.[0] || "";
  assert.match(runner, /guided-artifact-pane[\s\S]*renderLearningContext\(activeView\)[\s\S]*renderGuidedArtifact/);
  assert.match(runner, /guided-summary-pane[\s\S]*renderManifestView[\s\S]*renderGuidedActions/);
  assert.ok(runner.indexOf("renderGuidedCodeAssistant(project, activeView)") > runner.indexOf("</div>"));
  assert.doesNotMatch(runner.match(/<aside class="guided-summary-pane">[\s\S]*?<\/aside>/)?.[0] || "", /renderCodeExplorerChat/);
  assert.match(guidedView, /<details class="guided-code-assistant">/);
  assert.match(guidedView, /Worum es geht/);
  assert.match(guidedView, /Prüffragen/);
  assert.match(css, /\.guided-artifact-pane \{[\s\S]*display: grid;[\s\S]*gap: 12px/);
  assert.match(css, /\.guided-artifact-empty \{[\s\S]*min-height: 260px/);
});

test("catalog includes the home automation network course with a resource boundary", () => {
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  const course = fs.readFileSync(path.resolve(__dirname, "../src/dev/project-models/home-automation-network-course.json"), "utf8");
  assert.match(server, /home-automation-network/);
  assert.match(server, /createHomeAutomationNetworkCourseModel/);
  assert.match(server, /homeAutomationNetworkCourseModel\.createProject/);
  assert.match(guidedView, /access_gate/);
  assert.match(guidedView, /open_billing/);
  assert.match(course, /background_worker/);
  assert.match(course, /Home-Assistant-Kompatibilitaet/);
});

test("catalog includes a distinct sensor-learning project for home automation", () => {
  const course = require("../src/dev/project-models/home-automation-sensors-course.json");
  const model = require("../src/dev/project-models/home-automation-sensors-course");
  assert.match(server, /createHomeAutomationSensorsCourseModel/);
  assert.match(server, /homeAutomationSensorsCourseModel\.createProject/);
  assert.equal(course.project.title, "Sensorik für deine Hausautomation");
  assert.equal(course.project.learning_category, "embedded");
  assert.ok(course.project.tags.includes("topic:home-automation"));
  assert.ok(course.project.tags.includes("topic:privacy"));
  assert.match(server, /"topic:privacy"/);
  assert.match(course.view_manifest.views.find((view) => view.id === "signal-state-event").payload.cards.map((card) => card.title).join(" "), /Messwert.*Zustand.*Ereignis/);
  assert.match(course.sources.find((source) => source.path.endsWith("hausautomation-sensorplan.md")).content, /Wer darf Status sehen und wer darf die Regel ändern/);
  assert.equal(model.createHomeAutomationSensorsCourseModel().slug, "home-automation-sensors");
});

test("catalog includes a motor-control project that joins actuator electronics and firmware", () => {
  const course = require("../src/dev/project-models/motor-control-basics-course.json");
  const model = require("../src/dev/project-models/motor-control-basics-course");
  assert.match(server, /createMotorControlBasicsCourseModel/);
  assert.match(server, /motorControlBasicsCourseModel\.createProject/);
  assert.equal(course.project.title, "Motoransteuerung: Bewegung sicher steuern");
  assert.equal(course.project.learning_category, "embedded");
  assert.ok(course.project.tags.includes("topic:actuators"));
  assert.ok(course.project.tags.includes("topic:motor-control"));
  assert.match(server, /"topic:motor-control"/);
  assert.equal(course.project.steps.length, 9);
  assert.deepEqual(course.view_manifest.views.map((view) => view.id), [
    "gpio-output",
    "pwm-basics",
    "dc-motor-commutation",
    "transistor-driver",
    "h-bridge",
    "stepper-cnc",
    "servo-types",
    "bldc-inverter",
    "motion-state-model",
    "test-plan",
    "local-safety",
  ]);
  assert.match(JSON.stringify(course.view_manifest), /Schrittverlust[\s\S]*3D-Druck[\s\S]*CNC/);
  assert.match(JSON.stringify(course.view_manifest), /B6-Brücke[\s\S]*Sinusförmiger Strom[\s\S]*elektronische Kommutierung/);
  assert.match(course.sources.find((source) => source.path.endsWith("motorantrieb-plan.md")).content, /Maximale Laufzeit[\s\S]*Wer darf welche Bewegung anfordern/);
  assert.equal(model.createMotorControlBasicsCourseModel().slug, "motor-control-basics");
});

test("catalog scaffolds the proximity-sensor project with FMCW radar as its first stage", () => {
  const course = require("../src/dev/project-models/proximity-sensor-radar-course.json");
  const model = require("../src/dev/project-models/proximity-sensor-radar-course");
  assert.equal(course.project.title, "Baue deinen eigenen Näherungssensor");
  assert.equal(course.project.area, "Sensorik");
  assert.equal(course.project.learning_category, "embedded");
  assert.equal(course.project.access_model, "free");
  assert.ok(course.project.tags.includes("topic:sensors"));
  assert.ok(course.project.tags.includes("topic:radar"));
  assert.equal(course.project.steps.length, 7);
  assert.deepEqual(course.view_manifest.views.map((view) => view.id), [
    "radar-project-goal",
    "fmcw-principle",
    "sensor-comparison",
    "identify-module",
    "measurement-chain",
    "bench-experiment",
    "next-sensor-stage",
  ]);
  assert.match(JSON.stringify(course.view_manifest), /FMCW[\s\S]*Infrarot[\s\S]*Ultraschall[\s\S]*PIR/);
  assert.match(course.sources.find((source) => source.path.endsWith("radar-naeherungssensor-plan.md")).content, /Hersteller und genaue Typbezeichnung/);
  assert.match(course.sources.find((source) => source.path.endsWith("versuchsplan.csv")).content, /radar_ausgabe/);
  assert.equal(model.createProximitySensorRadarCourseModel().slug, "build-your-own-proximity-sensor");
  assert.match(server, /createProximitySensorRadarCourseModel/);
  assert.match(server, /proximitySensorRadarCourseModel\.createProject/);
  assert.match(server, /proximitySensorRadarCourseModel\.createViewManifest/);
  assert.match(server, /proximitySensorRadarCourseModel\.createSources/);
  assert.match(app, /"topic:radar": "Radar"/);
  assert.match(app, /"topic:sensors": "Sensorik"/);
  assert.match(app, /catalog=|get\("catalog"\)/);
  assert.match(app, /learning-catalog-card\$\{project\.slug === requestedCatalogSlug \? " is-linked"/);
});

test("catalog includes a software-only programming fundamentals course", () => {
  const course = require("../src/dev/project-models/programming-fundamentals-course.json");
  const model = require("../src/dev/project-models/programming-fundamentals-course");

  assert.equal(course.project.title, "Grundlagen der Programmierung");
  assert.equal(course.project.area, "Programmierung");
  assert.equal(course.project.learning_category, "software_engineering");
  assert.equal(course.project.hardware_profile_id, "runtime.browser_javascript");
  assert.equal(course.project.default_device_id, "");
  assert.equal(course.project.access_model, "free");
  assert.ok(course.project.tags.includes("runtime:browser"));
  assert.ok(course.project.tags.includes("topic:programming"));
  assert.ok(course.project.tags.includes("level:beginner"));
  assert.equal(course.project.steps.length, 8);
  assert.equal(course.view_manifest.schema_version, 2);
  assert.deepEqual(course.view_manifest.views.map((view) => view.id), [
    "computer-model",
    "abstraction",
    "values-and-variables",
    "expressions",
    "conditions",
    "loops",
    "functions",
    "score-challenge",
  ]);
  assert.match(JSON.stringify(course.view_manifest), /Eingabe[\s\S]*Speicher[\s\S]*Verarbeitung[\s\S]*Ausgabe/);
  assert.match(JSON.stringify(course.view_manifest), /Maschinenbefehle[\s\S]*Abstraktion/);
  assert.match(JSON.stringify(course.view_manifest), /if[\s\S]*switch/);
  assert.match(course.sources.find((source) => source.path === "src/grundlagen.js").content, /function istBestanden/);
  assert.match(course.sources.find((source) => source.path === "src/grundlagen.js").content, /switch \(schwierigkeitsgrad\)/);
  assert.match(course.sources.find((source) => source.path === "README.md").content, /benötigt keine Hardware/);
  assert.equal(model.createProgrammingFundamentalsCourseModel().slug, "programming-fundamentals");
  assert.match(server, /createProgrammingFundamentalsCourseModel/);
  assert.match(server, /programmingFundamentalsCourseModel\.createProject/);
  assert.match(server, /programmingFundamentalsCourseModel\.createViewManifest/);
  assert.match(server, /programmingFundamentalsCourseModel\.createSources/);
  assert.match(app, /"topic:programming": "Programmierung"/);
});

test("models the storage story as one development project with reusable standalone lessons", () => {
  const course = require("../src/dev/project-models/storage-learning-story-course.json");
  const model = require("../src/dev/project-models/storage-learning-story-course");
  const controller = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-controller.js"), "utf8");
  const learningView = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-view.js"), "utf8");
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");

  assert.equal(course.project_story.kind, "development_project");
  assert.match(course.project_story.learning_goal, /Arbeitsspeicher.*ESP32-NVS.*LittleFS.*SQLite.*Dateiarchiv/);
  assert.match(course.project_story.working_method, /15 kurzen Schritte.*konkretes Artefakt.*erwartete Ergebnis/);
  assert.match(course.project_story.result, /begründete Speicherentscheidung/);
  assert.match(course.project_story.continuation_rule, /Schwachpunkt der vorherigen Lösung/);
  assert.match(course.project_story.standalone_rule, /unabhängig gestartet/);
  assert.equal(course.development_lessons.length, 5);
  assert.deepEqual(course.development_lessons.map((lesson) => lesson.step_ids.length), [3, 3, 3, 3, 3]);
  assert.deepEqual(course.development_lessons.map((lesson) => lesson.order_index), [1, 2, 3, 4, 5]);
  assert.deepEqual(course.development_lessons.map((lesson) => lesson.standalone_start.hardware_required), [false, true, true, false, false]);
  assert.deepEqual(course.development_lessons[2].prerequisite_lesson_ids, ["development_lesson.storage.nvs"]);
  assert.match(course.development_lessons[2].standalone_start.snapshot_id, /with_nvs_baseline/);
  assert.match(course.development_lessons[3].standalone_start.snapshot_id, /with_sample_measurements/);

  const viewIds = course.view_manifest.views.map((view) => view.id);
  assert.equal(viewIds.length, 15);
  assert.deepEqual(new Set(viewIds), new Set(course.development_lessons.flatMap((lesson) => lesson.step_ids)));
  assert.ok(course.view_manifest.views.every((view) => view.lesson_id));
  assert.ok(course.view_manifest.views.every((view) => Array.isArray(view.payload?.learning_text) && view.payload.learning_text.length));
  assert.ok(course.view_manifest.views.every((view) => view.payload?.task && view.payload?.expected_result && view.payload?.why));

  const storageModel = model.createStorageLearningStoryCourseModel();
  const fullManifest = storageModel.createViewManifest(
    { learning_project_id: "learning_project.storage_learning_story" },
    { primarySourcePath: () => "lessons/01-datenstrukturen/inventar.js" },
  );
  assert.ok(fullManifest.views
    .filter((view) => view.type === "source_analysis")
    .every((view) => view.payload?.artifact?.type === "code" && view.payload.artifact.content));
  const standaloneManifest = storageModel.createViewManifest(
    { learning_project_id: "learning_project.storage_learning_story" },
    { lessonId: "development_lesson.storage.sqlite", primarySourcePath: () => "unused" },
  );
  assert.equal(standaloneManifest.entry_mode, "standalone_lesson");
  assert.equal(standaloneManifest.lesson_focus_id, "development_lesson.storage.sqlite");
  assert.deepEqual(standaloneManifest.views.map((view) => view.id), ["sqlite-schema", "sqlite-queries", "sqlite-transaction"]);
  assert.deepEqual(storageModel.createSources({ lessonId: "development_lesson.storage.sqlite" }).map((source) => source.path), [
    "docs/projektstory.md",
    "lessons/04-sqlite/schema.sql",
    "lessons/04-sqlite/abfragen.sql",
    "lessons/04-sqlite/beispieldaten.csv",
  ]);

  assert.match(server, /createStorageLearningStoryCourseModel/);
  assert.match(server, /handleDevelopmentLessonStart/);
  assert.match(server, /standalone_lesson/);
  assert.match(server, /learningProjectManifestForPersistedProject/);
  assert.match(server, /canonicalManifest\?\.schema_version[\s\S]*project\.view_manifest\?\.schema_version/);
  assert.equal(course.view_manifest.schema_version, 6);
  assert.match(app, /So ist das Projekt aufgebaut/);
  const catalogRenderer = app.match(/function renderProjects\(\)[\s\S]*?\nfunction renderLearningProjectOverview/)?.[0] || "";
  const overviewRenderer = app.match(/function renderLearningProjectOverview\(\)[\s\S]*?\nfunction learningCategoryLabel/)?.[0] || "";
  assert.match(catalogRenderer, /data-open-learning-project-overview/);
  assert.doesNotMatch(catalogRenderer, /Lernprojekt starten|Projektstory starten|Lesson einzeln starten|development-lesson-catalog/);
  assert.doesNotMatch(catalogRenderer, /step_ids|Schrittanzahl|Lernschritte/);
  assert.match(overviewRenderer, /Worum geht es in diesem Projekt/);
  assert.match(overviewRenderer, /Was du lernst/);
  assert.match(overviewRenderer, /So arbeitest du/);
  assert.match(overviewRenderer, /Ohne zusätzliche Hardware/);
  assert.match(overviewRenderer, /Die Etappen führen dich vom Einstieg bis zum praktisch geprüften Projektergebnis/);
  assert.match(overviewRenderer, /Zurück/);
  assert.match(overviewRenderer, /Lernprojekt starten/);
  assert.doesNotMatch(overviewRenderer, /step_ids|Schrittanzahl|Lernschritte/);
  assert.match(controller, /async function openLesson/);
  assert.match(controller, /\/lessons\/\$\{encodeURIComponent\(lessonId\)\}\/start/);
  assert.match(learningView, /Entwicklungsprojekt · Projektstory/);
  assert.match(learningView, /Entwicklungslesson · einzeln gestartet/);
  assert.match(guidedView, /Deine Aufgabe/);
  assert.match(guidedView, /Das solltest du danach sehen/);
  assert.match(guidedView, /Warum ist das wichtig\?/);
  assert.match(guidedView, /artifact_text/);
  assert.match(guidedView, /noch keine konkrete Aufgabe oder sichtbare Arbeitsgrundlage/);
});

test("models ESP32 camera streaming as three progressive and standalone lessons", () => {
  const course = require("../src/dev/project-models/esp32-camera-streaming-course.json");
  const { createEsp32CameraStreamingCourseModel } = require("../src/dev/project-models/esp32-camera-streaming-course");

  assert.equal(course.project.slug, "esp32-camera-streaming");
  assert.equal(course.project.hardware_profile_id, "hardware.processor_board.ai_thinker_esp32_cam");
  assert.equal(course.project.build_config.board, "esp32cam");
  assert.deepEqual(course.development_lessons.map((lesson) => lesson.order_index), [1, 2, 3]);
  assert.deepEqual(course.development_lessons.map((lesson) => lesson.step_ids.length), [3, 3, 3]);
  assert.deepEqual(course.development_lessons[2].prerequisite_lesson_ids, ["development_lesson.camera.phone_access_point"]);
  assert.ok(course.project.tags.includes("topic:camera"));
  assert.ok(course.project.tags.includes("topic:networking"));
  assert.ok(course.project.tags.includes("topic:video"));
  assert.match(JSON.stringify(course.view_manifest), /Weder Router-Portweiterleitung|Kein öffentlicher Port/);
  const cameraSource = course.sources.find((source) => source.path === "src/main.cpp").content;
  assert.match(cameraSource, /WiFi\.softAP/);
  assert.match(cameraSource, /multipart\/x-mixed-replace/);
  assert.match(course.sources.find((source) => source.path === "docs\/fernzugriff.md").content, /TLS.*Geräteberechtigung[\s\S]*Account-\/Projektberechtigung/);

  const model = createEsp32CameraStreamingCourseModel();
  const standalone = model.createViewManifest(
    { learning_project_id: "learning_project.esp32_camera_streaming" },
    { lessonId: "development_lesson.camera.phone_access_point", primarySourcePath: () => "unused" },
  );
  assert.equal(standalone.entry_mode, "standalone_lesson");
  assert.deepEqual(standalone.views.map((view) => view.id), ["ap-network", "mjpeg-stream", "phone-test"]);
  assert.deepEqual(model.createSources({ lessonId: "development_lesson.camera.secure_vps_relay" }).map((source) => source.path), [
    "docs/fernzugriff.md",
    "docs/projektstory.md",
    "docs/quellen.md",
  ]);
  assert.match(server, /createEsp32CameraStreamingCourseModel/);
  assert.match(server, /esp32CameraStreamingCourseModel\.createProject/);
  assert.match(server, /ai_thinker_esp32_cam[\s\S]*framework: "arduino"[\s\S]*board: "esp32cam"/);
  assert.match(app, /"topic:camera": "Kamera"/);
});

test("catalog exposes the UML fundamentals course", () => {
  const course = require("../src/dev/project-models/uml-fundamentals-course.json");
  const model = require("../src/dev/project-models/uml-fundamentals-course");

  assert.equal(course.project.title, "UML-Grundlagen – Diagramme, die Mensch und Maschine verstehen");
  assert.equal(course.project.area, "Modellierung");
  assert.equal(course.project.learning_category, "software_engineering");
  assert.equal(course.project.hardware_profile_id, "runtime.browser_plantuml");
  assert.equal(course.project.default_device_id, "");
  assert.equal(course.project.access_model, "free");
  assert.deepEqual(course.project.tags, ["runtime:browser", "topic:modeling", "level:beginner"]);
  assert.equal(course.project.steps.length, 7);
  assert.deepEqual(course.view_manifest.views.map((view) => view.id), [
    "picture-and-model",
    "choose-view",
    "use-case-view",
    "class-view",
    "sequence-view",
    "state-view",
    "uml-capstone",
  ]);
  assert.equal(course.view_manifest.views.filter((view) => view.type === "plantuml").length, 4);
  assert.match(JSON.stringify(course.view_manifest), /Bilder, die Mensch und Maschine verstehen/);
  assert.match(course.sources.find((source) => source.path.endsWith(".puml")).content, /@startuml[\s\S]*@enduml/);
  assert.equal(model.createUmlFundamentalsCourseModel().slug, "uml-fundamentals");
  assert.match(server, /createUmlFundamentalsCourseModel/);
  assert.match(server, /umlFundamentalsCourseModel\.createProject/);
  assert.match(server, /umlFundamentalsCourseModel\.createViewManifest/);
  assert.match(server, /umlFundamentalsCourseModel\.createSources/);
});

test("does not expose the retired ESP32 OTA basis software as a learning project", () => {
  assert.doesNotMatch(server, /project\("esp32-ota-bootstrap-firmware"/);
  assert.match(server, /isRetiredCatalogProject/);
});
