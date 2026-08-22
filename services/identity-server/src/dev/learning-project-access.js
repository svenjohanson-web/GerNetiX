"use strict";

function hasLearningProjectCatalogAccess(definition, entitlements = []) {
  if (definition?.access_model === "free") return true;
  const granted = new Set(Array.isArray(entitlements) ? entitlements : []);
  return granted.has("learn_guided_projects")
    || granted.has(`learning_course:${definition?.course_id}`)
    || granted.has(`learning_project:${definition?.slug}`);
}

function learningProjectPurchaseUrl(definition) {
  const params = new URLSearchParams({
    course: definition?.slug || "",
    access: definition?.access_model === "subscription" ? "abo" : "kauf",
  });
  return `/kurse/?${params}`;
}

module.exports = { hasLearningProjectCatalogAccess, learningProjectPurchaseUrl };
