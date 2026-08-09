"use strict";

function slugifyProjectId(value) {
  return String(value || "projekt")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "projekt";
}

function createDemoProjectSources({
  learningProjectRegistry,
  primarySourcePath,
}) {
  function demoProjectSources(project, options = {}) {
    const learningProjectModel = learningProjectRegistry.getBySlug(project.slug);
    if (!learningProjectModel) return [];
    return learningProjectModel.createSources({
      ...options,
      lessonId: options.lessonId || "",
      project,
      primarySourcePath,
    });
  }

  return { demoProjectSources };
}

module.exports = { createDemoProjectSources, slugifyProjectId };
