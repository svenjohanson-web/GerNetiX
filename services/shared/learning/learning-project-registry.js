"use strict";

(function exposeLearningProjectRegistry(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GerNetiXLearningProjects = api;
})(typeof window === "object" ? window : null, function createApi() {
  function createLearningProjectRegistry({ context = {}, validateProduct = () => {} } = {}) {
    const definitions = [];
    const definitionKeys = new Set();
    let entries = null;

    function register(definition) {
      if (entries) throw new Error("Learning project registry is already initialized");
      if (!definition || typeof definition.key !== "string" || typeof definition.create !== "function") {
        throw new TypeError("A learning project must register { key, create }");
      }
      if (definitionKeys.has(definition.key)) {
        throw new Error(`Duplicate learning project key: ${definition.key}`);
      }
      definitionKeys.add(definition.key);
      definitions.push(Object.freeze({ ...definition }));
      return definition;
    }

    function initialize() {
      if (entries) return entries;
      const slugs = new Set();
      entries = definitions.map((definition) => {
        const product = definition.create(context);
        validateProduct(product, definition);
        if (!product || typeof product.slug !== "string" || !product.slug) {
          throw new TypeError(`Learning project ${definition.key} has no slug`);
        }
        if (definition.slug && definition.slug !== product.slug) {
          throw new Error(`Learning project ${definition.key} created unexpected slug ${product.slug}`);
        }
        if (slugs.has(product.slug)) {
          throw new Error(`Duplicate learning project slug: ${product.slug}`);
        }
        slugs.add(product.slug);
        return Object.freeze({ definition, product });
      });
      return entries;
    }

    function createAll() {
      return initialize().map((entry) => entry.product);
    }

    function getBySlug(slug) {
      return initialize().find((entry) => entry.product.slug === slug)?.product || null;
    }

    function getByKey(key) {
      return initialize().find((entry) => entry.definition.key === key)?.product || null;
    }

    return Object.freeze({ register, createAll, getBySlug, getByKey });
  }

  return Object.freeze({ createLearningProjectRegistry });
});
