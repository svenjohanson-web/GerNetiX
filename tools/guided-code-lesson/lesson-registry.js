"use strict";

(function exposeLearningProjectRegistry(global) {
  const registryFactory = global.GerNetiXLearningProjects;
  if (!registryFactory) throw new Error("GerNetiX learning project registry must be loaded first");

  const registry = registryFactory.createLearningProjectRegistry({
    validateProduct(project, definition) {
      if (!project || project.slug !== definition.slug || !Array.isArray(project.steps)) {
        throw new Error(`Invalid guided learning project created by ${definition.slug}`);
      }
    },
  });

  function register(definition) {
    if (!definition || typeof definition.slug !== "string" || typeof definition.create !== "function") {
      throw new TypeError("A guided learning project must register { slug, create }");
    }
    return registry.register({
      key: definition.slug,
      slug: definition.slug,
      create: () => definition.create(global.GuidedLessonPattern),
    });
  }

  global.LearningProjectRegistry = Object.freeze({ register, createAll: registry.createAll });
})(window);
