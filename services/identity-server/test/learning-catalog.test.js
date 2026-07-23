const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
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
  const renderer = app.match(/function renderProjects\(\)[\s\S]*?\nfunction renderLearn/)?.[0] || "";
  assert.match(renderer, /Lernprojekt starten/);
  assert.match(renderer, /learningAccessLabel\(project\.accessModel\)/);
  assert.doesNotMatch(renderer, /Lernschritte/);
  assert.doesNotMatch(renderer, /Umgebung/);
  assert.doesNotMatch(renderer, /Hardware/);
  assert.doesNotMatch(renderer, /Projektdateien/);
});

test("catalog classifies free, purchased and subscription access", () => {
  assert.match(app, /free: "Frei verfuegbar"/);
  assert.match(app, /purchased: "Kurs gekauft"/);
  assert.match(app, /subscription: "Im Abo enthalten"/);
});

test("categories and controlled tags classify only learning projects", () => {
  const tamagotchi = require("../src/dev/project-models/tamagotchi-entry-course.json");
  const smartAssistant = require("../src/dev/project-models/smart-assistant-course.json");
  const notification = require("../src/dev/project-models/button-to-smartphone-notification-course.json");
  assert.equal(tamagotchi.project.learning_category, "software_engineering");
  assert.equal(smartAssistant.project.learning_category, "distributed_system");
  assert.ok(notification.project.tags.includes("platform:esp32"));
  assert.match(html, /id="learningCatalogCategory"/);
  assert.match(html, /value="software_engineering">Software Engineering/);
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
  const openMethod = learningController.match(/async function open\(projectId\) \{[\s\S]*?\n    \}/)?.[0] || "";
  assert.ok(openMethod.indexOf("navigate(") < openMethod.indexOf("saveStep("));
  assert.match(openMethod, /\.catch\(\(error\) => showError\(error\)\)/);
});

test("keeps the catalog and the active learning project in separate views", () => {
  assert.match(html, /id="learnView"[\s\S]*?id="projectList"/);
  assert.match(html, /id="learningProjectView"[\s\S]*?id="learningProjectWorkspace"/);
  assert.match(app, /"learning-project": "learningProjectView"/);
  assert.match(learningController, /navigate\(`\/app\/learning-project\/\?project=/);
});

test("catalog includes the button-to-smartphone notification learning project", () => {
  assert.match(server, /button-to-smartphone-notification/);
  assert.match(server, /createButtonToSmartphoneNotificationCourseModel/);
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
  assert.match(guidedView, /Schritt 1: ESP-Board auswählen/);
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
  assert.match(server, /schema_version \|\| 0\) < 4/);
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
  assert.match(learningController, /renderGuidedProject\(project\)/);
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  assert.match(guidedView, /renderProjectViewManifest\(project, targetSelector = "#ideProjectViewManifest"\)/);
  assert.match(guidedView, /guided-code-viewer/);
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

test("does not expose the retired ESP32 OTA basis software as a learning project", () => {
  assert.doesNotMatch(server, /project\("esp32-ota-bootstrap-firmware"/);
  assert.match(server, /isRetiredCatalogProject/);
});
