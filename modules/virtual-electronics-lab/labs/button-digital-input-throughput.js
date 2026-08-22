import {
  COMMAND_TYPES,
  createButtonDigitalInputThroughputRuntime,
} from "./button-digital-input-throughput-runtime.mjs";
import { DIGITAL_INPUT_PROGRAM_START_CODE } from "../virtual-mcu/digital-input-program-runtime.mjs";
import { createButtonBounceTrace } from "./button-bounce-trace.mjs";
import {
  BUTTON_DEBOUNCE_PROGRAM_START_CODE,
  executeButtonDebounceProgram,
} from "../virtual-mcu/button-debounce-program-runtime.mjs";

const BUTTON_STATES = {
  pressed: "gedrückt",
  released: "gelöst",
};

const FLOATING_INPUT_START_CODE = DIGITAL_INPUT_PROGRAM_START_CODE.replace("INPUT_PULLUP", "INPUT");
const DEBOUNCE_SCENARIOS = new Set(["bounce", "debounce-short", "debounce-long"]);

function debounceSourceForScenario(scenario) {
  const debounceUs = scenario === "debounce-short" ? 300 : scenario === "debounce-long" ? 2000 : 700;
  return BUTTON_DEBOUNCE_PROGRAM_START_CODE.replace("debounceUs = 700", `debounceUs = ${debounceUs}`);
}

function edgeCount(samples, key) {
  return samples.reduce((count, sample, index) =>
    index > 0 && sample[key] !== samples[index - 1][key] ? count + 1 : count, 0);
}

export const BUTTON_LAB_MODES = Object.freeze({
  throughput: Object.freeze({ title: "Freies Prüfen" }),
  troubleshooting: Object.freeze({ title: "Fehlersuche" }),
});

function formatLineColumn(entry) {
  const line = entry?.line;
  const column = entry?.column;
  if (!Number.isFinite(line) || !Number.isFinite(column)) return "";
  return ` (Zeile ${entry.line}, Spalte ${entry.column})`;
}

function formatErrorEntry(entry) {
  const code = entry?.code ? `${entry.code}: ` : "";
  const details = entry?.message || "";
  return `${code}${details}${formatLineColumn(entry)}`.trim();
}

function formatValue(value) {
  return Number.isFinite(value) ? `${value}` : "—";
}

function asPin(value) {
  return Number.isFinite(value) ? `${value}` : "4";
}

function setText(target, value) {
  if (target) target.textContent = value ?? "—";
}

function formatAssistantDiff(proposal, currentSource, currentContactReference) {
  if (proposal?.actionType !== "propose-command-diff" || !Array.isArray(proposal.commands)) {
    return "Keine Änderung vorgeschlagen.";
  }
  return proposal.commands.map((command) => {
    if (command.type === "SetContactReference") {
      return `- Kontaktbezug: ${currentContactReference || "auto"}\n+ Kontaktbezug: ${command.contactReferenceMode}`;
    }
    const before = String(currentSource || "").split("\n");
    const after = String(command.sourceFile || "").split("\n");
    const changedLine = Math.max(0, before.findIndex((line, index) => line !== after[index]));
    return `- ${before[changedLine] || "(leer)"}\n+ ${after[changedLine] || "(leer)"}`;
  }).join("\n");
}

function setButtonCaption(button, pressed) {
  if (!button) return;
  const current = pressed ? BUTTON_STATES.pressed : BUTTON_STATES.released;
  button.setAttribute("aria-pressed", String(Boolean(pressed)));
  button.textContent = `Taster: ${current}`;
  button.dataset.buttonState = current;
}

function createKpi(label, outputKey) {
  return `<div><span>${label}</span><strong data-output="${outputKey}">—</strong></div>`;
}

function clearTextOutputs(outputs) {
  for (const [key, target] of Object.entries(outputs)) {
    setText(target, key.includes("warning") ? "—" : "—");
  }
}

function formatPullMode(measurement) {
  if (!measurement) return "—";
  return measurement?.pullMode || "—";
}

function formatButtonContact(measurement) {
  if (!measurement) return "—";
  return measurement?.contactReference === "vcc"
    ? "Taster schaltet gegen 3,3 V"
    : "Taster schaltet gegen GND";
}

function updateWarningArea(warnings, warningOutput, statusOutput) {
  const messages = warnings.map((entry) => entry?.message || "").filter(Boolean);
  if (messages.length > 0) {
    setText(warningOutput, `Hinweis: ${messages.join(" | ")}`);
  } else {
    setText(warningOutput, "—");
  }
  setText(statusOutput, "Messung abgeschlossen.");
}

function updateCircuitAnnotations(measurement, refs) {
  const buttonContactPullMode = measurement?.buttonContactPullMode;
  const effectiveButtonContactPullMode =
    buttonContactPullMode === "pull-up" || buttonContactPullMode === "pull-down"
      ? buttonContactPullMode
      : "unmeasured";
  const modeText = measurement
    ? formatPullMode(measurement)
    : "—";
  const contactText = measurement
    ? formatButtonContact(measurement)
    : "—";
  const logicText = measurement
    ? `Pegel an GPIO 4: ${measurement.logicLevel ?? "—"}`
    : "Pegel an GPIO 4: —";
  const pressedText = measurement
    ? `Taster: ${measurement.pressed ? BUTTON_STATES.pressed : BUTTON_STATES.released}`
    : "Taster: —";
  const pullBranchText = measurement
    ? measurement?.buttonContactPullMode === "pull-down"
      ? "Pull-down nach GND"
      : "Pull-up nach 3,3 V"
    : "—";

  setText(refs.pullMode, modeText);
  setText(refs.contact, contactText);
  setText(refs.logic, logicText);
  setText(refs.pressed, pressedText);
  setText(refs.pullBranch, pullBranchText);
  setText(refs.runtimeHint, measurement ? "Darstellung aus Runtime-Snapshot" : "Noch keine Simulation");

  if (refs.canvas) {
    refs.canvas.dataset.buttonContactPullMode = effectiveButtonContactPullMode;
    refs.canvas.dataset.contactReference = measurement?.contactReference || "unmeasured";
    refs.canvas.dataset.logicLevel = measurement ? `${measurement?.logicLevel ?? "—"}` : "—";
    refs.canvas.dataset.pressed = measurement ? String(Boolean(measurement.pressed)) : "false";
  }
}

export function createButtonDigitalInputThroughputLab({ assistantClient = null } = {}) {
  const runtime = createButtonDigitalInputThroughputRuntime();
  const state = {
    source: DIGITAL_INPUT_PROGRAM_START_CODE,
    pressed: false,
    mode: "throughput",
    scenario: "miswired",
    observedFault: false,
    observedFloatingLevels: new Set(),
    repairedOpenState: false,
    bounceTrace: null,
    bounceProgram: null,
    bounceTargetPressed: true,
    pendingAssistantProposal: null,
  };

  let sourceArea = null;
  let buttonToggle = null;
  let statusOutput = null;
  let warningOutput = null;
  let buttonStateOutput = null;
  let pullModeOutput = null;
  let gpioLevelOutput = null;
  let normalizedOutput = null;
  let buttonStateVariableOutput = null;
  let pinOutput = null;
  let troubleshootingPanel = null;
  let troubleshootingStatus = null;
  let modeButtons = [];
  let scenarioButtons = [];
  let scenarioPanels = [];
  let contactButtons = [];
  let bounceCursor = null;
  let bouncePolyline = null;
  let debouncePolyline = null;
  let bounceCursorLine = null;
  let bounceTargetOutput = null;
  let bounceCursorOutput = null;
  let bounceEdgeOutput = null;
  let bounceStableOutput = null;
  let debounceEdgeOutput = null;
  let debounceChangedOutput = null;
  let assistantStatus = null;
  let assistantResult = null;
  let assistantDiff = null;
  let assistantApplyButton = null;
  let assistantMessage = null;
  let assistantActionButtons = [];

  let circuitSchematic = null;
  let circuitPullModeLabel = null;
  let circuitContactLabel = null;
  let circuitLogicLabel = null;
  let circuitPressedLabel = null;
  let circuitPullBranchLabel = null;
  let circuitRuntimeHint = null;

  const outputTargets = () => ({
    buttonState: buttonStateOutput,
    pullMode: pullModeOutput,
    gpioLevel: gpioLevelOutput,
    normalizedValue: normalizedOutput,
    buttonStateVariable: buttonStateVariableOutput,
    pin: pinOutput,
  });

  const setStartCode = (nextSource) => {
    if (typeof nextSource !== "string") return;
    if (DEBOUNCE_SCENARIOS.has(state.scenario)) {
      state.source = nextSource;
      state.pendingAssistantProposal = null;
      renderAssistantProposal();
      return;
    }
    state.source = nextSource;
    const response = runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: nextSource });
    if (response.ok) {
      state.source = response.sourceFile;
      state.pressed = runtime.getSnapshot().pressed;
    }
    renderFromSnapshot(response.errors);
  };

  const start = () => {
    if (state.mode === "troubleshooting" && DEBOUNCE_SCENARIOS.has(state.scenario)) {
      renderBounceTrace(state.bounceTargetPressed);
      return;
    }
    const response = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
    renderFromSnapshot(response.errors);
  };

  const clearTroubleshootingProgress = () => {
    state.observedFault = false;
    state.observedFloatingLevels.clear();
    state.repairedOpenState = false;
    state.bounceTrace = null;
    state.bounceProgram = null;
    state.pendingAssistantProposal = null;
  };

  const renderBounceCursor = () => {
    const samples = state.bounceTrace?.result?.trace || [];
    const debouncedSamples = state.bounceProgram?.result?.debouncedTrace || [];
    if (samples.length === 0 || !bounceCursor) return;
    const index = Math.min(Number(bounceCursor.value) || 0, samples.length - 1);
    const sample = samples[index];
    const x = samples.length === 1 ? 0 : (index / (samples.length - 1)) * 500;
    bounceCursorLine?.setAttribute("x1", `${x}`);
    bounceCursorLine?.setAttribute("x2", `${x}`);
    const debounced = debouncedSamples[index];
    setText(bounceCursorOutput,
      `${sample.timeUs} µs · roh ${sample.logicLevel} · Programm ${debounced?.debouncedLogicLevel || "—"}`);
  };

  const renderBounceTrace = (targetPressed) => {
    const trace = createButtonBounceTrace({
      targetPressed,
      pullMode: "pull-up",
      contactReference: "gnd",
      sampleIntervalUs: 50,
      durationUs: 5000,
    });
    if (!trace.ok) return;
    state.bounceTrace = trace;
    state.bounceTargetPressed = Boolean(targetPressed);
    const program = executeButtonDebounceProgram({
      sourceFile: state.source,
      measurementTrace: trace.result.trace,
    });
    state.bounceProgram = program.ok ? program : null;
    if (!program.ok) {
      setText(statusOutput, `Fehler: ${program.errors.map(formatErrorEntry).join(" | ")}`);
      setText(debounceEdgeOutput, "—");
      setText(debounceChangedOutput, "—");
      debouncePolyline?.setAttribute("points", "");
      return;
    }
    const samples = trace.result.trace;
    const points = samples.map((sample, index) => {
      const x = samples.length === 1 ? 0 : (index / (samples.length - 1)) * 500;
      return `${x},${sample.logicLevel === "HIGH" ? 20 : 55}`;
    }).join(" ");
    bouncePolyline?.setAttribute("points", points);
    const debouncedSamples = program.result.debouncedTrace;
    const debouncePoints = debouncedSamples.map((sample, index) => {
      const x = debouncedSamples.length === 1 ? 0 : (index / (debouncedSamples.length - 1)) * 500;
      return `${x},${sample.debouncedLogicLevel === "HIGH" ? 90 : 125}`;
    }).join(" ");
    debouncePolyline?.setAttribute("points", debouncePoints);
    if (bounceCursor) {
      bounceCursor.max = `${Math.max(0, samples.length - 1)}`;
      bounceCursor.value = "0";
    }
    const edges = edgeCount(samples, "logicLevel");
    const debounceEdges = edgeCount(debouncedSamples, "debouncedLogicLevel");
    const stableSample = samples.find((sample) => sample.timeUs >= 1800) || samples.at(-1);
    const changedSample = debouncedSamples.filter((sample) => sample.changed).at(-1);
    const delayUs = changedSample ? Math.max(0, changedSample.timeUs - stableSample.timeUs) : null;
    setText(bounceTargetOutput, targetPressed ? "gedrückt" : "gelöst");
    setText(bounceEdgeOutput, `${edges}`);
    setText(debounceEdgeOutput, `${debounceEdges}`);
    setText(debounceChangedOutput, changedSample
      ? `${changedSample.timeUs} µs · Verzögerung ${delayUs} µs`
      : "kein übernommener Wechsel");
    setText(bounceStableOutput,
      `${stableSample.timeUs} µs · ${stableSample.logicLevel} · digitalRead = ${stableSample.normalizedValue}`);
    renderFromSnapshot();
    setText(statusOutput, `Simulation abgeschlossen · debounceUs = ${program.result.debounceUs} µs`);
    renderBounceCursor();
  };

  const resetForCurrentMode = () => {
    const response = runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
    if (!response.ok) return response;
    if (state.mode === "troubleshooting" && state.scenario === "miswired") {
      runtime.dispatch({
        type: COMMAND_TYPES.SetContactReference,
        contactReferenceMode: "vcc",
      });
    }
    if (state.mode === "troubleshooting" && state.scenario === "missing-pull") {
      runtime.dispatch({
        type: COMMAND_TYPES.UpdateSourceFile,
        sourceFile: FLOATING_INPUT_START_CODE,
      });
    }
    if (state.mode === "troubleshooting" && DEBOUNCE_SCENARIOS.has(state.scenario)) {
      state.source = debounceSourceForScenario(state.scenario);
    }
    return response;
  };

  const reset = () => {
    clearTroubleshootingProgress();
    const response = resetForCurrentMode();
    if (!response?.ok) return;
    renderFromSnapshot();
    if (state.mode === "troubleshooting" && DEBOUNCE_SCENARIOS.has(state.scenario)) {
      renderBounceTrace(true);
    }
  };

  const setMode = (mode) => {
    state.mode = mode === "troubleshooting" ? "troubleshooting" : "throughput";
    state.scenario = "miswired";
    clearTroubleshootingProgress();
    const response = resetForCurrentMode();
    if (!response?.ok) return;
    renderFromSnapshot();
  };

  const setScenario = (scenario) => {
    if (state.mode !== "troubleshooting") return;
    state.scenario = ["missing-pull", "bounce", "debounce-short", "debounce-long"].includes(scenario)
      ? scenario
      : "miswired";
    clearTroubleshootingProgress();
    const response = resetForCurrentMode();
    if (!response?.ok) return;
    renderFromSnapshot();
    if (DEBOUNCE_SCENARIOS.has(state.scenario)) renderBounceTrace(true);
  };

  const loadTemplate = (template) => {
    const presetId = template?.entry?.presetId || "pullup";
    state.mode = presetId === "pullup" ? "throughput" : "troubleshooting";
    state.scenario = ["missing-pull", "bounce", "debounce-short", "debounce-long"].includes(presetId)
      ? presetId
      : "miswired";
    clearTroubleshootingProgress();
    const response = resetForCurrentMode();
    if (!response?.ok) return response;
    if (typeof template?.startCode === "string") {
      state.source = template.startCode;
      if (!DEBOUNCE_SCENARIOS.has(state.scenario)) {
        runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: state.source });
      }
    }
    return response;
  };

  const applyContactReference = (contactReferenceMode) => {
    if (state.mode !== "troubleshooting" || state.scenario !== "miswired") return;
    const response = runtime.dispatch({
      type: COMMAND_TYPES.SetContactReference,
      contactReferenceMode,
    });
    if (!response.ok) return;
    const simulation = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
    renderFromSnapshot(simulation.errors);
  };

  const repeatFloatingMeasurement = () => {
    if (state.mode !== "troubleshooting" || state.scenario !== "missing-pull") return;
    const advance = runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
    if (!advance.ok) return;
    const simulation = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
    renderFromSnapshot(simulation.errors);
  };

  const applyButtonState = (pressed) => {
    const response = runtime.dispatch({
      type: COMMAND_TYPES.SetButtonPressed,
      pressed,
    });
    if (!response.ok) return;
    state.pressed = response.pressed;
    setButtonCaption(buttonToggle, response.pressed);
    const simulation = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
    renderFromSnapshot(simulation.errors);
  };

  const assistantSnapshot = () => {
    const snapshot = runtime.getSnapshot();
    return {
      ...snapshot,
      sourceFile: state.source,
      measurement: snapshot.measurement || null,
    };
  };

  function renderAssistantProposal() {
    const proposal = state.pendingAssistantProposal;
    if (!proposal) {
      setText(assistantResult, "Noch kein Vorschlag angefordert.");
      setText(assistantDiff, "Noch keine Änderung vorgeschlagen.");
      if (assistantApplyButton) assistantApplyButton.hidden = true;
      return;
    }
    const commandSummary = proposal.commands?.map((command) => command.type === "SetContactReference"
      ? `Kontaktbezug → ${command.contactReferenceMode.toUpperCase()}`
      : "Quellcodeänderung anzeigen und übernehmen").join(" · ");
    setText(assistantResult, commandSummary ? `${proposal.content} · ${commandSummary}` : proposal.content);
    setText(assistantDiff, formatAssistantDiff(proposal, state.source, runtime.getSnapshot().labProject?.button?.contactReferenceMode));
    if (assistantApplyButton) {
      assistantApplyButton.hidden = proposal.actionType !== "propose-command-diff";
    }
  }

  const requestAssistantAction = async (requestedAction) => {
    if (!assistantClient || state.mode !== "troubleshooting") return;
    state.pendingAssistantProposal = null;
    renderAssistantProposal();
    setText(assistantStatus, "Assistent prüft den minimierten Laborzustand …");
    for (const button of assistantActionButtons) button.disabled = true;
    const response = await assistantClient.request({
      scenario: DEBOUNCE_SCENARIOS.has(state.scenario) ? "bounce" : state.scenario,
      snapshot: assistantSnapshot(),
      requestedAction,
      message: assistantMessage?.value || "",
    });
    for (const button of assistantActionButtons) button.disabled = false;
    if (!response.ok) {
      setText(assistantStatus, response.message || "Der Assistent ist nicht erreichbar.");
      return;
    }
    state.pendingAssistantProposal = response.proposal;
    setText(assistantStatus, response.proposal.requiresConfirmation
      ? "Vorschlag geprüft. Die Änderung wartet auf deine Bestätigung."
      : "Vorschlag geprüft; der Laborzustand wurde nicht verändert.");
    renderAssistantProposal();
  };

  const applyAssistantProposal = () => {
    const proposal = state.pendingAssistantProposal;
    if (!proposal?.requiresConfirmation || !Array.isArray(proposal.commands)) return;
    for (const command of proposal.commands) {
      if (command.type === "SetContactReference") {
        runtime.dispatch({ type: COMMAND_TYPES.SetContactReference, contactReferenceMode: command.contactReferenceMode });
      } else if (command.type === "UpdateSourceFile") {
        if (DEBOUNCE_SCENARIOS.has(state.scenario)) {
          state.source = command.sourceFile;
          sourceArea.value = state.source;
        } else {
          runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: command.sourceFile });
        }
      }
    }
    state.pendingAssistantProposal = null;
    renderAssistantProposal();
    setText(assistantStatus, "Bestätigter Vorschlag übernommen. Prüfe die Reparatur jetzt durch eine neue Messung.");
    start();
  };

  function renderFromSnapshot(runtimeErrors = null) {
    const snapshot = runtime.getSnapshot();
    const measurement = snapshot.measurement;
    const warnings = measurement?.warnings || [];
    const outputs = outputTargets();

    if (
      state.mode === "troubleshooting" &&
      state.scenario === "miswired" &&
      measurement?.pressed &&
      warnings.some((entry) => entry?.code === "BUTTON_CONTACT_NO_LEVEL_CHANGE")
    ) {
      state.observedFault = true;
    }

    const wiringRepairVerified = Boolean(
      state.mode === "troubleshooting" &&
      state.scenario === "miswired" &&
      state.observedFault &&
      measurement?.pressed &&
      measurement?.contactReference === "gnd" &&
      measurement?.logicLevel === "LOW" &&
      measurement?.buttonState === 0,
    );

    const isFloatingMeasurement = warnings.some(
      (entry) => entry?.code === "DIGITAL_INPUT_FLOATING_IDEALIZED",
    );
    if (
      state.mode === "troubleshooting" &&
      state.scenario === "missing-pull" &&
      measurement &&
      !measurement.pressed &&
      isFloatingMeasurement
    ) {
      state.observedFloatingLevels.add(measurement.logicLevel);
    }
    if (
      state.mode === "troubleshooting" &&
      state.scenario === "missing-pull" &&
      state.observedFloatingLevels.size >= 2 &&
      measurement?.pullMode === "INPUT_PULLUP" &&
      !measurement?.pressed &&
      measurement?.logicLevel === "HIGH"
    ) {
      state.repairedOpenState = true;
    }
    const pullRepairVerified = Boolean(
      state.mode === "troubleshooting" &&
      state.scenario === "missing-pull" &&
      state.observedFloatingLevels.size >= 2 &&
      state.repairedOpenState &&
      measurement?.pullMode === "INPUT_PULLUP" &&
      measurement?.pressed &&
      measurement?.logicLevel === "LOW" &&
      measurement?.buttonState === 0,
    );
    const debouncedSamples = state.bounceProgram?.result?.debouncedTrace || [];
    const debouncedEdges = edgeCount(debouncedSamples, "debouncedLogicLevel");
    const debounceChangedSample = debouncedSamples.filter((sample) => sample.changed).at(-1);
    const debounceDelayUs = debounceChangedSample ? Math.max(0, debounceChangedSample.timeUs - 1800) : null;
    const debounceRepairVerified = Boolean(
      ["debounce-short", "debounce-long"].includes(state.scenario) &&
      debouncedEdges === 1 && debounceDelayUs !== null && debounceDelayUs <= 1200
    );
    const repairVerified = wiringRepairVerified || pullRepairVerified || debounceRepairVerified;

    if (!DEBOUNCE_SCENARIOS.has(state.scenario)) state.source = snapshot.sourceFile;
    state.pressed = snapshot.pressed;
    sourceArea.value = state.source;
    setButtonCaption(buttonToggle, state.pressed);
    for (const button of modeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
    }
    for (const button of scenarioButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.scenario === state.scenario));
    }
    for (const panel of scenarioPanels) {
      panel.hidden = panel.dataset.scenarioPanel !== state.scenario &&
        !(panel.dataset.scenarioPanel === "bounce" && DEBOUNCE_SCENARIOS.has(state.scenario));
    }
    if (troubleshootingPanel) {
      troubleshootingPanel.hidden = state.mode !== "troubleshooting";
    }
    for (const button of contactButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.contactReference === snapshot.contactReferenceMode),
      );
    }
    if (state.mode === "troubleshooting") {
      let instruction = wiringRepairVerified || pullRepairVerified
        ? "Fehler gefunden und Reparatur durch Messung bestätigt."
        : state.observedFault
          ? "Der Tastendruck ändert den Pegel nicht. Prüfe jetzt den Kontaktanschluss."
          : "Drücke den Taster und beobachte, ob sich der Pegel an GPIO 4 ändert.";
      if (state.scenario === "missing-pull") {
        instruction = pullRepairVerified
          ? "Fehlenden Pull erkannt und Reparatur mit offenem sowie gedrücktem Taster bestätigt."
          : state.repairedOpenState
            ? "Der offene Eingang ist stabil HIGH. Drücke den Taster für die Gegenprobe."
            : state.observedFloatingLevels.size >= 2
              ? "Der offene Pegel wechselt. Ergänze im Quellcode einen internen Pull-up und prüfe erneut."
              : state.observedFloatingLevels.size === 1
                ? "Ein Sample reicht nicht. Wiederhole die Messung."
                : "Starte die Simulation und wiederhole anschließend die Messung.";
      } else if (state.scenario === "bounce") {
        instruction = "Ändere die Entprellzeit im Quellcode, starte erneut und vergleiche Rohsignal mit Programmwert.";
      } else if (state.scenario === "debounce-short") {
        instruction = debounceRepairVerified
          ? "Zu kurze Entprellung erkannt und durch genau eine Programmflanke bestätigt repariert."
          : "Beobachte, warum ein Tastendruck im Programm mehrfach erkannt wird, und korrigiere dann den Quellcode.";
      } else if (state.scenario === "debounce-long") {
        instruction = debounceRepairVerified
          ? "Zu lange Entprellung erkannt und mit einer ausreichend schnellen Programmflanke bestätigt repariert."
          : "Beobachte die Verzögerung zwischen stabilem Rohsignal und Programmwert und korrigiere dann den Quellcode.";
      }
      setText(troubleshootingStatus, instruction);
      troubleshootingPanel?.classList.toggle("is-complete", repairVerified);
    }
    updateCircuitAnnotations(measurement, {
      canvas: circuitSchematic,
      pullMode: circuitPullModeLabel,
      contact: circuitContactLabel,
      logic: circuitLogicLabel,
      pressed: circuitPressedLabel,
      pullBranch: circuitPullBranchLabel,
      runtimeHint: circuitRuntimeHint,
    });

    const errors = runtimeErrors || snapshot.error || [];
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors.map(formatErrorEntry).filter(Boolean);
      setText(statusOutput, `Fehler: ${messages.join(" | ")}`);
      setText(warningOutput, "—");
      clearTextOutputs(outputs);
      setText(outputs.buttonState, state.pressed ? BUTTON_STATES.pressed : BUTTON_STATES.released);
      setText(outputs.pullMode, formatPullMode(measurement));
      setText(outputs.gpioLevel, measurement?.logicLevel ?? "—");
      setText(outputs.normalizedValue, formatValue(measurement?.normalizedValue));
      setText(outputs.buttonStateVariable, formatValue(measurement?.buttonState));
      setText(outputs.pin, asPin(snapshot?.labProject?.button?.pin));
      return;
    }

    if (!measurement) {
      clearTextOutputs(outputs);
      setText(outputs.pin, asPin(snapshot?.labProject?.button?.pin));
      setText(statusOutput, "Simulation zurückgesetzt. Starten, um Messwerte neu zu berechnen.");
      setText(warningOutput, "—");
      return;
    }

    setText(outputs.buttonState, measurement.pressed ? BUTTON_STATES.pressed : BUTTON_STATES.released);
    setText(outputs.pullMode, formatPullMode(measurement));
    setText(outputs.gpioLevel, measurement.logicLevel ?? "—");
    setText(outputs.normalizedValue, formatValue(measurement.normalizedValue));
    setText(outputs.buttonStateVariable, formatValue(measurement.buttonState));
    setText(outputs.pin, asPin(measurement.pin));

    updateWarningArea(warnings, warningOutput, statusOutput);
  }

  function mount(target) {
    target.innerHTML = `<article id="button-digital-input-throughput" class="lab-card">
      <h2>Durchstich · Taster → digitalRead</h2>
      <p class="elab-throughput-reality">Idealisiertes Lernmodell – keine ESP32-Emulation; Tasterprellen folgt einem festen Lehrprofil.</p>
      <div class="elab-button-mode-switch" role="group" aria-label="Betriebsart des Tasterlabors">
        <button type="button" data-mode="throughput" aria-pressed="true">${BUTTON_LAB_MODES.throughput.title}</button>
        <button type="button" data-mode="troubleshooting" aria-pressed="false">${BUTTON_LAB_MODES.troubleshooting.title}</button>
      </div>
      <section class="elab-button-troubleshooting" data-troubleshooting-panel hidden>
        <div class="elab-button-scenario-switch" role="group" aria-label="Fehlersuchfall auswählen">
          <button type="button" data-scenario="miswired" aria-pressed="true">Taster falsch angeschlossen</button>
          <button type="button" data-scenario="missing-pull" aria-pressed="false">Pull-Widerstand fehlt</button>
          <button type="button" data-scenario="bounce" aria-pressed="false">Tasterprellen messen</button>
          <button type="button" data-scenario="debounce-short" aria-pressed="false">Entprellung zu kurz</button>
          <button type="button" data-scenario="debounce-long" aria-pressed="false">Entprellung zu lang</button>
        </div>
        <section data-scenario-panel="miswired">
          <strong>Fehlersuche · Taster reagiert nicht</strong>
          <p>Der Eingang verwendet <code>INPUT_PULLUP</code>. Finde mit Taster und Pegelanzeige heraus, warum keine Änderung erkennbar ist.</p>
          <div class="elab-button-wiring-actions" role="group" aria-label="Kontaktanschluss auswählen">
            <button type="button" data-contact-reference="vcc" aria-pressed="true">Kontakt an 3,3 V</button>
            <button type="button" data-contact-reference="gnd" aria-pressed="false">Kontakt an GND</button>
          </div>
        </section>
        <section data-scenario-panel="missing-pull" hidden>
          <strong>Fehlersuche · Offener Eingang liefert wechselnde Werte</strong>
          <p>Der Taster ist gelöst und Pin 4 steht auf <code>INPUT</code>. Miss mehrfach und stabilisiere den Eingang anschließend im Quellcode.</p>
          <button type="button" data-action="repeat-floating">Messung wiederholen</button>
          <p class="elab-throughput-small">Die feste Folge ist ein Lernmodell. Reale offene Eingänge reagieren abhängig von Aufbau und Umgebung.</p>
        </section>
        <section data-scenario-panel="bounce" hidden>
          <strong>Fehlersuche · Rohkontakt und Programmwert</strong>
          <p>Miss den Rohkontakt wie mit einem Logikanalysator und vergleiche ihn mit dem im Mikrocontrollerprogramm entprellten Wert.</p>
          <div class="elab-button-bounce-actions">
            <button type="button" data-action="bounce-press">Taster drücken · Spur aufnehmen</button>
            <button type="button" data-action="bounce-release">Taster lösen · Spur aufnehmen</button>
          </div>
          <svg class="elab-button-bounce-trace" viewBox="0 0 500 145" role="img" aria-label="Rohsignal und entprellter Programmwert des Tasters">
            <text x="8" y="14" class="elab-bounce-label">Rohkontakt</text>
            <line x1="0" y1="20" x2="500" y2="20" class="elab-bounce-grid" />
            <line x1="0" y1="55" x2="500" y2="55" class="elab-bounce-grid" />
            <polyline data-bounce-polyline points="" />
            <text x="8" y="84" class="elab-bounce-label">Programmwert buttonState</text>
            <line x1="0" y1="90" x2="500" y2="90" class="elab-bounce-grid" />
            <line x1="0" y1="125" x2="500" y2="125" class="elab-bounce-grid" />
            <polyline data-debounce-polyline points="" />
            <line data-bounce-cursor-line x1="0" y1="5" x2="0" y2="138" />
          </svg>
          <label class="elab-button-bounce-cursor">Messcursor
            <input type="range" min="0" max="50" value="0" data-bounce-cursor />
          </label>
          <dl class="elab-button-bounce-readout">
            <div><dt>Zielzustand</dt><dd data-bounce-target>—</dd></div>
            <div><dt>Cursor</dt><dd data-bounce-cursor-output>—</dd></div>
            <div><dt>Rohflanken</dt><dd data-bounce-edges>—</dd></div>
            <div><dt>Programmflanken</dt><dd data-debounce-edges>—</dd></div>
            <div><dt>Stabil ab</dt><dd data-bounce-stable>—</dd></div>
            <div><dt>Übernahme</dt><dd data-debounce-changed>—</dd></div>
          </dl>
          <p class="elab-throughput-small">Reales Labor: Logikanalysator- oder Oszilloskopmasse zuerst mit GND verbinden. Die Zeitwerte gehören nur zum festen Lehrprofil; reale Taster und Aufbauten müssen gemessen werden.</p>
        </section>
        <p data-troubleshooting-status aria-live="polite"></p>
        <section class="elab-troubleshooting-assistant" aria-labelledby="elab-assistant-title">
          <strong id="elab-assistant-title">KI-Unterstützung</strong>
          <p data-assistant-mode>${assistantClient?.label || "Assistent nicht konfiguriert"}</p>
          <label>Optionale Beobachtung
            <input type="text" maxlength="600" data-assistant-message placeholder="Was hast du gemessen?" />
          </label>
          <div class="elab-assistant-actions" role="group" aria-label="Assistentenaktion auswählen">
            <button type="button" data-assistant-action="explain-observation">Beobachtung erklären</button>
            <button type="button" data-assistant-action="suggest-measurement">Nächste Messung</button>
            <button type="button" data-assistant-action="propose-command-diff">Reparatur vorschlagen</button>
          </div>
          <p data-assistant-status aria-live="polite">Der Assistent verändert Schaltung und Quellcode nicht selbst.</p>
          <output data-assistant-result>Noch kein Vorschlag angefordert.</output>
          <pre data-assistant-diff aria-label="Vorgeschlagene Änderung">Noch keine Änderung vorgeschlagen.</pre>
          <button type="button" data-assistant-apply hidden>Vorschlag übernehmen</button>
        </section>
      </section>
      <div class="elab-button-throughput-layout">
        <section class="elab-throughput-circuit">
          <div class="elab-throughput-circuit-head">
            <strong>Virtuelles Vorgehen</strong>
            <span class="elab-throughput-small">Pin 4 ist mit internem Pull-Widerstand konfiguriert und an den Taster gekoppelt.</span>
          </div>
          <svg class="elab-button-throughput-schematic" data-button-contact-pull-mode="unmeasured" data-contact-reference="unmeasured" viewBox="0 0 760 240" role="img" aria-label="Taster-Durchstich mit MCU, GPIO 4, Pull-Widerstand, 3,3 V und GND">
            <g data-component="mcu" data-net="gpio4">
              <rect x="20" y="86" width="74" height="48" rx="8" fill="none" stroke="#8fa0b5" stroke-width="3" />
              <text x="33" y="110" fill="#9fb3c8" font-size="11">MCU</text>
              <text x="29" y="124" fill="#9fb3c8" font-size="9">GPIO 4</text>
              <line class="schematic-wire" x1="94" y1="110" x2="255" y2="110" />
            </g>
            <g data-net="vcc">
              <line class="schematic-wire schematic-rail" x1="40" y1="25" x2="740" y2="25" />
              <circle cx="40" cy="25" r="8" fill="#5f7084" stroke="#8fa0b5" stroke-width="2" />
              <text x="16" y="18" fill="#9fb3c8" font-size="12" data-schematic="vcc-label">3,3 V</text>
            </g>
            <g data-component="gnd" data-net="gnd">
              <line class="schematic-wire schematic-rail" x1="40" y1="210" x2="740" y2="210" />
              <circle cx="40" cy="210" r="8" fill="#202833" stroke="#8fa0b5" stroke-width="2" />
              <text x="16" y="225" fill="#9fb3c8" font-size="12" data-schematic="gnd-label">GND</text>
            </g>
            <g data-component="pull-resistor" data-net="floating-pull">
              <line class="schematic-wire schematic-component schematic-resistor schematic-pull-branch" data-pull-branch="pull-up" x1="220" y1="25" x2="220" y2="60" />
              <path class="schematic-component schematic-resistor schematic-pull-branch" data-pull-branch="pull-up" d="M220 60 L210 68 L230 76 L210 84 L230 92 L220 100" fill="none" stroke="#8fa0b5" stroke-width="3" />
              <line class="schematic-wire schematic-component schematic-pull-branch" data-pull-branch="pull-up" x1="220" y1="100" x2="220" y2="110" />
              <line class="schematic-wire schematic-pull-branch" data-pull-branch="pull-up" x1="220" y1="110" x2="255" y2="110" />

              <line class="schematic-wire schematic-component schematic-pull-branch" data-pull-branch="pull-down" x1="290" y1="210" x2="290" y2="160" />
              <path class="schematic-component schematic-resistor schematic-pull-branch" data-pull-branch="pull-down" d="M290 160 L280 152 L300 144 L280 136 L300 128 L290 120" fill="none" stroke="#8fa0b5" stroke-width="3" />
              <line class="schematic-wire schematic-component schematic-pull-branch" data-pull-branch="pull-down" x1="290" y1="120" x2="290" y2="110" />
              <line class="schematic-wire schematic-pull-branch" data-pull-branch="pull-down" x1="290" y1="110" x2="255" y2="110" />
              <text x="248" y="20" fill="#9fb3c8" font-size="10" data-schematic="pull-mode-label">—</text>
              <text x="188" y="148" fill="#9fb3c8" font-size="10" data-schematic="contact-label">—</text>
              <text x="188" y="176" fill="#9fb3c8" font-size="10" data-schematic="pull-branch-label">—</text>
            </g>
            <g data-component="button" data-net="button-to-gpio4">
              <line class="schematic-wire" x1="255" y1="110" x2="390" y2="110" />
              <rect x="390" y="94" width="16" height="32" fill="none" stroke="#5f7084" stroke-width="3" />
              <line class="schematic-wire" x1="406" y1="110" x2="438" y2="110" />
              <rect x="438" y="94" width="16" height="32" fill="#26313a" stroke="#dce5ec" stroke-width="2" />
              <path class="schematic-button-contact schematic-button-open" data-button-contact-state="open" d="M438 110 L474 124" />
              <path class="schematic-button-contact schematic-button-closed" data-button-contact-state="closed" d="M438 110 L474 110" />
              <path class="schematic-led" d="M474 94 L474 110" stroke="#f59f3a" stroke-width="4" />
              <circle cx="474" cy="110" r="7" class="elab-throughput-measurement-point" />
              <text x="486" y="118" fill="#9fb3c8" font-size="12">Taster</text>
            </g>
            <g data-net="button-ref">
              <path class="schematic-contact-reference" data-contact-reference="to-vcc" d="M474 110 L474 25 L650 25" />
              <path class="schematic-contact-reference" data-contact-reference="to-gnd" d="M474 110 L474 210 L650 210" />
            </g>
            <circle cx="255" cy="110" r="6" fill="none" stroke="#9fb3c8" stroke-width="2" />
            <text x="262" y="92" fill="#9fb3c8" font-size="11" data-schematic="logic-level-label">Pegel: —</text>
            <text x="456" y="165" fill="#9fb3c8" font-size="11" data-schematic="pressed-label">Taster: —</text>
            <text x="18" y="170" fill="#9fb3c8" font-size="11" data-schematic="runtime-hint">Noch keine Simulation</text>
          </svg>
          <p class="elab-throughput-small">Der Anschlussstatus und der Tasterzustand werden aus dem Laufzeit-Snapshot gelesen.</p>
        </section>
        <section class="elab-button-throughput-control">
          <section class="elab-throughput-program">
            <label for="button-throughput-source">Quellcode</label>
            <textarea id="button-throughput-source" spellcheck="false"></textarea>
            <div class="elab-throughput-actions elab-button-throughput-actions">
              <button type="button" data-action="toggle">Taster: gelöst</button>
              <button type="button" data-action="start">Simulation starten</button>
              <button type="button" data-action="reset">Zurücksetzen</button>
            </div>
          </section>
          <section class="elab-throughput-measurements">
            <h3>Ausgabe</h3>
            <div class="elab-throughput-kpi elab-button-throughput-kpi">
              ${createKpi("Tasterzustand", "button-state")}
              ${createKpi("Arduino-Pull-Modus", "pull-mode")}
              ${createKpi("Pegel an GPIO 4", "gpio-level")}
              ${createKpi("normierter Eingangswert", "normalized-value")}
              ${createKpi("Programmvariable buttonState", "button-variable")}
              ${createKpi("Pin", "pin")}
            </div>
            <p class="elab-throughput-warnings" data-button-warnings></p>
            <p class="elab-throughput-result" data-button-status></p>
            <p class="elab-throughput-disclaimer" data-button-reality>Vom virtuellen zum echten Labor: interner Pull-Widerstand, gemeinsame Masse, reale Verdrahtung als Schließer, Spannungsprüfung vor Realverdrahtung und Entprellung. Keine 5V am GPIO, sofern der reale Pin nicht ausdrücklich 5V-tolerant ist.</p>
          </section>
        </section>
      </div>
    </article>`;

    sourceArea = target.querySelector("#button-throughput-source");
    buttonToggle = target.querySelector('[data-action="toggle"]');
    statusOutput = target.querySelector("[data-button-status]");
    warningOutput = target.querySelector("[data-button-warnings]");
    buttonStateOutput = target.querySelector('[data-output="button-state"]');
    pullModeOutput = target.querySelector('[data-output="pull-mode"]');
    gpioLevelOutput = target.querySelector('[data-output="gpio-level"]');
    normalizedOutput = target.querySelector('[data-output="normalized-value"]');
    buttonStateVariableOutput = target.querySelector('[data-output="button-variable"]');
    pinOutput = target.querySelector('[data-output="pin"]');
    troubleshootingPanel = target.querySelector("[data-troubleshooting-panel]");
    troubleshootingStatus = target.querySelector("[data-troubleshooting-status]");
    modeButtons = [...target.querySelectorAll("[data-mode]")];
    scenarioButtons = [...target.querySelectorAll("[data-scenario]")];
    scenarioPanels = [...target.querySelectorAll("[data-scenario-panel]")];
    contactButtons = [...target.querySelectorAll("[data-contact-reference]")].filter(
      (element) => element.tagName === "BUTTON",
    );
    bounceCursor = target.querySelector("[data-bounce-cursor]");
    bouncePolyline = target.querySelector("[data-bounce-polyline]");
    debouncePolyline = target.querySelector("[data-debounce-polyline]");
    bounceCursorLine = target.querySelector("[data-bounce-cursor-line]");
    bounceTargetOutput = target.querySelector("[data-bounce-target]");
    bounceCursorOutput = target.querySelector("[data-bounce-cursor-output]");
    bounceEdgeOutput = target.querySelector("[data-bounce-edges]");
    bounceStableOutput = target.querySelector("[data-bounce-stable]");
    debounceEdgeOutput = target.querySelector("[data-debounce-edges]");
    debounceChangedOutput = target.querySelector("[data-debounce-changed]");
    assistantStatus = target.querySelector("[data-assistant-status]");
    assistantResult = target.querySelector("[data-assistant-result]");
    assistantDiff = target.querySelector("[data-assistant-diff]");
    assistantApplyButton = target.querySelector("[data-assistant-apply]");
    assistantMessage = target.querySelector("[data-assistant-message]");
    assistantActionButtons = [...target.querySelectorAll("[data-assistant-action]")];
    circuitSchematic = target.querySelector(".elab-button-throughput-schematic");
    circuitPullModeLabel = target.querySelector('[data-schematic="pull-mode-label"]');
    circuitContactLabel = target.querySelector('[data-schematic="contact-label"]');
    circuitLogicLabel = target.querySelector('[data-schematic="logic-level-label"]');
    circuitPressedLabel = target.querySelector('[data-schematic="pressed-label"]');
    circuitPullBranchLabel = target.querySelector('[data-schematic="pull-branch-label"]');
    circuitRuntimeHint = target.querySelector('[data-schematic="runtime-hint"]');

    target.querySelector('[data-action="start"]').addEventListener("click", start);
    target.querySelector('[data-action="reset"]').addEventListener("click", reset);
    for (const button of modeButtons) {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    }
    for (const button of scenarioButtons) {
      button.addEventListener("click", () => setScenario(button.dataset.scenario));
    }
    for (const button of contactButtons) {
      button.addEventListener("click", () => applyContactReference(button.dataset.contactReference));
    }
    target.querySelector('[data-action="repeat-floating"]').addEventListener("click", repeatFloatingMeasurement);
    target.querySelector('[data-action="bounce-press"]').addEventListener("click", () => renderBounceTrace(true));
    target.querySelector('[data-action="bounce-release"]').addEventListener("click", () => renderBounceTrace(false));
    bounceCursor.addEventListener("input", renderBounceCursor);
    for (const button of assistantActionButtons) {
      button.addEventListener("click", () => requestAssistantAction(button.dataset.assistantAction));
      button.disabled = !assistantClient;
    }
    assistantApplyButton.addEventListener("click", applyAssistantProposal);
    buttonToggle.addEventListener("click", () => {
      applyButtonState(!state.pressed);
    });

    sourceArea.addEventListener("input", () => {
      const nextSource = sourceArea.value;
      if (nextSource === state.source) return;
      setStartCode(nextSource);
    });

    renderFromSnapshot();
    renderAssistantProposal();
  }

  function dispose() {
    runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
  }

  return {
    id: "button-digital-input-throughput",
    title: "Durchstich · Taster → digitalRead",
    status: "Übung",
    summary: "Taster mit internem Pull-Widerstand über GPIO 4 einlesen.",
    mount,
    loadTemplate,
    dispose,
  };
}
