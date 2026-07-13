const assert = require("node:assert/strict");
const test = require("node:test");
const { createSmartAssistantCourseModel } = require("../src/dev/project-models/smart-assistant-course");

const model = createSmartAssistantCourseModel();
const projectFactory = (slug, title, area, summary, steps, options) => ({ slug, title, area, summary, steps, ...options });
const stepFactory = (title, text, insight) => ({ title, text, insight });

test("offers the smart assistant learning project with both hardware paths", () => {
  const project = model.createProject(projectFactory, stepFactory);
  const manifest = model.createViewManifest(project, { primarySourcePath: (item) => item.source_files[0].path });
  const hardwareView = manifest.views.find((view) => view.id === "hardware-choice");

  assert.equal(project.title, "Erschaffe dir deinen smart Assistenten");
  assert.equal(project.area, "KI und Automatisierung");
  assert.equal(project.access_model, "subscription");
  assert.equal(project.steps[0].title, "Warum ueberhaupt einen eigenen Assistenten?");
  assert.match(project.steps[0].text, /Alexa-Geraete/);
  assert.match(project.steps[0].text, /PC oder Smartphone/);
  assert.match(project.steps[0].insight, /KI versteht/);
  assert.match(JSON.stringify(manifest.views[0]), /Verstehen plus Handeln/);
  assert.match(JSON.stringify(manifest.views[0]), /LLM keinen Timer/);
  assert.match(JSON.stringify(manifest.views[0]), /Home Assistant/);
  assert.equal(manifest.views[0].id, "why-own-assistant");
  assert.match(JSON.stringify(hardwareView), /ESP32/);
  assert.match(JSON.stringify(hardwareView), /Raspberry Pi Zero 2 W/);
});

test("teaches provider adapters, safe automation and project artifacts", () => {
  const project = model.createProject(projectFactory, stepFactory);
  const manifest = model.createViewManifest(project, { primarySourcePath: (item) => item.source_files[0].path });
  const serialized = JSON.stringify(manifest);
  const sources = model.createSources();

  assert.match(serialized, /GPT/);
  assert.match(serialized, /Gemini/);
  assert.match(serialized, /Claude/);
  assert.match(serialized, /Alexa/);
  assert.match(serialized, /Bestaetigung/);
  assert.ok(sources.some((source) => source.path.endsWith(".puml")));
  assert.ok(sources.some((source) => source.path.endsWith("entscheidungen.md")));
});
