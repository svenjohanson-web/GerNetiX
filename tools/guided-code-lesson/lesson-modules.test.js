"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = __dirname;

function scriptSources() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  return Array.from(html.matchAll(/<script src="([^"?]+)(?:\?[^"\s]*)?"><\/script>/g),
    (match) => match[1]);
}

function loadLessonContext() {
  const context = vm.createContext({ console });
  context.window = context;
  for (const relativePath of scriptSources().filter((source) =>
    source.endsWith("services/shared/learning/learning-project-registry.js") ||
    source === "lesson-pattern.js" || source === "lesson-registry.js" ||
    source.startsWith("lessons/"))) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
  }
  return context;
}

function loadAppContext() {
  const elements = new Map();
  function element() {
    return {
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      innerHTML: "",
      textContent: "",
      value: "",
    };
  }
  const document = {
    body: element(),
    createElement: element,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
  };
  const stored = new Map();
  const context = vm.createContext({
    console,
    document,
    localStorage: {
      getItem: (key) => stored.get(key) || null,
      removeItem: (key) => stored.delete(key),
      setItem: (key, value) => stored.set(key, value),
    },
    URL,
    URLSearchParams,
  });
  context.window = context;
  context.location = { href: "http://localhost/guided-code-lesson/", search: "" };
  context.history = { replaceState() {} };
  for (const relativePath of scriptSources()) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    vm.runInContext(source, context, { filename: relativePath });
  }
  return { context, elements };
}

test("every guided learning project is a separate registered module", () => {
  const expectedSlugs = [
    "software-engineering-tamagotchi",
    "actuator-output-basics",
    "temperature-data-logger",
    "connected-tamagotchi",
    "plant-watering-control",
    "climate-box-control",
    "smartbox-rfid-access-control",
  ];
  const moduleSources = scriptSources().filter((source) =>
    source.startsWith("lessons/") && source.endsWith(".lesson.js"));
  assert.deepEqual(moduleSources, expectedSlugs.map((slug) =>
    `lessons/${slug}.lesson.js`));
  assert.deepEqual(
    fs.readdirSync(path.join(root, "lessons"))
      .filter((name) => name.endsWith(".lesson.js"))
      .sort(),
    moduleSources.map((source) => path.basename(source)).sort(),
  );

  const context = loadLessonContext();
  const lessons = context.LearningProjectRegistry.createAll();
  assert.deepEqual(Array.from(lessons, (lesson) => String(lesson.slug)),
    expectedSlugs);
  assert.deepEqual(Array.from(lessons, (lesson) => lesson.steps.length),
    [19, 8, 7, 7, 7, 7, 7]);
  assert.equal(new Set(lessons.map((lesson) => lesson.projectIdeaId)).size,
    lessons.length);
  for (const lesson of lessons) {
    assert.ok(lesson.projectIdeaId);
    assert.ok(lesson.projectVariantId);
    assert.ok(lesson.source);
    assert.ok(Array.isArray(lesson.steps) && lesson.steps.length > 0);
  }
});

test("app consumes the project catalog only through the registry", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const appState = fs.readFileSync(path.join(root, "app-state.js"), "utf8");
  const combinedRuntime = scriptSources()
    .filter((source) => source.endsWith(".js") && !source.startsWith("lessons/"))
    .map((source) => fs.readFileSync(path.join(root, source), "utf8"))
    .join("\n");
  assert.match(appState, /LearningProjectRegistry\.createAll\(\)/);
  assert.doesNotMatch(combinedRuntime, /projectIdeaId:\s*"project_idea\./);
  assert.doesNotMatch(combinedRuntime,
    /createSoftwareEngineeringTamagotchiLesson|createActuatorOutputBasicsLesson/);
  assert.ok(app.split(/\r?\n/).length < 20);
});

test("app runtime is split by responsibility and isolates the Tamagotchi adapter", () => {
  const expectedModules = [
    "runtime-preview-registry.js",
    "app-state.js",
    "app-shell.js",
    "lesson-renderer.js",
    "lesson-panel.js",
    "validation-engine.js",
    "interaction-controller.js",
    "preview-publisher.js",
    "browser-storage.js",
    "adapters/tamagotchi-runtime-adapter.js",
    "app.js",
  ];
  const sources = scriptSources();
  const modulePositions = expectedModules.map((source) => sources.indexOf(source));
  assert.ok(modulePositions.every((position) => position >= 0));
  assert.deepEqual(modulePositions, [...modulePositions].sort((a, b) => a - b));

  for (const source of expectedModules) {
    const contents = fs.readFileSync(path.join(root, source), "utf8");
    assert.ok(contents.split(/\r?\n/).length < 900, `${source} is too large`);
    new vm.Script(contents, { filename: source });
    if (!source.startsWith("adapters/")) {
      assert.doesNotMatch(contents, /tamagotchi/i, `${source} contains project-specific runtime logic`);
    }
  }

  const adapterContext = vm.createContext({ console, document: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, "runtime-preview-registry.js"), "utf8"), adapterContext);
  vm.runInContext(fs.readFileSync(path.join(root, "adapters/tamagotchi-runtime-adapter.js"), "utf8"), adapterContext);
  const adapter = vm.runInContext(
    'runtimePreviewAdapterFor({ runtimePreview: { type: "tamagotchiBrowserApp" } })',
    adapterContext,
  );
  assert.equal(typeof adapter.open, "function");
  assert.equal(typeof adapter.restore, "function");
  assert.equal(typeof adapter.serialize, "function");
});

test("split scripts initialize the complete learning app in browser order", () => {
  const { elements } = loadAppContext();
  assert.match(elements.get("#sidePanel").innerHTML, /Projektstart|Tamagotchi/);
  assert.match(elements.get("#projectSelector").innerHTML, /programming|tamagotchi/i);
});

test("registry rejects duplicate lesson modules", () => {
  const context = loadLessonContext();
  assert.throws(() => context.LearningProjectRegistry.register({
    slug: "software-engineering-tamagotchi",
    create() { return {}; },
  }), /Duplicate learning project key/);
});
