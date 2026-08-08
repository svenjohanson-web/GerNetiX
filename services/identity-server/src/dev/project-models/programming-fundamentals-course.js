const modelData = require("./programming-fundamentals-course.json");
const { developmentLessonCatalog } = require("./development-lesson-catalog");

function createProgrammingFundamentalsCourseModel() {
  const lessons = modelData.lessons || [];
  const lessonAssignments = modelData.project.project_lesson_assignments || [];
  const developmentLessons = developmentLessonCatalog.resolveProjectLessons(lessonAssignments);

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
        project_lesson_assignments: clone(lessonAssignments),
      },
    );
  }

  function createViewManifest(project, { lessonId = "", primarySourcePath, override } = {}) {
    if (override && !lessonId) return override;
    const manifest = {
      ...clone(modelData.view_manifest),
      primary_source_path: primarySourcePath(project),
      views: developmentLessonCatalog.viewsForProject(lessonAssignments),
    };
    const lesson = lessonById(lessonId);
    if (!lesson) return manifest;
    return {
      ...manifest,
      title: `${lesson.title} · Einzelübung`,
      summary: lesson.summary,
      primary_source_path: lesson.standalone_start.primary_source_path,
      entry_mode: "standalone_lesson",
      lesson_focus_id: lesson.id,
      parent_learning_project_id: project.learning_project_id,
      views: manifest.views.filter((view) => view.lesson_id === lesson.id),
    };
  }

  function createSources({ lessonId = "" } = {}) {
    const lesson = lessonById(lessonId);
    if (!lesson) return clone(modelData.sources);
    return developmentLessonCatalog.sourcesForLesson(lesson.id);
  }

  function lessonById(lessonId) {
    return developmentLessons.find((lesson) => lesson.id === lessonId) || null;
  }

  return { createProject, createSources, createViewManifest, lessonById, slug: modelData.slug };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createProgrammingFundamentalsCourseModel };
