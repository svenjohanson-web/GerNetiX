"use strict";

const programmingFundamentals = require("./programming-fundamentals-course.json");
const storageLearningStory = require("./storage-learning-story-course.json");
const esp32CameraStreaming = require("./esp32-camera-streaming-course.json");
const chickenCoopDoorSmartphoneApp = require("./chicken-coop-door-smartphone-app-course.json");

function createDevelopmentLessonCatalog(bundles) {
  const lessonsById = new Map();
  const viewsById = new Map();
  const bundleByLessonId = new Map();

  for (const bundle of bundles) {
    const bundleId = required(bundle.id, "bundle_id");
    const bundleViews = new Map((bundle.views || []).map((view) => [required(view.id, "step_id"), clone(view)]));
    for (const lesson of bundle.lessons || []) {
      const lessonId = required(lesson.id, "lesson_id");
      if (lessonsById.has(lessonId)) throw new Error(`duplicate_development_lesson:${lessonId}`);
      const stepIds = Array.isArray(lesson.step_ids) ? lesson.step_ids.map((stepId) => required(stepId, "step_id")) : [];
      if (stepIds.length < 2) throw new Error(`development_lesson_requires_multiple_steps:${lessonId}`);
      for (const stepId of stepIds) {
        if (!bundleViews.has(stepId)) throw new Error(`development_lesson_step_missing:${lessonId}:${stepId}`);
        if (viewsById.has(stepId)) throw new Error(`duplicate_development_step:${stepId}`);
        viewsById.set(stepId, { ...bundleViews.get(stepId), lesson_id: lessonId });
      }
      lessonsById.set(lessonId, {
        id: lessonId,
        title: String(lesson.title || lessonId),
        summary: String(lesson.summary || ""),
        step_ids: stepIds,
        standalone_start: clone(lesson.standalone_start || {}),
      });
      bundleByLessonId.set(lessonId, {
        id: bundleId,
        sources: clone(bundle.sources || []),
      });
    }
  }

  function lessonById(lessonId) {
    const lesson = lessonsById.get(String(lessonId || ""));
    return lesson ? clone(lesson) : null;
  }

  function resolveProjectLessons(assignments = []) {
    return assignments.map((assignment, index) => {
      const normalized = typeof assignment === "string" ? { lesson_id: assignment } : assignment || {};
      const lesson = lessonById(normalized.lesson_id);
      if (!lesson) throw new Error(`unknown_development_lesson:${normalized.lesson_id || ""}`);
      return {
        ...lesson,
        order_index: Number(normalized.order_index || index + 1),
        prerequisite_lesson_ids: clone(normalized.prerequisite_lesson_ids || []),
      };
    });
  }

  function viewsForProject(assignments = []) {
    return resolveProjectLessons(assignments).flatMap((lesson) => lesson.step_ids.map((stepId) => clone(viewsById.get(stepId))));
  }

  function viewsForLesson(lessonId) {
    const lesson = lessonById(lessonId);
    if (!lesson) return [];
    return lesson.step_ids.map((stepId) => clone(viewsById.get(stepId)));
  }

  function sourcesForLesson(lessonId) {
    const lesson = lessonById(lessonId);
    if (!lesson) return [];
    const sourcePaths = new Set(lesson.standalone_start.source_paths || []);
    return clone((bundleByLessonId.get(lesson.id)?.sources || []).filter((source) => sourcePaths.has(source.path)));
  }

  return { lessonById, resolveProjectLessons, sourcesForLesson, viewsForLesson, viewsForProject };
}

function programmingViews(modelData) {
  return (modelData.lessons || []).map((step) => ({
    id: step.id,
    type: step.type || "story_slide",
    title: step.title,
    summary: step.summary,
    completion: clone(step.completion),
    payload: clone(step.payload),
  }));
}

const developmentLessonCatalog = createDevelopmentLessonCatalog([
  {
    id: "lesson_bundle.programming_fundamentals",
    lessons: programmingFundamentals.development_lessons,
    views: programmingViews(programmingFundamentals),
    sources: programmingFundamentals.sources,
  },
  {
    id: "lesson_bundle.storage_learning_story",
    lessons: storageLearningStory.development_lessons,
    views: storageLearningStory.view_manifest.views,
    sources: storageLearningStory.sources,
  },
  {
    id: "lesson_bundle.esp32_camera_streaming",
    lessons: esp32CameraStreaming.development_lessons,
    views: esp32CameraStreaming.view_manifest.views,
    sources: esp32CameraStreaming.sources,
  },
  {
    id: "lesson_bundle.chicken_coop_door_smartphone_app",
    lessons: chickenCoopDoorSmartphoneApp.development_lessons,
    views: chickenCoopDoorSmartphoneApp.view_manifest.views,
    sources: chickenCoopDoorSmartphoneApp.sources,
  },
]);

function required(value, field) {
  const result = String(value || "").trim();
  if (!result) throw new Error(`missing_${field}`);
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createDevelopmentLessonCatalog, developmentLessonCatalog };
