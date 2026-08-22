const modelData = require("./microcontroller-fundamentals-course.json");

function createMicrocontrollerFundamentalsCourseModel() {
  const lessons = modelData.lessons || [];

  function createProject(project, step) {
    const definition = modelData.project;
    return project(
      definition.slug,
      definition.title,
      definition.area,
      definition.summary,
      lessons.map((lesson) => step(lesson.title, lesson.summary, lesson.insight)),
      {
        default_device_id: definition.default_device_id,
        hardware_profile_id: definition.hardware_profile_id,
        learning_category: definition.learning_category,
        access_model: definition.access_model,
        required_capability_ids: definition.required_capability_ids,
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
  const completion = clone(lesson.completion);
  return {
    id: lesson.id,
    lesson_id: lesson.lesson_id || `microcontroller-fundamentals.lesson-${String(index + 1).padStart(2, "0")}`,
    type: lesson.type || "story_slide",
    title: lesson.title,
    summary: lesson.summary,
    completion,
    payload: {
      artifact: {
        type: completion?.type === "code" ? "code_task" : "code",
        title: lesson.artifact_title || lesson.title,
        content: lesson.code || "",
        lab_url: lesson.lab_url || "",
        lab_title: lesson.lab_title || "",
      },
      task: lesson.task,
      expected_result: lesson.expected_result,
      why: lesson.why || lesson.insight,
      model_lines: clone(lesson.concepts || []),
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createMicrocontrollerFundamentalsCourseModel };
