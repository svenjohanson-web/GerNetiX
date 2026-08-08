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

function learningProjectController() {
  const context = { window: { addEventListener() {} } };
  vm.runInNewContext(`${controllerSource}\nthis.controller = LearningProjectController;`, context);
  return context.controller;
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
  assert.match(target.innerHTML, /1\/3 erledigt/);
  assert.match(target.innerHTML, /<details class="learning-project-progress-map"/);
  assert.match(target.innerHTML, /<summary title="Lessons und Schritte anzeigen">/);
  assert.match(target.innerHTML, /Grundlage[\s\S]*Problem verstehen[\s\S]*Begriffe klären/);
  assert.match(target.innerHTML, /Praxis[\s\S]*Lösung prüfen/);
  assert.match(target.innerHTML, /aria-current="step"/);
  assert.match(target.innerHTML, /aria-valuenow="1"/);
  assert.match(target.innerHTML, /Geführtes Lernprojekt/);
  assert.match(target.innerHTML, /learning-project-header-actions[\s\S]*learning-project-progress-map[\s\S]*Alle Lernprojekte/);
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

test("asks whether to restart or continue and shows the exact saved position", () => {
  const target = { innerHTML: "", classList: { toggle() {} } };
  learningProjectView().render({
    target,
    project: { ...project, name: "Beispielprojekt" },
    progress: { status: "active", currentStep: 1, completedSteps: [0] },
    activeStep: 1,
    showStartChoice: true,
    escapeHtml: (value) => String(value),
    learningText: (_key, fallback) => fallback,
  });
  assert.match(target.innerHTML, /data-learning-start-choice/);
  assert.match(target.innerHTML, /Wie möchtest du beginnen\?/);
  assert.match(target.innerHTML, /Grundlage[\s\S]*Schritt 2 \/ 3 · Begriffe klären/);
  assert.match(target.innerHTML, /data-learning-start-new>Neu beginnen/);
  assert.match(target.innerHTML, /data-learning-start-continue autofocus>Am letzten Stand fortsetzen/);
});

test("recognizes only genuinely saved progress as resumable", () => {
  const { hasSavedProgress } = learningProjectController();
  assert.equal(hasSavedProgress({ status: "not_started", currentStep: 0, completedSteps: [] }), false);
  assert.equal(hasSavedProgress({ status: "active", currentStep: 0, completedSteps: [] }), true);
  assert.equal(hasSavedProgress({ status: "not_started", updatedAt: "2026-08-08T10:00:00Z" }), true);
  assert.equal(hasSavedProgress({ status: "not_started", completedStepIds: ["step-1"] }), true);
});

test("project overview and workspace expose lesson and step counts continuously", () => {
  assert.match(catalogSource, /structure\.lessons\.length[\s\S]*structure\.totalSteps/);
  assert.match(catalogSource, /structure\.lessons\.map[\s\S]*lesson\.stepCount/);
  assert.match(viewSource, /learning-project-progress-map/);
  assert.match(viewSource, /learning-project-progress-lessons/);
  assert.match(viewSource, /aria-current="step"/);
  assert.match(viewSource, /completedSteps[^\n]*totalSteps[^\n]*completedLabel/);
  assert.match(controllerSource, /project: localizedProject,\s*progress,\s*activeStep/);
  assert.match(controllerSource, /state\.activeIdeStep[\s\S]*progress\.currentStep/);
  assert.match(controllerSource, /resetProgress: options\.resetProgress === true/);
  assert.match(controllerSource, /dialog\.showModal\(\)/);
  assert.match(css, /\.learning-project-header-actions[^{]*\{[^}]*display: flex/);
  assert.match(css, /\.learning-project-progress-map[^{]*\{[^}]*position: relative[^}]*width: clamp\(185px, 19vw, 220px\)/);
  assert.match(css, /\.learning-project-progress-lessons[^{]*\{[^}]*position: absolute/);
  assert.match(css, /\.learning-project-progress-map:hover > \.learning-project-progress-lessons/);
  assert.match(css, /\.learning-project-progress-map\[open\] > \.learning-project-progress-lessons/);
  assert.match(css, /\.learning-project-start-choice::backdrop/);
});
