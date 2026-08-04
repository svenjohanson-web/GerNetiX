const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createNexiCourseModel } = require("../src/dev/project-models/nexi-course");

const root = path.resolve(__dirname, "..");

test("offers Nexi as local product, build, learning and development customer journey", () => {
  const model = createNexiCourseModel();
  const definition = model.createProject((slug, title, area, summary, steps, options) => ({ slug, title, area, summary, steps, ...options }), (title, text, insight) => ({ title, text, insight }));
  assert.equal(definition.slug, "nexi-voice-assistant");
  assert.equal(definition.product_stage, "local_basic");
  assert.equal(definition.hardware_profile_id, "hardware.processor_board.waveshare_esp32_s3_audio_board");
  assert.deepEqual(definition.customer_entries.map((entry) => entry.id), ["use", "build", "learn", "develop"]);
  assert.equal(definition.customer_entries.find((entry) => entry.id === "build").availability, "available");
  assert.equal(definition.customer_entries.find((entry) => entry.id === "use").availability, "requires_instance");
});

test("keeps Nexi Basic useful without claiming an active AI provider", () => {
  const model = createNexiCourseModel();
  const sources = model.createSources();
  const decisions = sources.find((source) => source.path === "docs/nexi-entscheidungen.md");
  assert.ok(decisions);
  const modelSource = fs.readFileSync(path.join(root, "src/dev/project-models/nexi-course.json"), "utf8");
  assert.match(modelSource, /funktioniert lokal/);
  assert.match(modelSource, /Ohne Provider/);
  assert.match(modelSource, /keine Aufnahme/);
});

test("renders the four Nexi entries in the learning project overview", () => {
  const controller = fs.readFileSync(path.join(root, "public/app/app-project-controller.js"), "utf8");
  assert.match(controller, /project\.customerEntries/);
  assert.match(controller, /data-start-learning-entry/);
  assert.match(controller, /Nach Einrichtung verfügbar/);
  assert.match(controller, /customerEntryAvailabilityLabel/);
});
