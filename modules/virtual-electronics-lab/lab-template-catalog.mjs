import {
  ELAB_DS_001_START_CODE,
  ELAB_DS_002_PWM_START_CODE,
} from "./labs/gpio-led-throughput-runtime.js";
import { ADC_PROGRAM_START_CODE } from "./virtual-mcu/adc-program-runtime.mjs";
import { DIGITAL_INPUT_PROGRAM_START_CODE } from "./virtual-mcu/digital-input-program-runtime.mjs";
import { BUTTON_DEBOUNCE_PROGRAM_START_CODE } from "./virtual-mcu/button-debounce-program-runtime.mjs";
import { validateLabTemplate } from "./lab-template-contract.mjs";

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

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }

  return value;
}

function assertUniqueTemplateIds(validatedCatalog) {
  const ids = new Set();

  for (const template of validatedCatalog) {
    if (ids.has(template.id)) {
      throw new Error(`doppelte Template-ID im Katalog: ${template.id}`);
    }
    ids.add(template.id);
  }

  return ids;
}

function compareTemplateIds(left, right) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function validateTemplateSet(entries) {
  const validated = [];

  for (const draft of entries) {
    const result = validateLabTemplate(draft);
    if (!result.ok) {
      const code = result.errors?.[0]?.code || "ELAB_TPL_UNKNOWN";
      const message = result.errors?.[0]?.message || "Template ungültig";
      const id = draft && typeof draft.id === "string" ? draft.id : "<unbekannt>";
      throw new Error(`Ungültiger Template-Eintrag ${id}: ${code} (${message})`);
    }
    validated.push(result.template);
  }

  const sorted = validated.slice().sort(compareTemplateIds);
  const ids = assertUniqueTemplateIds(sorted);

  const catalog = Object.freeze(
    sorted.reduce((acc, template) => {
      acc[template.id] = template;
      return acc;
    }, {}),
  );

  return {
    catalog: deepFreeze(catalog),
    list: Object.freeze(sorted),
    ids: Object.freeze(Array.from(ids).sort()),
  };
}

const TEMPLATE_ENTRIES = [
  {
    id: "elab-tpl-gpio-led-digital",
    version: "1.0.0",
    title: "GPIO → LED digital",
    shortDescription: "Erstelle die klassische LED-Schaltung mit GPIO-Ausgang im digitalen Grundbetrieb.",
    area: "basic-circuit",
    entry: {
      labId: "gpio-led-throughput",
      runtimeEntrypoint: "createGpioLedThroughputLab",
      presetId: "digital",
    },
    recommendedInstruments: ["multimeter", "logic", "oscilloscope"],
    recommendedMeasurementPoints: [
      { id: "gpio-5", label: "GPIO 5" },
      { id: "r1", label: "Vorwiderstand R1" },
      { id: "led", label: "LED Knoten" },
      { id: "vcc", label: "3,3 V" },
      { id: "gnd", label: "GND" },
    ],
    startCode: ELAB_DS_001_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.03,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 1500,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-gpio-led-pwm",
    version: "1.0.0",
    title: "GPIO → LED PWM",
    shortDescription: "Steuere die Helligkeit über PWM im selben GPIO-Laborkontext.",
    area: "basic-circuit",
    entry: {
      labId: "gpio-led-throughput",
      runtimeEntrypoint: "createGpioLedThroughputLab",
      presetId: "pwm",
    },
    recommendedInstruments: ["oscilloscope", "multimeter", "logic"],
    recommendedMeasurementPoints: [
      { id: "gpio-5", label: "GPIO 5" },
      { id: "led", label: "LED Knoten" },
      { id: "vcc", label: "3,3 V" },
      { id: "gnd", label: "GND" },
    ],
    startCode: ELAB_DS_002_PWM_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.04,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 1800,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-pt1000-adc-divider",
    version: "1.0.0",
    title: "PT1000 → Spannungsteiler → ADC",
    shortDescription: "Ermittle die PT1000-Spannung über einen Spannungsteiler im ADC-Messfluss.",
    area: "measurement",
    entry: {
      labId: "pt1000-adc-throughput",
      runtimeEntrypoint: "createPt1000ThroughputLab",
      presetId: "default",
    },
    recommendedInstruments: ["multimeter", "oscilloscope"],
    recommendedMeasurementPoints: [
      { id: "vcc", label: "3,3 V" },
      { id: "pt1000", label: "PT1000-Knoten" },
      { id: "r-divider", label: "Teilerwiderstand" },
      { id: "adc-in", label: "ADC Eingang" },
      { id: "gnd", label: "GND" },
    ],
    startCode: ADC_PROGRAM_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.05,
      minTemperatureC: -30,
      maxTemperatureC: 80,
      maxRuntimeMs: 2000,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-button-bounce",
    version: "1.0.0",
    title: "Tasterprellen messen",
    shortDescription: "Vergleiche den Rohkontakt mit dem bei 700 µs entprellten Programmwert.",
    area: "troubleshooting",
    entry: {
      labId: "button-digital-input-throughput",
      runtimeEntrypoint: "createButtonDigitalInputThroughputLab",
      presetId: "bounce",
    },
    recommendedInstruments: ["logic", "oscilloscope"],
    recommendedMeasurementPoints: [
      { id: "button", label: "Taster-Kontakt" },
      { id: "gpio-4", label: "GPIO 4" },
      { id: "vcc", label: "3,3 V" },
      { id: "gnd", label: "GND" },
    ],
    startCode: BUTTON_DEBOUNCE_PROGRAM_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.02,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 1800,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-button-bounce-short",
    version: "1.0.0",
    title: "Tasterprellen/zu schnelle Entprellung",
    shortDescription: "Lerne den Effekt zu kurzer Entprellung bei schnellen Kontaktwechseln kennen.",
    area: "troubleshooting",
    entry: {
      labId: "button-digital-input-throughput",
      runtimeEntrypoint: "createButtonDigitalInputThroughputLab",
      presetId: "debounce-short",
    },
    recommendedInstruments: ["logic", "oscilloscope"],
    recommendedMeasurementPoints: [
      { id: "button", label: "Taster-Kontakt" },
      { id: "gpio-4", label: "GPIO 4" },
      { id: "vcc", label: "3,3 V" },
      { id: "gnd", label: "GND" },
    ],
    startCode: BUTTON_DEBOUNCE_SHORT_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.02,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 1800,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-button-bounce-long",
    version: "1.0.0",
    title: "Tasterprellen/zu langsame Entprellung",
    shortDescription: "Beobachte, wie zu lange Entprellzeiten Tastendrücke unnötig verzögern.",
    area: "troubleshooting",
    entry: {
      labId: "button-digital-input-throughput",
      runtimeEntrypoint: "createButtonDigitalInputThroughputLab",
      presetId: "debounce-long",
    },
    recommendedInstruments: ["logic", "oscilloscope"],
    recommendedMeasurementPoints: [
      { id: "button", label: "Taster-Kontakt" },
      { id: "gpio-4", label: "GPIO 4" },
      { id: "vcc", label: "3,3 V" },
      { id: "gnd", label: "GND" },
    ],
    startCode: BUTTON_DEBOUNCE_LONG_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.02,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 2500,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-button-missing-pull",
    version: "1.0.0",
    title: "fehlender Pull-Widerstand",
    shortDescription: "Untersuche den offenen Eingang anhand der deterministisch wechselnden Lehrwerte.",
    area: "troubleshooting",
    entry: {
      labId: "button-digital-input-throughput",
      runtimeEntrypoint: "createButtonDigitalInputThroughputLab",
      presetId: "missing-pull",
    },
    recommendedInstruments: ["logic", "multimeter"],
    recommendedMeasurementPoints: [
      { id: "button", label: "Taster-Kontakt" },
      { id: "gpio-4", label: "GPIO 4" },
      { id: "gnd", label: "GND" },
    ],
    startCode: BUTTON_INPUT_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.02,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 1200,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-button-pullup",
    version: "1.0.0",
    title: "Taster mit Pull-up",
    shortDescription: "Starte mit stabilem Pull-up und prüfe den Taster-Lesezustand an GPIO 4.",
    area: "basic-circuit",
    entry: {
      labId: "button-digital-input-throughput",
      runtimeEntrypoint: "createButtonDigitalInputThroughputLab",
      presetId: "pullup",
    },
    recommendedInstruments: ["multimeter", "logic"],
    recommendedMeasurementPoints: [
      { id: "button", label: "Taster-Kontakt" },
      { id: "gpio-4", label: "GPIO 4" },
      { id: "vcc", label: "3,3 V" },
      { id: "gnd", label: "GND" },
    ],
    startCode: BUTTON_PULLUP_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.02,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 1500,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
  {
    id: "elab-tpl-button-miswired",
    version: "1.0.0",
    title: "Taster-Fehlverdrahtung",
    shortDescription: "Lerne typische Kontakt-Fehlverdrahtungen eines Tasters zu erkennen.",
    area: "troubleshooting",
    entry: {
      labId: "button-digital-input-throughput",
      runtimeEntrypoint: "createButtonDigitalInputThroughputLab",
      presetId: "miswired",
    },
    recommendedInstruments: ["logic", "multimeter"],
    recommendedMeasurementPoints: [
      { id: "button", label: "Taster-Kontakt" },
      { id: "gpio-4", label: "GPIO 4" },
      { id: "vcc", label: "3,3 V" },
      { id: "gnd", label: "GND" },
    ],
    startCode: BUTTON_PULLUP_START_CODE,
    modelLimits: {
      minVoltageV: 0,
      maxVoltageV: 3.3,
      minCurrentA: 0,
      maxCurrentA: 0.02,
      minTemperatureC: -20,
      maxTemperatureC: 85,
      maxRuntimeMs: 1500,
    },
    access: {
      visibility: "public",
      requiresAuthentication: false,
      capabilities: ["measurement", "simulation"],
    },
  },
];

const { catalog, list, ids } = validateTemplateSet(TEMPLATE_ENTRIES);

export const ELAB_TPL_CATALOG = catalog;
export const ELAB_TPL_CATALOG_LIST = list;
export const ELAB_TPL_IDS = ids;

export function listLabTemplates() {
  return ELAB_TPL_CATALOG_LIST;
}

export function getLabTemplate(templateId) {
  if (typeof templateId !== "string") {
    return null;
  }
  return ELAB_TPL_CATALOG[templateId] ?? null;
}
