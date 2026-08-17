import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const filePath = fileURLToPath(new URL("../../labs/button-digital-input-throughput.js", import.meta.url));
const labSource = fs.readFileSync(filePath, "utf8");
const appSource = fs.readFileSync(path.resolve(path.dirname(filePath), "..", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.resolve(path.dirname(filePath), "..", "styles.css"), "utf8");
const indexSource = fs.readFileSync(path.resolve(path.dirname(filePath), "..", "index.html"), "utf8");
const routeSource = fs.readFileSync(
  path.resolve(path.dirname(filePath), "..", "..", "..", "services", "identity-server", "src", "dev", "server", "web-routes.js"),
  "utf8",
);
const devServerSource = fs.readFileSync(path.resolve(path.dirname(filePath), "..", "..", "..", "services", "identity-server", "src", "dev", "http-utils.js"), "utf8");

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("Runtime-Import statt Parser-/Taster-/Pegellogik", () => {
  assert.equal(labSource.includes("createButtonDigitalInputThroughputRuntime"), true);
  assert.equal(labSource.includes("./button-digital-input-throughput-runtime.mjs"), true);
  assert.equal(labSource.includes("./button-bounce-trace.mjs"), true);
  assert.equal(labSource.includes("button-debounce-program-runtime.mjs"), true);
  assert.match(labSource, /import\s*{\s*DIGITAL_INPUT_PROGRAM_START_CODE\s*}\s*from\s*[\"']\.\.\/virtual-mcu\/digital-input-program-runtime\.mjs/);
  assert.equal(labSource.includes("evaluateButtonContact"), false);
  assert.equal(labSource.includes("executeDigitalInputProgram"), false);
  assert.equal(labSource.includes("resolveButtonLevel"), false);
  assert.equal(labSource.includes("findFunction("), false);
  assert.equal(devServerSource.includes("\".mjs\": \"text/javascript; charset=utf-8\""), true);
});

test("Lab-Metadaten und Navigation direkt nach PT1000-Durchstich", () => {
  assert.match(labSource, /id:\s*"button-digital-input-throughput"/);
  assert.match(labSource, /title:\s*"Durchstich · Taster → digitalRead"/);
  assert.match(labSource, /summary:\s*"Taster mit internem Pull-Widerstand über GPIO 4 einlesen\."/);
  assert.match(appSource, /createPt1000ThroughputLab\(\),\n\s*createButtonDigitalInputThroughputLab\(\{ assistantClient: troubleshootingAssistantClient \}\),/);
});

test("Schaltbild enthält MCU, GPIO 4, Pull-Widerstand, Taster, 3,3 V und GND", () => {
  assert.match(labSource, /data-component="mcu"/);
  assert.match(labSource, /data-net=\"vcc\"/);
  assert.match(labSource, /data-component=\"pull-resistor\"/);
  assert.match(labSource, /data-net=\"button-to-gpio4\"/);
  assert.match(labSource, /data-component=\"button\"/);
  assert.match(labSource, /data-net=\"button-ref\"/);
  assert.match(labSource, /data-net=\"gnd\"/);
  assert.match(labSource, /data-schematic=\"vcc-label\"/);
  assert.match(labSource, /data-schematic=\"gnd-label\"/);
  assert.match(labSource, /data-schematic=\"pull-mode-label\"/);
  assert.match(labSource, /data-schematic=\"contact-label\"/);
  assert.match(labSource, /data-schematic=\"logic-level-label\"/);
  assert.match(labSource, /data-schematic=\"pressed-label\"/);
  assert.match(labSource, /data-schematic=\"runtime-hint\"/);
  assert.match(labSource, /data-button-contact-pull-mode=\"unmeasured\"/);
  assert.match(labSource, /Noch keine Simulation/);
  assert.match(labSource, /3,3 V/);
  assert.match(labSource, /GND/);
  assert.ok(countMatches(labSource, /schematic-wire/g) >= 6);
  assert.ok(labSource.includes("dataset.buttonContactPullMode"));
  assert.ok(labSource.includes("dataset.contactReference"));
  assert.ok(labSource.includes("dataset.logicLevel"));
  assert.ok(labSource.includes("dataset.pressed"));
  assert.doesNotMatch(labSource, /Pull-up aus Startcode/);
  assert.match(labSource, /data-pull-branch="pull-up"/);
  assert.match(labSource, /data-pull-branch="pull-down"/);
  assert.doesNotMatch(labSource, /data-pull-branch="pull-up"[^\\n]*x1="220"[^\\n]*x2="220"[^\\n]*y1="25"[^\\n]*y2="110"/);
  assert.doesNotMatch(labSource, /data-pull-branch="pull-down"[^\\n]*x1="290"[^\\n]*x2="290"[^\\n]*y1="210"[^\\n]*y2="110"/);
  assert.match(labSource, /data-pull-branch="pull-up"[\s\S]{0,200}d="M220\s+60[\s\S]*220\s+100"/);
  assert.match(labSource, /data-pull-branch="pull-down"[\s\S]{0,220}d="M290\s+160[\s\S]*290\s+120"/);
  assert.match(labSource, /data-button-contact-state="open"/);
  assert.match(labSource, /data-button-contact-state="closed"/);
  assert.match(labSource, /data-contact-reference=\"to-gnd\"/);
  assert.match(labSource, /data-contact-reference=\"to-vcc\"/);
  assert.match(labSource, /data-contact-reference=\"to-gnd\"[\s\S]*?d=\"M474\s+110\s+L474\s+210/);
  assert.match(labSource, /data-contact-reference=\"to-vcc\"[\s\S]*?d=\"M474\s+110\s+L474\s+25/);
  assert.match(labSource, /data-schematic="pull-branch-label"/);
  assert.match(labSource, /data-schematic=\"pull-mode-label\"/);
  assert.match(styleSource, /schematic-contact-reference/);
  assert.match(styleSource, /schematic-button-contact/);
  assert.match(styleSource, /data-pressed=\"false\"[\s\S]*schematic-button-open/);
  assert.match(styleSource, /data-pressed=\"true\"[\s\S]*schematic-button-closed/);
  assert.match(styleSource, /data-button-contact-pull-mode=\"pull-up\"[\s\S]*to-gnd/);
  assert.match(styleSource, /data-button-contact-pull-mode=\"pull-down\"[\s\S]*to-vcc/);
  assert.doesNotMatch(labSource, /x1="650"\\s*y1="110"\\s*x2="700"\\s*y2="110"/);
  assert.doesNotMatch(labSource, /cx=\"650\"\\s*cy=\"110\"/);
});

test("Erfassbare Bedienelemente und sechs Ausgabe-KPIs vorhanden", () => {
  assert.match(labSource, /data-action="toggle"/);
  assert.match(labSource, /data-action="start"/);
  assert.match(labSource, /data-action="reset"/);
  assert.match(labSource, /aria-pressed/);
  assert.match(labSource, /elab-button-throughput-kpi[\s\S]*data-output="button-state"/);
  assert.match(labSource, /elab-button-throughput-kpi[\s\S]*data-output="pull-mode"/);
  assert.match(labSource, /elab-button-throughput-kpi[\s\S]*data-output="gpio-level"/);
  assert.match(labSource, /elab-button-throughput-kpi[\s\S]*data-output="normalized-value"/);
  assert.match(labSource, /elab-button-throughput-kpi[\s\S]*data-output="button-variable"/);
  assert.match(labSource, /elab-button-throughput-kpi[\s\S]*data-output="pin"/);
  assert.match(labSource, /data-button-status/);
  assert.match(labSource, /data-button-warnings/);
  assert.match(labSource, /Vom virtuellen zum echten Labor/);
  assert.match(labSource, /data-button-reality/);
  assert.equal(labSource.includes('querySelector("[data-button-reality")'), false);
});

test("Typisierte Commands und Neuberechnung nach Tasterwechsel und Verdrahtung", () => {
  assert.match(labSource, /COMMAND_TYPES\.SetButtonPressed/);
  assert.match(labSource, /COMMAND_TYPES\.SetContactReference/);
  assert.match(labSource, /COMMAND_TYPES\.UpdateSourceFile/);
  assert.match(labSource, /COMMAND_TYPES\.StartSimulation/);
  assert.match(labSource, /COMMAND_TYPES\.ResetSimulation/);
  assert.match(labSource, /COMMAND_TYPES\.AdvanceFloatingSample/);
  assert.equal(labSource.includes("type: COMMAND_TYPES.SetButtonPressed"), true);
  assert.equal(labSource.includes("runtime.dispatch({ type: COMMAND_TYPES.StartSimulation })"), true);
  assert.equal(labSource.includes("buttonToggle.addEventListener(\"click\""), true);
});

test("Fehlersuchmodi sind gemeinsame Metadaten", () => {
  assert.match(labSource, /export const BUTTON_LAB_MODES = Object\.freeze/);
  assert.match(labSource, /throughput: Object\.freeze\(\{ title: "Freies Prüfen" \}\)/);
  assert.match(labSource, /troubleshooting: Object\.freeze\(\{ title: "Fehlersuche" \}\)/);
});

test("Fehlersuchmodus zeigt Symptom, Verdrahtung und bestätigte Reparatur", () => {
  assert.match(labSource, /data-mode="throughput"/);
  assert.match(labSource, /data-mode="troubleshooting"/);
  assert.match(labSource, /Fehlersuche · Taster reagiert nicht/);
  assert.match(labSource, /data-contact-reference="vcc"/);
  assert.match(labSource, /data-contact-reference="gnd"/);
  assert.match(labSource, /BUTTON_CONTACT_NO_LEVEL_CHANGE/);
  assert.match(labSource, /state\.observedFault/);
  assert.match(labSource, /measurement\?\.contactReference === "gnd"/);
  assert.match(labSource, /measurement\?\.logicLevel === "LOW"/);
  assert.match(labSource, /Fehler gefunden und Reparatur durch Messung bestätigt\./);
  assert.match(labSource, /contactReferenceMode:\s*"vcc"/);
  assert.match(labSource, /contactReferenceMode,\n\s*}\);/);
});

test("Fehlender Pull wird mehrfach gemessen und vollständig gegengeprüft", () => {
  assert.match(labSource, /data-scenario="missing-pull"/);
  assert.match(labSource, /data-scenario-panel="missing-pull"/);
  assert.match(labSource, /data-action="repeat-floating"/);
  assert.match(labSource, /FLOATING_INPUT_START_CODE/);
  assert.match(labSource, /DIGITAL_INPUT_FLOATING_IDEALIZED/);
  assert.match(labSource, /state\.observedFloatingLevels\.add/);
  assert.match(labSource, /state\.observedFloatingLevels\.size >= 2/);
  assert.match(labSource, /measurement\?\.pullMode === "INPUT_PULLUP"/);
  assert.match(labSource, /state\.repairedOpenState/);
  assert.match(labSource, /Messung wiederholen/);
  assert.match(labSource, /Reale offene Eingänge reagieren abhängig von Aufbau und Umgebung/);
  assert.match(labSource, /Fehlenden Pull erkannt und Reparatur mit offenem sowie gedrücktem Taster bestätigt/);
});

test("Tasterprellen wird aus der gemeinsamen Messspur mit Cursor und Flankenzahl dargestellt", () => {
  assert.match(labSource, /data-scenario="bounce"/);
  assert.match(labSource, /data-scenario-panel="bounce"/);
  assert.match(labSource, /createButtonBounceTrace\(\{/);
  assert.match(labSource, /sampleIntervalUs: 50/);
  assert.match(labSource, /durationUs: 5000/);
  assert.match(labSource, /data-bounce-polyline/);
  assert.match(labSource, /data-debounce-polyline/);
  assert.match(labSource, /data-bounce-cursor/);
  assert.match(labSource, /data-bounce-edges/);
  assert.match(labSource, /data-debounce-edges/);
  assert.match(labSource, /executeButtonDebounceProgram\(\{/);
  assert.match(labSource, /edgeCount\(samples, "logicLevel"\)/);
  assert.match(labSource, /sample\.timeUs >= 1800/);
  assert.match(labSource, /Logikanalysator- oder Oszilloskopmasse zuerst mit GND verbinden/);
  assert.doesNotMatch(labSource, /evaluateButtonBounce|evaluateButtonContact/);
});

test("Entprellfehler werden nur über Quellcode und gemeinsame Messspuren repariert", () => {
  assert.match(labSource, /data-scenario="debounce-short"/);
  assert.match(labSource, /data-scenario="debounce-long"/);
  assert.match(labSource, /scenario === "debounce-short" \? 300/);
  assert.match(labSource, /scenario === "debounce-long" \? 2000/);
  assert.match(labSource, /debounceDelayUs <= 1200/);
  assert.match(labSource, /genau eine Programmflanke/);
  assert.match(labSource, /Zeitwerte gehören nur zum festen Lehrprofil/);
  assert.doesNotMatch(labSource, /type="range"[^>]*debounce|data-debounce-slider/);
});

test("Assistent zeigt Vorschläge und wendet Reparaturen erst nach Bestätigung an", () => {
  assert.match(labSource, /data-assistant-action="explain-observation"/);
  assert.match(labSource, /data-assistant-action="suggest-measurement"/);
  assert.match(labSource, /data-assistant-action="propose-command-diff"/);
  assert.match(labSource, /data-assistant-apply/);
  assert.match(labSource, /data-assistant-diff/);
  assert.match(labSource, /formatAssistantDiff/);
  assert.match(labSource, /- Kontaktbezug:/);
  assert.match(labSource, /applyAssistantProposal/);
  assert.match(labSource, /proposal\?\.requiresConfirmation/);
  assert.match(labSource, /Der Assistent verändert Schaltung und Quellcode nicht selbst/);
  assert.match(appSource, /createFixtureTroubleshootingAssistantClient/);
  assert.match(appSource, /createLiveTroubleshootingAssistantClient/);
});

test("UI setzt ausschließlich sichere DOM-Outputpfade und zeigt Zeile/Spalte bei Fehlern", () => {
  assert.match(labSource, /function setText\(target, value\)/);
  assert.match(labSource, /target\.textContent =/);
  assert.ok(/Zeile \${entry\.line}, Spalte \${entry\.column}/.test(labSource));
  assert.match(labSource, /formatErrorEntry\(entry\)/);
  assert.match(labSource, /const [a-z]+Targets = /);
  assert.match(labSource, /warningOutput/);
  assert.equal(labSource.includes("Messung abgeschlossen."), true);
  assert.ok(labSource.includes("Hinweis:"));
  assert.doesNotMatch(labSource, /innerHTML\s*=\s*snapshot/);
  assert.doesNotMatch(labSource, /innerHTML\s*=\s*response/);
  assert.equal(labSource.includes("function normalizePullMode"), false);
  assert.ok(/return measurement\?\.\s*pullMode/.test(labSource));
  assert.match(
    labSource,
    /setText\(refs\.runtimeHint, measurement \? "Darstellung aus Runtime-Snapshot" : "Noch keine Simulation"\)/,
  );
});

test("Realitätsübergang benennt die Idealisierung inkl. Entprellung", () => {
  assert.match(labSource, /Idealisiertes Lernmodell – keine ESP32-Emulation; Tasterprellen folgt einem festen Lehrprofil\./);
  assert.match(labSource, /interner Pull/);
  assert.match(labSource, /gemeinsame Masse/);
  assert.match(labSource, /Entprellung/);
  assert.match(labSource, /5V/);
});

test("Responsive und Light-Theme Styles für die neue Lab-UI", () => {
  assert.match(styleSource, /\.elab-button-throughput-layout/);
  assert.match(styleSource, /\.elab-button-throughput-layout\s*\{[\s\S]*?align-items:\s*start/);
  assert.match(styleSource, /\.elab-button-throughput-control textarea\s*\{[\s\S]*?min-height:\s*228px/);
  assert.match(styleSource, /\.elab-button-throughput-schematic/);
  assert.match(styleSource, /\.elab-button-throughput-kpi/);
  assert.match(styleSource, /html\[data-public-theme=light\] \.elab-button-throughput-schematic/);
  assert.match(styleSource, /html\[data-public-theme=light\] \.elab-button-throughput-kpi/);
  assert.match(styleSource, /\.elab-button-mode-switch/);
  assert.match(styleSource, /\.elab-button-scenario-switch/);
  assert.match(styleSource, /\.elab-button-troubleshooting/);
  assert.match(styleSource, /repeat-floating/);
  assert.match(styleSource, /\.elab-button-bounce-trace/);
  assert.match(styleSource, /\.elab-button-bounce-readout/);
  assert.match(styleSource, /\.elab-troubleshooting-assistant/);
  assert.match(styleSource, /data-debounce-polyline/);
  assert.match(styleSource, /\.elab-button-wiring-actions/);
  assert.match(styleSource, /data-contact-reference="gnd"\]\[data-pressed="true"\][\s\S]*to-gnd/);
  assert.match(styleSource, /data-contact-reference="vcc"\]\[data-pressed="true"\][\s\S]*to-vcc/);
  assert.match(styleSource, /@media \(max-width: 1100px\)[\s\S]*elab-button-throughput-layout/);
  assert.match(styleSource, /@media \(max-width: 900px\)[\s\S]*elab-button-throughput-layout/);
  assert.match(styleSource, /@media \(max-width: 580px\)[\s\S]*elab-button-throughput-layout/);
  assert.match(styleSource, /elab-button-throughput-control \.elab-throughput-measurements \.elab-button-throughput-kpi/);
  assert.ok(styleSource.lastIndexOf("@media (max-width: 1100px)") > styleSource.indexOf(".elab-button-throughput-layout {"));
});

test("Eng begrenzte öffentliche Modulroute und neuer gemeinsamer Cache-Buster", () => {
  assert.ok(routeSource.includes("input-models\\/[^/]+\\.mjs"));
  assert.ok(routeSource.includes("ai\\/[^/]+\\.mjs"));
  assert.match(indexSource, /app\.js\?v=20260817-free-empty-1/);
  assert.match(indexSource, /styles\.css\?v=20260817-free-empty-1/);
});

test("Kein Netzwerk, keine Persistenz, keine Clock, kein Zufall in der neuen UI-Datei", () => {
  assert.doesNotMatch(labSource, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|Date\.now|Math\.random|setTimeout|requestAnimationFrame/);
});
