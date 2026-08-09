const modelData = require("./nexi-course.json");
const projectAppManifest = require("./nexi-project-app-manifest.json");

function createNexiCourseModel() {
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
        customer_entries: definition.customer_entries,
        build_config: definition.build_config,
        default_device_id: definition.default_device_id,
        hardware_profile_id: definition.hardware_profile_id,
        learning_category: definition.learning_category,
        product_stage: definition.product_stage,
        system_source_id: definition.system_source_id,
        source_files: [...productSourceFiles(), ...createSources()].map(({ path: sourcePath, role }) => ({
          path: sourcePath,
          role,
        })),
        tags: definition.tags,
      },
    );
  }

  function createViewManifest(project, { primarySourcePath, override } = {}) {
    if (override) return override;
    return { ...clone(modelData.view_manifest), primary_source_path: primarySourcePath(project) };
  }

  function createSources() {
    const sources = clone(modelData.sources)
      .filter((source) => source.path !== "project-app/manifest.json");
    return [
      ...sources,
      {
        path: "project-app/manifest.json",
        role: "project_app_manifest",
        content: `${JSON.stringify(projectAppManifest, null, 2)}\n`,
      },
    ];
  }

  return { createProject, createSources, createViewManifest, slug: modelData.slug };
}

function productSourceFiles() {
  return [
    { path: modelData.project.build_config.user_source_path, role: "user_code" },
    { path: "Komponenten/IoT-Device 1/include/nexi/voice_types.h", role: "user_header" },
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createNexiCourseModel };
