const TAU = Math.PI * 2;

export function createFilterLab() {
  const state = { type: "lowpass", amplitude: 1, frequency: 1000, start: 10, stop: 100000, resistance: 1000, capacitance: 100e-9, inductance: 10e-3, target: 1000 };
  let resizeObserver;
  return {
    id: "filters", title: "Filterlabor", status: "Nutzbar · Übung", summary: "Filter auslegen und mit Sinusquelle vermessen",
    mount(target) {
      target.innerHTML = `<article class="lab-card"><h2>Filter auslegen und vermessen</h2><p>Eine Sinusquelle speist den Filter. Vergleiche Eingang und Ausgang im Zeitbereich, führe einen Frequenz-Sweep durch und lege Bauteile für eine gewünschte Grenz- oder Resonanzfrequenz aus.</p><div class="filter-layout"><div><div class="filter-schematic" data-schematic></div><div class="filter-plots"><section><h3>Zweikanal-Messung</h3><canvas data-time aria-label="Eingangs- und Ausgangssignal"></canvas></section><section><h3>Frequenzgang</h3><canvas data-bode aria-label="Bode-Diagramm des Filters"></canvas></section></div><div class="filter-readout" data-readout></div><p class="scope-note" data-feedback></p></div><aside class="scope-controls" data-controls></aside></div></article>`;
      const schematic = target.querySelector("[data-schematic]");
      const timeCanvas = target.querySelector("[data-time]");
      const bodeCanvas = target.querySelector("[data-bode]");
      const readout = target.querySelector("[data-readout]");
      const feedback = target.querySelector("[data-feedback]");
      const controls = target.querySelector("[data-controls]");
      const render = () => {
        prepare(timeCanvas); prepare(bodeCanvas);
        const point = response(state, state.frequency);
        schematic.innerHTML = renderSchematic(state);
        drawTime(timeCanvas, state, point);
        drawBode(bodeCanvas, state);
        const output = state.amplitude * point.magnitude;
        readout.innerHTML = `<span>Quelle: Sinus · ${formatFrequency(state.frequency)}</span><span>U<sub>ein</sub> ${state.amplitude.toFixed(3)} Veff</span><span>U<sub>aus</sub> ${output.toFixed(3)} Veff</span><span>${db(point.magnitude).toFixed(2)} dB</span><span>Phase ${point.phase.toFixed(1)}°</span><span>${designLabel(state)}</span>`;
        feedback.textContent = feedbackText(state, point);
      };
      addSelect(controls, "Filtertyp", [["lowpass", "RC-Tiefpass"], ["highpass", "RC-Hochpass"], ["bandpass", "RLC-Bandpass"]], state.type, (value) => state.type = value, render);
      addNumber(controls, "Sinusquelle Ueff", state.amplitude, (value) => state.amplitude = clamp(value, .01, 10), "V", render, .1);
      addNumber(controls, "Messfrequenz", state.frequency, (value) => state.frequency = clamp(value, 1, 1e7), "Hz", render, 10);
      addNumber(controls, "Sweep Start", state.start, (value) => state.start = clamp(value, 1, state.stop / 1.1), "Hz", render, 10);
      addNumber(controls, "Sweep Stopp", state.stop, (value) => state.stop = clamp(value, state.start * 1.1, 1e8), "Hz", render, 100);
      addNumber(controls, "R", state.resistance, (value) => state.resistance = clamp(value, 1, 1e6), "Ω", render, 10);
      addNumber(controls, "C", state.capacitance * 1e9, (value) => state.capacitance = clamp(value, .001, 1e9) * 1e-9, "nF", render, 1);
      addNumber(controls, "L", state.inductance * 1000, (value) => state.inductance = clamp(value, .001, 1e6) / 1000, "mH", render, 1);
      addNumber(controls, "Ziel-Frequenz", state.target, (value) => state.target = clamp(value, 1, 1e7), "Hz", render, 10);
      addAction(controls, "Bauteile auslegen", "AUSLEGEN", () => {
        if (state.type === "bandpass") state.inductance = 1 / ((TAU * state.target) ** 2 * state.capacitance);
        else state.capacitance = 1 / (TAU * state.resistance * state.target);
        controls.querySelector('input[aria-label="C"]').value = Number((state.capacitance * 1e9).toPrecision(6));
        controls.querySelector('input[aria-label="L"]').value = Number((state.inductance * 1000).toPrecision(6));
        render();
      });
      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(timeCanvas); resizeObserver.observe(bodeCanvas);
      render();
      this.dispose = () => resizeObserver?.disconnect();
    },
    dispose() { resizeObserver?.disconnect(); },
  };
}

function response(state, frequency) {
  const omega = TAU * Math.max(frequency, 1e-12);
  if (state.type === "lowpass") { const ratio = omega * state.resistance * state.capacitance; return { magnitude: 1 / Math.sqrt(1 + ratio * ratio), phase: -Math.atan(ratio) * 180 / Math.PI }; }
  if (state.type === "highpass") { const ratio = omega * state.resistance * state.capacitance; return { magnitude: ratio / Math.sqrt(1 + ratio * ratio), phase: 90 - Math.atan(ratio) * 180 / Math.PI }; }
  const reactance = omega * state.inductance - 1 / (omega * state.capacitance);
  return { magnitude: state.resistance / Math.sqrt(state.resistance ** 2 + reactance ** 2), phase: -Math.atan2(reactance, state.resistance) * 180 / Math.PI };
}

function designFrequency(state) { return state.type === "bandpass" ? 1 / (TAU * Math.sqrt(state.inductance * state.capacitance)) : 1 / (TAU * state.resistance * state.capacitance); }
function designLabel(state) { return `${state.type === "bandpass" ? "f₀" : "fᵍ"} ${formatFrequency(designFrequency(state))}`; }
function feedbackText(state, point) { const level = db(point.magnitude); if (Math.abs(level + 3.01) < .5 && state.type !== "bandpass") return "Die Messfrequenz liegt ungefähr an der Grenzfrequenz: Uaus beträgt etwa 70,7 % von Uein (−3 dB)."; if (state.type === "bandpass" && level > -.5) return "Die Messfrequenz liegt nahe der Resonanz. Der Serien-RLC-Bandpass überträgt hier am stärksten."; return `Stelle die Messfrequenz schrittweise um und beobachte Amplitude und Phase. Aktuelle Übertragung: ${level.toFixed(2)} dB.`; }

function renderSchematic(state) {
  const filter = state.type === "lowpass"
    ? `<rect class="filter-component" x="245" y="72" width="90" height="28"/><text x="290" y="63" text-anchor="middle">R ${formatResistance(state.resistance)}</text><line x1="335" y1="86" x2="430" y2="86"/><line x1="390" y1="86" x2="390" y2="155"/><line class="filter-component" x1="360" y1="155" x2="420" y2="155"/><line class="filter-component" x1="360" y1="178" x2="420" y2="178"/><line x1="390" y1="178" x2="390" y2="238"/><text x="430" y="170">C ${formatCapacitance(state.capacitance)}</text>`
    : state.type === "highpass"
      ? `<line x1="230" y1="86" x2="270" y2="86"/><line class="filter-component" x1="270" y1="55" x2="270" y2="117"/><line class="filter-component" x1="294" y1="55" x2="294" y2="117"/><line x1="294" y1="86" x2="430" y2="86"/><line x1="390" y1="86" x2="390" y2="130"/><rect class="filter-component" x="376" y="130" width="28" height="82"/><line x1="390" y1="212" x2="390" y2="238"/><text x="282" y="43" text-anchor="middle">C ${formatCapacitance(state.capacitance)}</text><text x="420" y="173">R ${formatResistance(state.resistance)}</text>`
      : `<line x1="230" y1="86" x2="255" y2="86"/><line class="filter-component" x1="255" y1="55" x2="255" y2="117"/><line class="filter-component" x1="279" y1="55" x2="279" y2="117"/><line x1="279" y1="86" x2="305" y2="86"/><path class="filter-component" d="M305 86 c10 -28 20 28 30 0 s20 28 30 0 s20 28 30 0"/><line x1="395" y1="86" x2="430" y2="86"/><line x1="430" y1="86" x2="430" y2="125"/><rect class="filter-component" x="416" y="125" width="28" height="80"/><line x1="430" y1="205" x2="430" y2="238"/><text x="267" y="43" text-anchor="middle">C ${formatCapacitance(state.capacitance)}</text><text x="350" y="50" text-anchor="middle">L ${formatInductance(state.inductance)}</text><text x="453" y="170">R ${formatResistance(state.resistance)}</text>`;
  return `<svg viewBox="0 0 620 280" role="img" aria-label="${state.type === "bandpass" ? "RLC-Bandpass" : state.type === "lowpass" ? "RC-Tiefpass" : "RC-Hochpass"} mit Sinusspannungsquelle"><g class="filter-wires"><circle class="filter-source" cx="130" cy="150" r="48"/><path class="source-sine" d="M98 150 c12 -32 24 32 36 0 s24 32 36 0"/><line x1="130" y1="102" x2="130" y2="86"/><line x1="130" y1="86" x2="230" y2="86"/>${filter}<line x1="430" y1="238" x2="130" y2="238"/><line x1="130" y1="238" x2="130" y2="198"/><circle class="filter-node input-node" cx="215" cy="86" r="6"/><circle class="filter-node output-node" cx="430" cy="86" r="6"/><text x="88" y="79">Sinusquelle</text><text x="198" y="113">CH1 · Uein</text><text x="438" y="106">CH2 · Uaus</text><text x="77" y="222">${state.amplitude.toFixed(2)} Veff</text></g></svg>`;
}

function drawTime(canvas, state, point) { const ctx = canvas.getContext("2d"); const width = canvas.clientWidth; const height = canvas.clientHeight; const ratio = window.devicePixelRatio || 1; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); screen(ctx, width, height); ctx.lineWidth = 2; [["#68e5f5", 1, 0], ["#ffb35a", point.magnitude, point.phase * Math.PI / 180]].forEach(([color, magnitude, phase]) => { ctx.strokeStyle = color; ctx.beginPath(); for (let x = 0; x <= width; x++) { const value = Number(magnitude) * Math.sin(TAU * x / width * 3 + Number(phase)); const y = height / 2 - value * height * .34; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }); ctx.fillStyle = "#68e5f5"; ctx.fillText("CH1 Eingang", 10, 18); ctx.fillStyle = "#ffb35a"; ctx.fillText("CH2 Ausgang", 105, 18); }
function drawBode(canvas, state) { const ctx = canvas.getContext("2d"); const width = canvas.clientWidth; const height = canvas.clientHeight; const ratio = window.devicePixelRatio || 1; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); screen(ctx, width, height); const range = Math.log(state.stop / state.start); ctx.strokeStyle = "#7ff0af"; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= width; x++) { const frequency = state.start * Math.exp(range * x / width); const level = db(response(state, frequency).magnitude); const y = 12 + clamp(-level / 60, 0, 1) * (height - 24); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); const markerX = clamp(Math.log(state.frequency / state.start) / range, 0, 1) * width; ctx.strokeStyle = "#f5e663"; ctx.setLineDash([5, 4]); line(ctx, markerX, 0, markerX, height); ctx.setLineDash([]); ctx.fillStyle = "#a6b6c9"; ctx.fillText("0 dB", 8, 16); ctx.fillText("−60 dB", 8, height - 8); ctx.fillText(formatFrequency(state.start), 55, height - 8); ctx.fillText(formatFrequency(state.stop), Math.max(120, width - 75), height - 8); }
function screen(ctx, width, height) { ctx.fillStyle = "#050a10"; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = "#18334b"; ctx.lineWidth = 1; for (let x = 0; x <= 10; x++) line(ctx, x * width / 10, 0, x * width / 10, height); for (let y = 0; y <= 8; y++) line(ctx, 0, y * height / 8, width, y * height / 8); ctx.font = "11px ui-monospace, monospace"; }
function prepare(canvas) { const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio)); }
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function db(value) { return 20 * Math.log10(Math.max(value, 1e-9)); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
function formatFrequency(value) { if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MHz`; if (value >= 1000) return `${(value / 1000).toFixed(2)} kHz`; return `${value.toFixed(1)} Hz`; }
function formatResistance(value) { if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MΩ`; if (value >= 1000) return `${(value / 1000).toFixed(2)} kΩ`; return `${value.toFixed(1)} Ω`; }
function formatCapacitance(value) { if (value >= 1e-6) return `${(value * 1e6).toFixed(2)} µF`; if (value >= 1e-9) return `${(value * 1e9).toFixed(2)} nF`; return `${(value * 1e12).toFixed(2)} pF`; }
function formatInductance(value) { return value >= 1 ? `${value.toFixed(2)} H` : `${(value * 1000).toFixed(2)} mH`; }
function control(label) { const section = document.createElement("section"); section.className = "control-group"; section.innerHTML = `<h3>${label}</h3>`; return section; }
function addNumber(parent, label, initial, set, unit, changed, step) { const section = control(label); const input = document.createElement("input"); input.type = "number"; input.setAttribute("aria-label", label); input.value = initial; input.step = step; input.addEventListener("input", () => { set(Number(input.value)); changed(); }); const output = document.createElement("output"); output.textContent = unit; section.append(input, output); parent.append(section); }
function addSelect(parent, label, options, initial, set, changed) { const section = control(label); const select = document.createElement("select"); select.setAttribute("aria-label", label); for (const [value, text] of options) select.add(new Option(text, value)); select.value = initial; select.addEventListener("change", () => { set(select.value); changed(); }); section.append(select); parent.append(section); }
function addAction(parent, label, text, action) { const section = control(label); const button = document.createElement("button"); button.type = "button"; button.className = "instrument-button filter-design-button"; button.textContent = text; button.addEventListener("click", action); section.append(button); parent.append(section); }
