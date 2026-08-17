import {
  COMMAND_TYPES,
  ELAB_DS_001_START_CODE,
  ELAB_DS_002_PWM_START_CODE,
  createThroughputRuntime,
} from "./gpio-led-throughput-runtime.js";

const OSCILLOSCOPE_INSTRUMENT_ID = "scope-1";
const OSCILLOSCOPE_CHANNEL_ID = "ch1";

const MEASUREMENT_POINT_LABELS = {
  "gpio-5": "GPIO 5",
  gnd: "GND",
};

const STATUS_MESSAGES = {
  PROBE_TIP_NOT_CONNECTED: "Tastkopfspitze von CH1 ist nicht verbunden.",
  PROBE_REFERENCE_NOT_CONNECTED: "Masseklemme von CH1 ist nicht verbunden.",
  MEASUREMENT_TRACE_NOT_AVAILABLE: "Simulation noch nicht gestartet oder Trace nicht verfügbar.",
  OSCILLOSCOPE_TRIGGER_NOT_FOUND: "Trigger nicht gefunden.",
  OSCILLOSCOPE_PERIOD_NOT_MEASURABLE: "Keine periodischen Flanken messbar.",
  INSTRUMENT_NOT_FOUND: "Oszilloskop-Kanal ist nicht vorhanden.",
  INSTRUMENT_CHANNEL_NOT_FOUND: "CH1 ist im Instrument nicht vorhanden.",
  MEASUREMENT_POINT_NOT_FOUND: "Messpunkt ist nicht vorhanden.",
  PROBE_LEAD_NOT_SUPPORTED: "Leitungstyp ist ungültig.",
  GPIO_SOURCE_CURRENT_EXCEEDED: "Der berechnete GPIO-Strom überschreitet den Grenzwert des Lernmodells.",
  LED_CURRENT_EXCEEDED: "Der berechnete LED-Strom überschreitet den Grenzwert des Lernmodells.",
};

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits).replace(".", ",");
}

function toDisplayVoltage(voltage) {
  if (!Number.isFinite(voltage)) return "—";
  return `${formatNumber(voltage, 2)} V`;
}

function toDisplayCurrent(ampere) {
  if (!Number.isFinite(ampere)) return "—";
  return `${formatNumber(ampere * 1000, 3)} mA`;
}

function toDisplayDuty(value) {
  if (!Number.isFinite(value)) return "—";
  return `${formatNumber(value, 1)} %`;
}

function statusMessages(codes) {
  const list = [];
  for (const code of codes || []) {
    list.push(STATUS_MESSAGES[code] || code);
  }
  return list;
}

function formatStatus(snapshot) {
  if (snapshot.error?.length) {
    return snapshot.error.map((entry) => entry.message).join(" ");
  }

  const scope = snapshot.scope || {};
  const status = [...new Set(scope.statusCodes || [])];
  if (!status.length) return "Trace verfügbar – Werte sind aus dem gemessenen Spannungsverlauf abgeleitet.";
  return statusMessages(status).join(" ");
}

function setText(target, value) {
  if (target) target.textContent = value;
}

function parseErrorMessages(result) {
  if (result?.ok) return [];
  return (result?.errors || []).map((entry) => entry.message || String(entry.code || ""));
}

function getScopeState(runtime) {
  const snapshot = runtime.getSnapshot();
  return snapshot.scope || {};
}

function readOutput(text, value) {
  return `data-output="${text}"`;
}

function createKpi(valueLabel, valueId) {
  return `<div><span>${valueLabel}</span><strong ${readOutput(valueId)}>${"\u2014"}</strong></div>`;
}

export function createGpioLedThroughputLab() {
  const runtime = createThroughputRuntime({ sourceFile: ELAB_DS_001_START_CODE });
  const state = {
    source: ELAB_DS_001_START_CODE,
    templateSource: ELAB_DS_001_START_CODE,
    selectedLead: null,
  };

  function loadTemplate(template) {
    const sourceFile = typeof template?.startCode === "string" ? template.startCode : ELAB_DS_001_START_CODE;
    runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
    const response = runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile });
    if (response.ok) {
      state.source = response.sourceFile;
      state.templateSource = response.sourceFile;
      state.selectedLead = null;
    }
    return response;
  }

  function loadFromRoute(route) {
    const parsed = new URL(route || window.location.href, window.location.origin);
    const example = parsed.searchParams.get("example");
    if (example === "gpio-5-led-pwm") {
      const response = runtime.dispatch({
        type: COMMAND_TYPES.LoadLabExample,
        exampleId: "gpio-pwm-led",
      });
      if (response.ok) state.source = runtime.getSnapshot().sourceFile;
      return response;
    }
    if (example === "gpio-5-led-digital") {
      const response = runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: ELAB_DS_001_START_CODE });
      if (response.ok) state.source = response.sourceFile;
      return response;
    }
    return runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: state.source });
  }

  function mount(target) {
    target.innerHTML = `<article class="lab-card"><h2>Durchstich · GPIO 5 → LED</h2><p class="elab-throughput-reality">Generisches Lernmodell – keine ESP32-Emulation. LED und GPIO-Solver sind idealisiert.</p><div class="elab-throughput-layout"><section class="elab-throughput-circuit"><div class="elab-throughput-circuit-head"><strong>Virtueller Aufbau</strong><span class="elab-throughput-small">Tastkopfspitze an <strong>GPIO 5</strong>, Masseklemme an <strong>GND</strong> anschließen.</span></div><svg class="elab-throughput-schematic" viewBox="0 0 760 280" role="img" aria-label="Schaltung mit GPIO 5, GPIO-Ausgang und LED"><rect x="70" y="120" width="120" height="80" fill="none" stroke="#5f7084" stroke-width="3" rx="11" /><text x="84" y="164" fill="#9fb3c8" font-size="13">GPIO-MCU</text><line class="schematic-wire" x1="190" y1="160" x2="300" y2="160" /><path class="schematic-component schematic-resistor" d="M300 138 L300 182 L460 182 M300 138 L460 138" fill="none" stroke-width="3" /><path class="schematic-led" d="M460 140 L500 160 L460 182 Z M504 148 V172" fill="none" stroke-width="3" /><line class="schematic-wire" x1="500" y1="160" x2="585" y2="160" /><circle class="elab-throughput-measurement-point" data-measurement-point="gnd" cx="585" cy="218" r="9"></circle><line class="schematic-wire" x1="585" y1="160" x2="585" y2="218" /><line class="schematic-wire" x1="70" y1="205" x2="585" y2="205" /><line class="schematic-wire" x1="70" y1="205" x2="70" y2="250" /><line class="schematic-wire" x1="585" y1="205" x2="585" y2="250" /><circle class="elab-throughput-measurement-point" data-measurement-point="gpio-5" cx="190" cy="160" r="9"></circle><text x="180" y="190" fill="#9fb3c8" font-size="12">GPIO 5</text><text x="560" y="245" fill="#9fb3c8" font-size="12">GND</text><rect x="530" y="132" width="110" height="56" rx="6" fill="#111927" stroke="#425469"/><text x="542" y="163" fill="#f2f7ff" font-size="11">LED</text><text x="70" y="252" fill="#a8b7c5" font-size="11">Massepunkt</text><text x="185" y="150" fill="#a8b7c5" font-size="11">GPIO 5</text></svg><div class="elab-throughput-probe-strip"><div><button type="button" data-probe-action="pick-tip">Tastkopfspitze auswählen</button><button type="button" data-probe-action="pick-reference">Masseklemme auswählen</button></div><div class="elab-throughput-probe-strip-state"><span data-connection-status="tip">Tastkopf: nicht verbunden</span><span data-connection-status="reference">Masse: nicht verbunden</span></div><div class="elab-throughput-probe-strip-actions"><button type="button" data-action="detach-tip">Tastkopf lösen</button><button type="button" data-action="detach-reference">Masse lösen</button></div><p class="elab-throughput-small" data-probe-info>Tippe auf einen Messpunkt, nachdem du die gewünschte Leitung gewählt hast.</p><div class="elab-throughput-lead-lines" data-lead-lines><span class="elab-throughput-lead-line elab-throughput-lead-line-tip"></span><span class="elab-throughput-lead-line elab-throughput-lead-line-reference"></span></div></div><div class="elab-throughput-reality-bridge"><strong>Vom virtuellen zum echten Labor</strong><span>Modell: 3,3 V · 330 Ω · LED U<sub>F</sub> 2,0 V.</span><span>Real: Firmware flashen, gemeinsame Masse verbinden, Tastkopfspitze an GPIO 5 und Masseklemme an GND.</span><span>Das Lernoszilloskop ist idealisiert; am echten Aufbau zuerst Massebezug und zulässige Spannungen prüfen.</span></div></section><section class="elab-throughput-control"><section class="elab-throughput-program"><label for="elab-throughput-source">Quellcode</label><textarea id="elab-throughput-source" spellcheck="false">${state.source}</textarea><div class="elab-throughput-actions"><button type="button" data-action="start">Simulation starten</button><button type="button" data-action="reset">Zurücksetzen</button><button type="button" data-action="load-example">PWM-Beispiel laden</button></div></section><section class="elab-throughput-measurements"><h3>Werte</h3><div class="elab-throughput-kpi">${createKpi("GPIO-Level", "gpio-level")}${createKpi("GPIO-Spannung", "gpio-voltage")}${createKpi("LED-Pulsstrom", "led-current")}${createKpi("LED-Mittelstrom", "led-mean-current")}${createKpi("LED-Zustand", "led-state")}${createKpi("PWM-Frequenz", "pwm-frequency")}${createKpi("PWM-Periode", "pwm-period")}${createKpi("Tastgrad", "pwm-duty")}${createKpi("HIGH-Dauer", "pwm-high")}${createKpi("LOW-Dauer", "pwm-low")}</div><p class="elab-throughput-warnings" data-warnings></p><p class="elab-throughput-result" data-result></p><p class="elab-throughput-disclaimer">Formel: I_LED = max(0, (U_GPIO - U_F_LED) / R). PWM entsteht im virtuellen Mikrocontroller und wird als GPIO-Trace gemessen.</p></section><section class="elab-throughput-scope" aria-label="CH1-Oszilloskop"><h3>Kompaktes Oszilloskop · CH1</h3><p class="elab-throughput-small">Anschlüsse CH1: Spitze und Bezug</p><div class="elab-throughput-scope-settings"><span>Kupplung: DC</span><span>Spannungsteilung: 1×</span><span>V/div: 1 V</span><span>s/div: 500 µs</span><span>Trigger: 1,65 V · steigend</span></div><div class="elab-throughput-scope-frame"><canvas data-scope-canvas width="760" height="260" aria-label="Oszilloskopbild"></canvas><div class="elab-throughput-scope-readout">Min.: <output data-scope-min>—</output> · Max.: <output data-scope-max>—</output> · Vpp: <output data-scope-pp>—</output> · f: <output data-scope-frequency>—</output> · T: <output data-scope-period>—</output> · Duty: <output data-scope-duty>—</output> · Trigger: <output data-scope-trigger>—</output></div></div><p class="elab-throughput-result" data-scope-status></p></section></section></div></article>`;

    const sourceArea = target.querySelector("#elab-throughput-source");
    const startButton = target.querySelector('[data-action="start"]');
    const resetButton = target.querySelector('[data-action="reset"]');
    const loadButton = target.querySelector('[data-action="load-example"]');
    const resultOutput = target.querySelector("[data-result]");
    const warningsOutput = target.querySelector("[data-warnings]");
    const scopeStatus = target.querySelector("[data-scope-status]");
    const kpiLevel = target.querySelector('[data-output="gpio-level"]');
    const kpiVoltage = target.querySelector('[data-output="gpio-voltage"]');
    const kpiLedCurrent = target.querySelector('[data-output="led-current"]');
    const kpiLedMeanCurrent = target.querySelector('[data-output="led-mean-current"]');
    const kpiLedState = target.querySelector('[data-output="led-state"]');
    const kpiPwmFrequency = target.querySelector('[data-output="pwm-frequency"]');
    const kpiPwmPeriod = target.querySelector('[data-output="pwm-period"]');
    const kpiPwmDuty = target.querySelector('[data-output="pwm-duty"]');
    const kpiPwmHigh = target.querySelector('[data-output="pwm-high"]');
    const kpiPwmLow = target.querySelector('[data-output="pwm-low"]');
    const scopeMin = target.querySelector("[data-scope-min]");
    const scopeMax = target.querySelector("[data-scope-max]");
    const scopePp = target.querySelector("[data-scope-pp]");
    const scopeFrequency = target.querySelector("[data-scope-frequency]");
    const scopePeriod = target.querySelector("[data-scope-period]");
    const scopeDuty = target.querySelector("[data-scope-duty]");
    const scopeTrigger = target.querySelector("[data-scope-trigger]");
    const canvas = target.querySelector("[data-scope-canvas]");
    const gndNode = target.querySelector('[data-measurement-point="gnd"]');
    const gpioNode = target.querySelector('[data-measurement-point="gpio-5"]');
    const tipStatus = target.querySelector('[data-connection-status="tip"]');
    const referenceStatus = target.querySelector('[data-connection-status="reference"]');
    const probeInfo = target.querySelector("[data-probe-info]");
    const leadLines = {
      tip: target.querySelector(".elab-throughput-lead-line-tip"),
      reference: target.querySelector(".elab-throughput-lead-line-reference"),
    };

    const drawScope = () => {
      const snapshot = runtime.getSnapshot();
      const scope = getScopeState(runtime);
      const trace = Array.isArray(scope.signalTrace) ? scope.signalTrace : [];
      const width = canvas.clientWidth || canvas.width || 760;
      const height = canvas.clientHeight || canvas.height || 260;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#050a10";
      ctx.fillRect(0, 0, width, height);

      const horizontalDivisions = 8;
      const verticalDivisions = 8;
      const left = 28;
      const top = 16;
      const right = width - 18;
      const bottom = height - 20;
      const plotWidth = right - left;
      const plotHeight = bottom - top;

      ctx.strokeStyle = "#263748";
      ctx.lineWidth = 1;
      for (let y = 0; y <= horizontalDivisions; y += 1) {
        const yPos = top + (plotHeight * y) / horizontalDivisions;
        ctx.beginPath();
        ctx.moveTo(left, yPos);
        ctx.lineTo(right, yPos);
        ctx.stroke();
      }
      for (let x = 0; x <= verticalDivisions; x += 1) {
        const xPos = left + (plotWidth * x) / verticalDivisions;
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.stroke();
      }

      const minY = scope.gridMinVoltage ?? -0.2;
      const maxY = scope.gridMaxVoltage ?? 3.5;
      const visibleUs = scope.visibleTimeWindowUs ?? 4000;
      const minX = 0;
      const maxX = visibleUs;
      const toX = (time) => left + plotWidth * ((time - minX) / (maxX - minX));
      const toY = (value) => {
        const ratioY = (value - minY) / (maxY - minY);
        return bottom - plotHeight * ratioY;
      };

      const zeroY = toY(0);
      const triggerY = toY(scope.triggerLevel ?? 1.65);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#f5e663";
      ctx.beginPath();
      ctx.moveTo(left, zeroY);
      ctx.lineTo(right, zeroY);
      ctx.stroke();
      ctx.strokeStyle = "#75ec5f";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(left, triggerY);
      ctx.lineTo(right, triggerY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (trace.length > 0) {
        const [first] = trace;
        const firstX = toX(first.time);
        const firstY = toY(first.value);
        ctx.strokeStyle = "#ffb35a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        let lastX = firstX;
        let lastY = firstY;
        ctx.moveTo(firstX, lastY);

        for (let index = 0; index < trace.length - 1; index += 1) {
          const current = trace[index];
          const next = trace[index + 1];
          const nextX = toX(next.time);
          const currentY = toY(current.value);
          const nextY = toY(next.value);
          ctx.lineTo(nextX, currentY);
          ctx.lineTo(nextX, nextY);
          lastX = nextX;
          lastY = nextY;
        }
        ctx.stroke();

        if (Number.isFinite(scope.triggerTimeUs)) {
          ctx.strokeStyle = "#75ec5f";
          ctx.setLineDash([8, 5]);
          const triggerX = toX(scope.triggerTimeUs);
          ctx.beginPath();
          ctx.moveTo(triggerX, top);
          ctx.lineTo(triggerX, bottom);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      } else {
        ctx.fillStyle = "#8ca1b4";
        ctx.font = "12px ui-monospace, SFMono-Regular, Consolas, monospace";
        ctx.fillText("Kein Signal (Messung nicht verfügbar)", left + 14, top + 24);
      }

      if (Number.isFinite(snapshot.scope?.triggerTimeUs)) {
        ctx.fillStyle = "#f8fafc";
        ctx.font = "11px ui-monospace, SFMono-Regular, Consolas, monospace";
        ctx.fillText(`Trigger: ${snapshot.scope.triggerTimeUs.toFixed(0)} µs`, width - 110, 28);
      }
    };

    const updateOutputs = () => {
      const snapshot = runtime.getSnapshot();
      const measurement = snapshot.measurement;
      const scope = snapshot.scope || {};
      const pwmRunning = Boolean(measurement?.pwm?.running);

      if (snapshot.error?.length) {
        setText(resultOutput, snapshot.error.map((entry) => entry.message).join(" "));
      } else {
        setText(resultOutput, `GPIO ${pwmRunning ? "PWM" : measurement?.gpio?.logicLevel || "-"}`);
      }

      setText(kpiLevel, pwmRunning ? "PWM" : measurement?.gpio?.logicLevel ?? "—");
      setText(kpiVoltage, pwmRunning ? "0,00–3,30 V" : measurement ? toDisplayVoltage(measurement.gpio.voltageV) : "—");
      setText(kpiLedCurrent, measurement ? toDisplayCurrent(pwmRunning ? measurement.led?.highCurrentA : measurement.branch?.ledCurrentA || 0) : "—");
      setText(kpiLedMeanCurrent, pwmRunning ? toDisplayCurrent(measurement.led?.meanCurrentA) : "—");
      setText(kpiLedState, measurement?.led?.state || "—");
      setText(kpiPwmFrequency, measurement?.pwm?.frequencyHz != null ? `${formatNumber(measurement.pwm.frequencyHz / 1000, 2)} kHz` : "—");
      setText(kpiPwmPeriod, measurement?.pwm?.period != null ? `${formatNumber(measurement.pwm.period / 1000, 2)} ms` : "—");
      setText(kpiPwmDuty, toDisplayDuty(measurement?.pwm?.dutyPercent));
      setText(kpiPwmHigh, measurement?.pwm?.highDuration != null ? `${formatNumber(measurement.pwm.highDuration, 0)} µs` : "—");
      setText(kpiPwmLow, measurement?.pwm?.lowDuration != null ? `${formatNumber(measurement.pwm.lowDuration, 0)} µs` : "—");

      const warnings = statusMessages([...(measurement?.warnings || []), ...(scope.statusCodes || [])]);
      setText(warningsOutput, warnings.length ? [...new Set(warnings)].join(" ") : "Keine Statuswarnungen.");

      const statusText = formatStatus(snapshot);
      setText(scopeStatus, statusText);
      setText(scopeMin, scope.minimumVoltage != null ? toDisplayVoltage(scope.minimumVoltage) : "—");
      setText(scopeMax, scope.maximumVoltage != null ? toDisplayVoltage(scope.maximumVoltage) : "—");
      setText(scopePp, scope.peakToPeakVoltage != null ? toDisplayVoltage(scope.peakToPeakVoltage) : "—");
      setText(scopeFrequency, scope.frequencyHz != null ? `${formatNumber(scope.frequencyHz / 1000, 2)} kHz` : "—");
      setText(scopePeriod, scope.periodUs != null ? `${formatNumber(scope.periodUs / 1000, 2)} ms` : "—");
      setText(scopeDuty, toDisplayDuty(scope.dutyCyclePercent));
      setText(scopeTrigger, scope.triggerTimeUs != null ? `${formatNumber(scope.triggerTimeUs, 0)} µs` : "—");

      const tipConn = scope.tipConnection;
      const refConn = scope.referenceConnection;
      setText(tipStatus, `Tastkopf: ${tipConn ? MEASUREMENT_POINT_LABELS[tipConn] : "nicht verbunden"}`);
      setText(referenceStatus, `Masse: ${refConn ? MEASUREMENT_POINT_LABELS[refConn] : "nicht verbunden"}`);
      leadLines.tip?.classList.toggle("is-connected", Boolean(tipConn));
      leadLines.reference?.classList.toggle("is-connected", Boolean(refConn));

      drawScope();
    };

    const updateSourceFromEditor = () => {
      const nextSource = sourceArea.value;
      state.source = nextSource;
      runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: nextSource });
    };

    function dispatchAttach(lead, pointId) {
      const response = runtime.dispatch({
        type: COMMAND_TYPES.AttachProbe,
        instrumentId: OSCILLOSCOPE_INSTRUMENT_ID,
        channelId: OSCILLOSCOPE_CHANNEL_ID,
        lead,
        measurementPointId: pointId,
      });
      if (!response.ok) {
        setText(warningsOutput, parseErrorMessages(response).join(" "));
      }
      return response;
    }

    function dispatchDetach(lead) {
      const response = runtime.dispatch({
        type: COMMAND_TYPES.DetachProbe,
        instrumentId: OSCILLOSCOPE_INSTRUMENT_ID,
        channelId: OSCILLOSCOPE_CHANNEL_ID,
        lead,
      });
      if (!response.ok) {
        setText(warningsOutput, parseErrorMessages(response).join(" "));
      }
      return response;
    }

    sourceArea.addEventListener("input", () => {
      updateSourceFromEditor();
      updateOutputs();
    });

    startButton.addEventListener("click", () => {
      const result = runtime.dispatch({ type: COMMAND_TYPES.StartSimulation });
      if (!result.ok) {
        setText(warningsOutput, parseErrorMessages(result).join(" "));
      }
      updateOutputs();
    });

    resetButton.addEventListener("click", () => {
      runtime.dispatch({ type: COMMAND_TYPES.ResetSimulation });
      const result = runtime.dispatch({ type: COMMAND_TYPES.UpdateSourceFile, sourceFile: state.templateSource });
      if (result.ok) {
        sourceArea.value = result.sourceFile;
        state.source = result.sourceFile;
        state.selectedLead = null;
      }
      updateOutputs();
    });

    loadButton.addEventListener("click", () => {
      if (sourceArea.value !== ELAB_DS_002_PWM_START_CODE
        && !window.confirm("Der aktuelle Quellcode wird durch das PWM-Beispiel ersetzt. Fortfahren?")) {
        return;
      }
      const result = runtime.dispatch({
        type: COMMAND_TYPES.LoadLabExample,
        exampleId: "gpio-pwm-led",
      });
      if (result.ok) {
        sourceArea.value = result.sourceFile;
        state.source = result.sourceFile;
        updateOutputs();
        return;
      }
      setText(warningsOutput, parseErrorMessages(result).join(" "));
      updateOutputs();
    });

    target.querySelector('[data-probe-action="pick-tip"]').addEventListener("click", () => {
      state.selectedLead = state.selectedLead === "tip" ? null : "tip";
      probeInfo.textContent = state.selectedLead === "tip"
        ? "Tastkopfspitze ausgewählt: Knoten auf der Schaltung anklicken."
        : "Wähle Leitungsart erneut.";
    });

    target.querySelector('[data-probe-action="pick-reference"]').addEventListener("click", () => {
      state.selectedLead = state.selectedLead === "reference" ? null : "reference";
      probeInfo.textContent = state.selectedLead === "reference"
        ? "Masseklemme ausgewählt: GND-Knoten anklicken."
        : "Wähle Leitungsart erneut.";
    });

    target.querySelector('[data-action="detach-tip"]').addEventListener("click", () => {
      dispatchDetach("tip");
      updateOutputs();
    });

    target.querySelector('[data-action="detach-reference"]').addEventListener("click", () => {
      dispatchDetach("reference");
      updateOutputs();
    });

    gpioNode.addEventListener("click", () => {
      if (!state.selectedLead) {
        probeInfo.textContent = "Wähle zuerst Tastkopf oder Masseklemme aus.";
        return;
      }
      const response = dispatchAttach(state.selectedLead, "gpio-5");
      if (response.ok) {
        state.selectedLead = null;
        probeInfo.textContent = "Messpunkt verbunden.";
      }
      updateOutputs();
    });

    gndNode.addEventListener("click", () => {
      if (!state.selectedLead) {
        probeInfo.textContent = "Wähle zuerst Tastkopf oder Masseklemme aus.";
        return;
      }
      const response = dispatchAttach(state.selectedLead, "gnd");
      if (response.ok) {
        state.selectedLead = null;
        probeInfo.textContent = "Messpunkt verbunden.";
      }
      updateOutputs();
    });

    gndNode.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      gndNode.dispatchEvent(new Event("click"));
    });
    gpioNode.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      gpioNode.dispatchEvent(new Event("click"));
    });

    const routeResult = loadFromRoute(window.location.href);
    if (routeResult?.ok) {
      sourceArea.value = state.source;
    }
    updateOutputs();
  }

  return {
    id: "gpio-led-throughput",
    title: "Durchstich · GPIO5 → LED",
    status: "Übung",
    summary: "Virtuelles GPIO + Oszilloskop-Traces gemeinsam auslesen",
    mount,
    loadTemplate,
    dispose() {},
  };
}

export function loadFromRoute(route) {
  return route;
}
