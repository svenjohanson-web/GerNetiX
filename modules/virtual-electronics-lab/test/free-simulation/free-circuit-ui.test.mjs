import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const read = (relative) => fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const source = read("../../labs/free-circuit-simulation.js");
const styles = read("../../styles.css");
const app = read("../../app.js");

test("FREE-004: registriert eine eigene freie Simulationsfläche in derselben Shell", () => {
  assert.match(app, /createFreeCircuitSimulationLab/);
  assert.match(source, /id: "free-circuit-simulation"/);
  assert.match(source, /<h2>Freie Elektronik-Simulation<\/h2>/);
});

test("FREE-004: Bauteile, Verdrahtung und Parameter laufen ausschließlich über Commands", () => {
  assert.match(source, /FREE_CIRCUIT_COMMAND_TYPES\.AddComponent/);
  assert.match(source, /FREE_CIRCUIT_COMMAND_TYPES\.ConnectPins/);
  assert.match(source, /FREE_CIRCUIT_COMMAND_TYPES\.DisconnectPin/);
  assert.match(source, /FREE_CIRCUIT_COMMAND_TYPES\.SetComponentParameter/);
  assert.doesNotMatch(source, /localStorage|fetch\(|Date\.now|Math\.random/);
});

test("FREE-004: Messung verwendet den gemeinsamen DC-Adapter und benennt Grenzen", () => {
  assert.match(source, /simulateFreeDcOperatingPoint\(runtime\.getSnapshot\(\)\)/);
  assert.match(source, /Knotenspannungen/);
  assert.match(source, /Zweigwerte/);
  assert.match(source, /Freie Raw-SPICE-Direktiven werden nicht ausgeführt/);
  assert.match(source, /Nichtlineare LEDs benötigen später einen isolierten Provider/);
});

test("FREE-004: UI bleibt auf kleinen Breiten einspaltig", () => {
  assert.match(styles, /\.elab-free-layout\s*\{/);
  assert.match(styles, /@media \(max-width: 1050px\)[^{]*\{[^}]*\.elab-free-layout/s);
  assert.match(styles, /@media \(max-width: 640px\)[^{]*\{[^}]*\.elab-free-wiring/s);
});

test("FREE-004: dynamische Ergebnisse werden über textContent aufgebaut", () => {
  assert.match(source, /cell\.textContent = value/);
  assert.match(source, /option\.textContent/);
  assert.doesNotMatch(source, /insertAdjacentHTML|outerHTML/);
});

test("FREE-005: Messpunkte und virtuelle Tastköpfe besitzen einen getrennten Command-Pfad", () => {
  assert.match(source, /createMeasurementRuntime/);
  assert.match(source, /MEASUREMENT_COMMAND_TYPES\.AddMeasurementPoint/);
  assert.match(source, /MEASUREMENT_COMMAND_TYPES\.MoveMeasurementPoint/);
  assert.match(source, /MEASUREMENT_COMMAND_TYPES\.AddVoltageProbe/);
  assert.match(source, /evaluateVoltageProbes/);
  assert.match(source, /probeList\.replaceChildren\(\)/);
  assert.match(source, /Tastkopf misst zwischen Plusspitze und Referenzspitze/);
});

test("FREE-005: Labor benennt das ideale Tastkopfmodell und den Bezug zum echten Labor", () => {
  assert.match(source, /ideal hochohmig/);
  assert.match(source, /Oszilloskop- oder Multimeter-Tastkopfs/);
  assert.match(source, /Das Vorzeichen hängt von der Spitzenrichtung ab/);
  assert.match(styles, /\.elab-free-probe-workbench/);
});

test("FREE-006: gemeinsamer Verlauf steuert Schaltung und Messaufbau", () => {
  assert.match(source, /createFreeSimulationHistory/);
  assert.match(source, /data-free-action="undo"/);
  assert.match(source, /data-free-action="redo"/);
  assert.match(source, /historyRuntime\.record/);
  assert.match(source, /historyRuntime\.undo\(\)/);
  assert.match(source, /historyRuntime\.redo\(\)/);
  assert.match(source, /createMeasurementRuntime\(\{ setup: response\.state\.measurementSetup/);
  assert.match(styles, /\.elab-free-history button:disabled/);
});

test("FREE-008: begrenzte Transientenmessung ist in derselben Laborfläche sichtbar", () => {
  assert.match(source, /simulateFreeTransient/);
  assert.match(source, /evaluateTransientVoltageProbes/);
  assert.match(source, /Transientendauer in Millisekunden/);
  assert.match(source, /Transientenzeitschritt in Mikrosekunden/);
  assert.match(source, /data-free-transient-trace/);
  assert.match(source, /Backward-Euler/);
  assert.match(styles, /\.elab-free-transient-plot polyline/);
});

test("FREE-009: leere Vorlage bleibt in derselben Command-basierten Laborfläche", () => {
  assert.match(source, /FREE_EMPTY_PRESET_ID/);
  assert.match(source, /createFreeEmptyDocument/);
  assert.match(source, /createFreeEmptyMeasurementSetup/);
  assert.match(source, /elab-free-empty-state/);
  assert.match(source, /Wähle links ein erstes Bauteil aus/);
  assert.match(styles, /\.elab-free-empty-state/);
});

test("SPICE-003: AC-Auftrag, Tastköpfe, Bode-Kurven und Netlist bleiben in derselben Laborfläche", () => {
  assert.match(source, /FREE_RC_LOWPASS_PRESET_ID/);
  assert.match(source, /executeLearningSimulationRequest/);
  assert.match(source, /evaluateAcVoltageProbes/);
  assert.match(source, /exportSpiceNetlist/);
  assert.match(source, /AC-Anregungsquelle/);
  assert.match(source, /data-free-ac-magnitude-trace/);
  assert.match(source, /data-free-ac-phase-trace/);
  assert.match(source, /Erzeugte SPICE-Netlist/);
  assert.match(source, /state: "invalidated"/);
  assert.match(styles, /\.elab-free-ac-plots/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.elab-free-ac-plots/);
});

test("AC-004: Kennwerte und Ergebniszustände verwenden das gemeinsame AC-View-Model", () => {
  assert.match(source, /createAcResultViewModel/);
  assert.match(source, /state: "success"/);
  assert.match(source, /state: "error"/);
  assert.match(source, /state: "empty"/);
  assert.match(source, /state: "invalidated"/);
  assert.match(source, /data-free-ac-metrics/);
  assert.match(source, /−3-dB-Eckfrequenz/);
  assert.match(source, /Phase an der Eckfrequenz/);
  assert.doesNotMatch(source, /function bodePoints/);
  assert.match(styles, /\.elab-free-ac-metrics/);
  assert.match(styles, /\.elab-free-ac-table-wrap\s*\{[^}]*overflow-x: auto/s);
  assert.match(styles, /html\[data-public-theme=light\] \.elab-free-ac > \.elab-throughput-warnings/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.elab-free-ac-metrics\s*\{[^}]*grid-template-columns: 1fr/s);
});
