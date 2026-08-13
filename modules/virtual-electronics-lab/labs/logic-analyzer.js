export function createLogicAnalyzerLab() {
  const state = { protocol: "uart", rate: 9600, sampleRate: 100000, payload: "A5" };
  let resizeObserver;
  return {
    id: "logic", title: "Logikanalysator", status: "Nutzbar", summary: "UART, I²C und SPI lesen",
    mount(target) {
      target.innerHTML = `<article class="lab-card"><h2>Logikanalysator und Protokoll-Decoder</h2><p>Vergleiche digitale Leitungen, Abtastrate und automatisch dekodierte Daten.</p><div class="instrument-layout"><div><div class="logic-screen"><canvas aria-label="Digitale Signalverläufe"></canvas></div><div class="decode-strip" data-decode></div><p class="scope-note" data-feedback></p></div><aside class="scope-controls" data-controls></aside></div></article>`;
      const canvas = target.querySelector("canvas"); const decode = target.querySelector("[data-decode]"); const feedback = target.querySelector("[data-feedback]"); const controls = target.querySelector("[data-controls]");
      const render = () => { const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = Math.max(1, rect.width * ratio); canvas.height = Math.max(1, rect.height * ratio); const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); drawLogic(ctx, rect.width, rect.height, state); const decoded = decodeProtocol(state); decode.innerHTML = decoded.tokens.map((token) => `<span>${token}</span>`).join(""); feedback.textContent = state.sampleRate < state.rate * 4 ? "Die Abtastrate ist zu niedrig. Flanken können übersehen und Daten falsch dekodiert werden." : `Abtastrate ${formatRate(state.sampleRate)}: ${decoded.explanation}`; };
      addSelect(controls, "Protokoll", [["uart", "UART"], ["i2c", "I²C"], ["spi", "SPI"]], state.protocol, (value) => state.protocol = value, render);
      addNumber(controls, "Bit-/Taktrate", state.rate, (value) => state.rate = clamp(value, 100, 1e7), "Hz", render, 100);
      addNumber(controls, "Abtastrate", state.sampleRate, (value) => state.sampleRate = clamp(value, 1000, 1e8), "Sa/s", render, 1000);
      addSelect(controls, "Nutzdaten", [["A5", "0xA5"], ["55", "0x55"], ["48", "0x48 · H"]], state.payload, (value) => state.payload = value, render);
      resizeObserver = new ResizeObserver(render); resizeObserver.observe(canvas); render(); this.dispose = () => resizeObserver?.disconnect();
    }, dispose() { resizeObserver?.disconnect(); },
  };
}

function drawLogic(ctx, width, height, state) {
  ctx.fillStyle = "#050a10"; ctx.fillRect(0, 0, width, height);
  const tracks = protocolTracks(state);
  tracks.forEach((track, index) => {
    const top = 22 + index * (height - 34) / tracks.length; const high = top; const low = top + 30;
    ctx.fillStyle = "#a6b6c9"; ctx.font = "12px ui-monospace, monospace"; ctx.fillText(track.label, 8, top + 5);
    ctx.strokeStyle = index ? "#ffb35a" : "#68e5f5"; ctx.lineWidth = 2; ctx.beginPath();
    track.bits.forEach((bit, bitIndex) => { const x1 = 58 + bitIndex * (width - 68) / track.bits.length; const x2 = 58 + (bitIndex + 1) * (width - 68) / track.bits.length; const y = bit ? high : low; if (bitIndex === 0) ctx.moveTo(x1, y); else ctx.lineTo(x1, y); ctx.lineTo(x2, y); });
    ctx.stroke();
  });
}
function protocolTracks(state) { const byte = parseInt(state.payload, 16); const data = Array.from({ length: 8 }, (_, index) => (byte >> index) & 1); if (state.protocol === "uart") return [{ label: "RX", bits: [1, 0, ...data, 1, 1] }]; const clock = Array.from({ length: 20 }, (_, index) => index % 2); if (state.protocol === "i2c") return [{ label: "SCL", bits: [1, 1, ...clock, 1] }, { label: "SDA", bits: [1, 0, ...data.flatMap((bit) => [bit, bit]), 0, 1, 1] }]; return [{ label: "SCK", bits: [0, ...clock, 0] }, { label: "MOSI", bits: [0, ...data.flatMap((bit) => [bit, bit]), 0, 0, 0] }, { label: "CS", bits: [1, 0, ...Array(18).fill(0), 1, 1] }]; }
function decodeProtocol(state) { if (state.protocol === "uart") return { tokens: ["Start", `Daten 0x${state.payload}`, "Stop"], explanation: "Startbit, acht Datenbits (LSB zuerst) und Stopbit wurden erkannt." }; if (state.protocol === "i2c") return { tokens: ["START", "Adresse 0x52 · W", `Daten 0x${state.payload}`, "ACK", "STOP"], explanation: "START, Adresse, Datenbyte, Bestätigung und STOP wurden erkannt." }; return { tokens: ["CS aktiv", `MOSI 0x${state.payload}`, "CS inaktiv"], explanation: "Das Datenbyte wurde zwischen den Chip-Select-Flanken eingelesen." }; }
function control(label) { const section = document.createElement("section"); section.className = "control-group"; section.innerHTML = `<h3>${label}</h3>`; return section; }
function addNumber(parent, label, initial, set, unit, changed, step) { const section = control(label); const input = document.createElement("input"); input.type = "number"; input.setAttribute("aria-label", label); input.value = initial; input.step = step; input.addEventListener("input", () => { set(Number(input.value)); changed(); }); const output = document.createElement("output"); output.textContent = unit; section.append(input, output); parent.append(section); }
function addSelect(parent, label, options, initial, set, changed) { const section = control(label); const select = document.createElement("select"); select.setAttribute("aria-label", label); for (const [value, text] of options) select.add(new Option(text, value)); select.value = initial; select.addEventListener("change", () => { set(select.value); changed(); }); section.append(select); parent.append(section); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
function formatRate(value) { if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MSa/s`; if (value >= 1000) return `${(value / 1000).toFixed(1)} kSa/s`; return `${value} Sa/s`; }
