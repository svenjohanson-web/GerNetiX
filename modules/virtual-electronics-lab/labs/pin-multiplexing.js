const SIGNALS = [
  ["adc", "ADC-Eingang"],
  ["pwm", "PWM-Ausgang"],
  ["uartTx", "UART TX"],
  ["uartRx", "UART RX"],
  ["spiSclk", "SPI SCLK"],
  ["spiMosi", "SPI MOSI"],
  ["spiMiso", "SPI MISO"],
  ["spiCs", "SPI CS"],
];

const NANO_PINS = [
  pin("D0", ["uartRx"], "UART RX"), pin("D1", ["uartTx"], "UART TX"),
  pin("D2", [], "Interrupt"), pin("D3", ["pwm"], "PWM · Interrupt"),
  pin("D4"), pin("D5", ["pwm"], "PWM"), pin("D6", ["pwm"], "PWM"), pin("D7"),
  pin("D8"), pin("D9", ["pwm"], "PWM"), pin("D10", ["pwm", "spiCs"], "PWM · SPI SS"),
  pin("D11", ["pwm", "spiMosi"], "PWM · SPI MOSI"), pin("D12", ["spiMiso"], "SPI MISO"),
  pin("D13", ["spiSclk"], "SPI SCLK · Board-LED"),
  pin("A0", ["adc"], "ADC0"), pin("A1", ["adc"], "ADC1"), pin("A2", ["adc"], "ADC2"),
  pin("A3", ["adc"], "ADC3"), pin("A4", ["adc"], "ADC4 · I²C SDA"), pin("A5", ["adc"], "ADC5 · I²C SCL"),
  pin("A6", ["adc"], "ADC6 · nur Eingang"), pin("A7", ["adc"], "ADC7 · nur Eingang"),
];

const ESP32_PIN_NUMBERS = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35];
const ESP32_INPUT_ONLY = new Set([34, 35]);
const ESP32_ADC = new Set([0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35]);
const ESP32_ADC2 = new Set([0, 2, 4, 12, 13, 14, 15, 25, 26, 27]);
const ESP32_STRAPPING = new Set([0, 2, 5, 12, 15]);
const ESP32_PINS = ESP32_PIN_NUMBERS.map((number) => {
  const functions = ["uartRx", "spiMiso"];
  if (!ESP32_INPUT_ONLY.has(number)) functions.push("pwm", "uartTx", "spiSclk", "spiMosi", "spiCs");
  if (ESP32_ADC.has(number)) functions.push("adc");
  const notes = [];
  if (ESP32_INPUT_ONLY.has(number)) notes.push("nur Eingang");
  if (ESP32_ADC.has(number)) notes.push(ESP32_ADC2.has(number) ? "ADC2" : "ADC1");
  if (ESP32_STRAPPING.has(number)) notes.push("Strapping-Pin");
  if (number === 1 || number === 3) notes.push("UART0/USB-Serial");
  return pin(`GPIO${number}`, functions, notes.join(" · "));
});

const BOARDS = {
  nano: {
    id: "nano",
    title: "Projekt Arduino Nano",
    subtitle: "ATmega328P · überwiegend feste Peripheriepins",
    voltage: 5,
    pins: NANO_PINS,
    defaults: { adc: "A0", pwm: "D9", uartTx: "D1", uartRx: "D0", spiSclk: "D13", spiMosi: "D11", spiMiso: "D12", spiCs: "D10" },
    alternative: { adc: "A1", pwm: "D6", uartTx: "D1", uartRx: "D0", spiSclk: "D8", spiMosi: "D7", spiMiso: "D4", spiCs: "D2" },
    explanation: "Beim ATmega328P liegen UART und Hardware-SPI auf festen Pins. Eine andere GPIO-Nummer erzeugt nicht automatisch eine zweite Hardware-SPI-Belegung.",
  },
  esp32: {
    id: "esp32",
    title: "Projekt ESP32 Dev Board",
    subtitle: "klassischer ESP32 · flexible GPIO-Matrix mit Grenzen",
    voltage: 3.3,
    pins: ESP32_PINS,
    defaults: { adc: "GPIO32", pwm: "GPIO25", uartTx: "GPIO17", uartRx: "GPIO16", spiSclk: "GPIO18", spiMosi: "GPIO23", spiMiso: "GPIO19", spiCs: "GPIO5" },
    alternative: { adc: "GPIO32", pwm: "GPIO21", uartTx: "GPIO17", uartRx: "GPIO16", spiSclk: "GPIO25", spiMosi: "GPIO26", spiMiso: "GPIO27", spiCs: "GPIO33" },
    explanation: "Die GPIO-Matrix kann viele UART-, SPI- und PWM-Signale umleiten. Eingangs-only-, Strapping-, Flash-, USB- oder boardintern belegte Pins bleiben trotzdem zu prüfen.",
  },
};

export function createPinMultiplexingLab() {
  const requestedBoard = new URLSearchParams(window.location.search).get("board");
  const initialBoard = BOARDS[requestedBoard] ? requestedBoard : "nano";
  const state = {
    boardId: initialBoard,
    assignments: { ...BOARDS[initialBoard].defaults },
    pwmFrequency: 1000,
    pwmDuty: 35,
    spiFrequency: 1000000,
    spiByte: "A5",
    adcVoltage: initialBoard === "nano" ? 2.5 : 1.65,
    wifiActive: false,
    scopeSignals: ["pwm", "spiSclk"],
    logicSignals: ["spiCs", "spiSclk", "spiMosi", "spiMiso"],
    scopeCaptured: false,
    logicCaptured: false,
  };
  const observers = [];

  return {
    id: "pinmux",
    title: "Pin-Multiplexing",
    status: "Projektlabor",
    summary: "Arduino Nano und ESP32 ohne Flashen verdrahten und messen",
    mount(target) {
      target.innerHTML = `
        <article class="lab-card pinmux-lab">
          <header class="pinmux-heading">
            <div><span class="lab-status">Reine Browser-Simulation</span><h2>Pin-Multiplexing-Projektlabor</h2><p>Ordne interne Peripheriesignale den Pins eines virtuellen Boards zu. Es wird keine Hardware erkannt, beschrieben oder geflasht.</p></div>
            <div class="pinmux-project-switch" role="group" aria-label="Virtuelles Boardprojekt">
              ${Object.values(BOARDS).map((board) => `<button type="button" data-pinmux-board="${board.id}">${board.title}</button>`).join("")}
            </div>
          </header>
          <section class="pinmux-task-strip"><strong data-project-title></strong><span data-project-subtitle></span><p data-project-explanation></p></section>
          <div class="pinmux-workspace">
            <section class="pinmux-panel"><h3>1 · Pins und Funktionen</h3><div class="pinmux-board" data-pin-board></div></section>
            <section class="pinmux-panel"><h3>2 · Ressourcen zuordnen</h3><div class="pinmux-assignments" data-assignments></div><div class="pinmux-actions"><button type="button" data-pinmux-action="reference">Referenzbelegung</button><button type="button" data-pinmux-action="alternative">Alternative testen</button><button type="button" data-pinmux-action="conflict">Konflikt erzeugen</button></div></section>
          </div>
          <section class="pinmux-controls" data-signal-controls></section>
          <section class="pinmux-validation" data-validation aria-live="polite"></section>
          <div class="pinmux-instruments">
            <section class="pinmux-instrument"><header><div><span>Virtuell angeschlossen</span><h3>Oszilloskop</h3></div><button type="button" data-capture="scope">Erfassung starten</button></header><div class="pinmux-probes" data-scope-probes></div><div class="pinmux-screen"><canvas data-scope-canvas aria-label="Virtuelles Zweikanal-Oszilloskop"></canvas></div><output data-scope-readout></output></section>
            <section class="pinmux-instrument"><header><div><span>Virtuell angeschlossen</span><h3>Logikanalysator</h3></div><button type="button" data-capture="logic">Erfassung starten</button></header><div class="pinmux-probes" data-logic-probes></div><div class="pinmux-screen"><canvas data-logic-canvas aria-label="Virtueller Vierkanal-Logikanalysator"></canvas></div><div class="decode-strip" data-decode></div></section>
          </div>
          <footer class="pinmux-result" data-result></footer>
        </article>`;

      const elements = {
        board: target.querySelector("[data-pin-board]"),
        assignments: target.querySelector("[data-assignments]"),
        validation: target.querySelector("[data-validation]"),
        controls: target.querySelector("[data-signal-controls]"),
        scopeProbes: target.querySelector("[data-scope-probes]"),
        logicProbes: target.querySelector("[data-logic-probes]"),
        scopeCanvas: target.querySelector("[data-scope-canvas]"),
        logicCanvas: target.querySelector("[data-logic-canvas]"),
        scopeReadout: target.querySelector("[data-scope-readout]"),
        decode: target.querySelector("[data-decode]"),
        result: target.querySelector("[data-result]"),
        projectTitle: target.querySelector("[data-project-title]"),
        projectSubtitle: target.querySelector("[data-project-subtitle]"),
        projectExplanation: target.querySelector("[data-project-explanation]"),
      };

      const renderAll = () => renderLab(target, elements, state);
      target.querySelectorAll("[data-pinmux-board]").forEach((button) => button.addEventListener("click", () => {
        switchBoard(state, button.dataset.pinmuxBoard);
        renderAll();
      }));
      target.querySelectorAll("[data-pinmux-action]").forEach((button) => button.addEventListener("click", () => {
        applyScenario(state, button.dataset.pinmuxAction);
        renderAll();
      }));
      target.querySelector('[data-capture="scope"]').addEventListener("click", () => { state.scopeCaptured = true; renderAll(); });
      target.querySelector('[data-capture="logic"]').addEventListener("click", () => { state.logicCaptured = true; renderAll(); });
      target.addEventListener("change", (event) => {
        const assignment = event.target.dataset.assignment;
        const scopeChannel = event.target.dataset.scopeChannel;
        const logicChannel = event.target.dataset.logicChannel;
        const numeric = event.target.dataset.numeric;
        if (assignment) state.assignments[assignment] = event.target.value;
        if (scopeChannel !== undefined) state.scopeSignals[Number(scopeChannel)] = event.target.value;
        if (logicChannel !== undefined) state.logicSignals[Number(logicChannel)] = event.target.value;
        if (numeric) state[numeric] = Number(event.target.value);
        if (event.target.matches("[data-wifi-active]")) state.wifiActive = event.target.checked;
        resetCaptures(state);
        renderAll();
      });
      const redrawInstruments = () => {
        const board = BOARDS[state.boardId];
        drawScope(elements.scopeCanvas, board, state);
        drawLogic(elements.logicCanvas, board, state);
      };
      [elements.scopeCanvas, elements.logicCanvas].forEach((canvas) => {
        const observer = new ResizeObserver(redrawInstruments);
        observer.observe(canvas.parentElement);
        observers.push(observer);
      });
      renderAll();
    },
    dispose() { observers.splice(0).forEach((observer) => observer.disconnect()); },
  };
}

function renderLab(target, elements, state) {
  const board = BOARDS[state.boardId];
  target.querySelectorAll("[data-pinmux-board]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.pinmuxBoard === board.id)));
  elements.projectTitle.textContent = board.title;
  elements.projectSubtitle.textContent = board.subtitle;
  elements.projectExplanation.textContent = board.explanation;
  const validation = validateAssignments(board, state);
  renderBoard(elements.board, board, state, validation);
  renderAssignments(elements.assignments, board, state, validation);
  renderControls(elements.controls, board, state);
  renderProbeSelectors(elements.scopeProbes, state.scopeSignals, "scopeChannel", 2);
  renderProbeSelectors(elements.logicProbes, state.logicSignals, "logicChannel", 4);
  renderValidation(elements.validation, validation);
  drawScope(elements.scopeCanvas, board, state);
  drawLogic(elements.logicCanvas, board, state);
  elements.scopeReadout.textContent = scopeReadout(board, state);
  elements.decode.innerHTML = logicDecode(state, validation).map((token) => `<span>${token}</span>`).join("");
  const complete = validation.errors.length === 0 && state.scopeCaptured && state.logicCaptured;
  elements.result.className = `pinmux-result ${complete ? "is-complete" : ""}`;
  elements.result.innerHTML = complete
    ? `<strong>Projekt abgeschlossen</strong><span>Die Belegung ist konfliktfrei und beide virtuellen Messgeräte haben Signale erfasst. Übertrage das Ergebnis jetzt in den Ressourcenplan der Lektion.</span>`
    : `<strong>Noch zu prüfen</strong><span>${validation.errors.length ? "Behebe zuerst die Pin- und Ressourcenkonflikte." : "Starte anschließend je eine Oszilloskop- und Logikanalysator-Erfassung."}</span>`;
}

function renderBoard(target, board, state, validation) {
  const usedByPin = invertAssignments(state.assignments);
  target.innerHTML = `<div class="pinmux-chip"><strong>${board.id === "nano" ? "ATmega328P" : "ESP32"}</strong><span>${board.voltage.toFixed(1)} V Logikmodell</span><small>Flashen deaktiviert</small></div><div class="pinmux-pin-grid">${board.pins.map((entry) => {
    const uses = usedByPin.get(entry.id) || [];
    const hasError = validation.errors.some((error) => error.pins.includes(entry.id));
    return `<article class="pinmux-pin ${uses.length ? "is-used" : ""} ${hasError ? "has-error" : ""}"><strong>${entry.id}</strong><span>${entry.note || "GPIO"}</span>${uses.length ? `<small>${uses.map(signalLabel).join(" · ")}</small>` : ""}</article>`;
  }).join("")}</div>`;
}

function renderAssignments(target, board, state, validation) {
  target.innerHTML = SIGNALS.map(([signal, label]) => {
    const issue = validation.bySignal.get(signal);
    return `<label class="pinmux-assignment ${issue?.level === "error" ? "has-error" : issue?.level === "warning" ? "has-warning" : ""}"><span><strong>${label}</strong><small>${issue?.message || "Pin auswählen"}</small></span><select data-assignment="${signal}" aria-label="${label}">${board.pins.map((entry) => `<option value="${entry.id}" ${state.assignments[signal] === entry.id ? "selected" : ""}>${entry.id}</option>`).join("")}</select></label>`;
  }).join("");
}

function renderControls(target, board, state) {
  target.innerHTML = `
    <label><span>PWM-Frequenz</span><input type="range" min="100" max="5000" step="100" value="${state.pwmFrequency}" data-numeric="pwmFrequency"><output>${state.pwmFrequency} Hz</output></label>
    <label><span>PWM-Tastgrad</span><input type="range" min="0" max="100" step="5" value="${state.pwmDuty}" data-numeric="pwmDuty"><output>${state.pwmDuty} %</output></label>
    <label><span>SPI-Takt</span><input type="range" min="100000" max="4000000" step="100000" value="${state.spiFrequency}" data-numeric="spiFrequency"><output>${formatRate(state.spiFrequency)}</output></label>
    <label><span>ADC-Spannung</span><input type="range" min="0" max="${board.voltage}" step="0.05" value="${state.adcVoltage}" data-numeric="adcVoltage"><output>${state.adcVoltage.toFixed(2)} V</output></label>
    ${board.id === "esp32" ? `<label class="pinmux-check"><input type="checkbox" data-wifi-active ${state.wifiActive ? "checked" : ""}><span>WLAN aktiv – ADC2-Konflikt prüfen</span></label>` : ""}`;
}

function renderProbeSelectors(target, values, datasetName, count) {
  target.innerHTML = Array.from({ length: count }, (_, index) => `<label><span>${datasetName === "scopeChannel" ? `CH${index + 1}` : `D${index}`}</span><select data-${toKebab(datasetName)}="${index}">${SIGNALS.map(([signal, label]) => `<option value="${signal}" ${values[index] === signal ? "selected" : ""}>${label}</option>`).join("")}</select></label>`).join("");
}

function renderValidation(target, validation) {
  const messages = [...validation.errors, ...validation.warnings];
  target.className = `pinmux-validation ${validation.errors.length ? "has-error" : validation.warnings.length ? "has-warning" : "is-valid"}`;
  target.innerHTML = `<strong>${validation.errors.length ? `${validation.errors.length} Konflikt${validation.errors.length === 1 ? "" : "e"}` : "Belegung technisch möglich"}</strong><ul>${(messages.length ? messages : [{ message: "Alle Signale besitzen geeignete, voneinander getrennte Pins." }]).map((item) => `<li>${item.message}</li>`).join("")}</ul>`;
}

function validateAssignments(board, state) {
  const errors = [];
  const warnings = [];
  const bySignal = new Map();
  const pinById = new Map(board.pins.map((entry) => [entry.id, entry]));
  for (const [signal] of SIGNALS) {
    const assignedPin = state.assignments[signal];
    const entry = pinById.get(assignedPin);
    if (!entry?.functions.includes(signal)) {
      const message = board.id === "nano" && signal.startsWith("spi")
        ? `${signalLabel(signal)} ist beim ATmega328P nicht auf ${assignedPin} routbar.`
        : `${assignedPin} unterstützt ${signalLabel(signal)} in diesem Lernprofil nicht.`;
      const issue = { level: "error", signal, pins: [assignedPin], message };
      errors.push(issue); bySignal.set(signal, issue);
    }
  }
  for (const [assignedPin, signals] of invertAssignments(state.assignments)) {
    if (signals.length < 2) continue;
    const message = `${assignedPin} ist gleichzeitig für ${signals.map(signalLabel).join(" und ")} belegt.`;
    const issue = { level: "error", pins: [assignedPin], message };
    errors.push(issue);
    signals.forEach((signal) => bySignal.set(signal, { ...issue, signal }));
  }
  if (board.id === "esp32") {
    for (const [signal, assignedPin] of Object.entries(state.assignments)) {
      const number = Number(assignedPin.replace("GPIO", ""));
      if (ESP32_STRAPPING.has(number)) {
        const issue = { level: "warning", signal, pins: [assignedPin], message: `${assignedPin} ist ein Strapping-Pin; die externe Beschaltung muss den Bootpegel zulassen.` };
        warnings.push(issue); if (!bySignal.has(signal)) bySignal.set(signal, issue);
      }
    }
    const adcNumber = Number(state.assignments.adc.replace("GPIO", ""));
    if (state.wifiActive && ESP32_ADC2.has(adcNumber)) {
      const issue = { level: "error", signal: "adc", pins: [state.assignments.adc], message: `${state.assignments.adc} gehört beim klassischen ESP32 zu ADC2 und kollidiert im Lernmodell mit aktivem WLAN.` };
      errors.push(issue); bySignal.set("adc", issue);
    }
  }
  return { errors, warnings, bySignal };
}

function drawScope(canvas, board, state) {
  const { ctx, width, height } = canvasContext(canvas);
  drawGrid(ctx, width, height);
  state.scopeSignals.forEach((signal, channel) => {
    ctx.strokeStyle = channel === 0 ? "#68e5f5" : "#ffb35a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const definition = signalDefinition(signal, board, state);
    for (let x = 0; x <= width; x += 2) {
      const t = x / width;
      const normalized = waveformValue(definition, t);
      const center = channel === 0 ? height * .3 : height * .7;
      const y = center - normalized * height * .16;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`CH${channel + 1} ${signalLabel(signal)} · ${state.assignments[signal]}`, 10, channel === 0 ? 18 : height * .52);
  });
}

function drawLogic(canvas, board, state) {
  const { ctx, width, height } = canvasContext(canvas);
  ctx.fillStyle = "#050a10"; ctx.fillRect(0, 0, width, height);
  state.logicSignals.forEach((signal, channel) => {
    const definition = signalDefinition(signal, board, state);
    const top = 18 + channel * ((height - 24) / 4);
    const high = top + 8; const low = top + 40;
    ctx.strokeStyle = channel % 2 ? "#ffb35a" : "#68e5f5";
    ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 76; x <= width; x += 2) {
      const bit = waveformValue(definition, (x - 76) / Math.max(1, width - 76)) > 0;
      const y = bit ? high : low;
      if (x === 76) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#cbd5e1"; ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(`D${channel} ${signalLabel(signal)}`, 7, top + 26);
  });
}

function drawGrid(ctx, width, height) {
  ctx.fillStyle = "#050a10"; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#17324d"; ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += width / 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += height / 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
}

function signalDefinition(signal, board, state) {
  if (signal === "adc") return { kind: "dc", level: state.adcVoltage / board.voltage };
  if (signal === "pwm") return { kind: "square", cycles: 5, duty: state.pwmDuty / 100 };
  if (signal === "spiSclk") return { kind: "square", cycles: 8, duty: .5 };
  if (signal === "spiCs") return { kind: "window", start: .08, end: .92, inverted: true };
  if (signal === "spiMosi" || signal === "spiMiso") return { kind: "bits", bits: byteBits(signal === "spiMosi" ? state.spiByte : invertByte(state.spiByte)) };
  if (signal === "uartTx") return { kind: "bits", bits: [1, 0, ...byteBits(state.spiByte), 1, 1] };
  return { kind: "dc", level: .8 };
}

function waveformValue(definition, t) {
  if (definition.kind === "dc") return definition.level * 2 - 1;
  if (definition.kind === "square") return (t * definition.cycles) % 1 < definition.duty ? 1 : -1;
  if (definition.kind === "window") {
    const inside = t >= definition.start && t <= definition.end;
    return (definition.inverted ? !inside : inside) ? 1 : -1;
  }
  if (definition.kind === "bits") return definition.bits[Math.min(definition.bits.length - 1, Math.floor(t * definition.bits.length))] ? 1 : -1;
  return -1;
}

function logicDecode(state, validation) {
  if (validation.errors.length) return ["Dekoder angehalten", "Pinbelegung ungültig"];
  const selected = new Set(state.logicSignals);
  if (["spiCs", "spiSclk", "spiMosi"].every((signal) => selected.has(signal))) return ["CS aktiv", `MOSI 0x${state.spiByte}`, `MISO 0x${invertByte(state.spiByte)}`, "CS inaktiv"];
  if (selected.has("pwm")) return [`PWM ${state.pwmFrequency} Hz`, `Tastgrad ${state.pwmDuty} %`];
  if (selected.has("uartTx")) return ["Start", `Daten 0x${state.spiByte}`, "Stop"];
  return ["Digitale Pegel erfasst", "Für SPI CS, SCLK und MOSI anschließen"];
}

function scopeReadout(board, state) {
  return state.scopeSignals.map((signal, index) => {
    const frequency = signal === "pwm" ? state.pwmFrequency : signal.startsWith("spi") ? state.spiFrequency : 0;
    return `CH${index + 1}: ${signalLabel(signal)} an ${state.assignments[signal]} · ${frequency ? formatRate(frequency) : `${state.adcVoltage.toFixed(2)} V`} · ${board.voltage.toFixed(1)} V Logik`;
  }).join(" | ");
}

function switchBoard(state, boardId) {
  const board = BOARDS[boardId];
  if (!board) return;
  state.boardId = boardId;
  state.assignments = { ...board.defaults };
  state.scopeSignals = ["pwm", "spiSclk"];
  state.logicSignals = ["spiCs", "spiSclk", "spiMosi", "spiMiso"];
  state.adcVoltage = board.id === "nano" ? 2.5 : 1.65;
  state.wifiActive = false;
  resetCaptures(state);
}

function applyScenario(state, action) {
  const board = BOARDS[state.boardId];
  if (action === "reference") state.assignments = { ...board.defaults };
  if (action === "alternative") state.assignments = { ...board.alternative };
  if (action === "conflict") state.assignments = { ...board.defaults, pwm: board.defaults.spiMosi };
  resetCaptures(state);
}

function resetCaptures(state) { state.scopeCaptured = false; state.logicCaptured = false; }
function invertAssignments(assignments) { const result = new Map(); for (const [signal, assignedPin] of Object.entries(assignments)) result.set(assignedPin, [...(result.get(assignedPin) || []), signal]); return result; }
function signalLabel(signal) { return SIGNALS.find(([id]) => id === signal)?.[1] || signal; }
function pin(id, functions = [], note = "") { return { id, functions, note }; }
function byteBits(value) { const byte = parseInt(value, 16) || 0; return Array.from({ length: 8 }, (_, index) => (byte >> (7 - index)) & 1); }
function invertByte(value) { return ((~(parseInt(value, 16) || 0)) & 0xff).toString(16).toUpperCase().padStart(2, "0"); }
function formatRate(value) { return value >= 1000000 ? `${(value / 1000000).toFixed(1)} MHz` : value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${value} Hz`; }
function toKebab(value) { return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`); }
function canvasContext(canvas) { const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; const width = Math.max(320, rect.width || 640); const height = Math.max(220, rect.height || 260); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); return { ctx, width, height }; }
