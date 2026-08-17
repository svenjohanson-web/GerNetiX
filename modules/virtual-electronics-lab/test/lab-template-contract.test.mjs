import assert from "node:assert/strict";
import test from "node:test";
import { LAB_TEMPLATE_CONTRACT, validateLabTemplate } from "../lab-template-contract.mjs";

const validTemplateDraft = {
  id: "elab-tpl-gpio-led-basic-01",
  version: "1.2.0",
  title: "GPIO-Led Grundaufbau",
  shortDescription: "Kompaktes Startmodell für LED-Beschaltung mit Messpunkten am Knoten.",
  area: "basic-circuit",
  entry: {
    labId: "gpio-led-throughput",
    runtimeEntrypoint: "createGpioLedThroughputLab",
    presetId: "digital",
  },
  recommendedInstruments: ["Multimeter", "  Logic-Analyzer ", "multimeter", "  oscilloscope "],
  recommendedMeasurementPoints: [
    { id: "D1", label: "Digitaler Eingang A" },
    { id: "VLED", label: "LED-Spannung" },
  ],
  startCode: "int ledPin = 13;",
  modelLimits: {
    minVoltageV: 0,
    maxVoltageV: 3.3,
    maxCurrentA: 0.05,
    minTemperatureC: -20,
    maxTemperatureC: 85,
    maxRuntimeMs: 250,
  },
  access: {
    visibility: "public",
    requiresAuthentication: false,
    capabilities: ["simulation", "measurement"],
  },
};

function assertDeepFrozen(value) {
  assert.equal(Object.isFrozen(value), true);
  for (const entry of Object.values(value)) {
    if (entry && typeof entry === "object") {
      assertDeepFrozen(entry);
    }
  }
}

function template(overrides = {}) {
  return {
    ...validTemplateDraft,
    ...overrides,
    entry: {
      ...validTemplateDraft.entry,
      ...(overrides.entry || {}),
    },
    access: {
      ...validTemplateDraft.access,
      ...(overrides.access || {}),
    },
    modelLimits: {
      ...validTemplateDraft.modelLimits,
      ...(overrides.modelLimits || {}),
    },
    recommendedMeasurementPoints:
      overrides.recommendedMeasurementPoints ?? validTemplateDraft.recommendedMeasurementPoints,
    recommendedInstruments:
      overrides.recommendedInstruments ?? validTemplateDraft.recommendedInstruments,
  };
}

test("normalisiert eine gültige Vorlage deterministisch und eingefroren", () => {
  const result = validateLabTemplate(template());
  assert.equal(result.ok, true);
  assert.equal(result.template.schemaVersion, LAB_TEMPLATE_CONTRACT.schemaVersion);
  assert.equal(result.template.id, validTemplateDraft.id);
  assert.equal(result.template.area, "basic-circuit");
  assert.deepEqual(result.template.entry, {
    labId: "gpio-led-throughput",
    runtimeEntrypoint: "createGpioLedThroughputLab",
    presetId: "digital",
  });
  assert.deepEqual(result.template.recommendedInstruments, ["Logic-Analyzer", "Multimeter", "oscilloscope"]);
  assert.deepEqual(result.template.recommendedMeasurementPoints, [
    { id: "D1", label: "Digitaler Eingang A" },
    { id: "VLED", label: "LED-Spannung" },
  ]);
  assert.deepEqual(result.template.access.capabilities, ["measurement", "simulation"]);
  assertDeepFrozen(result.template);
  assert.equal(result.template.startCode, "int ledPin = 13;");
  assert.equal(validateLabTemplate(result.template).ok, true);
});

test("akzeptiert Umlaut-Zeichen in Messpunkt-Labels", () => {
  const result = validateLabTemplate(template({
    recommendedMeasurementPoints: [{ id: "TMP", label: "Spannung am Öfteren / Ausgang & Rückleitung" }],
  }));
  assert.equal(result.ok, true);
  assert.equal(result.template.recommendedMeasurementPoints[0].label, "Spannung am Öfteren / Ausgang & Rückleitung");
});

test("verwirft Steuerzeichen in Messpunkt-Label", () => {
  const result = validateLabTemplate(template({
    recommendedMeasurementPoints: [{ id: "TMP", label: "Linie\nmit\nNeuzeile" }],
  }));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_TPL_MEASUREMENT_POINTS_INVALID");
});

test("verwirft unbekannte Top-Level-Felder", () => {
  const result = validateLabTemplate({ ...template(), unknownField: "x" });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_TPL_UNKNOWN_TOP_LEVEL_KEYS");
});

test("liefert stabile Fehlercodes bei ungültigem Bereich", () => {
  const result = validateLabTemplate(template({ area: "freier-modus" }));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_TPL_AREA_INVALID");
  assert.equal(result.errors.length, 1);
});

test("verwirft Zugangsmetadaten mit Tarif- oder Planfeldern", () => {
  const result = validateLabTemplate(template({
    access: {
      visibility: "public",
      requiresAuthentication: false,
      tariff: "professional",
    },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_TPL_ACCESS_INVALID");
});

test("verwirft access-Konsistenz bei Sichtbarkeit/Authentifizierung", () => {
  assert.equal(validateLabTemplate(template({
    access: { visibility: "public", requiresAuthentication: true },
  })).errors?.[0].code, "ELAB_TPL_ACCESS_INVALID");

  assert.equal(validateLabTemplate(template({
    access: { visibility: "signed-in", requiresAuthentication: false },
  })).errors?.[0].code, "ELAB_TPL_ACCESS_INVALID");
});

test("verwirft Modellgrenzen, die als Strings kommen oder Runtime ungültig ist", () => {
  assert.equal(
    validateLabTemplate(template({
      modelLimits: { ...validTemplateDraft.modelLimits, maxVoltageV: "3.3" },
    })).errors?.[0].code,
    "ELAB_TPL_MODEL_LIMITS_INVALID",
  );

  assert.equal(
    validateLabTemplate(template({
      modelLimits: { ...validTemplateDraft.modelLimits, maxRuntimeMs: 0 },
    })).errors?.[0].code,
    "ELAB_TPL_MODEL_LIMITS_INVALID",
  );
});

test("lehnt unterschiedliche Duplikate bei Messpunkt-IDs ab", () => {
  const result = validateLabTemplate(template({
    recommendedMeasurementPoints: [
      { id: "D1", label: "Digitaler Eingang A" },
      { id: "D1", label: "anders benannt" },
    ],
  }));
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "ELAB_TPL_MEASUREMENT_POINTS_INVALID");
});

test("verwirft unbekannte Felder in entry und Modellgrenzen", () => {
  assert.equal(
    validateLabTemplate(template({
      entry: { ...validTemplateDraft.entry, legacyMode: true },
    })).errors?.[0].code,
    "ELAB_TPL_ENTRY_INVALID",
  );

  assert.equal(
    validateLabTemplate(template({
      modelLimits: { ...validTemplateDraft.modelLimits, reserved: 1 },
    })).errors?.[0].code,
    "ELAB_TPL_MODEL_LIMITS_INVALID",
  );
});

test("liefert bei gültigem Input keine leeren oder verbotenen Zugriffsfelder mehr", () => {
  const result = validateLabTemplate(template());
  assert.equal(result.ok, true);
  const source = Object.keys(result.template.access);
  assert.deepEqual(source.includes("tariff"), false);
  assert.deepEqual(source.includes("plan"), false);
  assert.deepEqual(source.includes("provider"), false);
  assert.deepEqual(result.template.access, {
    visibility: "public",
    requiresAuthentication: false,
    capabilities: ["measurement", "simulation"],
  });
});
