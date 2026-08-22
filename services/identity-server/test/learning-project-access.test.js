"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  hasLearningProjectCatalogAccess,
  learningProjectPurchaseUrl,
} = require("../src/dev/learning-project-access");

const subscriptionProject = {
  slug: "paid-learning-project",
  course_id: "course.paid_learning_project",
  access_model: "subscription",
};

test("free learning projects start without an entitlement", () => {
  assert.equal(hasLearningProjectCatalogAccess({ ...subscriptionProject, access_model: "free" }, []), true);
});

test("locked learning projects reject an account without a matching entitlement", () => {
  assert.equal(hasLearningProjectCatalogAccess(subscriptionProject, []), false);
  assert.equal(hasLearningProjectCatalogAccess(subscriptionProject, ["learning_course:course.other"]), false);
});

test("locked learning projects accept plan, course, or project entitlements", () => {
  assert.equal(hasLearningProjectCatalogAccess(subscriptionProject, ["learn_guided_projects"]), true);
  assert.equal(hasLearningProjectCatalogAccess(subscriptionProject, ["learning_course:course.paid_learning_project"]), true);
  assert.equal(hasLearningProjectCatalogAccess(subscriptionProject, ["learning_project:paid-learning-project"]), true);
});

test("purchase URLs preserve the selected project and access path", () => {
  assert.equal(
    learningProjectPurchaseUrl(subscriptionProject),
    "/kurse/?course=paid-learning-project&access=abo",
  );
  assert.equal(
    learningProjectPurchaseUrl({ ...subscriptionProject, access_model: "purchased" }),
    "/kurse/?course=paid-learning-project&access=kauf",
  );
});
