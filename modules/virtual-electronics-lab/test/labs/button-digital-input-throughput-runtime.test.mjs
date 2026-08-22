import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  COMMAND_TYPES,
  createButtonDigitalInputThroughputRuntime,
} from "../../labs/button-digital-input-throughput-runtime.mjs";
import { DIGITAL_INPUT_PROGRAM_START_CODE } from "../../virtual-mcu/digital-input-program-runtime.mjs";
import { BUTTON_CONTACT_MODEL } from "../../input-models/button-contact.mjs";
import { DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL } from "../../virtual-mcu/digital-input-program-runtime.mjs";
import { FLOATING_DIGITAL_INPUT_MODEL } from "../../input-models/floating-digital-input.mjs";

const filePath = fileURLToPath(new URL("../../labs/button-digital-input-throughput-runtime.mjs", import.meta.url));
const source = fs.readFileSync(filePath, "utf8");

function expectFrozenDeep(snapshot, prefix = "") {
  assert.equal(Object.isFrozen(snapshot), true, `frozen root: ${prefix || "<root>"}`);

  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  for (const key of Object.keys(snapshot)) {
    const value = snapshot[key];
    const next = `${prefix}${prefix ? "." : ""}${key}`;
    if (value && typeof value === "object") {
      assert.equal(Object.isFrozen(value), true, next);
      expectFrozenDeep(value, next);
    }
  }
}

const PULL_DOWN_START_CODE = DIGITAL_INPUT_PROGRAM_START_CODE.replace("INPUT_PULLUP", "INPUT_PULLDOWN");
const PULL_UP_START_CODE = DIGITAL_INPUT_PROGRAM_START_CODE;
const INPUT_START_CODE = DIGITAL_INPUT_PROGRAM_START_CODE.replace("INPUT_PULLUP", "INPUT");
const BAD_SOURCE = `int buttonState = LOW;\n\nvoid setup() {\n  pinMode(4, INPUT_PULLUP)\n}\n\nvoid loop() {\n  buttonState = digitalRead(4);\n}`;

test("Defaultzustand und vollständiger LabProject-Vorläufer", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();
  const snapshot = runtime.getSnapshot();

  assert.equal(snapshot.pressed, false);
  assert.equal(snapshot.contactReferenceMode, "auto");
  assert.equal(snapshot.sourceFile, DIGITAL_INPUT_PROGRAM_START_CODE);
  assert.equal(snapshot.floatingSampleIndex, 0);
  assert.equal(snapshot.measurement, null);
  assert.equal(snapshot.error, null);
  assert.equal(snapshot.errorSource, null);
  assert.equal(snapshot.pressed, snapshot.labProject.button.pressed);
  assert.equal(snapshot.contactReferenceMode, snapshot.labProject.button.contactReferenceMode);
  assert.equal(snapshot.labProject.button.floatingSampleIndex, 0);

  const labProject = snapshot.labProject;
  assert.equal(labProject.schemaVersion, "1.1.0");
  assert.equal(labProject.metadata.id, "elab-seq-005-button-digital-input-throughput");
  assert.equal(labProject.controller.sourceFile, DIGITAL_INPUT_PROGRAM_START_CODE);
  assert.equal(labProject.button.pin, 4);
  assert.equal(labProject.button.pressed, false);
  assert.equal(labProject.button.contactReferenceMode, "auto");
  assert.equal(labProject.modelVersions.buttonContact, BUTTON_CONTACT_MODEL.modelVersion);
  assert.equal(labProject.modelVersions.digitalInputProgramRuntime, DIGITAL_INPUT_PROGRAM_RUNTIME_MODEL.modelVersion);
  assert.equal(labProject.modelVersions.floatingDigitalInput, FLOATING_DIGITAL_INPUT_MODEL.modelVersion);
});

test("Factory-Options bleiben unveraendert", () => {
  const options = {
    pressed: true,
    sourceFile: PULL_DOWN_START_CODE,
    contactReferenceMode: "vcc",
  };
  const optionsCopy = structuredClone(options);

  createButtonDigitalInputThroughputRuntime(options);
  assert.deepEqual(options, optionsCopy);
});

test("Factory normalisiert ungültigen contactReferenceMode auf auto und gibt ihn im Snapshot zurück", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    contactReferenceMode: "invalid",
  });
  const snapshot = runtime.getSnapshot();

  assert.equal(snapshot.contactReferenceMode, "auto");
  assert.equal(snapshot.labProject.button.contactReferenceMode, "auto");
});

test("Factory normalisiert den initialen pressed-Wert konsistent ins LabProject", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({ pressed: true });
  const snapshot = runtime.getSnapshot();

  assert.equal(snapshot.pressed, true);
  assert.equal(snapshot.labProject.button.pressed, true);
});

test("Factory normalisiert non-Boolean gedrueckten Startwert konsistent auf false", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({ pressed: 1 });
  const snapshot = runtime.getSnapshot();

  assert.equal(snapshot.pressed, false);
  assert.equal(snapshot.labProject.button.pressed, false);
});

test("Golden Cases für Pull-Up/Pull-Down und pressed/logic", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({ sourceFile: PULL_UP_START_CODE });
  const upFalse = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const upFalseMeasurement = runtime.getSnapshot().measurement;

  assert.equal(upFalse.ok, true);
  assert.equal(upFalse.measurement.pressed, false);
  assert.equal(upFalse.measurement.pullMode, "INPUT_PULLUP");
  assert.equal(upFalse.measurement.buttonContactPullMode, "pull-up");
  assert.equal(upFalse.measurement.logicLevel, "HIGH");
  assert.equal(upFalse.measurement.normalizedValue, 1);
  assert.equal(upFalse.measurement.buttonState, 1);
  assert.equal(upFalse.measurement.normalizedValue, upFalse.measurement.buttonState);
  expectFrozenDeep(upFalse.measurement);
  assert.equal(Object.isFrozen(upFalse.measurement.warnings), true);
  assert.equal(Object.isFrozen(upFalse.measurement.modelVersions), true);

  runtime.dispatch({ type: COMMAND_TYPES.SetButtonPressed, pressed: true });
  const upTrue = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const upTrueMeasurement = runtime.getSnapshot().measurement;
  assert.equal(upTrue.ok, true);
  assert.equal(upTrue.measurement.pressed, true);
  assert.equal(upTrue.measurement.pullMode, "INPUT_PULLUP");
  assert.equal(upTrue.measurement.logicLevel, "LOW");
  assert.equal(upTrue.measurement.normalizedValue, 0);
  assert.equal(upTrue.measurement.buttonState, 0);
  assert.equal(upTrue.measurement.normalizedValue, upTrue.measurement.buttonState);
  expectFrozenDeep(upTrue.measurement);
  assert.equal(Object.isFrozen(upTrue.measurement.warnings), true);
  assert.equal(Object.isFrozen(upTrue.measurement.modelVersions), true);

  const downRuntime = createButtonDigitalInputThroughputRuntime({ sourceFile: PULL_DOWN_START_CODE });
  const downFalse = downRuntime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const downFalseMeasurement = downRuntime.getSnapshot().measurement;
  assert.equal(downFalse.ok, true);
  assert.equal(downFalse.measurement.pressed, false);
  assert.equal(downFalse.measurement.pullMode, "INPUT_PULLDOWN");
  assert.equal(downFalse.measurement.buttonContactPullMode, "pull-down");
  assert.equal(downFalse.measurement.logicLevel, "LOW");
  assert.equal(downFalse.measurement.normalizedValue, 0);
  assert.equal(downFalse.measurement.buttonState, 0);
  assert.equal(downFalse.measurement.normalizedValue, downFalse.measurement.buttonState);
  expectFrozenDeep(downFalse.measurement);
  assert.equal(Object.isFrozen(downFalse.measurement.warnings), true);
  assert.equal(Object.isFrozen(downFalse.measurement.modelVersions), true);

  downRuntime.dispatch({ type: COMMAND_TYPES.SetButtonPressed, pressed: true });
  const downTrue = downRuntime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const downTrueMeasurement = downRuntime.getSnapshot().measurement;
  assert.equal(downTrue.ok, true);
  assert.equal(downTrue.measurement.pressed, true);
  assert.equal(downTrue.measurement.pullMode, "INPUT_PULLDOWN");
  assert.equal(downTrue.measurement.logicLevel, "HIGH");
  assert.equal(downTrue.measurement.normalizedValue, 1);
  assert.equal(downTrue.measurement.buttonState, 1);
  assert.equal(downTrue.measurement.normalizedValue, downTrue.measurement.buttonState);
  expectFrozenDeep(downTrue.measurement);
  assert.equal(Object.isFrozen(downTrue.measurement.warnings), true);
  assert.equal(Object.isFrozen(downTrue.measurement.modelVersions), true);
});

test("INPUT-Modus erzeugt Floating-Verlauf beim gelösten Taster", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: INPUT_START_CODE,
    contactReferenceMode: "auto",
  });

  const open0 = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(open0.ok, true);
  assert.equal(open0.measurement.pullMode, "INPUT");
  assert.equal(open0.measurement.floatingSampleIndex, 0);
  assert.equal(open0.measurement.sampleIndex, 0);
  assert.equal(open0.measurement.normalizedValue, 0);
  assert.equal(open0.measurement.logicLevel, "LOW");
  assert.equal(open0.measurement.buttonState, 0);
  assert.equal(open0.measurement.warnings.length, 1);
  assert.equal(open0.measurement.warnings[0].code, "DIGITAL_INPUT_FLOATING_IDEALIZED");

  runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
  const open1 = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(open1.ok, true);
  assert.equal(open1.measurement.floatingSampleIndex, 1);
  assert.equal(open1.measurement.sampleIndex, 1);
  assert.equal(open1.measurement.normalizedValue, 1);
  assert.equal(open1.measurement.logicLevel, "HIGH");
  assert.equal(open1.measurement.warnings[0].code, "DIGITAL_INPUT_FLOATING_IDEALIZED");

  runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
  const open2 = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(open2.measurement.sampleIndex, 2);
  assert.equal(open2.measurement.normalizedValue, 1);
  assert.equal(open2.measurement.buttonState, 1);

  runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
  const open3 = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(open3.measurement.sampleIndex, 3);
  assert.equal(open3.measurement.normalizedValue, 0);
  assert.equal(open3.measurement.logicLevel, "LOW");
  assert.equal(open3.measurement.buttonState, 0);
});

test("INPUT-Modus nutzt VCC/GND-Schließung ohne Floating-Warnung", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({ sourceFile: INPUT_START_CODE });
  runtime.dispatch({ type: COMMAND_TYPES.SetButtonPressed, pressed: true });
  const pressedAuto = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });

  assert.equal(pressedAuto.ok, true);
  assert.equal(pressedAuto.measurement.contactReference, "gnd");
  assert.equal(pressedAuto.measurement.logicLevel, "LOW");
  assert.equal(pressedAuto.measurement.buttonState, 0);
  assert.equal(pressedAuto.measurement.warnings.length, 0);

  runtime.dispatch({ type: COMMAND_TYPES.SetContactReference, contactReferenceMode: "vcc" });
  const pressedVcc = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(pressedVcc.ok, true);
  assert.equal(pressedVcc.measurement.contactReference, "vcc");
  assert.equal(pressedVcc.measurement.logicLevel, "HIGH");
  assert.equal(pressedVcc.measurement.buttonState, 1);
  assert.equal(pressedVcc.measurement.warnings.length, 0);
});

test("AdvanceFloatingSample ist command-basiert und zyklisch", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({ sourceFile: INPUT_START_CODE });

  let result = runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
  assert.equal(result.floatingSampleIndex, 1);
  assert.equal(runtime.getSnapshot().measurement, null);

  for (let index = 0; index < 64; index += 1) {
    result = runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
  }
  assert.equal(result.floatingSampleIndex, 1);
  assert.equal(runtime.getSnapshot().floatingSampleIndex, 1);
});

test("ResetSimulation setzt Floating-Sampleindex zurück", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({ sourceFile: INPUT_START_CODE });
  runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
  runtime.dispatch({ type: COMMAND_TYPES.AdvanceFloatingSample });
  assert.equal(runtime.getSnapshot().floatingSampleIndex, 2);

  runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
  assert.equal(runtime.getSnapshot().floatingSampleIndex, 0);
  assert.equal(runtime.getSnapshot().measurement, null);
});

test("Kontaktreferenzmodus wird als State und in der Messung gemeldet", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_UP_START_CODE,
    contactReferenceMode: "gnd",
  });

  const upFalse = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(upFalse.ok, true);
  assert.equal(upFalse.measurement.contactReferenceMode, "gnd");
  assert.equal(upFalse.measurement.contactReference, "gnd");
  assert.equal(upFalse.measurement.buttonContactPullMode, "pull-up");
  assert.equal(upFalse.measurement.logicLevel, "HIGH");
  assert.equal(upFalse.measurement.normalizedValue, 1);
  assert.equal(upFalse.measurement.buttonState, 1);
  assert.equal(upFalse.warnings.length, 0);
  assert.equal(Object.isFrozen(upFalse.warnings), true);

  runtime.dispatch({
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: "vcc",
  });
  const upFalseVcc = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(upFalseVcc.ok, true);
  assert.equal(upFalseVcc.measurement.contactReferenceMode, "vcc");
  assert.equal(upFalseVcc.measurement.contactReference, "vcc");
  assert.equal(upFalseVcc.measurement.logicLevel, "HIGH");
  assert.equal(upFalseVcc.measurement.normalizedValue, 1);
  assert.equal(upFalseVcc.measurement.buttonState, 1);
  assert.equal(upFalseVcc.warnings.length, 0);
  assert.equal(Object.isFrozen(upFalseVcc.warnings), true);
  assert.deepEqual(upFalseVcc.warnings, upFalseVcc.measurement.warnings);
});

test("SetContactReference akzeptiert nur auto/gnd/vcc und ist auf Command-Niveau stabil", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();
  const invalid = runtime.dispatch({
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: "invalid",
  });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors[0].code, "BUTTON_DIGITAL_RUNTIME_COMMAND_INVALID");
  assert.equal(runtime.getSnapshot().contactReferenceMode, "auto");

  assert.equal(runtime.dispatch({
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: 3,
  }).ok, false);
});

test("SetContactReference Commandobjekt bleibt unveraendert", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();
  const command = {
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: "vcc",
  };
  const commandCopy = structuredClone(command);

  runtime.dispatch(command);
  assert.deepEqual(command, commandCopy);
});

test("SetContactReference in Verbindung mit StartSimulation aktualisiert die Verdrahtung", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_UP_START_CODE,
  });

  const defaultModeBefore = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(defaultModeBefore.measurement.logicLevel, "HIGH");
  assert.equal(defaultModeBefore.measurement.buttonState, 1);

  runtime.dispatch({
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: "gnd",
  });
  const gndMode = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(gndMode.measurement.logicLevel, "HIGH");
  assert.equal(gndMode.measurement.normalizedValue, 1);
  assert.equal(gndMode.measurement.buttonState, 1);
  assert.equal(gndMode.measurement.contactReferenceMode, "gnd");
  assert.equal(gndMode.measurement.contactReference, "gnd");
});

test("Tasteränderung erfolgt nur über Command und löscht Messung/Fehler", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({ sourceFile: PULL_UP_START_CODE });

  const baseline = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(baseline.ok, true);
  assert.equal(runtime.getSnapshot().measurement.buttonState, 1);

  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: BAD_SOURCE,
  });
  const badRun = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(badRun.ok, false);
  assert.equal(runtime.getSnapshot().errorSource, "digital-input-program-runtime");

  const pressedCommand = {
    type: COMMAND_TYPES.SetButtonPressed,
    pressed: true,
  };
  assert.equal(runtime.dispatch(pressedCommand).ok, true);
  assert.equal(runtime.getSnapshot().measurement, null);
  assert.equal(runtime.getSnapshot().error, null);
  assert.equal(runtime.getSnapshot().errorSource, null);

  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: PULL_UP_START_CODE,
  });
  const afterPressed = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(afterPressed.ok, true);
  assert.equal(runtime.getSnapshot().measurement.buttonState, 0);
});

test("SetContactReference löscht Messung und Fehler", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_DOWN_START_CODE,
    contactReferenceMode: "gnd",
  });

  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(runtime.getSnapshot().measurement.buttonState, 0);
  assert.equal(runtime.getSnapshot().error, null);

  runtime.dispatch({ type: COMMAND_TYPES.SetContactReference, contactReferenceMode: "vcc" });
  assert.equal(runtime.getSnapshot().measurement, null);
  assert.equal(runtime.getSnapshot().error, null);

  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: BAD_SOURCE,
  });
  const badRun = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(badRun.ok, false);

  runtime.dispatch({
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: "gnd",
  });
  assert.equal(runtime.getSnapshot().measurement, null);
  assert.equal(runtime.getSnapshot().error, null);
  assert.equal(runtime.getSnapshot().errorSource, null);
});

test("Reparatur-Case: Fehlverdrahtung -> Korrektur via SetContactReference", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_UP_START_CODE,
    contactReferenceMode: "vcc",
  });

  runtime.dispatch({
    type: COMMAND_TYPES.SetButtonPressed,
    pressed: true,
  });
  const miswired = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(miswired.ok, true);
  assert.equal(miswired.measurement.logicLevel, "HIGH");
  assert.equal(miswired.measurement.normalizedValue, 1);
  assert.equal(miswired.measurement.buttonState, 1);
  assert.equal(miswired.measurement.warnings.length, 1);
  assert.equal(miswired.measurement.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
  assert.equal(miswired.warnings.length, 1);
  assert.equal(Object.isFrozen(miswired.warnings), true);
  assert.deepEqual(miswired.warnings, miswired.measurement.warnings);

  runtime.dispatch({
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: "gnd",
  });
  assert.equal(runtime.getSnapshot().measurement, null);
  assert.equal(runtime.getSnapshot().error, null);

  const repaired = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(repaired.ok, true);
  assert.equal(repaired.measurement.logicLevel, "LOW");
  assert.equal(repaired.measurement.normalizedValue, 0);
  assert.equal(repaired.measurement.buttonState, 0);
  assert.equal(repaired.measurement.warnings.length, 0);
  assert.equal(repaired.warnings.length, 0);
  assert.equal(Object.isFrozen(repaired.warnings), true);
});

test("UpdateSourceFile + Simulationsfehler erhält contactReferenceMode in Snapshot und LabProject", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_UP_START_CODE,
    contactReferenceMode: "gnd",
  });

  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: BAD_SOURCE,
  });
  const failed = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(failed.ok, false);

  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.contactReferenceMode, "gnd");
  assert.equal(snapshot.labProject.button.contactReferenceMode, "gnd");
});

test("Fehlverdrahtung bei Input-Pullup + Kontakt nach VCC löst Warnung beim Druck aus", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_UP_START_CODE,
    contactReferenceMode: "vcc",
  });

  const base = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(base.ok, true);
  assert.equal(base.measurement.warnings.length, 0);
  assert.equal(base.measurement.contactReferenceMode, "vcc");
  assert.equal(base.measurement.contactReference, "vcc");

  runtime.dispatch({ type: COMMAND_TYPES.SetButtonPressed, pressed: true });
  const pressed = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(pressed.ok, true);
  assert.equal(pressed.measurement.logicLevel, "HIGH");
  assert.equal(pressed.measurement.normalizedValue, 1);
  assert.equal(pressed.measurement.buttonState, 1);
  assert.equal(pressed.measurement.warnings.length, 1);
  assert.equal(pressed.warnings.length, 1);
  assert.equal(Object.isFrozen(pressed.warnings), true);
  assert.deepEqual(pressed.warnings, pressed.measurement.warnings);
  assert.equal(pressed.measurement.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
});

test("Fehlverdrahtung bei Input-Pulldown + Kontakt nach GND löst Warnung beim Druck aus", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_DOWN_START_CODE,
    contactReferenceMode: "gnd",
  });

  const base = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(base.ok, true);
  assert.equal(base.measurement.warnings.length, 0);
  assert.equal(base.measurement.contactReferenceMode, "gnd");
  assert.equal(base.measurement.contactReference, "gnd");

  runtime.dispatch({ type: COMMAND_TYPES.SetButtonPressed, pressed: true });
  const pressed = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(pressed.ok, true);
  assert.equal(pressed.measurement.logicLevel, "LOW");
  assert.equal(pressed.measurement.normalizedValue, 0);
  assert.equal(pressed.measurement.buttonState, 0);
  assert.equal(pressed.measurement.warnings.length, 1);
  assert.equal(pressed.warnings.length, 1);
  assert.equal(Object.isFrozen(pressed.warnings), true);
  assert.deepEqual(pressed.warnings, pressed.measurement.warnings);
  assert.equal(pressed.measurement.warnings[0].code, "BUTTON_CONTACT_NO_LEVEL_CHANGE");
});

test("Kontaktverdrahtung ohne Betätigung erzeugt keine Fehlverdrahtungswarnung", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    sourceFile: PULL_UP_START_CODE,
    contactReferenceMode: "vcc",
  });

  const upOpen = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(upOpen.ok, true);
  assert.equal(upOpen.measurement.warnings.length, 0);

  runtime.dispatch({
    type: COMMAND_TYPES.SetContactReference,
    contactReferenceMode: "gnd",
  });

  const pulledGnd = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(pulledGnd.ok, true);
  assert.equal(pulledGnd.measurement.warnings.length, 0);
});

test("Quellcodewechsel Pull-Up nach Pull-Down über Command löscht den Zustand und löscht vorherigen Fehler", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();

  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: BAD_SOURCE,
  });
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(runtime.getSnapshot().errorSource, "digital-input-program-runtime");

  const update = runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: PULL_DOWN_START_CODE,
  });
  assert.equal(update.ok, true);
  assert.equal(runtime.getSnapshot().measurement, null);
  assert.equal(runtime.getSnapshot().error, null);

  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(runtime.getSnapshot().measurement.pullMode, "INPUT_PULLDOWN");
});

test("Syntaxfehler des Interpreters wird unverändert durchgereicht", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();
  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: BAD_SOURCE,
  });

  const start = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const snapshot = runtime.getSnapshot();

  assert.equal(start.ok, false);
  assert.equal(start.errorSource, "digital-input-program-runtime");
  assert.equal(snapshot.errorSource, "digital-input-program-runtime");
  assert.equal(snapshot.error[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
});

test("Ungültige und unbekannte Commands liefern stabile Fehlercodes", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();

  const missingType = runtime.dispatch({});
  assert.equal(missingType.ok, false);
  assert.equal(missingType.errors[0].code, "BUTTON_DIGITAL_RUNTIME_COMMAND_INVALID");

  const badSet = runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: 1,
  });
  assert.equal(badSet.ok, false);
  assert.equal(badSet.errors[0].code, "BUTTON_DIGITAL_RUNTIME_COMMAND_INVALID");

  const unknown = runtime.dispatch({ type: "Unknown" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.errors[0].code, "BUTTON_DIGITAL_RUNTIME_COMMAND_NOT_SUPPORTED");
});

test("ResetSimulation setzt Runtime, Messung und Fehler zurück", () => {
  const runtime = createButtonDigitalInputThroughputRuntime({
    pressed: true,
    sourceFile: BAD_SOURCE,
  });

  const invalid = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  assert.equal(invalid.ok, false);
  assert.equal(runtime.getSnapshot().measurement, null);
  assert.equal(runtime.getSnapshot().error[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");

  const reset = runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
  const snapshot = runtime.getSnapshot();

  assert.equal(reset.ok, true);
  assert.equal(snapshot.pressed, false);
  assert.equal(snapshot.sourceFile, DIGITAL_INPUT_PROGRAM_START_CODE);
  assert.equal(snapshot.floatingSampleIndex, 0);
  assert.equal(snapshot.contactReferenceMode, "auto");
  assert.equal(snapshot.labProject.button.contactReferenceMode, "auto");
  assert.equal(snapshot.measurement, null);
  assert.equal(snapshot.error, null);
  assert.equal(snapshot.errorSource, null);
});

test("GetSnapshot ist defensiv, tief unveränderlich und verbundenkeitsfrei", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();
  runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const snapshot = runtime.getSnapshot();
  expectFrozenDeep(snapshot);

  assert.throws(() => {
    snapshot.measurement.buttonState = 99;
  }, { name: "TypeError" });
  assert.throws(() => {
    snapshot.labProject.controller.sourceFile = "x";
  }, { name: "TypeError" });
});

test("Fehlerobjekte sind vom Snapshot entkoppelt", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();
  runtime.dispatch({
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: BAD_SOURCE,
  });

  const badStart = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const before = runtime.getSnapshot();
  assert.equal(badStart.ok, false);

  assert.throws(() => {
    badStart.errors[0].code = "MUTATED";
  }, { name: "TypeError" });
  const after = runtime.getSnapshot();

  assert.equal(before.error[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
  assert.equal(after.error[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
  assert.equal(before.error[0].code, after.error[0].code);
  assert.equal(runtime.getSnapshot().error[0].code, "DIGITAL_INPUT_PROGRAM_SYNTAX_ERROR");
});

test("Input- und Commandobjekte bleiben unveraendert durch den Laufzeitaufruf", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();

  const command = {
    type: COMMAND_TYPES.UpdateSourceFile,
    sourceFile: PULL_DOWN_START_CODE,
  };
  const commandCopy = structuredClone(command);

  runtime.dispatch(command);
  assert.deepEqual(command, commandCopy);
  assert.equal(runtime.getSnapshot().sourceFile, PULL_DOWN_START_CODE);

  const startCommand = {
    type: COMMAND_TYPES.StartSimulation,
  };
  const startCommandCopy = structuredClone(startCommand);

  const startResult = runtime.dispatch(startCommand);
  assert.equal(startResult.ok, true);
  assert.deepEqual(startCommand, startCommandCopy);
  expectFrozenDeep(startResult.measurement);
});

test("Wiederholte Simulation ist deterministisch", () => {
  const runtime = createButtonDigitalInputThroughputRuntime();
  const first = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const firstSnapshot = runtime.getSnapshot().measurement;
  assert.equal(first.ok, true);

  const second = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
  const secondSnapshot = runtime.getSnapshot().measurement;

  assert.equal(second.ok, true);
  assert.deepEqual(firstSnapshot, secondSnapshot);
});

test("Direkter Import der Kernmodelle statt eigener Logik (Parser/Taster)", () => {
  assert.equal(source.includes("evaluateButtonContact"), true);
  assert.equal(source.includes("executeDigitalInputProgram"), true);
  assert.equal(source.includes("evaluateFloatingDigitalInput"), true);
  assert.equal(source.includes("findFunction("), false);
  assert.equal(source.includes("resolveButtonLevel"), false);
});

test("keine verbotenen Laufzeitkonstrukte in der Runtime-Datei", () => {
  const forbidden = [
    "eval(",
    "new Function",
    "WebAssembly",
    "Date(",
    "Date.",
    "Math.random",
    "fetch(",
    "XMLHttpRequest",
    "localStorage",
    "sessionStorage",
    "process.env",
    "require(",
    "net.",
  ];

  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `forbidden token found: ${token}`);
  }
});
