const AM_STATIONS = [
  { carrier: 1000, bandwidth: 10, tauMin: 20, tauMax: 100, phrase: "Hallo GerNetiX" },
  { carrier: 1020, bandwidth: 6, tauMin: 20, tauMax: 165, phrase: "Guten Tag GerNetiX" },
];
const FM_STATIONS = [
  { rf: 100.7, intermediate: 10.7, bandwidth: 170, deviation: 75, audioBandwidth: 10, phrase: "Hallo GerNetiX" },
  { rf: 101.0, intermediate: 10.7, bandwidth: 120, deviation: 50, audioBandwidth: 10, phrase: "Guten Tag GerNetiX" },
];

export function createRadioLab() {
  const state = { mode: "am", solved: false, result: "", amTune: 900, amBandwidth: 4, amDetector: "none", amTau: 10, fmRf: 99.5, fmLo: 110, fmIf: 9, fmBandwidth: 50, fmDeviation: 25, fmDetector: "none" };
  let resizeObserver;
  let stopAudio = () => {};
  return {
    id: "radio", title: "Radiolabor", status: "Nutzbar · Übung", summary: "AM-Hüllkurve und FM-Superhet demodulieren",
    mount(target) {
      target.innerHTML = `<article class="lab-card"><h2>Radiolabor · AM und FM empfangen</h2><p>Zwei Sender belegen gleichzeitig das Band. Analysiere beide Spektren, stimme den Empfänger auf einen Sender ab und höre, welche Stationsansage er überträgt.</p><section class="radio-task"><div><span>Zwei unbekannte Sender</span><strong>„Hallo GerNetiX“ · „Guten Tag GerNetiX“</strong><p data-task></p></div><button type="button" data-check>DEMODULIEREN</button><button type="button" class="radio-play" data-play>▶ EMPFANG ANHÖREN</button><output data-result></output></section><div class="radio-layout"><div><div class="radio-blocks" data-blocks></div><div class="radio-plots"><section><h3>HF-Spektrum mit zwei unbekannten Sendern</h3><canvas data-rf aria-label="Spektrum zweier modulierter Hochfrequenzsignale"></canvas></section><section><h3>Demodulator-Ausgang · Zeitbereich</h3><canvas data-audio aria-label="Demoduliertes Audiosignal"></canvas></section></div><div class="radio-readout" data-readout></div><p class="scope-note" data-feedback></p></div><aside class="scope-controls" data-controls></aside></div></article>`;
      const task = target.querySelector("[data-task]"); const blocks = target.querySelector("[data-blocks]"); const rfCanvas = target.querySelector("[data-rf]"); const audioCanvas = target.querySelector("[data-audio]"); const readout = target.querySelector("[data-readout]"); const feedback = target.querySelector("[data-feedback]"); const controls = target.querySelector("[data-controls]"); const check = target.querySelector("[data-check]"); const play = target.querySelector("[data-play]"); const result = target.querySelector("[data-result]");
      const render = () => { prepare(rfCanvas); prepare(audioCanvas); drawRadioSpectrum(rfCanvas, state); drawRecovered(audioCanvas, state); task.textContent = state.mode === "am" ? "Bestimme für beide Signale Trägerfrequenz und belegte Bandbreite aus Trägerlinien und Seitenbändern. Stimme anschließend einen der Sender sauber ab." : "Bestimme für beide Signale Mittenfrequenz und belegte Bandbreite. Das Nutzsignal ist jeweils auf 10 kHz begrenzt; leite mit der Carson-Regel den Hub des gewählten Senders ab."; blocks.innerHTML = renderBlocks(state); readout.innerHTML = renderReadout(state); feedback.textContent = diagnostic(state).message; play.dataset.quality = receptionQuality(state) > .85 ? "clear" : receptionQuality(state) > .35 ? "weak" : "noise"; result.textContent = state.result; };
      const changed = () => { stopAudio(); state.solved = false; state.result = ""; render(); };
      const rebuildControls = () => { stopAudio(); controls.replaceChildren(); buildControls(controls, state, rebuildControls, changed); render(); };
      check.addEventListener("click", () => { const diagnosis = diagnostic(state); state.solved = diagnosis.ok; state.result = diagnosis.ok ? "Signal sauber demoduliert – die Stationsansage ist freigeschaltet." : diagnosis.message; render(); });
      play.addEventListener("click", () => { stopAudio(); stopAudio = playReception(state); const quality = receptionQuality(state); state.result = quality > .85 ? "Klarer Empfang: Die Stationsansage ist verständlich." : quality > .35 ? "Schwacher Empfang: Die Ansage liegt noch unter Rauschen und Verzerrungen." : "Kein verwertbarer Empfang: Es ist nur Rauschen hörbar."; render(); });
      rebuildControls();
      resizeObserver = new ResizeObserver(render); resizeObserver.observe(rfCanvas); resizeObserver.observe(audioCanvas); render();
      this.dispose = () => { resizeObserver?.disconnect(); stopAudio(); window.speechSynthesis?.cancel(); };
    },
    dispose() { resizeObserver?.disconnect(); stopAudio(); window.speechSynthesis?.cancel(); },
  };
}

function buildControls(target, state, rebuild, changed) {
  addSelect(target, "Empfangsart", [["am", "AM · Hüllkurvendemodulator"], ["fm", "FM · Superhet-Empfänger"]], state.mode, (value) => { state.mode = value; state.solved = false; state.result = ""; }, rebuild);
  if (state.mode === "am") {
    addNumber(target, "Abstimmung", state.amTune, (value) => state.amTune = clamp(value, 500, 1600), "kHz", changed, 1);
    addNumber(target, "HF-Bandbreite", state.amBandwidth, (value) => state.amBandwidth = clamp(value, 1, 30), "kHz", changed, 1);
    addSelect(target, "Demodulator", [["none", "nicht gewählt"], ["envelope", "Diode · Hüllkurve"], ["product", "Produktdetektor"]], state.amDetector, (value) => state.amDetector = value, changed);
    addNumber(target, "RC-Zeitkonstante τ = R · C", state.amTau, (value) => state.amTau = clamp(value, 1, 500), "µs", changed, 5);
  } else {
    addNumber(target, "HF-Abstimmung", state.fmRf, (value) => state.fmRf = clamp(value, 87.5, 108), "MHz", changed, .1);
    addNumber(target, "Lokaloszillator", state.fmLo, (value) => state.fmLo = clamp(value, 90, 125), "MHz", changed, .1);
    addNumber(target, "ZF-Filter Mitte", state.fmIf, (value) => state.fmIf = clamp(value, 1, 20), "MHz", changed, .1);
    addNumber(target, "ZF-Bandbreite", state.fmBandwidth, (value) => state.fmBandwidth = clamp(value, 20, 500), "kHz", changed, 10);
    addNumber(target, "Demodulator-Hub", state.fmDeviation, (value) => state.fmDeviation = clamp(value, 5, 150), "kHz", changed, 5);
    addSelect(target, "FM-Demodulator", [["none", "nicht gewählt"], ["discriminator", "Frequenzdiskriminator"], ["envelope", "Hüllkurvendetektor"]], state.fmDetector, (value) => state.fmDetector = value, changed);
  }
}

function diagnostic(state) {
  if (state.mode === "am") {
    const station = nearestAmStation(state.amTune);
    if (Math.abs(state.amTune - station.carrier) > 3) return { ok: false, message: "Die AM-Abstimmung liegt noch nicht auf einer der beiden Trägerlinien im Spektrum." };
    if (state.amBandwidth < station.bandwidth - 2) return { ok: false, message: "Die HF-Bandbreite ist zu schmal; Seitenbänder des gewählten Senders werden abgeschnitten." };
    if (state.amBandwidth > station.bandwidth + 5) return { ok: false, message: "Die HF-Bandbreite ist zu breit und lässt den Nachbarsender sowie unnötiges Rauschen durch." };
    if (state.amDetector !== "envelope") return { ok: false, message: "Für diese AM-Aufgabe wird der Dioden-Hüllkurvendemodulator benötigt." };
    if (state.amTau < station.tauMin) return { ok: false, message: "Die RC-Zeitkonstante ist zu klein; zu viel Trägerwelligkeit bleibt im Audiosignal." };
    if (state.amTau > station.tauMax) return { ok: false, message: "Die RC-Zeitkonstante ist zu groß; die Hüllkurve kann der Sprache nicht schnell genug folgen." };
    return { ok: true, message: `AM-Sender bei ${station.carrier} kHz sauber demoduliert. Höre nun seine Stationsansage an.` };
  }
  const station = nearestFmStation(state.fmRf);
  if (Math.abs(state.fmRf - station.rf) > .05) return { ok: false, message: "Die HF-Stufe liegt noch nicht auf einer der beiden aus dem Spektrum bestimmten Mittenfrequenzen." };
  const expectedLo = station.rf + station.intermediate;
  if (Math.abs(state.fmLo - expectedLo) > .05) return { ok: false, message: "Der Lokaloszillator passt noch nicht: Bei Hochseitenmischung gilt LO = RF + 10,7 MHz." };
  if (Math.abs(Math.abs(state.fmLo - state.fmRf) - state.fmIf) > .05 || Math.abs(state.fmIf - station.intermediate) > .05) return { ok: false, message: "Mischer und ZF-Filter ergeben noch nicht die übliche Zwischenfrequenz von 10,7 MHz." };
  if (state.fmBandwidth < station.bandwidth - 20) return { ok: false, message: "Das ZF-Filter ist zu schmal für den gewählten FM-Sender." };
  if (state.fmBandwidth > station.bandwidth + 40) return { ok: false, message: "Das ZF-Filter ist zu breit; der Nachbarsender und Rauschen gelangen zum Demodulator." };
  if (Math.abs(state.fmDeviation - station.deviation) > 10) return { ok: false, message: "Der Demodulator-Hub passt noch nicht zum Ergebnis aus belegter Bandbreite und Carson-Regel." };
  if (state.fmDetector !== "discriminator") return { ok: false, message: "FM benötigt einen Frequenzdiskriminator; ein Hüllkurvendetektor gewinnt die Sprache nicht zurück." };
  return { ok: true, message: `Superhet korrekt: ${station.rf.toFixed(1).replace(".", ",")} MHz werden auf 10,7 MHz umgesetzt. Höre nun die Stationsansage an.` };
}

function receptionQuality(state) {
  if (state.mode === "am") {
    const station = nearestAmStation(state.amTune);
    const tune = clamp(1 - Math.abs(state.amTune - station.carrier) / 12, 0, 1);
    const bandwidth = clamp(1 - Math.abs(state.amBandwidth - station.bandwidth) / 14, 0, 1);
    const detector = state.amDetector === "envelope" ? 1 : state.amDetector === "product" ? .35 : .08;
    const timeConstant = clamp(1 - Math.abs(state.amTau - (station.tauMin + station.tauMax) / 2) / 170, 0, 1);
    return clamp((tune * .52 + bandwidth * .18 + timeConstant * .18 + detector * .12) * detector, 0, 1);
  }
  const station = nearestFmStation(state.fmRf);
  const rf = clamp(1 - Math.abs(state.fmRf - station.rf) / .18, 0, 1);
  const oscillator = clamp(1 - Math.abs(state.fmLo - (station.rf + station.intermediate)) / .25, 0, 1);
  const intermediate = clamp(1 - Math.abs(state.fmIf - station.intermediate) / 2, 0, 1);
  const bandwidth = clamp(1 - Math.abs(state.fmBandwidth - station.bandwidth) / 180, 0, 1);
  const deviation = clamp(1 - Math.abs(state.fmDeviation - station.deviation) / 100, 0, 1);
  const detector = state.fmDetector === "discriminator" ? 1 : .06;
  return clamp((rf * .3 + oscillator * .2 + intermediate * .18 + bandwidth * .12 + deviation * .12 + detector * .08) * detector, 0, 1);
}

function nearestAmStation(frequency) { return AM_STATIONS.reduce((nearest, station) => Math.abs(station.carrier - frequency) < Math.abs(nearest.carrier - frequency) ? station : nearest); }
function nearestFmStation(frequency) { return FM_STATIONS.reduce((nearest, station) => Math.abs(station.rf - frequency) < Math.abs(nearest.rf - frequency) ? station : nearest); }
function receivedStation(state) { return state.mode === "am" ? nearestAmStation(state.amTune) : nearestFmStation(state.fmRf); }

function renderBlocks(state) { const quality = receptionQuality(state); const audioState = quality > .85 ? "klar" : quality > .35 ? "schwach / verrauscht" : "Rauschen"; const blocks = state.mode === "am" ? [["Antenne", `${state.amTune.toFixed(0)} kHz`], ["HF-Filter", `${state.amBandwidth.toFixed(0)} kHz BW`], ["Diode", state.amDetector === "envelope" ? "Hüllkurve" : "falsch / aus"], ["RC-Tiefpass", `${state.amTau.toFixed(0)} µs`], ["Audio", audioState]] : [["Antenne", `${state.fmRf.toFixed(1)} MHz`], ["Mischer + LO", `${state.fmLo.toFixed(1)} MHz`], ["ZF-Filter", `${state.fmIf.toFixed(1)} MHz · ${state.fmBandwidth.toFixed(0)} kHz`], ["Begrenzer", "Amplitude konstant"], ["Diskriminator", state.fmDetector === "discriminator" ? `±${state.fmDeviation.toFixed(0)} kHz` : "falsch / aus"], ["Audio", audioState]]; return blocks.map(([name, value], index) => `<div class="radio-block${index === blocks.length - 1 && quality > .85 ? " is-ready" : ""}"><strong>${name}</strong><span>${value}</span></div>${index < blocks.length - 1 ? "<i>→</i>" : ""}`).join(""); }
function renderReadout(state) { if (state.mode === "am") { const station = nearestAmStation(state.amTune); const carrierPeriod = 1000 / station.carrier; const audioPeriod = 2000 / station.bandwidth; const rcState = state.amTau < station.tauMin ? "zu klein – Trägerwelligkeit" : state.amTau > station.tauMax ? "zu groß – Hüllkurve wird verschliffen" : "passend"; return `<span>Analyse: höchste Linie = Träger</span><span>Bandbreite = obere − untere Spektrumsgrenze</span><span>Aus dem Spektrum: fAudio,max ≈ Bandbreite ÷ 2</span><span>RC-Regel: Trägerperiode ≪ τ ≪ kürzeste Audioperiode</span><span>Hier: ${carrierPeriod.toFixed(1)} µs ≪ τ ≪ ${audioPeriod.toFixed(0)} µs</span><span>Praxisbereich: ${station.tauMin} bis ${station.tauMax} µs</span><span>Aktueller Wert ${state.amTau.toFixed(0)} µs: ${rcState}</span><span>τ = R · C; Beispiel: 10 kΩ · 4,7 nF = 47 µs</span><span>Empfänger ${state.amTune.toFixed(0)} kHz</span><span>Filter ${state.amBandwidth.toFixed(0)} kHz</span>`; } const mixed = Math.abs(state.fmLo - state.fmRf); return `<span>Analyse: Spektrumsmitte = Sender</span><span>Carson: B ≈ 2 · (Δf + 10 kHz)</span><span>Empfänger ${state.fmRf.toFixed(1)} MHz</span><span>LO ${state.fmLo.toFixed(1)} MHz</span><span>|LO − RF| ${mixed.toFixed(1)} MHz</span><span>ZF ${state.fmIf.toFixed(1)} MHz</span>`; }

function drawRadioSpectrum(canvas, state) {
  const ctx = context(canvas); const width = canvas.clientWidth; const height = canvas.clientHeight;
  screen(ctx, width, height);
  const plot = { left: 48, right: width - 12, top: 26, bottom: height - 34 };
  const range = state.mode === "am" ? { min: 985, max: 1035, unit: "kHz" } : { min: 100.5, max: 101.2, unit: "MHz" };
  const xAt = (frequency) => plot.left + (frequency - range.min) / (range.max - range.min) * (plot.right - plot.left);
  const yAt = (level) => plot.bottom - clamp((level + 80) / 80, 0, 1) * (plot.bottom - plot.top);
  ctx.fillStyle = "rgba(104,229,245,.08)"; ctx.fillRect(plot.left, yAt(-58), plot.right - plot.left, plot.bottom - yAt(-58));
  ctx.strokeStyle = "#4a6377"; ctx.lineWidth = 1; line(ctx, plot.left, plot.bottom, plot.right, plot.bottom); line(ctx, plot.left, plot.top, plot.left, plot.bottom);
  ctx.fillStyle = "#a6b6c9"; ctx.font = "10px ui-monospace, monospace";
  const divisions = state.mode === "am" ? 10 : 7;
  for (let tick = 0; tick <= divisions; tick++) {
    const frequency = range.min + (range.max - range.min) * tick / divisions; const x = xAt(frequency);
    ctx.strokeStyle = "#233b50"; line(ctx, x, plot.top, x, plot.bottom);
    ctx.fillStyle = "#a6b6c9"; ctx.textAlign = tick === 0 ? "left" : tick === divisions ? "right" : "center";
    ctx.fillText(state.mode === "am" ? frequency.toFixed(0) : frequency.toFixed(2), x, height - 13);
  }
  ctx.textAlign = "left"; ctx.fillText("0 dB", 6, plot.top + 4); ctx.fillText("−80", 6, plot.bottom); ctx.textAlign = "right"; ctx.fillText(range.unit, plot.right, 14);
  if (state.mode === "am") drawAmSpectrum(ctx, xAt, yAt, plot);
  else drawFmSpectrum(ctx, xAt, yAt, plot);
  ctx.textAlign = "left";
}

function drawAmSpectrum(ctx, xAt, yAt, plot) {
  const lineSets = [
    [[.5, -30], [1.2, -25], [2.1, -33], [3.2, -38], [4.1, -43], [5, -52]],
    [[.4, -28], [1.0, -32], [1.8, -36], [2.5, -43], [3, -52]],
  ];
  AM_STATIONS.forEach((station, stationIndex) => {
    ctx.strokeStyle = stationIndex === 0 ? "#68e5f5" : "#9cf59a";
    for (const [offset, level] of lineSets[stationIndex]) {
      for (const sign of [-1, 1]) { const x = xAt(station.carrier + sign * offset); ctx.lineWidth = 2; line(ctx, x, plot.bottom, x, yAt(level)); }
    }
    const carrierX = xAt(station.carrier); ctx.strokeStyle = stationIndex === 0 ? "#ffb35a" : "#ff8cbb"; ctx.lineWidth = 3; line(ctx, carrierX, plot.bottom, carrierX, yAt(stationIndex === 0 ? -3 : -8));
    ctx.fillStyle = stationIndex === 0 ? "#ffb35a" : "#ff8cbb"; ctx.textAlign = "center"; ctx.fillText(`Sender ${stationIndex + 1}`, carrierX, yAt(stationIndex === 0 ? -3 : -8) - 7);
    spectrumBracket(ctx, xAt(station.carrier - station.bandwidth / 2), xAt(station.carrier + station.bandwidth / 2), plot.top + 25 + stationIndex * 18, `B${stationIndex + 1}`);
  });
}

function drawFmSpectrum(ctx, xAt, yAt, plot) {
  const levelSets = [[-9, -7, -8, -11, -15, -19, -24, -31, -40], [-7, -9, -12, -17, -24, -34, -45]];
  FM_STATIONS.forEach((station, stationIndex) => {
    const halfBandwidth = station.bandwidth / 2000;
    ctx.fillStyle = stationIndex === 0 ? "rgba(104,229,245,.12)" : "rgba(156,245,154,.12)";
    ctx.fillRect(xAt(station.rf - halfBandwidth), yAt(-7), xAt(station.rf + halfBandwidth) - xAt(station.rf - halfBandwidth), plot.bottom - yAt(-7));
    ctx.strokeStyle = stationIndex === 0 ? "#68e5f5" : "#9cf59a";
    const levels = levelSets[stationIndex];
    for (let order = -(levels.length - 1); order <= levels.length - 1; order++) { const x = xAt(station.rf + order * .01); const level = levels[Math.abs(order)]; ctx.lineWidth = Math.abs(order) < 3 ? 2.5 : 1.5; line(ctx, x, plot.bottom, x, yAt(level)); }
    ctx.fillStyle = stationIndex === 0 ? "#ffb35a" : "#ff8cbb"; ctx.textAlign = "center"; ctx.fillText(`Sender ${stationIndex + 1}`, xAt(station.rf), plot.top + 14 + stationIndex * 18);
    spectrumBracket(ctx, xAt(station.rf - halfBandwidth), xAt(station.rf + halfBandwidth), plot.top + 48 + stationIndex * 18, `B${stationIndex + 1}`);
  });
}

function spectrumBracket(ctx, left, right, y, label) { ctx.strokeStyle = "#f5e663"; ctx.fillStyle = "#f5e663"; ctx.lineWidth = 1; line(ctx, left, y, right, y); line(ctx, left, y - 5, left, y + 5); line(ctx, right, y - 5, right, y + 5); ctx.textAlign = "center"; ctx.fillText(label, (left + right) / 2, y - 6); }
function drawRecovered(canvas, state) { const ctx = context(canvas); const width = canvas.clientWidth; const height = canvas.clientHeight; screen(ctx, width, height); const quality = receptionQuality(state); ctx.strokeStyle = quality > .85 ? "#7ff0af" : quality > .35 ? "#f5e663" : "#ff8c8c"; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= width; x++) { const t = x / width; const message = .62 * Math.sin(Math.PI * 2 * 2.2 * t) + .25 * Math.sin(Math.PI * 2 * 4.7 * t); const interference = .45 * Math.sin(Math.PI * 2 * 22 * t) + .2 * Math.sin(Math.PI * 2 * 39 * t); const sample = quality * message + (1 - quality) * interference; const y = height / 2 - sample * height * .37; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.fillStyle = "#a6b6c9"; ctx.fillText(quality > .85 ? "Niederfrequenz sauber wiedergewonnen" : quality > .35 ? "Sprache unter Rauschen erkennbar" : "Noch kein verständliches Audiosignal", 10, 18); }
function playReception(state) {
  const quality = receptionQuality(state);
  const station = receivedStation(state);
  window.speechSynthesis?.cancel();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = AudioContextClass ? new AudioContextClass() : null;
  let noiseSource = null;
  let whistle = null;
  let stopTimer = null;
  if (audioContext) {
    const duration = 3.2;
    const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = buffer;
    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = state.mode === "fm" ? "highpass" : "bandpass";
    noiseFilter.frequency.value = state.mode === "fm" ? 1200 : 950;
    noiseFilter.Q.value = state.mode === "fm" ? .3 : .7;
    const noiseGain = audioContext.createGain();
    const fmQuieting = state.mode === "fm" ? (1 - quality) ** 1.7 : 1 - quality;
    noiseGain.gain.value = .025 + .24 * (state.mode === "fm" ? fmQuieting : 1 - quality);
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(audioContext.destination);
    noiseSource.start();
    noiseSource.stop(audioContext.currentTime + duration);
    if (state.mode === "am" && quality < .9) {
      whistle = audioContext.createOscillator();
      const whistleGain = audioContext.createGain();
      whistle.type = "sine";
      whistle.frequency.value = 260 + Math.min(1600, Math.abs(state.amTune - station.carrier) * 12);
      whistleGain.gain.value = Math.min(.1, .08 * (1 - quality));
      whistle.connect(whistleGain).connect(audioContext.destination);
      whistle.start();
      whistle.stop(audioContext.currentTime + duration);
    }
    stopTimer = window.setTimeout(() => audioContext.close().catch(() => {}), duration * 1000 + 100);
  }
  if (quality > .32 && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(station.phrase);
    utterance.lang = "de-DE";
    utterance.volume = clamp(.35 + quality * .65, 0, 1);
    utterance.rate = .72 + quality * .18;
    utterance.pitch = .76 + quality * .24;
    const german = window.speechSynthesis.getVoices().find((voice) => voice.lang?.toLowerCase().startsWith("de"));
    if (german) utterance.voice = german;
    window.speechSynthesis.speak(utterance);
  }
  return () => {
    window.speechSynthesis?.cancel();
    if (stopTimer) window.clearTimeout(stopTimer);
    try { noiseSource?.stop(); } catch {}
    try { whistle?.stop(); } catch {}
    audioContext?.close().catch(() => {});
  };
}
function prepare(canvas) { const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio)); }
function context(canvas) { const ctx = canvas.getContext("2d"); const ratio = window.devicePixelRatio || 1; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); return ctx; }
function screen(ctx, width, height) { ctx.fillStyle = "#050a10"; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = "#18334b"; ctx.lineWidth = 1; for (let x = 0; x <= 10; x++) line(ctx, x * width / 10, 0, x * width / 10, height); for (let y = 0; y <= 6; y++) line(ctx, 0, y * height / 6, width, y * height / 6); ctx.font = "11px ui-monospace, monospace"; }
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function control(label) { const section = document.createElement("section"); section.className = "control-group"; section.innerHTML = `<h3>${label}</h3>`; return section; }
function addNumber(parent, label, initial, set, unit, changed, step) { const section = control(label); const input = document.createElement("input"); input.type = "number"; input.setAttribute("aria-label", label); input.value = initial; input.step = step; input.addEventListener("input", () => { set(Number(input.value)); changed(); }); const output = document.createElement("output"); output.textContent = unit; section.append(input, output); parent.append(section); }
function addSelect(parent, label, options, initial, set, changed) { const section = control(label); const select = document.createElement("select"); select.setAttribute("aria-label", label); for (const [value, text] of options) select.add(new Option(text, value)); select.value = initial; select.addEventListener("change", () => { set(select.value); changed(); }); section.append(select); parent.append(section); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
