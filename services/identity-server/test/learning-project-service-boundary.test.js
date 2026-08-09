"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createLearningProjectService } = require("../src/dev/learning/learning-project-service");

test("project access uses the learning service boundary for canonical manifest synchronization", () => {
  const service = createLearningProjectService({});
  const server = fs.readFileSync(path.resolve(__dirname, "../src/dev/projects/project-runtime-service.js"), "utf8");

  assert.equal(typeof service.learningProjectManifestForPersistedProject, "function");
  assert.equal(typeof service.synchronizeLearningProjectStructure, "function");
  assert.match(server, /learningProjects\.learningProjectManifestForPersistedProject/);
  assert.match(server, /learningProjects\.synchronizeLearningProjectStructure/);
  assert.doesNotMatch(server, /\? learningProjectManifestForPersistedProject\(/);
  assert.doesNotMatch(server, /return synchronizeLearningProjectStructure\(/);
});
