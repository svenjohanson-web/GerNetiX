"use strict";

function createStaticLearningProjectModel(definition) {
  function createProject(project, step) {
    return project(
      definition.slug,
      definition.title,
      definition.area,
      definition.summary,
      definition.steps.map((item) => step(item.title, item.text, item.insight)),
      { ...clone(definition.options) },
    );
  }

  function createViewManifest(project, { primarySourcePath, override } = {}) {
    if (override) return override;
    return {
      schema_version: 1,
      title: `${project.title} Projektansicht`,
      summary: project.summary,
      primary_source_path: primarySourcePath(project),
      mode: "guided_ide",
      views: [
        {
          id: "source-analysis",
          type: "source_analysis",
          title: "Quellcode analysieren",
          summary: "Primaere Projektdatei lesen, verstehen und bearbeiten.",
          source_path: primarySourcePath(project),
        },
        {
          id: "implementation-plan",
          type: "implementation_plan",
          title: "Naechste Schritte",
          summary: "Die Lernschritte des Projekts werden in der IDE begleitet.",
          payload: { tasks: project.steps.map((item) => item.title) },
        },
      ],
    };
  }

  function createSources({ project, primarySourcePath }) {
    return definition.sources.map((source) => ({
      ...source,
      path: source.path || primarySourcePath(project),
      content: typeof source.content === "function" ? source.content(project) : source.content,
    }));
  }

  return Object.freeze({ slug: definition.slug, createProject, createSources, createViewManifest });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

module.exports = { createStaticLearningProjectModel };
