"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appRoot = path.resolve(__dirname, "../public/app");
const read = (file) => fs.readFileSync(path.join(appRoot, file), "utf8");
const guidedToolRoot = path.resolve(__dirname, "../../../tools/guided-code-lesson");

test("all PlantUML renderers use the shared dark theme", () => {
  const runtime = read("app-runtime-utils.js");
  const guided = read("guided-project-view.js");
  const development = read("development-platform.js");
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
  assert.match(css, /\.plantuml-viewer \{[\s\S]*?background: #111827/);
  assert.match(css, /\.plantuml-diagram \{[\s\S]*?background: #111827/);
  assert.doesNotMatch(css, /\.plantuml-(?:viewer|diagram)[^}]*background: #fff/);
  assert.doesNotMatch(html, /guided-project-view\.js/);
  assert.match(shell, /loadGuidedProjectAssets[\s\S]*guided-project-view\.js/);
  assert.match(html, /app-runtime-utils\.js\?v=20260806-project-summary-lazy-1/);
});

test("dark PlantUML theme is injected before diagram elements", () => {
  const runtime = read("app-runtime-utils.js");
  const context = {};
  vm.runInNewContext(`${runtime}\nresult = themedPlantUmlSource('@startuml\\nrectangle "Test" as test\\n@enduml');`, context);

  assert.ok(context.result.indexOf("skinparam defaultFontColor #F8FAFC") > context.result.indexOf("@startuml"));
  assert.ok(context.result.indexOf("skinparam defaultFontColor #F8FAFC") < context.result.indexOf('rectangle "Test"'));
  assert.ok(context.result.indexOf("skinparam rectangleBorderColor #67E8F9") < context.result.indexOf('rectangle "Test"'));
});

test("standalone guided lessons render PlantUML on the same dark background", () => {
  const app = fs.readFileSync(path.join(guidedToolRoot, "app.js"), "utf8");
  const css = fs.readFileSync(path.join(guidedToolRoot, "styles.css"), "utf8");

  assert.match(app, /TextEncoder\(\)\.encode\(themedPlantUmlSource\(source\)\)/);
  assert.match(app, /skinparam backgroundColor transparent/);
  assert.match(app, /skinparam rectangleBackgroundColor #1E3A5F/);
  assert.match(app, /skinparam rectangleBorderColor #67E8F9/);
  assert.match(css, /\.plantuml-viewer \{[\s\S]*?background: #111827/);
  assert.match(css, /\.plantuml-diagram \{[\s\S]*?background: #111827/);
  assert.match(fs.readFileSync(path.join(guidedToolRoot, "index.html"), "utf8"), /app\.js\?v=20260801-plantuml-contrast/);
});
