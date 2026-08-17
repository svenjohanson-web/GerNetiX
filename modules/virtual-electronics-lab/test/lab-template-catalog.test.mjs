import assert from "node:assert/strict";
import test from "node:test";

import * as gpioLedModule from "../labs/gpio-led-throughput.js";
import * as pt1000Module from "../labs/pt1000-adc-throughput.js";
import * as buttonModule from "../labs/button-digital-input-throughput.js";
import * as freeCircuitModule from "../labs/free-circuit-simulation.js";
import { ELAB_DS_001_START_CODE, ELAB_DS_002_PWM_START_CODE } from "../labs/gpio-led-throughput-runtime.js";
import { ADC_PROGRAM_START_CODE } from "../virtual-mcu/adc-program-runtime.mjs";
import { DIGITAL_INPUT_PROGRAM_START_CODE } from "../virtual-mcu/digital-input-program-runtime.mjs";
import { BUTTON_DEBOUNCE_PROGRAM_START_CODE } from "../virtual-mcu/button-debounce-program-runtime.mjs";
import { LED_CURRENT_CONTROL_PROGRAM_START_CODE } from "../virtual-mcu/led-current-control-program-runtime.mjs";
import { validateLabTemplate } from "../lab-template-contract.mjs";
import {
  ELAB_TPL_IDS,
  ELAB_TPL_CATALOG,
  ELAB_TPL_CATALOG_LIST,
  listLabTemplates,
  getLabTemplate,
} from "../lab-template-catalog.mjs";

const BUTTON_PULLUP_START_CODE = DIGITAL_INPUT_PROGRAM_START_CODE;
const BUTTON_INPUT_START_CODE = DIGITAL_INPUT_PROGRAM_START_CODE.replace("INPUT_PULLUP", "INPUT");
const BUTTON_DEBOUNCE_SHORT_START_CODE = BUTTON_DEBOUNCE_PROGRAM_START_CODE.replace(
  "const unsigned long debounceUs = 700;",
  "const unsigned long debounceUs = 300;",
);
const BUTTON_DEBOUNCE_LONG_START_CODE = BUTTON_DEBOUNCE_PROGRAM_START_CODE.replace(
  "const unsigned long debounceUs = 700;",
  "const unsigned long debounceUs = 2000;",
);

const EXPECTED_IDS = [
  "elab-tpl-button-bounce",
  "elab-tpl-button-bounce-long",
  "elab-tpl-button-bounce-short",
  "elab-tpl-button-missing-pull",
  "elab-tpl-button-miswired",
  "elab-tpl-button-pullup",
  "elab-tpl-free-dc-divider",
  "elab-tpl-free-empty",
  "elab-tpl-free-rc-charge",
  "elab-tpl-gpio-led-digital",
  "elab-tpl-gpio-led-pwm",
  "elab-tpl-led-current-control",
  "elab-tpl-pt1000-adc-divider",
];

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") {
    return;
  }

  assert.equal(Object.isFrozen(value), true);
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertDeepFrozen(entry);
    }
  } else {
    for (const entry of Object.values(value)) {
      assertDeepFrozen(entry);
    }
  }
}

test("listet den vollständigen ELAB-TPL-002-Katalog", () => {
  assert.deepEqual(ELAB_TPL_IDS, EXPECTED_IDS);
  assert.equal(ELAB_TPL_CATALOG_LIST.length, EXPECTED_IDS.length);
  assert.deepEqual(ELAB_TPL_CATALOG_LIST.map((template) => template.id), EXPECTED_IDS);
});

test("liefert deterministische Reihenfolge aus listLabTemplates", () => {
  const snapshotOne = listLabTemplates().map((template) => template.id);
  const snapshotTwo = listLabTemplates().map((template) => template.id);
  assert.equal(snapshotOne.length, EXPECTED_IDS.length);
  assert.deepEqual(snapshotOne, EXPECTED_IDS);
  assert.deepEqual(snapshotTwo, EXPECTED_IDS);
});
test("stellt stabile eindeutige IDs sicher", () => {
  const ids = ELAB_TPL_CATALOG_LIST.map((template) => template.id);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length);
  assert.deepEqual(ids, ELAB_TPL_IDS);
});

test("validiert alle Katalogeinträge über den Vertrag", () => {
  for (const template of ELAB_TPL_CATALOG_LIST) {
    const result = validateLabTemplate(template);
    assert.equal(result.ok, true, `Template ungültig: ${template.id}`);
    assert.deepEqual(result.template.id, template.id);
  }
});

test("macht Katalog und Liste tief unveränderlich", () => {
  assert.equal(Object.isFrozen(ELAB_TPL_CATALOG), true);
  assert.equal(Object.isFrozen(ELAB_TPL_CATALOG_LIST), true);
  assert.equal(Object.isFrozen(listLabTemplates()), true);
  assert.deepEqual(listLabTemplates(), ELAB_TPL_CATALOG_LIST);
  assertDeepFrozen(ELAB_TPL_CATALOG);
  assertDeepFrozen(ELAB_TPL_CATALOG_LIST);
});

test("liefert unbekannte Templates mit null", () => {
  assert.equal(getLabTemplate("elab-tpl-not-found"), null);
  assert.equal(typeof getLabTemplate("elab-tpl-not-found"), "object");
  const knownId = ELAB_TPL_CATALOG_LIST[0].id;
  assert.equal(getLabTemplate(knownId), ELAB_TPL_CATALOG[knownId]);
});

test("verifiziert echte Runtime-Referenzen pro Template", () => {
  const moduleByLabId = {
    "gpio-led-throughput": gpioLedModule,
    "pt1000-adc-throughput": pt1000Module,
    "button-digital-input-throughput": buttonModule,
    "free-circuit-simulation": freeCircuitModule,
  };

  for (const template of ELAB_TPL_CATALOG_LIST) {
    const runtimeModule = moduleByLabId[template.entry.labId];
    assert.ok(runtimeModule, `Unbekannte labId im Katalog: ${template.entry.labId}`);
    assert.equal(typeof runtimeModule[template.entry.runtimeEntrypoint], "function", template.id);
  }
});

test("prüft reale Startcodes der Templates", () => {
  const expectedStartCodeById = {
    "elab-tpl-gpio-led-digital": ELAB_DS_001_START_CODE,
    "elab-tpl-gpio-led-pwm": ELAB_DS_002_PWM_START_CODE,
    "elab-tpl-free-dc-divider": "// Freie DC-Simulation: Schaltung und Messung werden über Labor-Commands verändert.",
    "elab-tpl-free-empty": "// Leere Laborfläche: Bauteile und Messpunkte werden über Labor-Commands hinzugefügt.",
    "elab-tpl-free-rc-charge": "// Freie Transientensimulation: RC-Ladevorgang mit begrenztem Zeitschrittmodell.",
    "elab-tpl-led-current-control": LED_CURRENT_CONTROL_PROGRAM_START_CODE,
    "elab-tpl-pt1000-adc-divider": ADC_PROGRAM_START_CODE,
    "elab-tpl-button-pullup": BUTTON_PULLUP_START_CODE,
    "elab-tpl-button-miswired": BUTTON_PULLUP_START_CODE,
    "elab-tpl-button-missing-pull": BUTTON_INPUT_START_CODE,
    "elab-tpl-button-bounce-short": BUTTON_DEBOUNCE_SHORT_START_CODE,
    "elab-tpl-button-bounce": BUTTON_DEBOUNCE_PROGRAM_START_CODE,
    "elab-tpl-button-bounce-long": BUTTON_DEBOUNCE_LONG_START_CODE,
  };

  for (const template of ELAB_TPL_CATALOG_LIST) {
    assert.equal(template.startCode, expectedStartCodeById[template.id]);
    assert.equal(typeof template.startCode, "string");
    assert.equal(template.startCode.length > 0, true);
  }
});
