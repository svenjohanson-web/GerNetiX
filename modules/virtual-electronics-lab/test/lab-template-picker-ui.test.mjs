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
const freeCircuitSource = read("../labs/free-circuit-simulation.js");

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

test("LED-Stromregelung bleibt im GPIO-Labor und wird ausschließlich per Quellcode bedient", () => {
  assert.match(gpioSource, /presetId === "current-control"/);
  assert.match(gpioSource, /runLedCurrentControlProgram/);
  assert.match(gpioSource, /Shunt-Spannung/);
  assert.match(gpioSource, /ADC-Wert/);
  assert.match(gpioSource, /Programm-Sollwert/);
  assert.match(gpioSource, /Fehler: Sollwert zu hoch/);
  assert.match(gpioSource, /Fehler: Regler instabil/);
  assert.match(gpioSource, /kein Ersatz für einen realen Konstantstromtreiber/);
  assert.doesNotMatch(gpioSource, /type="range"[^>]*(?:duty|current|gain)/i);
});

test("leere Laborfläche nutzt das bestehende freie Labor und seinen Resetpfad", () => {
  assert.match(freeCircuitSource, /presetId === FREE_EMPTY_PRESET_ID/);
  assert.match(freeCircuitSource, /createFreeEmptyDocument/);
  assert.match(freeCircuitSource, /createFreeEmptyMeasurementSetup/);
  assert.match(freeCircuitSource, /Die Laborfläche ist leer/);
  assert.match(freeCircuitSource, /createFreeCircuitCommandRuntime\(\{ document: initialDocument \}\)/);
});

test("AC-Tiefpassvorlage verwendet die freie Laborfläche und den vorhandenen Resetpfad", () => {
  assert.match(freeCircuitSource, /presetId === FREE_RC_LOWPASS_PRESET_ID/);
  assert.match(freeCircuitSource, /createFreeRcLowpassDocument/);
  assert.match(freeCircuitSource, /createFreeRcLowpassMeasurementSetup/);
  assert.match(freeCircuitSource, /data-free-action="reset"/);
});
