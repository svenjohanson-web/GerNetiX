const modelData = require("./smart-assistant-course.json");

function createSmartAssistantCourseModel() {
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
        access_model: definition.access_model,
        source_files: definition.source_files,
      },
    );
  }

  function createViewManifest(project, { primarySourcePath, override } = {}) {
    if (override) return override;
    return { ...clone(modelData.view_manifest), primary_source_path: primarySourcePath(project) };
  }

  function createSources() {
    return clone(modelData.sources);
  }

  return { createProject, createSources, createViewManifest, slug: modelData.slug };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createSmartAssistantCourseModel };
