import { normalizeCircuitDocument } from "./circuit-document-contract.mjs";
import { normalizeMeasurementSetup } from "./measurement-point-contract.mjs";

export const FREE_SIMULATION_HISTORY_LIMIT = 50;

const DOMAINS = Object.freeze(["circuit", "measurement", "system"]);

function failure(code, message) {
  return Object.freeze({ ok: false, errors: Object.freeze([Object.freeze({ code, message })]) });
}

function stateFrom(document, measurementSetup, change = null) {
  const normalizedDocument = normalizeCircuitDocument(document);
  if (!normalizedDocument.ok) return failure("ELAB_HISTORY_DOCUMENT_INVALID", normalizedDocument.errors[0]?.message || "Schaltungszustand ist ungültig.");
  const normalizedMeasurements = normalizeMeasurementSetup(measurementSetup, normalizedDocument.document);
  if (!normalizedMeasurements.ok) return failure("ELAB_HISTORY_MEASUREMENT_INVALID", normalizedMeasurements.errors[0]?.message || "Messzustand ist ungültig.");
  return Object.freeze({
    ok: true,
    state: Object.freeze({
      document: normalizedDocument.document,
      measurementSetup: normalizedMeasurements.setup,
      change: change ? Object.freeze({ domain: change.domain, commandType: change.commandType, label: change.label }) : null,
    }),
  });
}

function sameState(left, right) {
  return JSON.stringify(left.document) === JSON.stringify(right.document)
    && JSON.stringify(left.measurementSetup) === JSON.stringify(right.measurementSetup);
}

function validChange(change) {
  return change && typeof change === "object" && !Array.isArray(change)
    && Object.keys(change).every((key) => ["domain", "commandType", "label"].includes(key))
    && DOMAINS.includes(change.domain)
    && typeof change.commandType === "string" && change.commandType.length >= 1 && change.commandType.length <= 64
    && typeof change.label === "string" && change.label.trim().length >= 1 && change.label.trim().length <= 80;
}

export function createFreeSimulationHistory({ document, measurementSetup, limit = FREE_SIMULATION_HISTORY_LIMIT } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > FREE_SIMULATION_HISTORY_LIMIT) throw new TypeError("ELAB_HISTORY_LIMIT_INVALID");
  const initial = stateFrom(document, measurementSetup);
  if (!initial.ok) throw new TypeError(initial.errors[0].code);
  let states = [initial.state];
  let cursor = 0;

  function status() {
    const currentChange = states[cursor]?.change;
    const redoChange = states[cursor + 1]?.change;
    return Object.freeze({
      canUndo: cursor > 0,
      canRedo: cursor < states.length - 1,
      undoDepth: cursor,
      redoDepth: states.length - cursor - 1,
      undoLabel: currentChange?.label || null,
      redoLabel: redoChange?.label || null,
      limit,
    });
  }

  function response() {
    return Object.freeze({ ok: true, state: states[cursor], status: status() });
  }

  return Object.freeze({
    record({ change, document: nextDocument, measurementSetup: nextMeasurements } = {}) {
      if (!validChange(change)) return failure("ELAB_HISTORY_CHANGE_INVALID", "Verlaufseintrag ist ungültig.");
      const next = stateFrom(nextDocument, nextMeasurements, { ...change, label: change.label.trim() });
      if (!next.ok) return next;
      if (sameState(states[cursor], next.state)) return Object.freeze({ ...response(), recorded: false });
      states = states.slice(0, cursor + 1);
      states.push(next.state);
      if (states.length > limit + 1) states.shift();
      cursor = states.length - 1;
      return Object.freeze({ ...response(), recorded: true });
    },
    undo() {
      if (cursor === 0) return failure("ELAB_HISTORY_UNDO_EMPTY", "Keine Änderung zum Rückgängigmachen vorhanden.");
      cursor -= 1;
      return response();
    },
    redo() {
      if (cursor >= states.length - 1) return failure("ELAB_HISTORY_REDO_EMPTY", "Keine Änderung zum Wiederholen vorhanden.");
      cursor += 1;
      return response();
    },
    getStatus: status,
    getSnapshot() {
      return states[cursor];
    },
  });
}

