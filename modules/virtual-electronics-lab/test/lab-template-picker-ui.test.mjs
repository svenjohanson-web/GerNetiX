import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const appSource = read("../app.js");
const indexSource = read("../index.html");
const stylesSource = read("../styles.css");
const gpioSource = read("../labs/gpio-led-throughput.js");
const pt1000Source = read("../labs/pt1000-adc-throughput.js");
const buttonSource = read("../labs/button-digital-input-throughput.js");

test("bietet eine kompakte Vorlagenauswahl in derselben Laboroberfläche", () => {
  assert.match(indexSource, /Anwendungsfall wählen/);
  assert.match(indexSource, /id="labTemplateSelect"/);
  assert.match(indexSource, /id="labTemplateLoad"/);
  assert.match(appSource, /const areaLabels/);
  assert.match(appSource, /showLab\(lab, template\)/);
  assert.doesNotMatch(appSource, /window\.open|location\.assign/);
});

test("lädt Preset und Startcode über die bestehenden drei Labs", () => {
  assert.match(appSource, /lab\.loadTemplate\?\.\(template\)/);
  assert.match(gpioSource, /function loadTemplate\(template\)/);
  assert.match(gpioSource, /state\.templateSource/);
  assert.match(pt1000Source, /function loadTemplate\(template\)/);
  assert.match(pt1000Source, /state\.templateSource/);
  assert.match(buttonSource, /const loadTemplate = \(template\)/);
  assert.match(buttonSource, /presetId === "pullup"/);
  assert.match(buttonSource, /"missing-pull", "bounce", "debounce-short", "debounce-long"/);
});

test("Reset verwendet den gewählten Template-Startzustand und Direktlinks bleiben möglich", () => {
  assert.match(gpioSource, /UpdateSourceFile, sourceFile: state\.templateSource/);
  assert.match(pt1000Source, /UpdateSourceFile, sourceFile: state\.templateSource/);
  assert.match(appSource, /URLSearchParams\(window\.location\.search\)\.get\("lab"\)/);
  assert.match(appSource, /URLSearchParams\(window\.location\.search\)\.get\("template"\)/);
});

test("Vorlagenauswahl bleibt auf kleinen Breiten einspaltig", () => {
  assert.match(stylesSource, /\.lab-template-picker\s*\{/);
  assert.match(stylesSource, /@media \(max-width: 900px\)[^{]*\{[^}]*\.lab-template-picker/s);
});
