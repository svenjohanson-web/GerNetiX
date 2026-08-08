"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createDevelopmentLessonCatalog, developmentLessonCatalog } = require("../src/dev/project-models/development-lesson-catalog");

test("one catalog lesson and its steps can be assigned to multiple learning projects", () => {
  const catalog = createDevelopmentLessonCatalog([{
    id: "lesson_bundle.shared",
    lessons: [{
      id: "development_lesson.shared.requirements",
      title: "Anforderungen präzisieren",
      summary: "Formuliere und prüfe Anforderungen.",
      step_ids: ["shared-understand", "shared-verify"],
      standalone_start: {
        runtime: "browser",
        source_paths: ["lesson.md"],
      },
    }],
    views: [
      { id: "shared-understand", title: "Verständnis spiegeln" },
      { id: "shared-verify", title: "Akzeptanz prüfen" },
    ],
    sources: [{ path: "lesson.md", content: "Gemeinsamer Inhalt" }],
  }]);

  const firstProject = catalog.resolveProjectLessons([{
    lesson_id: "development_lesson.shared.requirements",
    prerequisite_lesson_ids: [],
  }]);
  const secondProject = catalog.resolveProjectLessons([{
    lesson_id: "development_lesson.shared.requirements",
    order_index: 3,
    prerequisite_lesson_ids: ["development_lesson.other.introduction"],
  }]);

  assert.equal(firstProject[0].id, secondProject[0].id);
  assert.deepEqual(firstProject[0].step_ids, ["shared-understand", "shared-verify"]);
  assert.deepEqual(secondProject[0].step_ids, firstProject[0].step_ids);
  assert.equal(firstProject[0].order_index, 1);
  assert.equal(secondProject[0].order_index, 3);
  assert.deepEqual(firstProject[0].prerequisite_lesson_ids, []);
  assert.deepEqual(secondProject[0].prerequisite_lesson_ids, ["development_lesson.other.introduction"]);
  assert.deepEqual(catalog.viewsForProject([{ lesson_id: firstProject[0].id }]).map((view) => view.id), [
    "shared-understand",
    "shared-verify",
  ]);
  assert.deepEqual(catalog.sourcesForLesson(firstProject[0].id).map((source) => source.path), ["lesson.md"]);
});

test("catalog lessons require at least two existing and globally unique steps", () => {
  assert.throws(() => createDevelopmentLessonCatalog([{
    id: "lesson_bundle.invalid",
    lessons: [{ id: "development_lesson.invalid", step_ids: ["only-step"] }],
    views: [{ id: "only-step", title: "Zu wenig" }],
  }]), /development_lesson_requires_multiple_steps/);
});

test("existing learning projects resolve lessons through references without copying their steps", () => {
  const references = [
    { lesson_id: "development_lesson.programming.flow_values" },
    { lesson_id: "development_lesson.programming.final_transfer" },
  ];
  const lessons = developmentLessonCatalog.resolveProjectLessons(references);
  const views = developmentLessonCatalog.viewsForProject(references);

  assert.deepEqual(lessons.map((lesson) => lesson.step_ids.length), [7, 2]);
  assert.equal(views.length, 9);
  assert.equal(views[0].lesson_id, lessons[0].id);
  assert.equal(views.at(-1).lesson_id, lessons[1].id);
});

test("the shared project factory persists assignments and exposes lessons only as a resolved view", () => {
  const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
  assert.match(server, /project_lesson_assignments: projectLessonAssignments/);
  assert.match(server, /developmentLessonCatalog\.resolveProjectLessons\(projectLessonAssignments\)/);
  assert.match(server, /projectLessonAssignments: project\.project_lesson_assignments \|\| \[\]/);
});
