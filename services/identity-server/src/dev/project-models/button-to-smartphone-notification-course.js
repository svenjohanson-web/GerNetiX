const modelData = require("./button-to-smartphone-notification-course.json");

function createButtonToSmartphoneNotificationCourseModel() {
  function createProject(project, step) {
    const definition = modelData.project;
    return project(
      definition.slug,
      definition.title,
      definition.area,
      definition.summary,
      definition.steps.map((item) => step(item.title, item.text, item.insight)),
      {
        default_device_id: definition.default_device_id,
        hardware_profile_id: definition.hardware_profile_id,
        learning_category: definition.learning_category,
        access_model: definition.access_model,
        build_config: definition.build_config,
        source_files: definition.source_files,
        tags: definition.tags,
      },
    );
  }

  function createViewManifest(project, { primarySourcePath, override } = {}) {
    if (override) return override;
    return { ...clone(modelData.view_manifest), primary_source_path: primarySourcePath(project) };
  }

  function createSources({ projectId = "" } = {}) {
    return clone(modelData.sources).map((source) => ({
      ...source,
      content: projectId ? String(source.content || "").replaceAll("__PROJECT_ID__", projectId) : source.content,
    }));
  }

  return { createProject, createSources, createViewManifest, slug: modelData.slug };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createButtonToSmartphoneNotificationCourseModel };
