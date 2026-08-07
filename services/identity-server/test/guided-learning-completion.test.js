const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
const courseModel = require("../src/dev/project-models/programming-fundamentals-course")
  .createProgrammingFundamentalsCourseModel();
const manifest = courseModel.createViewManifest({}, { primarySourcePath: () => "src/grundlagen.js" });
const microcontrollerCourseModel = require("../src/dev/project-models/microcontroller-fundamentals-course")
  .createMicrocontrollerFundamentalsCourseModel();
const microcontrollerManifest = microcontrollerCourseModel.createViewManifest(
  {},
  { primarySourcePath: () => "src/mikrocontroller.cpp" },
);

test("guided learning blocks progression until the mandatory lesson check is complete", () => {
  const target = createTarget();
  const sourceEditor = { value: "" };
  const document = {
    querySelector(selector) {
      if (selector === "#mount") return target;
      if (selector === "#sourceEditor") return sourceEditor;
      return null;
    },
  };
  const context = {
    console,
    document,
    window: { addEventListener() {}, dispatchEvent() {} },
  };
  vm.runInNewContext(`${source}\nthis.GuidedProjectViewForTest = GuidedProjectView;`, context);

  let completedSteps = [];
  const state = { activeIdeStep: 0, billing: { entitlements: [] }, guidedCodeChats: {} };
  const view = context.GuidedProjectViewForTest.create({
    state,
    getJson: async () => ({}),
    postJson: async () => ({}),
    putJson: async () => ({}),
    waitForCompletedBuild: null,
    progressFor: () => ({ completedSteps, completedStepIds: [] }),
    escapeHtml,
    escapeAttribute: escapeHtml,
    meta: () => "",
  });
  const project = {
    id: "project-1",
    projectOrigin: "account_project",
    targetRuntime: "runtime.browser_javascript",
    viewManifest: manifest,
  };

  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /data-guided-choice/);
  assert.match(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /Beantworte die Aufgabe, bevor du fortfährst/);

  completedSteps = [0];
  view.renderProjectViewManifest(project, "#mount");
  assert.doesNotMatch(nextButton(target.innerHTML), /disabled/);

  completedSteps = [];
  state.activeIdeStep = 8;
  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /data-guided-code-task/);
  assert.match(nextButton(target.innerHTML), /disabled/);
});

test("guided learning requires simulation without hardware and a physical check with usable hardware", () => {
  const target = createTarget();
  const document = {
    querySelector(selector) {
      if (selector === "#mount") return target;
      if (selector === "#sourceEditor") return { value: "" };
      return null;
    },
  };
  const context = {
    console,
    document,
    window: { addEventListener() {}, dispatchEvent() {} },
  };
  vm.runInNewContext(`${source}\nthis.GuidedProjectViewForTest = GuidedProjectView;`, context);

  const state = {
    activeIdeStep: 3,
    billing: { entitlements: [] },
    devices: [],
    guidedCodeChats: {},
    guidedLessonResponses: {},
  };
  const view = context.GuidedProjectViewForTest.create({
    state,
    getJson: async () => ({}),
    postJson: async () => ({}),
    putJson: async () => ({}),
    waitForCompletedBuild: null,
    progressFor: () => ({ completedSteps: [], completedStepIds: [] }),
    escapeHtml,
    escapeAttribute: escapeHtml,
    meta: () => "",
  });
  const project = {
    id: "micro-1",
    projectOrigin: "account_project",
    targetRuntime: "runtime.browser_microcontroller_simulator",
    viewManifest: microcontrollerManifest,
  };

  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /Pflichtprüfung im Simulator/);
  assert.match(target.innerHTML, /data-guided-adaptive-mode="simulator"/);
  assert.match(nextButton(target.innerHTML), /disabled/);

  state.devices = [{
    device_id: "esp-1",
    display_name: "Werkbank ESP32",
    hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
    connectivity_status: "online",
  }];
  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /Pflichtprüfung am realen Gerät/);
  assert.match(target.innerHTML, /Werkbank ESP32/);
  assert.match(target.innerHTML, /data-guided-adaptive-mode="hardware"/);
  assert.match(nextButton(target.innerHTML), /disabled/);

  state.guidedLessonResponses["micro-1:04-datasheet-pinout-board"] = {
    adaptiveMode: "hardware",
    adaptiveChoice: "b",
  };
  view.renderProjectViewManifest(project, "#mount");
  assert.doesNotMatch(nextButton(target.innerHTML), /disabled/);

  state.devices = [];
  view.renderProjectViewManifest(project, "#mount");
  assert.match(nextButton(target.innerHTML), /disabled/);
});

function createTarget() {
  return {
    innerHTML: "",
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
}

function nextButton(html) {
  return html.match(/<button(?:(?!<\/button>)[\s\S])*?data-guided-control="next_step"(?:(?!<\/button>)[\s\S])*?<\/button>/)?.[0] || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
