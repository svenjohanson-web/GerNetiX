const modelData = require("./tamagotchi-entry-course.json");

function createTamagotchiEntryCourseModel({ readWorkspaceText }) {
  function createProject(project, step) {
    const definition = modelData.project;
    return project(
      definition.slug,
      definition.title,
      definition.area,
      definition.summary,
      modelData.view_manifest.views.map((view) => step(view.title, view.summary, "")),
      {
        build_config: definition.build_config,
        default_device_id: definition.default_device_id,
        hardware_profile_id: definition.hardware_profile_id,
        source_files: definition.source_files,
      },
    );
  }

  function createViewManifest(project, { primarySourcePath, override } = {}) {
    if (override) return override;
    return {
      ...clone(modelData.view_manifest),
      primary_source_path: primarySourcePath(project),
    };
  }

  function createSources(project, primarySourcePath) {
    return modelData.sources.map((source) => ({
      path: source.path || primarySourcePath(project),
      role: source.role || "user_code",
      content: source.content_ref ? readWorkspaceText(source.content_ref) : String(source.content || ""),
    }));
  }

  return {
    createProject,
    createSources,
    createViewManifest,
    slug: modelData.slug,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createTamagotchiEntryCourseModel,
};
