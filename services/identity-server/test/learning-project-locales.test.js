const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "app", "learning-project-locales.js"), "utf8");
const app = readPlatformAppSource();
const view = fs.readFileSync(path.join(__dirname, "..", "public", "app", "learning-project-view.js"), "utf8");
const controller = fs.readFileSync(path.join(__dirname, "..", "public", "app", "learning-project-controller.js"), "utf8");
const context = {};
vm.runInNewContext(`${source}\nthis.locales = LearningProjectLocales;`, context);

test("English learning catalog translations preserve canonical project identity", () => {
  const original = { id: "learning_project.yaml_fundamentals", slug: "yaml-fundamentals", name: "YAML-Grundlagen", description: "Deutsch" };
  const localized = context.locales.project(original, "en");
  assert.equal(localized.id, original.id);
  assert.equal(localized.slug, original.slug);
  assert.equal(localized.name, "YAML fundamentals – describe structured data clearly");
  assert.match(localized.description, /without prior knowledge/);
  assert.equal(original.name, "YAML-Grundlagen");
});

test("German learning catalog keeps its canonical content", () => {
  const original = { slug: "yaml-fundamentals", name: "YAML-Grundlagen" };
  assert.equal(context.locales.project(original, "de"), original);
});

test("Dutch learning catalog translations preserve canonical project identity", () => {
  const original = { id: "learning_project.yaml_fundamentals", slug: "yaml-fundamentals", name: "YAML-Grundlagen", description: "Deutsch" };
  const localized = context.locales.project(original, "nl");
  assert.equal(localized.id, original.id);
  assert.equal(localized.slug, original.slug);
  assert.equal(localized.name, "YAML-basis – gestructureerde gegevens duidelijk beschrijven");
  assert.match(localized.description, /zonder voorkennis/);
});

test("learning interface labels follow the selected locale", () => {
  assert.equal(context.locales.text("en", "continue"), "Continue");
  assert.equal(context.locales.text("nl", "startProject"), "Leerproject starten");
  assert.equal(context.locales.text("de", "progress"), "Fortschritt");
});

test("language changes rerender catalog, personal projects and active learning views", () => {
  assert.match(app, /if \(route === "learn"\) \{[\s\S]*renderProjects\(\);[\s\S]*renderLearn\(\);/);
  assert.match(app, /await state\.i18n\.setLocale\(nextLocale\)[\s\S]*renderRoute\(\)/);
  assert.match(app, /personalLearningProjects\(\)[\s\S]*LearningProjectLocales\.project\(project, currentLearningLocale\(\)\)/);
  assert.match(controller, /localizeProject\(project\)[\s\S]*LearningProjectView\.render/);
  assert.match(view, /learningText\("allProjects", "Alle Lernprojekte"\)/);
});
