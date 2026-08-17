import {
  CIRCUIT_DOCUMENT_CONTRACT,
} from "../free-simulation/circuit-document-contract.mjs";
import {
  FREE_CIRCUIT_COMMAND_TYPES,
  createFreeCircuitCommandRuntime,
} from "../free-simulation/free-circuit-command-runtime.mjs";
import {
  FREE_RC_CHARGE_PRESET_ID,
  FREE_EMPTY_PRESET_ID,
  createFreeDcDividerDocument,
  createFreeDcDividerMeasurementSetup,
  createFreeEmptyDocument,
  createFreeEmptyMeasurementSetup,
  createFreeRcChargeDocument,
  createFreeRcChargeMeasurementSetup,
} from "../free-simulation/free-circuit-presets.mjs";
import { simulateFreeDcOperatingPoint } from "../free-simulation/dc-learning-solver-adapter.mjs";
import {
  MEASUREMENT_COMMAND_TYPES,
  createMeasurementRuntime,
} from "../free-simulation/measurement-runtime.mjs";
import { evaluateTransientVoltageProbes, evaluateVoltageProbes } from "../free-simulation/voltage-probe-evaluator.mjs";
import { createFreeSimulationHistory } from "../free-simulation/free-simulation-history-runtime.mjs";
import { simulateFreeTransient } from "../free-simulation/transient-learning-solver.mjs";

const TYPE_LABELS = Object.freeze({
  gnd: "GND",
  "dc-voltage-source": "DC-Quelle",
  resistor: "Widerstand",
  capacitor: "Kondensator",
  inductor: "Spule",
  led: "LED",
  "push-button": "Taster",
});

const TYPE_PREFIXES = Object.freeze({
  gnd: "gnd",
  "dc-voltage-source": "v",
  resistor: "r",
  capacitor: "c",
  inductor: "l",
  led: "d",
  "push-button": "s",
});

const PARAMETER_LABELS = Object.freeze({
  voltage: "Spannung",
  resistance: "Widerstand",
  capacitance: "Kapazität",
  inductance: "Induktivität",
  forwardVoltage: "Flussspannung",
  dynamicResistance: "dynamischer Widerstand",
  state: "Tasterzustand",
});

function setText(target, value) {
  if (target) target.textContent = value;
}

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("de-DE", { maximumFractionDigits: digits });
}

function nextComponentId(document, componentType) {
  const prefix = TYPE_PREFIXES[componentType];
  const used = new Set(document.components.map((component) => component.id));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

function endpointValue(componentId, portId) {
  return `${componentId}::${portId}`;
}

function parseEndpoint(value) {
  const [componentId, portId] = String(value || "").split("::");
  return { componentId, portId };
}

function nextId(items, prefix) {
  const used = new Set(items.map((item) => item.id));
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function historyLabel(command) {
  switch (command.type) {
    case FREE_CIRCUIT_COMMAND_TYPES.AddComponent: return `Bauteil ${command.componentId} hinzufügen`;
    case FREE_CIRCUIT_COMMAND_TYPES.RemoveComponent: return `Bauteil ${command.componentId} entfernen`;
    case FREE_CIRCUIT_COMMAND_TYPES.ConnectPins: return `${command.from.componentId}.${command.from.portId} verbinden`;
    case FREE_CIRCUIT_COMMAND_TYPES.DisconnectPin: return `${command.componentId}.${command.portId} lösen`;
    case FREE_CIRCUIT_COMMAND_TYPES.DisconnectNet: return `Netz ${command.nodeId} trennen`;
    case FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter: return `${command.componentId}: ${command.parameterName} ändern`;
    case MEASUREMENT_COMMAND_TYPES.AddMeasurementPoint: return `Messpunkt ${command.pointId} setzen`;
    case MEASUREMENT_COMMAND_TYPES.MoveMeasurementPoint: return `Messpunkt ${command.pointId} verschieben`;
    case MEASUREMENT_COMMAND_TYPES.RemoveMeasurementPoint: return `Messpunkt ${command.pointId} entfernen`;
    case MEASUREMENT_COMMAND_TYPES.AddVoltageProbe: return `Tastkopf ${command.probeId} anschließen`;
    case MEASUREMENT_COMMAND_TYPES.RemoveVoltageProbe: return `Tastkopf ${command.probeId} entfernen`;
    default: return "Laborzustand ändern";
  }
}

export function createFreeCircuitSimulationLab() {
  let initialDocument = createFreeDcDividerDocument();
  let initialMeasurementSetup = createFreeDcDividerMeasurementSetup();
  let runtime = createFreeCircuitCommandRuntime({ document: initialDocument });
  let measurementRuntime = createMeasurementRuntime({ setup: initialMeasurementSetup, document: initialDocument });
  let historyRuntime = createFreeSimulationHistory({ document: initialDocument, measurementSetup: initialMeasurementSetup });
  let mountedTarget = null;

  function loadTemplate(template) {
    const presetId = template?.entry?.presetId;
    const useRcCharge = presetId === FREE_RC_CHARGE_PRESET_ID;
    const useEmptyWorkbench = presetId === FREE_EMPTY_PRESET_ID;
    initialDocument = useEmptyWorkbench
      ? createFreeEmptyDocument()
      : useRcCharge ? createFreeRcChargeDocument() : createFreeDcDividerDocument();
    runtime = createFreeCircuitCommandRuntime({ document: initialDocument });
    initialMeasurementSetup = useEmptyWorkbench
      ? createFreeEmptyMeasurementSetup()
      : useRcCharge ? createFreeRcChargeMeasurementSetup() : createFreeDcDividerMeasurementSetup();
    measurementRuntime = createMeasurementRuntime({ setup: initialMeasurementSetup, document: initialDocument });
    historyRuntime = createFreeSimulationHistory({ document: initialDocument, measurementSetup: initialMeasurementSetup });
    return { ok: true, document: runtime.getSnapshot() };
  }

  function mount(target) {
    mountedTarget = target;
    target.innerHTML = `<article class="lab-card elab-free-circuit">
      <h2>Freie Elektronik-Simulation</h2>
      <p class="elab-throughput-reality">Bauteile platzieren, Anschlüsse verbinden, Werte ändern und mit frei gesetzten Tastköpfen messen.</p>
      <div class="elab-free-layout">
        <aside class="elab-free-palette"><h3>Bauteile</h3><p>DC berechnet Quellen und Widerstände. Die begrenzte Transientenanalyse unterstützt zusätzlich C, L und Taster; die LED bleibt eine sichtbare Providergrenze.</p><div data-free-palette></div><button type="button" data-free-action="reset">Vorlage zurücksetzen</button></aside>
        <section class="elab-free-workbench"><div class="elab-free-workbench-head"><h3>Virtueller Aufbau</h3><div class="elab-free-workbench-meta"><span data-free-count></span><div class="elab-free-history" aria-label="Bearbeitungsverlauf"><button type="button" data-free-action="undo">Rückgängig</button><button type="button" data-free-action="redo">Wiederholen</button><output data-free-history-status></output></div></div></div><div class="elab-free-board" data-free-board></div><section class="elab-free-wiring"><h3>Verdrahten</h3><label>Erster Anschluss<select data-free-endpoint="from"></select></label><label>Zweiter Anschluss<select data-free-endpoint="to"></select></label><button type="button" data-free-action="connect">Anschlüsse verbinden</button><button type="button" data-free-action="disconnect">Ersten Anschluss lösen</button></section><p class="elab-throughput-result" data-free-command-status></p></section>
        <section class="elab-free-measurements">
          <div class="elab-free-measurement-head"><div><h3>Messungen</h3><p>Messpunkte entsprechen Prüfösen; ein Tastkopf misst zwischen Plusspitze und Referenzspitze.</p></div><button type="button" data-free-action="simulate">DC-Arbeitspunkt berechnen</button></div>
          <p class="elab-throughput-warnings" data-free-simulation-status>Simulation noch nicht gestartet.</p>
          <section class="elab-free-transient"><div class="elab-free-transient-head"><div><h4>Transientenanalyse</h4><p>DC-Quellen springen bei t = 0+ auf ihren Wert; C-Spannung und L-Strom starten bei null.</p></div><div class="elab-free-transient-controls"><label>Dauer <input type="number" min="0.001" max="1000" step="0.1" value="10" aria-label="Transientendauer in Millisekunden"> ms</label><label>Zeitschritt <input type="number" min="1" max="10000" step="1" value="100" aria-label="Transientenzeitschritt in Mikrosekunden"> µs</label><button type="button" data-free-action="simulate-transient">Transiente berechnen</button></div></div><p class="elab-throughput-warnings" data-free-transient-status>Transientenanalyse noch nicht gestartet.</p><svg class="elab-free-transient-plot" viewBox="0 0 600 180" role="img" aria-label="Spannungsverlauf des ersten Tastkopfs"><line x1="0" y1="170" x2="600" y2="170"></line><line x1="0" y1="10" x2="0" y2="170"></line><polyline data-free-transient-trace points=""></polyline></svg><table class="elab-free-transient-table"><thead><tr><th>Tastkopf</th><th>Endwert</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody data-free-transient-results></tbody></table></section>
          <section class="elab-free-probe-workbench"><div><h4>Messpunkte</h4><div class="elab-free-measurement-create"><select aria-label="Knoten für neuen Messpunkt" data-free-point-node></select><button type="button" data-free-action="add-point">Messpunkt setzen</button></div><div class="elab-free-measurement-list" data-free-point-list></div></div><div><h4>Virtuelle Tastköpfe</h4><div class="elab-free-measurement-create"><select aria-label="Plusspitze" data-free-probe-positive></select><select aria-label="Referenzspitze" data-free-probe-reference></select><button type="button" data-free-action="add-probe">Tastkopf anschließen</button></div><div class="elab-free-measurement-list" data-free-probe-list></div></div></section>
          <p class="elab-throughput-result" data-free-measurement-status></p>
          <div class="elab-free-results"><section><h4>Tastkopfmessung</h4><table><thead><tr><th>Tastkopf</th><th>Spitzen</th><th>Spannung</th></tr></thead><tbody data-free-probe-results></tbody></table></section><section><h4>Knotenspannungen</h4><table><thead><tr><th>Knoten</th><th>Spannung</th></tr></thead><tbody data-free-node-results></tbody></table></section><section><h4>Zweigwerte</h4><table><thead><tr><th>Bauteil</th><th>Strom</th><th>Leistung</th></tr></thead><tbody data-free-branch-results></tbody></table></section></div>
          <div class="elab-throughput-reality-bridge"><strong>Vom virtuellen zum echten Labor</strong><span>Messpunkt und Referenzspitze entsprechen dem Ansetzen eines Oszilloskop- oder Multimeter-Tastkopfs. Das Vorzeichen hängt von der Spitzenrichtung ab.</span><span>Die Tastköpfe sind derzeit ideal hochohmig. Reale Eingangsimpedanz, Tastkopfkapazität, Toleranzen, Temperatur und parasitäre Effekte fehlen.</span><span>R, C, L und Taster nutzen ein begrenztes lineares Backward-Euler-Lernmodell. Nichtlineare LEDs benötigen später einen isolierten Provider. Freie Raw-SPICE-Direktiven werden nicht ausgeführt.</span></div>
        </section>
      </div>
    </article>`;

    const board = target.querySelector("[data-free-board]");
    const palette = target.querySelector("[data-free-palette]");
    const count = target.querySelector("[data-free-count]");
    const commandStatus = target.querySelector("[data-free-command-status]");
    const simulationStatus = target.querySelector("[data-free-simulation-status]");
    const fromSelect = target.querySelector('[data-free-endpoint="from"]');
    const toSelect = target.querySelector('[data-free-endpoint="to"]');
    const nodeResults = target.querySelector("[data-free-node-results]");
    const branchResults = target.querySelector("[data-free-branch-results]");
    const measurementStatus = target.querySelector("[data-free-measurement-status]");
    const pointNodeSelect = target.querySelector("[data-free-point-node]");
    const pointList = target.querySelector("[data-free-point-list]");
    const probePositiveSelect = target.querySelector("[data-free-probe-positive]");
    const probeReferenceSelect = target.querySelector("[data-free-probe-reference]");
    const probeList = target.querySelector("[data-free-probe-list]");
    const probeResults = target.querySelector("[data-free-probe-results]");
    const undoButton = target.querySelector('[data-free-action="undo"]');
    const redoButton = target.querySelector('[data-free-action="redo"]');
    const historyStatus = target.querySelector("[data-free-history-status]");
    const transientDurationInput = target.querySelector('[aria-label="Transientendauer in Millisekunden"]');
    const transientStepInput = target.querySelector('[aria-label="Transientenzeitschritt in Mikrosekunden"]');
    const transientStatus = target.querySelector("[data-free-transient-status]");
    const transientTrace = target.querySelector("[data-free-transient-trace]");
    const transientResults = target.querySelector("[data-free-transient-results]");
    let lastSimulationResponse = null;
    let lastTransientResponse = null;

    function renderHistoryControls() {
      const status = historyRuntime.getStatus();
      undoButton.disabled = !status.canUndo;
      redoButton.disabled = !status.canRedo;
      undoButton.title = status.undoLabel ? `Rückgängig: ${status.undoLabel}` : "Keine Änderung zum Rückgängigmachen";
      redoButton.title = status.redoLabel ? `Wiederholen: ${status.redoLabel}` : "Keine Änderung zum Wiederholen";
      setText(historyStatus, `${status.undoDepth} Schritte · maximal ${status.limit}`);
    }

    function recordHistory(command, domain) {
      const response = historyRuntime.record({
        change: { domain, commandType: command.type, label: historyLabel(command) },
        document: runtime.getSnapshot(),
        measurementSetup: measurementRuntime.getSnapshot(),
      });
      renderHistoryControls();
      return response;
    }

    function restoreHistory(response, actionLabel) {
      if (!response.ok) {
        setText(commandStatus, response.errors?.[0]?.message || `${actionLabel} fehlgeschlagen.`);
        return;
      }
      runtime = createFreeCircuitCommandRuntime({ document: response.state.document });
      measurementRuntime = createMeasurementRuntime({ setup: response.state.measurementSetup, document: response.state.document });
      lastTransientResponse = null;
      const changedLabel = actionLabel === "Rückgängig" ? response.status.redoLabel : response.state.change?.label;
      setText(commandStatus, `${actionLabel}: ${changedLabel || "Startzustand"}.`);
      renderDocument();
      renderSimulation(simulateFreeDcOperatingPoint(runtime.getSnapshot()));
      renderTransient(simulateFreeTransient(runtime.getSnapshot(), transientAnalysis()));
      renderHistoryControls();
    }

    function dispatch(command) {
      const response = runtime.dispatch(command);
      setText(commandStatus, response.ok
        ? "Schaltungsdokument aktualisiert. Analysen erneut starten."
        : response.errors?.[0]?.message || "Befehl fehlgeschlagen.");
      if (response.ok) {
        measurementRuntime.reconcile(response.document);
        recordHistory(command, "circuit");
        invalidateAnalysisResults();
        renderDocument();
      }
      return response;
    }

    function dispatchMeasurement(command) {
      const response = measurementRuntime.dispatch(command, runtime.getSnapshot());
      setText(measurementStatus, response.ok ? "Messaufbau aktualisiert." : response.errors?.[0]?.message || "Messbefehl fehlgeschlagen.");
      if (response.ok) {
        recordHistory(command, "measurement");
        renderMeasurementSetup();
      }
      return response;
    }

    function addOption(select, component, port) {
      const option = document.createElement("option");
      option.value = endpointValue(component.id, port.id);
      option.textContent = `${component.id}.${port.id} · ${port.nodeId}`;
      select.append(option);
    }

    function renderDocument() {
      const documentSnapshot = runtime.getSnapshot();
      const reconciled = measurementRuntime.reconcile(documentSnapshot);
      if (reconciled.removedPointIds.length) setText(measurementStatus, "Messpunkte an nicht mehr vorhandenen Knoten wurden entfernt.");
      board.replaceChildren();
      fromSelect.replaceChildren();
      toSelect.replaceChildren();
      setText(count, `${documentSnapshot.components.length}/${CIRCUIT_DOCUMENT_CONTRACT.maxComponents} Bauteile · ${documentSnapshot.nodes.length} Knoten`);

      if (documentSnapshot.components.length === 0) {
        const emptyState = document.createElement("p");
        emptyState.className = "elab-free-empty-state";
        emptyState.textContent = "Die Laborfläche ist leer. Wähle links ein erstes Bauteil aus.";
        board.append(emptyState);
      }

      for (const component of documentSnapshot.components) {
        const card = document.createElement("article");
        card.className = "elab-free-component";
        const heading = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = component.id;
        const type = document.createElement("span");
        type.textContent = TYPE_LABELS[component.type] || component.type;
        heading.append(strong, type);
        const ports = document.createElement("div");
        ports.className = "elab-free-ports";
        for (const port of component.ports) {
          const portLabel = document.createElement("span");
          portLabel.textContent = `${port.id} → ${port.nodeId}`;
          ports.append(portLabel);
          addOption(fromSelect, component, port);
          addOption(toSelect, component, port);
        }
        const parameters = document.createElement("div");
        parameters.className = "elab-free-parameters";
        for (const [parameterName, parameter] of Object.entries(component.parameters)) {
          const label = document.createElement("label");
          label.append(`${PARAMETER_LABELS[parameterName] || parameterName} `);
          const input = parameterName === "state" ? document.createElement("select") : document.createElement("input");
          if (parameterName === "state") {
            for (const stateValue of ["open", "closed"]) {
              const option = document.createElement("option");
              option.value = stateValue;
              option.textContent = stateValue === "open" ? "offen" : "geschlossen";
              input.append(option);
            }
            input.value = parameter.value;
          } else {
            input.type = "number";
            input.step = "any";
            input.value = String(parameter.value);
          }
          input.setAttribute("aria-label", `${component.id} ${PARAMETER_LABELS[parameterName] || parameterName}`);
          input.addEventListener("input", () => {
            const response = runtime.dispatch({
              type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter,
              componentId: component.id,
              parameterName,
              value: parameterName === "state" ? input.value : Number(input.value),
            });
            setText(commandStatus, response.ok
              ? "Bauteilwert aktualisiert. Analysen erneut starten."
              : response.errors?.[0]?.message || "Bauteilwert ist ungültig.");
            if (response.ok) {
              recordHistory({ type: FREE_CIRCUIT_COMMAND_TYPES.SetComponentParameter, componentId: component.id, parameterName }, "circuit");
              invalidateAnalysisResults();
            }
          });
          const unit = document.createElement("span");
          unit.textContent = parameter.unit === "state" ? "" : parameter.unit;
          label.append(input, unit);
          parameters.append(label);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Bauteil entfernen";
        remove.addEventListener("click", () => dispatch({
          type: FREE_CIRCUIT_COMMAND_TYPES.RemoveComponent,
          componentId: component.id,
        }));
        card.append(heading, ports, parameters, remove);
        board.append(card);
      }
      renderMeasurementSetup();
    }

    function appendSelectOption(select, value, label) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }

    function renderMeasurementSetup() {
      const documentSnapshot = runtime.getSnapshot();
      const setup = measurementRuntime.getSnapshot();
      pointNodeSelect.replaceChildren();
      pointList.replaceChildren();
      probePositiveSelect.replaceChildren();
      probeReferenceSelect.replaceChildren();
      probeList.replaceChildren();
      for (const node of documentSnapshot.nodes) appendSelectOption(pointNodeSelect, node.id, `${node.label} · ${node.id}`);
      for (const point of setup.points) {
        appendSelectOption(probePositiveSelect, point.id, `+ ${point.label}`);
        appendSelectOption(probeReferenceSelect, point.id, `− ${point.label}`);
        const item = document.createElement("div");
        item.className = "elab-free-measurement-item";
        const label = document.createElement("strong");
        label.textContent = point.label;
        const select = document.createElement("select");
        select.setAttribute("aria-label", `${point.label} verschieben`);
        for (const node of documentSnapshot.nodes) appendSelectOption(select, node.id, node.id);
        select.value = point.nodeId;
        select.addEventListener("change", () => dispatchMeasurement({ type: MEASUREMENT_COMMAND_TYPES.MoveMeasurementPoint, pointId: point.id, nodeId: select.value }));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Entfernen";
        remove.addEventListener("click", () => dispatchMeasurement({ type: MEASUREMENT_COMMAND_TYPES.RemoveMeasurementPoint, pointId: point.id }));
        item.append(label, select, remove);
        pointList.append(item);
      }
      for (const probe of setup.voltageProbes) {
        const positive = setup.points.find((point) => point.id === probe.positivePointId);
        const reference = setup.points.find((point) => point.id === probe.referencePointId);
        const item = document.createElement("div");
        item.className = "elab-free-measurement-item";
        const label = document.createElement("span");
        label.textContent = `${probe.label}: ${positive?.label || "?"} gegen ${reference?.label || "?"}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Entfernen";
        remove.addEventListener("click", () => dispatchMeasurement({ type: MEASUREMENT_COMMAND_TYPES.RemoveVoltageProbe, probeId: probe.id }));
        item.append(label, remove);
        probeList.append(item);
      }
      renderProbeResults(lastSimulationResponse);
      if (lastTransientResponse) renderTransient(lastTransientResponse);
    }

    function renderProbeResults(response) {
      probeResults.replaceChildren();
      const setup = measurementRuntime.getSnapshot();
      if (!response?.ok || !setup.voltageProbes.length) return;
      const evaluated = evaluateVoltageProbes(setup, runtime.getSnapshot(), response);
      if (!evaluated.ok) return;
      for (const reading of evaluated.readings) {
        const row = document.createElement("tr");
        for (const value of [reading.label, `${reading.positivePointId} → ${reading.referencePointId}`, `${formatNumber(reading.voltageV)} V`]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        probeResults.append(row);
      }
    }

    function renderSimulation(response) {
      lastSimulationResponse = response;
      nodeResults.replaceChildren();
      branchResults.replaceChildren();
      renderProbeResults(response);
      if (!response.ok) {
        setText(simulationStatus, response.errors?.map((error) => error.message).join(" ") || "Simulation fehlgeschlagen.");
        return;
      }
      setText(simulationStatus, `Berechnet mit ${response.result.diagnostics.solver} · Leistungsbilanz ${formatNumber(response.result.diagnostics.powerBalanceW, 8)} W.`);
      for (const node of response.result.nodeVoltages) {
        const row = document.createElement("tr");
        for (const value of [node.nodeId, `${formatNumber(node.voltageV)} V`]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        nodeResults.append(row);
      }
      for (const branch of response.result.branches) {
        const row = document.createElement("tr");
        for (const value of [branch.componentId, `${formatNumber(branch.currentA * 1000)} mA`, `${formatNumber(branch.powerW * 1000)} mW`]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        branchResults.append(row);
      }
    }

    function transientAnalysis() {
      return {
        timeStepS: Number(transientStepInput.value) / 1_000_000,
        stopTimeS: Number(transientDurationInput.value) / 1_000,
      };
    }

    function renderTransient(response) {
      lastTransientResponse = response?.ok ? response : null;
      transientTrace.setAttribute("points", "");
      transientResults.replaceChildren();
      if (!response?.ok) {
        setText(transientStatus, response?.errors?.map((error) => error.message).join(" ") || "Transientenanalyse noch nicht gestartet.");
        return;
      }
      const evaluated = evaluateTransientVoltageProbes(measurementRuntime.getSnapshot(), runtime.getSnapshot(), response);
      if (!evaluated.ok || !evaluated.traces.length) {
        setText(transientStatus, "Für die Transientendarstellung wird mindestens ein gültiger Tastkopf benötigt.");
        return;
      }
      for (const trace of evaluated.traces) {
        const values = trace.samples.map((sample) => sample.voltageV);
        const row = document.createElement("tr");
        for (const value of [trace.label, `${formatNumber(values.at(-1))} V`, `${formatNumber(Math.min(...values))} V`, `${formatNumber(Math.max(...values))} V`]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        }
        transientResults.append(row);
      }
      const firstTrace = evaluated.traces[0];
      const voltages = firstTrace.samples.map((sample) => sample.voltageV);
      const minimum = Math.min(0, ...voltages);
      const maximum = Math.max(0, ...voltages);
      const span = Math.max(maximum - minimum, 1e-12);
      const points = firstTrace.samples.map((sample, index) => {
        const x = firstTrace.samples.length === 1 ? 0 : index * 600 / (firstTrace.samples.length - 1);
        const y = 170 - ((sample.voltageV - minimum) / span) * 160;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(" ");
      transientTrace.setAttribute("points", points);
      setText(transientStatus, `${response.result.sampleCount} Samples · ${formatNumber(response.result.stopTimeS * 1000)} ms · ${response.result.diagnostics.integration}.`);
    }

    function invalidateAnalysisResults() {
      lastSimulationResponse = null;
      lastTransientResponse = null;
      nodeResults.replaceChildren();
      branchResults.replaceChildren();
      probeResults.replaceChildren();
      transientResults.replaceChildren();
      transientTrace.setAttribute("points", "");
      setText(simulationStatus, "Schaltung geändert; DC-Arbeitspunkt erneut berechnen.");
      setText(transientStatus, "Schaltung geändert; Transiente erneut berechnen.");
    }

    for (const componentType of CIRCUIT_DOCUMENT_CONTRACT.supportedComponentTypes) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `+ ${TYPE_LABELS[componentType] || componentType}`;
      button.addEventListener("click", () => {
        const snapshot = runtime.getSnapshot();
        dispatch({
          type: FREE_CIRCUIT_COMMAND_TYPES.AddComponent,
          componentId: nextComponentId(snapshot, componentType),
          componentType,
        });
      });
      palette.append(button);
    }

    target.querySelector('[data-free-action="connect"]').addEventListener("click", () => dispatch({
      type: FREE_CIRCUIT_COMMAND_TYPES.ConnectPins,
      from: parseEndpoint(fromSelect.value),
      to: parseEndpoint(toSelect.value),
    }));
    target.querySelector('[data-free-action="disconnect"]').addEventListener("click", () => {
      const endpoint = parseEndpoint(fromSelect.value);
      dispatch({ type: FREE_CIRCUIT_COMMAND_TYPES.DisconnectPin, ...endpoint });
    });
    target.querySelector('[data-free-action="add-point"]').addEventListener("click", () => {
      const setup = measurementRuntime.getSnapshot();
      const pointId = nextId(setup.points, "mp");
      dispatchMeasurement({ type: MEASUREMENT_COMMAND_TYPES.AddMeasurementPoint, pointId, label: `Messpunkt ${setup.points.length + 1}`, nodeId: pointNodeSelect.value });
    });
    target.querySelector('[data-free-action="add-probe"]').addEventListener("click", () => {
      const setup = measurementRuntime.getSnapshot();
      const probeId = nextId(setup.voltageProbes, "probe");
      dispatchMeasurement({
        type: MEASUREMENT_COMMAND_TYPES.AddVoltageProbe,
        probeId,
        label: `Tastkopf ${setup.voltageProbes.length + 1}`,
        positivePointId: probePositiveSelect.value,
        referencePointId: probeReferenceSelect.value,
      });
    });
    target.querySelector('[data-free-action="simulate"]').addEventListener("click", () => {
      renderSimulation(simulateFreeDcOperatingPoint(runtime.getSnapshot()));
    });
    target.querySelector('[data-free-action="simulate-transient"]').addEventListener("click", () => {
      renderTransient(simulateFreeTransient(runtime.getSnapshot(), transientAnalysis()));
    });
    undoButton.addEventListener("click", () => restoreHistory(historyRuntime.undo(), "Rückgängig"));
    redoButton.addEventListener("click", () => restoreHistory(historyRuntime.redo(), "Wiederholt"));
    target.querySelector('[data-free-action="reset"]').addEventListener("click", () => {
      runtime = createFreeCircuitCommandRuntime({ document: initialDocument });
      measurementRuntime = createMeasurementRuntime({ setup: initialMeasurementSetup, document: initialDocument });
      lastTransientResponse = null;
      recordHistory({ type: "ResetWorkspace" }, "system");
      setText(commandStatus, "Vorlage wiederhergestellt.");
      renderDocument();
      renderSimulation(simulateFreeDcOperatingPoint(runtime.getSnapshot()));
      renderTransient(simulateFreeTransient(runtime.getSnapshot(), transientAnalysis()));
    });

    renderDocument();
    renderSimulation(simulateFreeDcOperatingPoint(runtime.getSnapshot()));
    renderTransient(simulateFreeTransient(runtime.getSnapshot(), transientAnalysis()));
    renderHistoryControls();
  }

  return {
    id: "free-circuit-simulation",
    title: "Freie Elektronik-Simulation",
    status: "Basis",
    summary: "Bauteile, Netze und DC-Arbeitspunkt frei verändern",
    loadTemplate,
    mount,
    dispose() {
      mountedTarget = null;
    },
  };
}
