const fs = require("node:fs");
const path = require("node:path");
const modelData = require("./nexi-course.json");
const projectAppManifest = require("./nexi-project-app-manifest.json");

const voiceLabRoot = path.resolve(
  __dirname,
  "../../../../../projects/waveshare-voice-lab",
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
        source_files: createSources().map(({ path: sourcePath, role }) => ({
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
      ...loadNexiFirmwareSources(),
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

function loadNexiFirmwareSources() {
  const userSourcePath = modelData.project.build_config.user_source_path;
  const componentRoot = userSourcePath.slice(0, userSourcePath.lastIndexOf("/src/"));
  const sources = [{
    path: userSourcePath,
    role: "user_code",
    content: fs.readFileSync(path.join(voiceLabRoot, "voice_lab.cpp"), "utf8"),
  }];
  for (const area of ["include", "src"]) {
    for (const filePath of walkFiles(path.join(voiceLabRoot, area))) {
      const relative = path.relative(path.join(voiceLabRoot, area), filePath)
        .split(path.sep).join("/");
      sources.push({
        path: `${componentRoot}/${area}/${relative}`,
        role: area === "include" ? "user_header" : "user_code",
        content: fs.readFileSync(filePath, "utf8"),
      });
    }
  }
  return sources.sort((left, right) => left.path.localeCompare(right.path));
}

function walkFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) return walkFiles(filePath);
    return entry.isFile() && /\.(?:h|hpp|cc|cpp|cxx)$/i.test(entry.name)
      ? [filePath]
      : [];
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { createNexiCourseModel };
