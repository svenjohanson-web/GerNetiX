"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { readDevelopmentPlatformSource, readForSandbox } = require("../test-support/platform-app-source");

const appRoot = path.resolve(__dirname, "../public/app");
const read = (file) => fs.readFileSync(path.join(appRoot, file), "utf8");
const guidedToolRoot = path.resolve(__dirname, "../../../tools/guided-code-lesson");

test("all PlantUML renderers use the shared dark theme", () => {
  const runtime = read("app-runtime-utils.js");
  const guided = read("guided-project-view.js");
  const development = readDevelopmentPlatformSource();
  const css = read("app.css");
  const html = read("index.html");
  const shell = read("app-shell-controller.js");

  assert.match(runtime, /function themedPlantUmlSource/);
  assert.match(runtime, /TextEncoder\(\)\.encode\(themedPlantUmlSource\(source\)\)/);
  assert.match(guided, /TextEncoder\(\)\.encode\(themedPlantUmlSource\(source\)\)/);
  assert.match(development, /TextEncoder\(\)\.encode\(themedPlantUmlSource\(source\)\)/);
  assert.match(runtime, /skinparam (?:rectangle|component|node|class)BackgroundColor #1E3A5F/);
  assert.match(runtime, /skinparam defaultFontColor #F8FAFC/);
  assert.match(runtime, /skinparam (?:rectangle|component|node|class)BorderColor #67E8F9/);
  assert.match(runtime, /skinparam ArrowThickness 2/);
  assert.match(css, /\.plantuml-viewer \{[\s\S]*?background: var\(--surface-panel\)/);
  assert.match(css, /\.plantuml-diagram \{[\s\S]*?background: var\(--surface-panel\)/);
  assert.doesNotMatch(css, /\.plantuml-(?:viewer|diagram)[^}]*background: #fff/);
  assert.doesNotMatch(html, /guided-project-view\.js/);
  assert.match(shell, /loadGuidedProjectAssets[\s\S]*guided-project-view\.js/);
});

test("dark PlantUML theme is injected before diagram elements", () => {
  // app-runtime-utils.js ist inzwischen ein ES-Modul; die export-Anweisung
  // waere in diesem klassischen vm-Kontext ein Syntaxfehler.
  const runtime = readForSandbox("app-runtime-utils.js");
  const context = { globalThis: {}, Object };
  vm.runInNewContext(`${runtime}\nresult = themedPlantUmlSource('@startuml\\nrectangle "Test" as test\\n@enduml');`, context);

  assert.ok(context.result.indexOf("skinparam defaultFontColor #F8FAFC") > context.result.indexOf("@startuml"));
  assert.ok(context.result.indexOf("skinparam defaultFontColor #F8FAFC") < context.result.indexOf('rectangle "Test"'));
  assert.ok(context.result.indexOf("skinparam rectangleBorderColor #67E8F9") < context.result.indexOf('rectangle "Test"'));
});

test("standalone guided lessons render PlantUML on the same dark background", () => {
  const renderer = fs.readFileSync(path.join(guidedToolRoot, "lesson-renderer.js"), "utf8");
  const css = fs.readFileSync(path.join(guidedToolRoot, "styles.css"), "utf8");

  assert.match(renderer, /TextEncoder\(\)\.encode\(themedPlantUmlSource\(source\)\)/);
  assert.match(renderer, /skinparam backgroundColor transparent/);
  assert.match(renderer, /skinparam rectangleBackgroundColor #1E3A5F/);
  assert.match(renderer, /skinparam rectangleBorderColor #67E8F9/);
  // Das eigenstaendige Lektionswerkzeug hat ein eigenes Stylesheet ohne
  // Farbtoken; hier bleiben die festen Werte richtig.
  assert.match(css, /\.plantuml-viewer \{[\s\S]*?background: #111827/);
  assert.match(css, /\.plantuml-diagram \{[\s\S]*?background: #111827/);
});
