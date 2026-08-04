const fs = require("node:fs");
const path = require("node:path");
const modelData = require("./nexi-course.json");
const projectAppManifest = require("./nexi-project-app-manifest.json");

const voiceLabSourcePath = path.resolve(
  __dirname,
  "../../../../../projects/waveshare-voice-lab/voice_lab.cpp",
);

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
        source_files: definition.source_files,
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
      {
        path: modelData.project.build_config.user_source_path,
        role: "user_code",
        content: fs.readFileSync(voiceLabSourcePath, "utf8"),
      },
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createNexiCourseModel };
