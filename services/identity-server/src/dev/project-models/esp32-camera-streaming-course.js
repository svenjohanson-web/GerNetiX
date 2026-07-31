const modelData = require("./esp32-camera-streaming-course.json");

function createEsp32CameraStreamingCourseModel() {
  function createProject(project, step) {
    const definition = modelData.project;
    return project(
      definition.slug,
      definition.title,
      definition.area,
      definition.summary,
      definition.steps.map((item) => step(item.title, item.text, item.insight)),
      {
        access_model: definition.access_model,
        build_config: definition.build_config,
        default_device_id: definition.default_device_id,
        development_lessons: clone(modelData.development_lessons),
        hardware_profile_id: definition.hardware_profile_id,
        learning_category: definition.learning_category,
        project_story: clone(modelData.project_story),
        required_capability_ids: definition.required_capability_ids,
        source_files: definition.source_files,
        tags: definition.tags,
      },
    );
  }

  function createViewManifest(project, { lessonId = "", primarySourcePath, override } = {}) {
    if (override && !lessonId) return override;
    const manifest = withSourceArtifacts(clone(modelData.view_manifest));
    const lesson = lessonById(lessonId);
    if (!lesson) return { ...manifest, primary_source_path: primarySourcePath(project) };
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
    const sourcePaths = new Set(lesson.standalone_start.source_paths);
    return clone(modelData.sources.filter((source) => sourcePaths.has(source.path)));
  }

  function lessonById(lessonId) {
    return modelData.development_lessons.find((lesson) => lesson.id === lessonId) || null;
  }

  function withSourceArtifacts(manifest) {
    const sourcesByPath = new Map(modelData.sources.map((source) => [source.path, source]));
    manifest.views = manifest.views.map((view) => {
      if (view.type !== "source_analysis" || !view.source_path) return view;
      const source = sourcesByPath.get(view.source_path);
      if (!source) return view;
      return {
        ...view,
        payload: {
          ...(view.payload || {}),
          artifact: { type: "code", title: view.source_path, content: source.content },
        },
      };
    });
    return manifest;
  }

  return { createProject, createSources, createViewManifest, lessonById, slug: modelData.slug };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createEsp32CameraStreamingCourseModel };
