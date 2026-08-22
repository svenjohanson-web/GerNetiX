import {
  COMMAND_TYPES,
  createPt1000ThroughputRuntime,
} from "./pt1000-adc-throughput-runtime.mjs";
import { ADC_PROGRAM_START_CODE } from "../virtual-mcu/adc-program-runtime.mjs";

const MIN_TEMPERATURE_C = -200;
const MAX_TEMPERATURE_C = 850;
const INPUT_STEP = 0.1;

function asNumber(value, fallback = NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asText(value, digits) {
  const fractionDigits = Number.isFinite(digits) ? digits : 2;
  return Number.isFinite(value) ? value.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }) : "—";
}

function asVolt(value) {
  return Number.isFinite(value) ? `${asText(value, 3)} V` : "—";
}

function asAmp(value) {
  return Number.isFinite(value) ? `${asText(value * 1000, 3)} mA` : "—";
}

function asKohm(value) {
  return Number.isFinite(value) ? `${asText(value, 2)} Ω` : "—";
}

function asCode(value) {
  return Number.isFinite(value) ? `${Math.round(value)}` : "—";
}

function asInteger(value) {
  return Number.isFinite(value) ? `${Math.round(value)}` : "—";
}

function setText(target, value) {
  if (!target) return;
  target.textContent = value ?? "—";
}

function setNumberValue(target, value) {
  if (target && Number.isFinite(value)) {
    target.value = value.toFixed(1);
  }
}

function formatErrorEntry(entry) {
  const location = entry?.line && entry?.column ? ` (Zeile ${entry.line}, Spalte ${entry.column})` : "";
  const code = entry?.code ? `${entry.code}: ` : "";
  return `${code}${entry?.message || ""}${location}`.trim();
}

function renderWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return "";
  return warnings.map((entry) => entry?.message || "").filter(Boolean).join(" | ");
}

function renderStatus({ status, error, warning }) {
  if (error) {
    return `Fehler: ${error}`;
  }
  if (warning) {
    return `Hinweis: ${warning}`;
  }
  return status;
}

function createKpi(label, outputKey) {
  return `<div><span>${label}</span><strong data-output="${outputKey}">—</strong></div>`;
}

function parseTemperatureCommand(value) {
  const parsed = asNumber(value, NaN);
  return {
    type: COMMAND_TYPES.SetTemperature,
    temperatureC: parsed,
  };
}

export function createPt1000ThroughputLab() {
  const runtime = createPt1000ThroughputRuntime();
  const state = {
    source: ADC_PROGRAM_START_CODE,
    templateSource: ADC_PROGRAM_START_CODE,
  };

  function loadTemplate(template) {
    const sourceFile = typeof template?.startCode === "string" ? template.startCode : ADC_PROGRAM_START_CODE;
    runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
    const response = runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile });
    if (response.ok) {
      state.source = sourceFile;
      state.templateSource = sourceFile;
    }
    return response;
  }

  let rangeInput = null;
  let numberInput = null;
  let sourceArea = null;
  let statusOutput = null;
  let ambientOutput = null;
  let resistanceOutput = null;
  let voltageOutput = null;
  let dividerCurrentOutput = null;
  let adcCodeOutput = null;
  let adcVoltageOutput = null;
  let adcVariableOutput = null;
  let lastWarningText = "";

  const updateRuntimeSource = (nextSource) => {
    if (typeof nextSource !== "string") return;
    if (state.source === nextSource) return;
    const response = runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: nextSource });
    if (response.ok) {
      state.source = nextSource;
    }
    renderFromSnapshot();
  };

  const setAmbientTemperature = (nextTemperature) => {
    const response = runtime.dispatch(parseTemperatureCommand(nextTemperature));
    if (response.ok) {
      renderFromSnapshot();
      return;
    }
    renderFromSnapshot(response.error);
  };

  const start = () => {
    const response = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
    if (!response.ok) {
      renderFromSnapshot(response.errors);
      return;
    }
    lastWarningText = renderWarnings(runtime.getSnapshot().measurement?.warnings || []);
    renderFromSnapshot(response.errors);
  };

  const reset = () => {
    runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
    runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: state.templateSource });
    renderFromSnapshot();
  };

  const syncTemperatureInputs = (value) => {
    const temperature = asNumber(value, 0);
    if (!Number.isFinite(temperature)) return;
    setNumberValue(rangeInput, temperature);
    setNumberValue(numberInput, temperature);
  };

  const renderFromSnapshot = (runtimeErrors = null) => {
    const snapshot = runtime.getSnapshot();
    const measurement = snapshot.measurement;
    const ambientTemperature = snapshot.temperatureC;

    state.source = snapshot.sourceFile;
    sourceArea.value = snapshot.sourceFile;
    syncTemperatureInputs(ambientTemperature);
    setText(ambientOutput, `${ambientTemperature.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`);

    const errors = runtimeErrors || snapshot.error || [];
    if (Array.isArray(errors) && errors.length > 0) {
      lastWarningText = "";
      setText(ambientOutput, `${ambientTemperature.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`);
      const messages = errors.map(formatErrorEntry).filter(Boolean);
      setText(statusOutput, renderStatus({
        error: messages.join(" | "),
      }));
      setText(resistanceOutput, "—");
      setText(voltageOutput, "—");
      setText(dividerCurrentOutput, "—");
      setText(adcCodeOutput, "—");
      setText(adcVoltageOutput, "—");
      setText(adcVariableOutput, "—");
      return;
    }

    if (!measurement) {
      setText(resistanceOutput, "—");
      setText(voltageOutput, "—");
      setText(dividerCurrentOutput, "—");
      setText(adcCodeOutput, "—");
      setText(adcVoltageOutput, "—");
      setText(adcVariableOutput, "—");
      setText(statusOutput, "Simulation zurückgesetzt. Starten, um Messwerte neu zu berechnen.");
      return;
    }

    setText(resistanceOutput, asKohm(measurement.sensorResistanceOhm));
    setText(voltageOutput, asVolt(measurement.senseVoltageV));
    setText(dividerCurrentOutput, asAmp(measurement.dividerCurrentA));
    setText(adcCodeOutput, asCode(measurement.adcCode));
    setText(adcVoltageOutput, asVolt(measurement.adcQuantizedVoltageV));
    setText(adcVariableOutput, asInteger(measurement.adcValue));
    setText(statusOutput, renderStatus({
      status: "Messung abgeschlossen.",
      warning: lastWarningText,
    }));
  };

  function mount(target) {
    target.innerHTML = `<article class="lab-card">
      <h2>Durchstich · PT1000 → ADC</h2>
      <p class="elab-throughput-reality">Generisches Lernmodell – keine ESP32-Emulation, kein konkretes Bauteil-Datenblatt.</p>
      <div class="elab-pt1000-throughput-layout">
        <section class="elab-throughput-circuit">
          <div class="elab-throughput-circuit-head">
            <strong>Virtuelles Vorgehen</strong>
            <span class="elab-throughput-small">3,3 V, Festwiderstand 1000 Ω, PT1000 im Spannungsteiler mit ADC-Knoten A0.</span>
          </div>
          <svg class="elab-throughput-schematic elab-pt1000-throughput-schematic" viewBox="0 0 780 240" role="img" aria-label="PT1000 Spannungsteiler mit Sense-Knoten und A0">
            <g data-net="vcc-to-fixed">
              <circle cx="100" cy="60" r="8" fill="#5f7084" stroke="#8fa0b5" stroke-width="2" />
              <text x="72" y="48" fill="#9fb3c8" font-size="12">3,3 V</text>
              <line class="schematic-wire" x1="108" y1="60" x2="200" y2="60" />
            </g>
            <g data-net="fixed-to-sense" data-component="fixed-resistor">
              <rect class="elab-pt1000-throughput-element" x="200" y="45" width="140" height="30" fill="none" stroke="#8fa0b5" stroke-width="4" rx="8" />
              <text x="224" y="65" fill="#9fb3c8" font-size="12">R_fest = 1000 Ω</text>
              <line class="schematic-wire" x1="340" y1="60" x2="430" y2="60" />
            </g>
            <g data-component="pt1000-sense-to-gnd">
              <circle cx="430" cy="60" r="7" class="elab-throughput-measurement-point" />
              <text x="372" y="48" fill="#9fb3c8" font-size="11">Sense</text>
              <line class="schematic-wire" x1="430" y1="60" x2="430" y2="105" />
              <rect class="elab-pt1000-throughput-element" x="423" y="105" width="14" height="75" fill="none" stroke="#8fa0b5" stroke-width="4" rx="3" />
              <text x="448" y="142" fill="#9fb3c8" font-size="12">PT1000</text>
              <text x="438" y="156" fill="#9fb3c8" font-size="11">temperaturabh.</text>
            </g>
            <g data-net="pt1000-to-gnd">
              <line class="schematic-wire" x1="430" y1="180" x2="430" y2="205" />
              <line class="schematic-wire" x1="418" y1="205" x2="442" y2="205" />
              <line class="schematic-wire" x1="420" y1="209" x2="438" y2="209" />
              <line class="schematic-wire" x1="422" y1="213" x2="436" y2="213" />
              <text x="452" y="208" fill="#9fb3c8" font-size="11">ADC-Masse / GND</text>
            </g>
            <g data-net="sense-to-a0">
              <line class="schematic-wire" x1="430" y1="60" x2="680" y2="60" />
              <circle cx="680" cy="60" r="7" class="elab-throughput-measurement-point" />
              <text x="665" y="78" fill="#9fb3c8" font-size="11">A0</text>
            </g>
          </svg>
          <p class="elab-throughput-small elab-pt1000-throughput-reality">Der Rechenschritt erfolgt im Runtime-Modell. Der UI-Code zeigt nur Schaltung, Parameter und Messresultate.</p>
        </section>
        <section class="elab-pt1000-throughput-control">
          <section class="elab-throughput-control">
            <label for="pt1000-temperature-range">Umgebungstemperatur (C)</label>
            <div class="elab-pt1000-throughput-range-control">
              <input type="range" id="pt1000-temperature-range" min="${MIN_TEMPERATURE_C}" max="${MAX_TEMPERATURE_C}" step="${INPUT_STEP}" value="0">
              <input type="number" id="pt1000-temperature-number" min="${MIN_TEMPERATURE_C}" max="${MAX_TEMPERATURE_C}" step="${INPUT_STEP}" value="0" aria-label="Umgebungstemperatur in C">
            </div>
            <small>Eingestellt via gemeinsamem Schieberegler + Werteingabe</small>
          </section>
          <section class="elab-throughput-program elab-throughput-control">
            <label for="pt1000-throughput-source">Quellcode</label>
            <textarea id="pt1000-throughput-source" spellcheck="false"></textarea>
            <div class="elab-throughput-actions">
              <button type="button" data-action="start">Simulation starten</button>
              <button type="button" data-action="reset">Zurücksetzen</button>
            </div>
          </section>
          <section class="elab-throughput-measurements">
            <h3>Ausgabe</h3>
            <div class="elab-throughput-kpi elab-pt1000-throughput-kpi">${createKpi("Temperatur", "ambient-temperature")}${createKpi("PT1000-Widerstand", "sensor-resistance")}${createKpi("Sense-Spannung", "sense-voltage")}${createKpi("Teilerstrom", "divider-current")}${createKpi("ADC-Code", "adc-code")}${createKpi("Quantisierte ADC-Spannung", "adc-quantized-voltage")}${createKpi("Variable adcValue", "adc-variable")}</div>
            <p class="elab-throughput-result" data-status></p>
          </section>
          <section class="elab-throughput-reality-bridge">
            <strong>Vom virtuellen zum echten Labor</strong>
            <span>PT1000: temperaturabhängiger Widerstand als ideales Standardmodell.</span>
            <span>Festwiderstand: 1000 Ω im Spannungsteiler.</span>
            <span>Gemeinsame Masse: ADC-Referenz und Messknoten nutzen dieselbe Bezugsebene.</span>
            <span>Echte Aufbauten verwenden 3,3 V Versorgung, saubere ADC-Referenz und Spannungsgrenzprüfung für den A0-Eingang.</span>
          </section>
        </section>
      </div>
    </article>`;

    rangeInput = target.querySelector("#pt1000-temperature-range");
    numberInput = target.querySelector("#pt1000-temperature-number");
    sourceArea = target.querySelector("#pt1000-throughput-source");
    statusOutput = target.querySelector("[data-status]");
    ambientOutput = target.querySelector('[data-output="ambient-temperature"]');
    resistanceOutput = target.querySelector('[data-output="sensor-resistance"]');
    voltageOutput = target.querySelector('[data-output="sense-voltage"]');
    dividerCurrentOutput = target.querySelector('[data-output="divider-current"]');
    adcCodeOutput = target.querySelector('[data-output="adc-code"]');
    adcVoltageOutput = target.querySelector('[data-output="adc-quantized-voltage"]');
    adcVariableOutput = target.querySelector('[data-output="adc-variable"]');

    const startButton = target.querySelector('[data-action="start"]');
    const resetButton = target.querySelector('[data-action="reset"]');

    rangeInput.addEventListener("input", () => {
      const next = asNumber(rangeInput.value, NaN);
      if (!Number.isFinite(next)) return;
      setNumberValue(numberInput, next);
      setAmbientTemperature(next);
    });

    numberInput.addEventListener("input", () => {
      const next = asNumber(numberInput.value, NaN);
      if (!Number.isFinite(next)) return;
      setNumberValue(rangeInput, next);
      setAmbientTemperature(next);
    });

    sourceArea.addEventListener("input", () => {
      updateRuntimeSource(sourceArea.value);
    });

    startButton.addEventListener("click", start);
    resetButton.addEventListener("click", reset);
    renderFromSnapshot();
  }

  function dispose() {
    runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
  }

  return {
    id: "pt1000-adc-throughput",
    title: "Durchstich · PT1000 → ADC",
    status: "Übung",
    summary: "Temperatur über Spannungsteiler und ADC im Mikrocontroller messen.",
    mount,
    loadTemplate,
    dispose,
  };
}
