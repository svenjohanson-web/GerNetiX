"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createLearningProjectModels } = require("../src/dev/learning/learning-project-models");
const { createProjectViewModel } = require("../src/dev/projects/project-view-model");

const workspaceRoot = path.resolve(__dirname, "../../..");

function readWorkspaceText(relativePath) {
  return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

function project(slug, title, area, summary, steps, options) {
  return { slug, title, area, summary, steps, ...options };
}

function step(title, text, insight) {
  return { title, text, insight };
}

test("all active learning projects use one registry contract", () => {
  const { learningProjectRegistry } = createLearningProjectModels({ readWorkspaceText });
  const expectedSlugs = [
    "arduino-blink",
    "arduino-atmel-bare-metal",
    "software-engineering-tamagotchi",
    "nexi-voice-assistant",
    "smart-assistant-ai-automation",
    "button-to-smartphone-notification",
    "home-automation-network",
    "home-automation-sensors",
    "motor-control-basics",
    "build-your-own-proximity-sensor",
    "programming-fundamentals",
    "microcontroller-fundamentals",
    "uml-fundamentals",
    "ai-requirements-workshop",
    "yaml-fundamentals",
    "storage-learning-story",
    "radio-technologies",
    "measurement-tools-basics",
    "esp32-camera-streaming",
    "plant-watering-control",
    "embedded-runtime-and-interrupts",
    "embedded-c-hardware-control",
    "avr-framework-resource-budget",
    "chicken-coop-door-smartphone-app",
  ];

  assert.deepEqual(learningProjectRegistry.models.map((model) => model.slug), expectedSlugs);
  assert.equal(new Set(expectedSlugs).size, learningProjectRegistry.models.length);
  for (const model of learningProjectRegistry.models) {
    assert.equal(typeof model.createProject, "function");
    assert.equal(typeof model.createSources, "function");
    assert.equal(typeof model.createViewManifest, "function");
    assert.equal(learningProjectRegistry.getBySlug(model.slug), model);
  }
});

test("registry creates every project including programming fundamentals", () => {
  const { learningProjectRegistry } = createLearningProjectModels({ readWorkspaceText });
  const projects = learningProjectRegistry.createProjects(project, step);

  assert.equal(projects.length, 24);
  assert.equal(projects.find((item) => item.slug === "programming-fundamentals")?.title,
    "Grundlagen der Programmierung");
  assert.equal(projects.find((item) => item.slug === "arduino-blink")?.access_model, "free");
  assert.equal(projects.find((item) => item.slug === "plant-watering-control")?.access_model, "purchased");
  assert.equal(projects.find((item) => item.slug === "embedded-runtime-and-interrupts")?.title,
    "Mikrocontroller intern: Programmstart, Speicher und Interrupts");
  assert.equal(projects.find((item) => item.slug === "embedded-c-hardware-control")?.title,
    "Embedded C: Hardware sicher steuern");
  assert.equal(projects.find((item) => item.slug === "avr-framework-resource-budget")?.title,
    "Arduino oder direkt? Timer und Ressourcen auf dem AVR");
  assert.equal(projects.find((item) => item.slug === "chicken-coop-door-smartphone-app")?.access_model, "free");
});

test("every registered project provides sources through the same call shape", () => {
  const { learningProjectRegistry } = createLearningProjectModels({ readWorkspaceText });
  const projects = learningProjectRegistry.createProjects(project, step);
  const primarySourcePath = (item) => item.source_files?.[0]?.path || "src/main.cpp";

  for (const item of projects) {
    const sources = learningProjectRegistry.getBySlug(item.slug).createSources({
      lessonId: "",
      project: item,
      primarySourcePath,
    });
    assert.ok(Array.isArray(sources), `${item.slug} must return sources`);
    assert.ok(sources.length > 0, `${item.slug} must provide at least one source`);
  }
});

test("every registered project can be normalized with its catalog tags", () => {
  const { learningProjectRegistry } = createLearningProjectModels({ readWorkspaceText });
  const { normalizeLearningProjectTags } = createProjectViewModel({});
  for (const definition of learningProjectRegistry.createProjects(project, step)) {
    assert.doesNotThrow(() => normalizeLearningProjectTags(definition.tags), definition.slug);
  }
});
