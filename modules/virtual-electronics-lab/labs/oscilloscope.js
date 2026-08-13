const TAU = Math.PI * 2;
const CHANNEL_COLORS = ["#68e5f5", "#ffb35a"];
const TIME_DIVISIONS = [0.00001, 0.00002, 0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
const VOLTS_DIVISIONS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
const EXERCISES = [
  { title: "Taktsignal untersuchen", hint: "Ein digitaler Ausgang schaltet periodisch. Bestimme Signalform, Frequenz und Spitze-Spitze-Spannung.", form: "square", frequency: 2500, amplitude: 1.65, offset: 1.65, duty: 40, actualProbe: 10 },
  { title: "Sensorsignal bestimmen", hint: "Ein analoger Sensor liefert ein periodisches Signal. Richte das Oszilloskop ein und bestimme die Messwerte.", form: "sine", frequency: 120, amplitude: 1.2, offset: 0.4, duty: 50, actualProbe: 1 },
  { title: "Dreieckgenerator prüfen", hint: "Die Quelle ist unbekannt eingestellt. Ermittle Signalform, Frequenz und Spitze-Spitze-Spannung.", form: "triangle", frequency: 800, amplitude: 2.5, offset: -0.5, duty: 50, actualProbe: 1 },
  { title: "PWM-Ausgang messen", hint: "Ein Steuerausgang erzeugt PWM. Bestimme die Grundfrequenz und den vollständigen Spannungshub.", form: "square", frequency: 1000, amplitude: 2.5, offset: 2.5, duty: 25, actualProbe: 10 },
];

export function createOscilloscopeLab() {
  const state = {
    operation: "exercise", mode: "time", timeDiv: 0.02, horizontalPosition: 0,
    acquisition: "sample", triggerSource: 0, triggerLevel: 10, freeRunTime: 0,
    triggerSlope: "rising", triggerMode: "normal", triggerHoldoff: 0,
    cursorMode: "off", cursors: { time: { a: .32, b: .68 }, voltage: { a: .32, b: .68 } },
    fftSource: 0, fftSpan: 10000, exerciseIndex: -1, exerciseSolved: false, exerciseResult: "",
    answer: { form: "sine", frequency: "", peakToPeak: "" },
    channels: [
      createChannel({ form: "sine", frequency: 1000, amplitude: 2, offset: 0, phase: 0 }),
      createChannel({ form: "sine", frequency: 1000, amplitude: 2, offset: 0, phase: 90 }),
    ],
  };
  let resizeObserver;
  let animationFrame;

  return {
    id: "oscilloscope", title: "Oszilloskop", status: "Übung", summary: "Unbekannte Signale messen, Trigger, XY und FFT verstehen",
    mount(target) {
      target.innerHTML = `<article class="lab-card oscilloscope-lab"><h2>Oszilloskop-Messübung</h2><p>Das Signal wird vom Labor vorgegeben, aber nicht verraten. Stelle das Oszilloskop selbst ein und bestimme anschließend die Messwerte. Eine Auto-Setup-Taste gibt es bewusst nicht.</p><section class="scope-exercise" data-exercise></section><section class="oscilloscope-front-panel"><header class="scope-model-strip"><strong>GerNetiX DSO-2L</strong><span>Digitales Zweikanal-Oszilloskop</span><i aria-label="Gerät eingeschaltet"></i></header><div class="scope-grid"><div class="scope-display-column"><div class="scope-screen"><canvas aria-label="Oszilloskop-Anzeige"></canvas><div class="scope-readout"><span class="channel-one" data-readout="one"></span><span class="channel-two" data-readout="two"></span><span data-readout="counter"></span></div><output class="scope-cursor-readout" data-cursor-readout></output></div><p class="scope-note" data-feedback></p></div><aside class="scope-controls" aria-label="Oszilloskop-Bedienfeld"></aside></div></section></article>`;
      const canvas = target.querySelector("canvas");
      const screen = target.querySelector(".scope-screen");
      const controls = target.querySelector(".scope-controls");
      const exercise = target.querySelector("[data-exercise]");
      const feedback = target.querySelector("[data-feedback]");
      const cursorReadout = target.querySelector("[data-cursor-readout]");
      const readouts = [...target.querySelectorAll("[data-readout]")];
      let activeCursor = null;

      const paintTrace = () => {
        const rect = screen.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(rect.width * ratio));
        const pixelHeight = Math.max(1, Math.round(rect.height * ratio));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawScope(ctx, rect.width, rect.height, state);
      };
      const render = () => {
        paintTrace();
        updateCursorReadout(cursorReadout, state);
        readouts[0].textContent = `CH 1 · ${formatVolts(state.channels[0].voltsDiv)}/div · ${state.channels[0].coupling.toUpperCase()} · ${state.channels[0].probe}×`;
        readouts[1].textContent = `CH 2 · ${formatVolts(state.channels[1].voltsDiv)}/div · ${state.channels[1].coupling.toUpperCase()} · ${state.channels[1].probe}×`;
        const counted = state.channels[state.triggerSource];
        readouts[2].textContent = state.operation === "exercise" && !state.exerciseSolved
          ? "Zähler: nach Auswertung"
          : `Zähler CH ${state.triggerSource + 1}: ${counted.form === "dc" ? "kein periodisches Signal" : formatFrequency(counted.frequency)}`;
        feedback.textContent = measurementFeedback(state);
        renderExercise(exercise, state, rebuildControls, render);
      };
      const cursorPosition = (event) => {
        const rect = canvas.getBoundingClientRect();
        return state.cursorMode === "time"
          ? clamp((event.clientX - rect.left) / rect.width, 0, 1)
          : clamp((event.clientY - rect.top) / rect.height, 0, 1);
      };
      canvas.addEventListener("pointerdown", (event) => {
        if (state.mode !== "time" || state.cursorMode === "off") return;
        const position = cursorPosition(event);
        const cursors = state.cursors[state.cursorMode];
        activeCursor = Math.abs(position - cursors.a) <= Math.abs(position - cursors.b) ? "a" : "b";
        cursors[activeCursor] = position;
        canvas.setPointerCapture(event.pointerId);
        paintTrace();
        updateCursorReadout(cursorReadout, state);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!activeCursor || !canvas.hasPointerCapture(event.pointerId)) return;
        state.cursors[state.cursorMode][activeCursor] = cursorPosition(event);
        paintTrace();
        updateCursorReadout(cursorReadout, state);
      });
      const releaseCursor = (event) => {
        activeCursor = null;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      canvas.addEventListener("pointerup", releaseCursor);
      canvas.addEventListener("pointercancel", releaseCursor);
      const rebuildControls = () => {
        controls.replaceChildren();
        buildControls(controls, state, rebuildControls, render);
        render();
      };
      newExercise(state);
      rebuildControls();
      resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(screen);
      render();
      const animate = (time) => {
        if (state.mode === "time" && !canTrigger(state.channels[state.triggerSource], state)) {
          state.freeRunTime = time / 1000;
          paintTrace();
        }
        animationFrame = window.requestAnimationFrame(animate);
      };
      animationFrame = window.requestAnimationFrame(animate);
      this.dispose = () => {
        resizeObserver?.disconnect();
        window.cancelAnimationFrame(animationFrame);
      };
    },
    dispose() {
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrame);
    },
  };
}

function createChannel(overrides = {}) {
  return { enabled: true, form: "sine", frequency: 1000, amplitude: 2, offset: 0, phase: 0, duty: 50, voltsDiv: .2, position: 0, coupling: "dc", probe: 1, actualProbe: 1, inverted: false, bandwidthLimit: false, ...overrides };
}

function newExercise(state) {
  let next = Math.floor(Math.random() * EXERCISES.length);
  if (next === state.exerciseIndex) next = (next + 1) % EXERCISES.length;
  state.exerciseIndex = next;
  const task = EXERCISES[next];
  Object.assign(state.channels[0], task, { enabled: true, phase: 0, voltsDiv: .2, position: 0, coupling: "dc", probe: 1, inverted: false });
  Object.assign(state.channels[1], { enabled: false, actualProbe: 1 });
  Object.assign(state, { mode: "time", timeDiv: .02, horizontalPosition: 0, triggerSource: 0, triggerLevel: 10, triggerSlope: "rising", triggerMode: "normal", cursorMode: "off", exerciseSolved: false, exerciseResult: "" });
  state.cursors = { time: { a: .32, b: .68 }, voltage: { a: .32, b: .68 } };
  state.answer = { form: "sine", frequency: "", peakToPeak: "" };
}

function renderExercise(target, state, rebuildControls, changed) {
  if (state.operation !== "exercise") {
    target.innerHTML = `<div><strong>Freies Experiment</strong><p>Die Generatorwerte sind sichtbar und frei einstellbar. Wechsle zur Messübung, um ein unbekanntes Signal zu erhalten.</p></div>`;
    return;
  }
  const task = EXERCISES[state.exerciseIndex];
  const probeHint = task.actualProbe === 10 ? "Am Eingang ist ein 10×-Tastkopf angeschlossen." : "Am Eingang ist ein 1×-Tastkopf angeschlossen.";
  target.innerHTML = `<div><span>Messauftrag</span><strong>${task.title}</strong><p>${task.hint} ${probeHint}</p></div><button type="button" data-new-exercise>Neues Signal</button><form class="scope-answer" data-answer><label>Signalform<select name="form"><option value="sine">Sinus</option><option value="square">Rechteck / PWM</option><option value="triangle">Dreieck</option><option value="dc">Gleichspannung</option></select></label><label>Frequenz<input name="frequency" type="number" min="0" step="1" inputmode="decimal" /><span>Hz</span></label><label>Uss<input name="peakToPeak" type="number" min="0" step="0.1" inputmode="decimal" /><span>V</span></label><button type="submit">Messung auswerten</button><output data-result></output></form>`;
  target.querySelector("[data-new-exercise]").addEventListener("click", () => { newExercise(state); rebuildControls(); });
  const form = target.querySelector("[data-answer]");
  form.elements.form.value = state.answer.form;
  form.elements.frequency.value = state.answer.frequency;
  form.elements.peakToPeak.value = state.answer.peakToPeak;
  form.querySelector("[data-result]").textContent = state.exerciseResult;
  form.addEventListener("input", () => { state.answer = { form: form.elements.form.value, frequency: form.elements.frequency.value, peakToPeak: form.elements.peakToPeak.value }; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = evaluateAnswer(state);
    state.exerciseSolved = result.correct;
    state.exerciseResult = result.message;
    changed();
  });
}

function evaluateAnswer(state) {
  const task = EXERCISES[state.exerciseIndex];
  const readable = measurementQuality(state).ok;
  const frequency = Number(state.answer.frequency);
  const peakToPeak = Number(state.answer.peakToPeak);
  const formCorrect = state.answer.form === task.form;
  const frequencyCorrect = Number.isFinite(frequency) && Math.abs(frequency - task.frequency) / task.frequency <= .1;
  const voltageCorrect = Number.isFinite(peakToPeak) && Math.abs(peakToPeak - task.amplitude * 2) / (task.amplitude * 2) <= .1;
  if (!readable) return { correct: false, message: "Das Oszillogramm ist noch nicht zuverlässig ablesbar. Korrigiere zuerst Zeit/div, V/div, Tastkopf oder Trigger." };
  if (formCorrect && frequencyCorrect && voltageCorrect) return { correct: true, message: `Richtig: ${formLabel(task.form)}, ${formatFrequency(task.frequency)} und ${formatVolts(task.amplitude * 2)} Spitze-Spitze. Der Frequenzzähler ist jetzt freigeschaltet.` };
  const errors = [];
  if (!formCorrect) errors.push("Signalform");
  if (!frequencyCorrect) errors.push("Frequenz (±10 %)");
  if (!voltageCorrect) errors.push("Uss (±10 %)");
  return { correct: false, message: `Noch nicht richtig: Prüfe ${errors.join(", ")}. Setze die Cursor auf passende Signalpunkte und beachte den Tastkopffaktor.` };
}

function buildControls(target, state, rebuild, changed) {
  const operation = group("Betriebsart", "scope-operation");
  addSelect(operation, "Modus", [["exercise", "Messübung · Signal unbekannt"], ["free", "Freies Experiment · Generator sichtbar"]], state.operation, (value) => { state.operation = value; if (value === "exercise") newExercise(state); }, rebuild);
  target.append(operation);

  const horizontal = group("Horizontal", "scope-horizontal");
  addSelect(horizontal, "Darstellung", [["time", "Zeitbereich"], ["xy", "XY / Lissajous"], ["fft", "FFT / Frequenzansicht"]], state.mode, (value) => state.mode = value, changed);
  addKnob(horizontal, "Zeit / DIV", TIME_DIVISIONS, state.timeDiv, formatSeconds, (value) => state.timeDiv = value, changed, "horizontal");
  addNumber(horizontal, "Position", state.horizontalPosition, (value) => state.horizontalPosition = clamp(value, -5, 5), "div", changed, .1);
  addSelect(horizontal, "Erfassung", [["sample", "Sample"], ["average", "Mittelwert 16×"], ["peak", "Peak Detect"]], state.acquisition, (value) => state.acquisition = value, changed);
  addSelect(horizontal, "FFT-Quelle", [[0, "Kanal 1"], [1, "Kanal 2"]], state.fftSource, (value) => state.fftSource = Number(value), changed);
  addNumber(horizontal, "FFT-Spanne", state.fftSpan, (value) => state.fftSpan = clamp(value, 100, 200000), "Hz", changed, 100);
  target.append(horizontal);

  const trigger = group("Trigger", "scope-trigger");
  addSelect(trigger, "Quelle", [[0, "Kanal 1"], [1, "Kanal 2"]], state.triggerSource, (value) => state.triggerSource = Number(value), changed);
  addTriggerModeButton(trigger, state, changed);
  addSelect(trigger, "Flanke", [["rising", "steigend"], ["falling", "fallend"]], state.triggerSlope, (value) => state.triggerSlope = value, changed);
  addNumber(trigger, "Pegel", state.triggerLevel, (value) => state.triggerLevel = clamp(value, -20, 20), "V", changed, .1);
  addNumber(trigger, "Holdoff", state.triggerHoldoff, (value) => state.triggerHoldoff = clamp(value, 0, 1), "s", changed, .0001);
  target.append(trigger);

  const cursor = group("Cursor", "scope-cursor");
  addCursorModeButton(cursor, state, changed);
  const cursorHint = document.createElement("p");
  cursorHint.className = "instrument-hint";
  cursorHint.textContent = "CURSOR drücken, dann A und B direkt im Display verschieben.";
  cursor.append(cursorHint);
  target.append(cursor);

  state.channels.forEach((channel, index) => {
    const section = group(`Kanal ${index + 1}`, `scope-channel scope-channel-${index + 1}`);
    addCheck(section, "Kanal sichtbar", channel.enabled, (value) => channel.enabled = value, changed);
    addKnob(section, "V / DIV", VOLTS_DIVISIONS, channel.voltsDiv, formatVolts, (value) => channel.voltsDiv = value, changed, `channel-${index + 1}`);
    addNumber(section, "Position", channel.position, (value) => channel.position = clamp(value, -4, 4), "div", changed, .1);
    addSelect(section, "Kopplung", [["dc", "DC"], ["ac", "AC"], ["gnd", "GND"]], channel.coupling, (value) => channel.coupling = value, changed);
    addSelect(section, "Tastkopf", [[1, "1×"], [10, "10×"]], channel.probe, (value) => channel.probe = Number(value), changed);
    addCheck(section, "Invertieren", channel.inverted, (value) => channel.inverted = value, changed);
    addCheck(section, "20-MHz-Limit", channel.bandwidthLimit, (value) => channel.bandwidthLimit = value, changed);
    target.append(section);
  });

  if (state.operation === "free") state.channels.forEach((channel, index) => {
    const section = group(`Generator ${index + 1}`);
    addSelect(section, "Signalform", [["sine", "Sinus"], ["square", "Rechteck"], ["triangle", "Dreieck"], ["dc", "Gleichspannung"]], channel.form, (value) => channel.form = value, changed);
    addNumber(section, "Frequenz", channel.frequency, (value) => channel.frequency = clamp(value, 1, 100000), "Hz", changed, 1);
    addNumber(section, "Amplitude Spitze", channel.amplitude, (value) => channel.amplitude = clamp(value, .05, 10), "V", changed, .1);
    addNumber(section, "DC-Offset", channel.offset, (value) => channel.offset = clamp(value, -10, 10), "V", changed, .1);
    addNumber(section, "Phase", channel.phase, (value) => channel.phase = clamp(value, -360, 360), "°", changed, 1);
    addNumber(section, "Tastgrad", channel.duty, (value) => channel.duty = clamp(value, 5, 95), "%", changed, 1);
    target.append(section);
  });
}

function drawScope(ctx, width, height, state) {
  ctx.fillStyle = "#050a10"; ctx.fillRect(0, 0, width, height); drawGrid(ctx, width, height);
  if (state.mode === "xy") drawXy(ctx, width, height, state);
  else if (state.mode === "fft") drawFft(ctx, width, height, state);
  else {
    drawTime(ctx, width, height, state);
    drawCursors(ctx, width, height, state);
  }
}

function drawCursors(ctx, width, height, state) {
  if (state.cursorMode === "off") return;
  const cursors = state.cursors[state.cursorMode];
  ctx.save();
  ctx.strokeStyle = "#f5e663";
  ctx.fillStyle = "#f5e663";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.font = "700 11px ui-monospace, monospace";
  [cursors.a, cursors.b].forEach((position, index) => {
    ctx.beginPath();
    if (state.cursorMode === "time") {
      const x = position * width;
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
      ctx.fillText(index ? "B" : "A", Math.min(width - 14, x + 4), 34);
    } else {
      const y = position * height;
      ctx.moveTo(0, y); ctx.lineTo(width, y);
      ctx.fillText(index ? "B" : "A", 14, Math.max(44, y - 4));
    }
    ctx.stroke();
  });
  ctx.restore();
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = "#18334b"; ctx.lineWidth = 1;
  for (let x = 0; x <= 10; x++) line(ctx, x * width / 10, 0, x * width / 10, height);
  for (let y = 0; y <= 8; y++) line(ctx, 0, y * height / 8, width, y * height / 8);
  ctx.strokeStyle = "#31516a"; line(ctx, 0, height / 2, width, height / 2); line(ctx, width / 2, 0, width / 2, height);
}

function drawTime(ctx, width, height, state) {
  const duration = state.timeDiv * 10;
  const triggerChannel = state.channels[state.triggerSource];
  const triggered = canTrigger(triggerChannel, state);
  const trigger = triggered ? findTrigger(triggerChannel, state) + state.triggerHoldoff : 0;
  const freeRunOffset = triggered ? 0 : state.freeRunTime * 0.8 / Math.max(triggerChannel.frequency, 1);
  state.channels.forEach((channel, index) => {
    if (!channel.enabled) return;
    ctx.strokeStyle = CHANNEL_COLORS[index]; ctx.lineWidth = state.acquisition === "peak" ? 2.3 : 1.8; ctx.beginPath();
    for (let x = 0; x <= width; x++) {
      const time = trigger + freeRunOffset + state.horizontalPosition * state.timeDiv + (x / width - .5) * duration;
      const measured = measuredSample(channel, time);
      const y = height / 2 - channel.position * height / 8 - measured / channel.voltsDiv * height / 8;
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  const triggerY = height / 2 - state.triggerLevel / triggerChannel.voltsDiv * height / 8;
  ctx.fillStyle = triggered ? "#7ff0af" : "#ff8c8c"; ctx.beginPath(); ctx.moveTo(0, triggerY); ctx.lineTo(10, triggerY - 6); ctx.lineTo(10, triggerY + 6); ctx.fill();
}

function drawXy(ctx, width, height, state) {
  const [one, two] = state.channels;
  if (!one.enabled || !two.enabled) return;
  const duration = 8 / Math.min(Math.max(one.frequency, 1), Math.max(two.frequency, 1));
  ctx.strokeStyle = CHANNEL_COLORS[0]; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let point = 0; point <= 2000; point++) {
    const time = (point / 2000 - .5) * duration;
    const x = width / 2 + measuredSample(one, time) / one.voltsDiv * width / 10;
    const y = height / 2 - measuredSample(two, time) / two.voltsDiv * height / 8;
    point ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}

function drawFft(ctx, width, height, state) {
  const channel = state.channels[state.fftSource];
  const bins = calculateFft(channel, state.fftSpan);
  ctx.strokeStyle = CHANNEL_COLORS[state.fftSource]; ctx.lineWidth = 1.8; ctx.beginPath();
  bins.forEach((db, index) => { const x = index / (bins.length - 1) * width; const y = height - clamp((db + 80) / 80, 0, 1) * height; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke(); ctx.fillStyle = "#a6b6c9"; ctx.font = "12px ui-monospace, monospace";
  ctx.fillText("−80 dBV", 8, height - 8); ctx.fillText("0 dBV", 8, 16); ctx.fillText(formatFrequency(state.fftSpan), Math.max(8, width - 90), height - 8);
}

function calculateFft(channel, span) {
  const size = 512; const sampleRate = span * 2; const samples = new Float64Array(size);
  for (let n = 0; n < size; n++) samples[n] = measuredSample(channel, n / sampleRate) * (.5 - .5 * Math.cos(TAU * n / (size - 1)));
  const result = [];
  for (let k = 0; k <= size / 2; k++) {
    let real = 0; let imaginary = 0;
    for (let n = 0; n < size; n++) { const angle = TAU * k * n / size; real += samples[n] * Math.cos(angle); imaginary -= samples[n] * Math.sin(angle); }
    result.push(20 * Math.log10(Math.max(1e-6, 4 * Math.hypot(real, imaginary) / size)));
  }
  return result;
}

function measurementQuality(state) {
  const channel = state.channels[state.triggerSource];
  if (!channel.enabled) return { ok: false, message: "Die Triggerquelle ist ausgeschaltet." };
  if (channel.coupling === "gnd") return { ok: false, message: "Die Eingangskopplung steht auf GND; das Signal ist getrennt." };
  if (channel.probe !== channel.actualProbe) return { ok: false, message: `Tastkopf und Oszilloskop stimmen nicht überein. Am Eingang ist ${channel.actualProbe}× angeschlossen.` };
  if (!canTrigger(channel, state)) return { ok: false, message: "Der Trigger greift noch nicht: Das Signal läuft frei über den Bildschirm. Stelle Quelle, Pegel und Flanke passend ein." };
  const periods = state.timeDiv * 10 * channel.frequency;
  if (periods < .7) return { ok: false, message: "Die Zeitbasis ist zu kurz: Nicht einmal eine vollständige Periode ist sichtbar." };
  if (periods > 12) return { ok: false, message: "Die Zeitbasis ist zu lang: Zu viele Perioden liegen dicht nebeneinander." };
  const displayedAmplitude = channel.amplitude * channel.probe / channel.actualProbe;
  if (displayedAmplitude / channel.voltsDiv > 3.7) return { ok: false, message: "Das Signal überschreitet den vertikalen Bildschirm. Wähle mehr V/div." };
  if (displayedAmplitude / channel.voltsDiv < .7) return { ok: false, message: "Das Signal ist vertikal zu klein. Wähle weniger V/div." };
  return { ok: true, message: "Das Signal ist stabil und über mehrere Kästchen ablesbar. Bestimme jetzt Signalform, Frequenz und Uss." };
}

function measurementFeedback(state) {
  if (state.mode === "xy") return "XY-Modus: Kanal 1 steuert X, Kanal 2 steuert Y. Beide Kanäle müssen eingeschaltet sein.";
  if (state.mode === "fft") return "FFT-Ansicht: Grundschwingung und Oberwellen werden sichtbar. Für die Messübung wird die Zeitansicht benötigt.";
  return measurementQuality(state).message;
}

function measuredSample(channel, time) {
  if (channel.coupling === "gnd") return 0;
  let value = sample(channel, time);
  if (channel.coupling === "ac") value -= channel.offset;
  value *= channel.probe / channel.actualProbe;
  if (channel.inverted) value *= -1;
  return value;
}

function sample(channel, time) {
  const phase = channel.frequency * time + channel.phase / 360;
  const cycle = ((phase % 1) + 1) % 1;
  let raw = 0;
  if (channel.form === "sine") raw = Math.sin(TAU * phase);
  if (channel.form === "square") raw = cycle < channel.duty / 100 ? 1 : -1;
  if (channel.form === "triangle") raw = 1 - 4 * Math.abs(cycle - .5);
  return channel.offset + channel.amplitude * raw;
}

function canTrigger(channel, state) {
  if (!channel.enabled || channel.form === "dc" || channel.coupling === "gnd") return false;
  const offset = channel.coupling === "ac" ? 0 : channel.offset * channel.probe / channel.actualProbe;
  const amplitude = channel.amplitude * channel.probe / channel.actualProbe;
  return Math.abs(state.triggerLevel - offset) <= amplitude;
}
function findTrigger(channel, state) { const offset = channel.coupling === "ac" ? 0 : channel.offset * channel.probe / channel.actualProbe; const amplitude = channel.amplitude * channel.probe / channel.actualProbe; const ratio = clamp((state.triggerLevel - offset) / amplitude, -1, 1); const base = Math.asin(ratio) / TAU; const phase = state.triggerSlope === "rising" ? base : .5 - base; return (phase - channel.phase / 360) / channel.frequency; }
function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function group(title, className = "") { const section = document.createElement("section"); section.className = `control-group ${className}`.trim(); section.innerHTML = `<h3>${title}</h3>`; return section; }
function addKnob(parent, label, values, initial, format, set, changed, accent) {
  const control = document.createElement("div");
  control.className = `knob-control knob-${accent}`;
  const name = document.createElement("span");
  name.className = "knob-name";
  name.textContent = label;
  const dial = document.createElement("button");
  dial.type = "button";
  dial.className = "rotary-knob";
  dial.title = `${label}: drehen mit Mausrad, Ziehen oder Pfeiltasten`;
  dial.setAttribute("role", "slider");
  dial.setAttribute("aria-label", label);
  dial.innerHTML = "<i></i>";
  const output = document.createElement("output");
  let index = Math.max(0, values.findIndex((value) => Number(value) === Number(initial)));
  let pointerStart = 0;
  let pointerIndex = index;
  const update = (next) => {
    index = clamp(Math.round(next), 0, values.length - 1);
    const value = values[index];
    const angle = -135 + index / Math.max(1, values.length - 1) * 270;
    dial.style.setProperty("--knob-angle", `${angle}deg`);
    dial.setAttribute("aria-valuemin", "0");
    dial.setAttribute("aria-valuemax", String(values.length - 1));
    dial.setAttribute("aria-valuenow", String(index));
    dial.setAttribute("aria-valuetext", format(value));
    output.textContent = format(value);
    set(value);
    changed();
  };
  dial.addEventListener("wheel", (event) => { event.preventDefault(); update(index + (event.deltaY > 0 ? 1 : -1)); }, { passive: false });
  dial.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") update(0);
    else if (event.key === "End") update(values.length - 1);
    else update(index + (["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : -1));
  });
  dial.addEventListener("pointerdown", (event) => { pointerStart = event.clientY; pointerIndex = index; dial.setPointerCapture(event.pointerId); });
  dial.addEventListener("pointermove", (event) => { if (dial.hasPointerCapture(event.pointerId)) update(pointerIndex + (pointerStart - event.clientY) / 14); });
  dial.addEventListener("click", (event) => { if (Math.abs(pointerStart - event.clientY) < 4) update(index + 1 >= values.length ? 0 : index + 1); });
  control.append(name, dial, output);
  parent.append(control);
  update(index);
}
function addTriggerModeButton(parent, state, changed) {
  const control = document.createElement("div");
  control.className = "trigger-mode-control";
  const modes = [["auto", "Auto"], ["normal", "Normal"], ["single", "Single"]];
  const indicators = document.createElement("div");
  indicators.className = "trigger-mode-indicators";
  modes.forEach(([value, label]) => {
    const indicator = document.createElement("span");
    indicator.dataset.mode = value;
    indicator.innerHTML = `<i></i>${label}`;
    indicators.append(indicator);
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = "instrument-button trigger-mode-button";
  button.textContent = "MODE";
  button.title = "Trigger-Modus umschalten";
  const update = () => indicators.querySelectorAll("span").forEach((item) => item.classList.toggle("is-active", item.dataset.mode === state.triggerMode));
  button.addEventListener("click", () => {
    const index = modes.findIndex(([value]) => value === state.triggerMode);
    state.triggerMode = modes[(index + 1) % modes.length][0];
    update();
    changed();
  });
  update();
  control.append(indicators, button);
  parent.append(control);
}
function addCursorModeButton(parent, state, changed) {
  const control = document.createElement("div");
  control.className = "cursor-mode-control";
  const modes = [["off", "Aus"], ["time", "Zeit"], ["voltage", "Spannung"]];
  const indicators = document.createElement("div");
  indicators.className = "cursor-mode-indicators";
  modes.forEach(([value, label]) => {
    const indicator = document.createElement("span");
    indicator.dataset.mode = value;
    indicator.innerHTML = `<i></i>${label}`;
    indicators.append(indicator);
  });
  const button = document.createElement("button");
  button.type = "button";
  button.className = "instrument-button cursor-mode-button";
  button.textContent = "CURSOR";
  button.title = "Messcursor umschalten";
  const update = () => indicators.querySelectorAll("span").forEach((item) => item.classList.toggle("is-active", item.dataset.mode === state.cursorMode));
  button.addEventListener("click", () => {
    const index = modes.findIndex(([value]) => value === state.cursorMode);
    state.cursorMode = modes[(index + 1) % modes.length][0];
    update();
    changed();
  });
  update();
  control.append(indicators, button);
  parent.append(control);
}
function updateCursorReadout(target, state) {
  if (state.mode !== "time" || state.cursorMode === "off") {
    target.hidden = true;
    target.textContent = "";
    return;
  }
  target.hidden = false;
  if (state.cursorMode === "time") {
    const cursors = state.cursors.time;
    const timeA = (cursors.a - .5) * state.timeDiv * 10 + state.horizontalPosition * state.timeDiv;
    const timeB = (cursors.b - .5) * state.timeDiv * 10 + state.horizontalPosition * state.timeDiv;
    const deltaTime = Math.abs(cursors.b - cursors.a) * state.timeDiv * 10;
    target.textContent = `A ${formatSignedSeconds(timeA)}  B ${formatSignedSeconds(timeB)}  ·  Δt ${formatSeconds(deltaTime)}  ·  1/Δt ${formatFrequency(deltaTime > 0 ? 1 / deltaTime : 0)}`;
    return;
  }
  const channel = state.channels[state.triggerSource];
  const cursors = state.cursors.voltage;
  const voltageAt = (position) => ((.5 - position) * 8 - channel.position) * channel.voltsDiv;
  const voltageA = voltageAt(cursors.a);
  const voltageB = voltageAt(cursors.b);
  const deltaVoltage = Math.abs(cursors.b - cursors.a) * channel.voltsDiv * 8;
  target.textContent = `A ${formatSignedVolts(voltageA)}  B ${formatSignedVolts(voltageB)}  ·  ΔV ${formatVolts(deltaVoltage)}  ·  CH ${state.triggerSource + 1}`;
}
function addNumber(parent, label, initial, set, unit, changed, step) { const row = document.createElement("label"); row.innerHTML = `<span>${label}</span>`; const input = document.createElement("input"); input.type = "number"; input.value = initial; input.step = step; input.addEventListener("input", () => { set(Number(input.value)); changed(); }); const output = document.createElement("output"); output.textContent = unit; row.append(input, output); parent.append(row); }
function addSelect(parent, label, options, initial, set, changed) { const row = document.createElement("label"); row.innerHTML = `<span>${label}</span>`; const select = document.createElement("select"); for (const [value, text] of options) select.add(new Option(text, value)); select.value = String(initial); select.addEventListener("change", () => { set(select.value); changed(); }); row.append(select); parent.append(row); }
function addCheck(parent, label, initial, set, changed) { const row = document.createElement("label"); row.innerHTML = `<span>${label}</span>`; const input = document.createElement("input"); input.type = "checkbox"; input.checked = initial; input.addEventListener("change", () => { set(input.checked); changed(); }); row.append(input); parent.append(row); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function formatVolts(value) { return value < 1 ? `${Math.round(value * 1000)} mV` : `${value.toFixed(value < 10 ? 1 : 0)} V`; }
function formatFrequency(value) { if (value >= 1e6) return `${(value / 1e6).toFixed(3)} MHz`; if (value >= 1000) return `${(value / 1000).toFixed(3)} kHz`; return `${value.toFixed(1)} Hz`; }
function formatSeconds(value) { if (value < .001) return `${Math.round(value * 1e6)} µs`; if (value < 1) return `${Number((value * 1000).toPrecision(3))} ms`; return `${value} s`; }
function formatSignedSeconds(value) { return `${value < 0 ? "−" : "+"}${formatSeconds(Math.abs(value))}`; }
function formatSignedVolts(value) { return `${value < 0 ? "−" : "+"}${formatVolts(Math.abs(value))}`; }
function formLabel(value) { return ({ sine: "Sinus", square: "Rechteck / PWM", triangle: "Dreieck", dc: "Gleichspannung" })[value] || value; }
