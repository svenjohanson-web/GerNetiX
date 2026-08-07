const modelData = require("./programming-fundamentals-course.json");

function createProgrammingFundamentalsCourseModel() {
  const lessons = modelData.lessons || [];

  function createProject(project, step) {
    const definition = modelData.project;
    return project(
      definition.slug,
      definition.title,
      definition.area,
      definition.summary,
      lessons.map((item) => step(item.title, item.summary, item.insight)),
      {
        default_device_id: definition.default_device_id,
        hardware_profile_id: definition.hardware_profile_id,
        learning_category: definition.learning_category,
        access_model: definition.access_model,
        source_files: definition.source_files,
        tags: definition.tags,
      },
    );
  }

  function createViewManifest(project, { primarySourcePath, override } = {}) {
    if (override) return override;
    return {
      ...clone(modelData.view_manifest),
      primary_source_path: primarySourcePath(project),
      views: lessons.map(createLessonView),
    };
  }

  function createSources() {
    return clone(modelData.sources);
  }

  return { createProject, createSources, createViewManifest, slug: modelData.slug };
}

function createLessonView(lesson, index) {
  return {
    id: lesson.id,
    lesson_id: lesson.lesson_id || `programming-fundamentals.lesson-${String(index + 1).padStart(2, "0")}`,
    type: lesson.type || "story_slide",
    title: lesson.title,
    summary: lesson.summary,
    completion: clone(lesson.completion),
    payload: clone(lesson.payload),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createProgrammingFundamentalsCourseModel };
