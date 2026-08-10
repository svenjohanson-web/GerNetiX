const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createNexiCourseModel } = require("../src/dev/project-models/nexi-course");
const nexiProjectApp = require("../src/dev/project-models/nexi-project-app-manifest.json");

const root = path.resolve(__dirname, "..");

test("offers Nexi as local product, build, learning and development customer journey", () => {
  const model = createNexiCourseModel();
  const definition = model.createProject((slug, title, area, summary, steps, options) => ({ slug, title, area, summary, steps, ...options }), (title, text, insight) => ({ title, text, insight }));
  assert.equal(definition.slug, "nexi-voice-assistant");
  assert.equal(definition.product_stage, "local_basic");
  assert.equal(definition.hardware_profile_id, "hardware.processor_board.waveshare_esp32_s3_audio_board");
  assert.equal(definition.build_config.environment, "waveshare_esp32_s3_audio_board");
  assert.equal(definition.build_config.board, "4d_systems_esp32s3_gen4_r8n16");
  assert.equal(definition.build_config.flash_size_mb, 16);
  assert.equal(definition.build_config.firmware_basis_id, "gernetix-runtime-basissoftware");
  assert.deepEqual(definition.customer_entries.map((entry) => entry.id), ["use", "build", "learn", "develop"]);
  assert.equal(definition.customer_entries.find((entry) => entry.id === "build").availability, "available");
  assert.equal(definition.customer_entries.find((entry) => entry.id === "learn").availability, "available");
  assert.equal(definition.customer_entries.find((entry) => entry.id === "develop").availability, "available");
  assert.equal(definition.customer_entries.find((entry) => entry.id === "use").availability, "requires_instance");
});

test("binds Nexi Basic to its protected product source without claiming an active AI provider", () => {
  const model = createNexiCourseModel();
  const definition = model.createProject((slug, title, area, summary, steps, options) => ({ slug, title, area, summary, steps, ...options }), (title, text, insight) => ({ title, text, insight }));
  const sources = model.createSources();
  const decisions = sources.find((source) => source.path === "docs/nexi-entscheidungen.md");
  assert.ok(decisions);
  assert.equal(definition.system_source_id, "gernetix-product-nexi");
  assert.ok(definition.source_files.some((source) => source.path === "Komponenten/IoT-Device 1/src/user_main.cpp"));
  assert.equal(sources.some((source) => source.path === "Komponenten/IoT-Device 1/src/user_main.cpp"), false);
  const modelSource = fs.readFileSync(path.join(root, "src/dev/project-models/nexi-course.json"), "utf8");
  assert.match(modelSource, /funktioniert lokal/);
  assert.match(modelSource, /Ohne Provider/);
  assert.match(modelSource, /keine Aufnahme/);
  const dockerfile = fs.readFileSync(path.resolve(root, "../../docker/node-service.Dockerfile"), "utf8");
  assert.doesNotMatch(dockerfile, /projects\/waveshare-voice-lab/);
});

test("defines every promised Nexi parent field in the versioned project app", () => {
  const settingKeys = new Set(nexiProjectApp.settings.map((setting) => setting.key));
  for (const key of [
    "child_first_name", "child_age", "languages", "interests", "cloud_enabled",
    "web_search_enabled", "excluded_topics", "assistant_mode", "voice", "max_volume",
    "daily_minutes", "max_session_minutes", "quiet_hours",
  ]) assert.equal(settingKeys.has(key), true, key);
  assert.equal(nexiProjectApp.settings.find((setting) => setting.key === "cloud_enabled").default, false);
  assert.equal(nexiProjectApp.settings.find((setting) => setting.key === "child_age").default, 8);
  assert.deepEqual(nexiProjectApp.pages.map((page) => page.id), ["overview", "child", "assistant", "times"]);
  assert.ok(nexiProjectApp.pages.flatMap((page) => page.widgets).some((widget) => widget.type === "input"));
  const source = JSON.parse(createNexiCourseModel().createSources().find((item) => item.path === "project-app/manifest.json").content);
  assert.deepEqual(source, nexiProjectApp);
  const intro = nexiProjectApp.pages.find((page) => page.id === "overview").widgets.find((widget) => widget.id === "intro");
  assert.match(intro.text, /Aufnahme, Stimmeffekte, Wiedergabe, Tasten und LEDs funktionieren direkt/);
  assert.match(intro.text, /ausdrücklich aktivierst[\s\S]*KI-Anbieter freigegeben[\s\S]*Kontingent verfügbar/);
});

test("renders the four Nexi entries in the learning project overview", () => {
  const controller = fs.readFileSync(path.join(root, "public/app/app-project-controller.js"), "utf8");
  const learningController = fs.readFileSync(path.join(root, "public/app/learning-project-controller.js"), "utf8");
  assert.match(controller, /project\.customerEntries/);
  assert.match(controller, /kind === "build" \? "nexi-build" : "nexi-local"/);
  assert.match(controller, /kind === "develop"[\s\S]*openDevelopment/);
  assert.match(controller, /data-open-customer-project-app/);
  assert.match(controller, /project\.projectOrigin === "account_project" && project\.slug === catalogProject\.slug/);
  assert.match(controller, /Nach Einrichtung verfügbar/);
  assert.match(controller, /customerEntryAvailabilityLabel/);
  assert.match(controller, /query\.get\("entry"\)[\s\S]*requestedButton\.click\(\)/);
  assert.doesNotMatch(controller, /Fünf Etappen führen dich von einfachen Daten/);
  assert.match(learningController, /options\.startViewId[\s\S]*findIndex/);
  assert.match(learningController, /openDevelopment[\s\S]*\/app\/ide\/\?project=/);
});
