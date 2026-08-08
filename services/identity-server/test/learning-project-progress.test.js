"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const viewSource = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-view.js"), "utf8");
const catalogSource = fs.readFileSync(path.resolve(__dirname, "../public/app/app-project-controller.js"), "utf8");
const controllerSource = fs.readFileSync(path.resolve(__dirname, "../public/app/learning-project-controller.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");

function learningProjectView() {
  const context = {};
  vm.runInNewContext(`${viewSource}\nthis.view = LearningProjectView;`, context);
  return context.view;
}

const project = {
  lessonId: "lesson-1",
  developmentLessons: [
    { id: "lesson-1", title: "Grundlage" },
    { id: "lesson-2", title: "Praxis" },
  ],
  viewManifest: {
    views: [
      { id: "step-1", lesson_id: "lesson-1", title: "Problem verstehen" },
      { id: "step-2", lesson_id: "lesson-1", title: "Begriffe klären" },
      { id: "step-3", lesson_id: "lesson-2", title: "Lösung prüfen" },
    ],
  },
};

test("groups every project step under its lesson and derives completion", () => {
  const structure = learningProjectView().lessonStructure(project, {
    completedSteps: [0],
    completedStepIds: ["step-3"],
  }, 1);

  assert.equal(structure.lessons.length, 2);
  assert.deepEqual(Array.from(structure.lessons, (lesson) => lesson.stepCount), [2, 1]);
  assert.equal(structure.completedSteps, 2);
  assert.equal(structure.lessons[0].status, "active");
  assert.equal(structure.lessons[0].steps[1].active, true);
  assert.equal(structure.lessons[1].status, "completed");
});

test("standalone lesson progress shows only the selected lesson", () => {
  const structure = learningProjectView().lessonStructure({
    ...project,
    entryMode: "standalone_lesson",
    currentLessonId: "lesson-2",
    viewManifest: { views: [project.viewManifest.views[2]] },
  });
  assert.equal(structure.lessons.length, 1);
  assert.equal(structure.lessons[0].title, "Praxis");
  assert.equal(structure.totalSteps, 1);
});

test("projects without declared lessons still expose all steps as one lesson", () => {
  const structure = learningProjectView().lessonStructure({
    name: "YAML-Grundlagen",
    lessonId: "yaml-intro",
    viewManifest: { views: [
      { id: "yaml-1", title: "Werte", lesson_id: "yaml-intro" },
      { id: "yaml-2", title: "Listen", lesson_id: "yaml-intro" },
    ] },
  });
  assert.equal(structure.lessons.length, 1);
  assert.equal(structure.lessons[0].title, "YAML-Grundlagen");
  assert.equal(structure.lessons[0].stepCount, 2);
});

test("renders lessons and every step as a visible progress map", () => {
  const target = { innerHTML: "", classList: { toggle() {} } };
  const rendered = learningProjectView().render({
    target,
    project: { ...project, name: "Beispielprojekt", projectOrigin: "account_project" },
    progress: { completedSteps: [0], completedStepIds: ["step-1"] },
    activeStep: 1,
    escapeHtml: (value) => String(value),
    learningText: (_key, fallback) => fallback,
  });
  assert.equal(rendered, true);
  assert.match(target.innerHTML, /2 Lessons · 3 Schritte/);
  assert.match(target.innerHTML, /<details class="learning-project-progress-map"/);
  assert.match(target.innerHTML, /<summary title="Lessons und Schritte anzeigen">/);
  assert.match(target.innerHTML, /Grundlage[\s\S]*Problem verstehen[\s\S]*Begriffe klären/);
  assert.match(target.innerHTML, /Praxis[\s\S]*Lösung prüfen/);
  assert.match(target.innerHTML, /aria-current="step"/);
  assert.match(target.innerHTML, /aria-valuenow="1"/);
  assert.match(target.innerHTML, /Geführtes Lernprojekt/);
});

test("uses the project-story label only for projects that actually define a story", () => {
  const target = { innerHTML: "", classList: { toggle() {} } };
  learningProjectView().render({
    target,
    project: { ...project, name: "Beispielprojekt", projectStory: { kind: "development_project" } },
    escapeHtml: (value) => String(value),
    learningText: (_key, fallback) => fallback,
  });
  assert.match(target.innerHTML, /Entwicklungsprojekt · Projektstory/);
});

test("project overview and workspace expose lesson and step counts continuously", () => {
  assert.match(catalogSource, /structure\.lessons\.length[\s\S]*structure\.totalSteps/);
  assert.match(catalogSource, /structure\.lessons\.map[\s\S]*lesson\.stepCount/);
  assert.match(viewSource, /learning-project-progress-map/);
  assert.match(viewSource, /learning-project-progress-lessons/);
  assert.match(viewSource, /aria-current="step"/);
  assert.match(controllerSource, /project: localizedProject,\s*progress,\s*activeStep/);
  assert.match(controllerSource, /state\.activeIdeStep[\s\S]*progress\.currentStep/);
  assert.match(css, /\.learning-project-body[^{]*\{[^}]*grid-template-columns/);
  assert.match(css, /\.learning-project-progress-map[^{]*\{[^}]*position: sticky/);
  assert.match(css, /\.learning-project-progress-map:hover > \.learning-project-progress-lessons/);
  assert.match(css, /\.learning-project-progress-map\[open\] > \.learning-project-progress-lessons/);
});
