const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
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
  assert.match(target.innerHTML, /guided-instruction-board/);
  assert.match(target.innerHTML, /Drei ungeordnete Anweisungen einer Produkterfassung/);
  assert.match(target.innerHTML, /data-guided-sequence-card="show-product"/);
  assert.match(target.innerHTML, /data-guided-sequence-move="-1"/);
  assert.match(target.innerHTML, /Kennung des RFID-Etiketts einlesen/);
  assert.match(target.innerHTML, /Produktbezeichnung im Bestand nachschlagen/);
  assert.match(target.innerHTML, /Produktbezeichnung auf dem Bildschirm anzeigen/);
  assert.doesNotMatch(target.innerHTML, /Code Viewer/);
  assert.doesNotMatch(target.innerHTML, /type="radio"/);
  assert.doesNotMatch(target.innerHTML, /data-guided-uml-artifact/);
  assert.match(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /guided-step-position[^>]*aria-label="Aktueller Schritt 1 von 44"/);
  assert.match(target.innerHTML, /Schritt <strong>1<\/strong> von 44/);
  assert.match(target.innerHTML, /Verschiebe die Kacheln in eine sinnvolle Reihenfolge/);
  assert.doesNotMatch(target.innerHTML, /Weiter wird automatisch freigeschaltet/);

  completedSteps = [0];
  view.renderProjectViewManifest(project, "#mount");
  assert.match(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /Verschiebe die Kacheln in eine sinnvolle Reihenfolge/);

  state.guidedLessonResponses["project-1:01-what-is-a-program"] = { sequenceOrder: ["read-tag", "find-product", "show-product"] };
  view.renderProjectViewManifest(project, "#mount");
  assert.doesNotMatch(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /Richtig: Zuerst wird die RFID-Kennung gelesen/);
  assert.doesNotMatch(target.innerHTML, /data-guided-uml-artifact/);
  assert.match(target.innerHTML, /Weiter wird automatisch freigeschaltet/);

  state.activeIdeStep = 1;
  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /Schritt <strong>2<\/strong> von 44/);
  assert.match(target.innerHTML, /data-guided-uml-artifact="uml_activity"/);
  assert.match(target.innerHTML, /UML-Aktivitätsdiagramm der Produkterfassung/);
  assert.match(target.innerHTML, /Initialknoten/);
  assert.match(target.innerHTML, /Kontrollfluss/);
  assert.match(target.innerHTML, /Aktivitätsendknoten/);
  assert.match(target.innerHTML, /viewBox="0 0 620 470"/);
  assert.match(target.innerHTML, /markerUnits="userSpaceOnUse"/);
  assert.match(target.innerHTML, /RFID-Kennung einlesen/);
  assert.match(target.innerHTML, /Produktbezeichnung nachschlagen/);
  assert.match(target.innerHTML, /Produktbezeichnung anzeigen/);
  assert.doesNotMatch(target.innerHTML, /Entscheidungsknoten|\[ja\]|\[nein\]/);
  assert.doesNotMatch(target.innerHTML, /M440 260 H540 V405/);
  assert.match(target.innerHTML, /Entwickler können solche Abläufe mit UML-Aktivitätsdiagrammen/);
  assert.doesNotMatch(nextButton(target.innerHTML), /disabled/);

  state.activeIdeStep = 2;
  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /Drei Anweisungen ausführen/);
  assert.match(target.innerHTML, /data-guided-code-run-lab/);
  assert.match(target.innerHTML, /data-guided-code-run[^>]*>Programm ausführen/);
  assert.match(target.innerHTML, /console\.log erklären/);
  assert.match(target.innerHTML, /Anführungszeichen erklären/);
  assert.match(target.innerHTML, /Semikolon erklären/);
  assert.match(target.innerHTML, /JavaScript ergänzt es in vielen Fällen automatisch/);
  assert.doesNotMatch(target.innerHTML, /type="radio"/);
  assert.match(nextButton(target.innerHTML), /disabled/);

  const firstCode = manifest.views[2].payload.artifact.content;
  state.guidedLessonResponses["project-1:02-statements-and-order"] = {
    code: firstCode,
    lastRunCode: firstCode,
    runCompleted: true,
    runOutput: manifest.views[2].completion.target_output,
    runError: "",
  };
  view.renderProjectViewManifest(project, "#mount");
  assert.doesNotMatch(nextButton(target.innerHTML), /disabled/);

  state.activeIdeStep = 3;
  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /data-guided-code-run-lab/);
  assert.match(target.innerHTML, /console\.log\(&quot;Produkt gefunden&quot;\);/);
  assert.match(target.innerHTML, /data-guided-code-run[^>]*>Programm ausführen/);
  assert.match(target.innerHTML, /data-guided-code-output>Noch nicht ausgeführt/);
  assert.match(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /Führe den aktuellen Code aus und prüfe die Ausgabe/);
  assert.match(target.innerHTML, /guided-target-text/);
  assert.match(target.innerHTML, /<code>RFID-Produkt gefunden<\/code>/);

  state.guidedLessonResponses["project-1:03-input-processing-output"] = {
    code: 'console.log("RFID–Produkt");',
    lastRunCode: 'console.log("RFID–Produkt");',
    runCompleted: true,
    runOutput: "RFID–Produkt",
    runError: "",
  };
  view.renderProjectViewManifest(project, "#mount");
  assert.match(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /guided-validation-comparison/);
  assert.match(target.innerHTML, /<dt>Erwartet<\/dt><dd><code>RFID-Produkt gefunden<\/code>/);
  assert.match(target.innerHTML, /<dt>Tatsächlich<\/dt><dd><code>RFID–Produkt<\/code>/);

  state.guidedLessonResponses["project-1:03-input-processing-output"] = {
    code: 'console.log("RFID-Produkt gefunden");',
    lastRunCode: 'console.log("RFID-Produkt gefunden");',
    runCompleted: true,
    runOutput: "RFID-Produkt gefunden",
    runError: "",
  };
  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /data-guided-code-output>RFID-Produkt gefunden<\/output>/);
  assert.doesNotMatch(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /Codezeile geändert/);

  state.activeIdeStep = 4;
  const initialValuesCode = "console.log(42);\nconsole.log(\"Mia\");\nconsole.log(true);";
  state.guidedLessonResponses["project-1:04-values"] = {
    code: initialValuesCode,
    lastRunCode: initialValuesCode,
    runCompleted: true,
    runOutput: "42\nMia\ntrue",
    runError: "",
  };
  view.renderProjectViewManifest(project, "#mount");
  assert.match(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /Ändere genau einen Wert im Code/);

  state.guidedLessonResponses["project-1:04-values"] = {
    code: "console.log(7);\nconsole.log(\"Noah\");\nconsole.log(true);",
    lastRunCode: "console.log(7);\nconsole.log(\"Noah\");\nconsole.log(true);",
    runCompleted: true,
    runOutput: "7\nNoah\ntrue",
    runError: "",
  };
  view.renderProjectViewManifest(project, "#mount");
  assert.match(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /unterscheiden sich 2 Zeilen/);

  state.guidedLessonResponses["project-1:04-values"] = {
    code: "console.log(7);\nconsole.log(\"Mia\");\nconsole.log(true);",
    lastRunCode: "console.log(7);\nconsole.log(\"Mia\");\nconsole.log(true);",
    runCompleted: true,
    runOutput: "7\nMia\ntrue",
    runError: "",
  };
  view.renderProjectViewManifest(project, "#mount");
  assert.match(target.innerHTML, /data-guided-code-output>7\nMia\ntrue<\/output>/);
  assert.doesNotMatch(nextButton(target.innerHTML), /disabled/);
  assert.match(target.innerHTML, /genau einen Wert verändert/);
  assert.match(styles, /\.guided-code-output output \{[^}]*white-space: pre-wrap/);

  completedSteps = [];
  state.activeIdeStep = 9;
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
