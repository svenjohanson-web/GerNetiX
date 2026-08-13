const CIRCUITS = {
  led: { label: "LED mit Vorwiderstand", nodes: ["Plus", "vor LED", "Masse"], hint: "Miss Versorgung, LED-Spannung und Spannungsabfall am Vorwiderstand." },
  divider: { label: "Spannungsteiler", nodes: ["Plus", "Mitte", "Masse"], hint: "Die Spannung am Mittelpunkt hängt vom Verhältnis R1 zu R2 ab." },
  transistorSwitch: { label: "NPN-Transistorschalter", nodes: ["Plus", "Kollektor", "Basis", "Emitter", "Masse"], hint: "Vergleiche Basis-Emitter- und Kollektor-Emitter-Spannung des eingeschalteten NPN-Transistors." },
  commonEmitter: { label: "Emitterschaltung", nodes: ["Plus", "Kollektor", "Basis", "Emitter", "Masse"], hint: "Die Widerstände legen den Arbeitspunkt an Basis, Emitter und Kollektor fest." },
  wheatstone: { label: "Wheatstone-Messbrücke", nodes: ["Plus", "Brücke links", "Brücke rechts", "Masse"], hint: "Verbinde die Messleitungen mit beiden Brückenmitten. Bei R1/R2 = R3/R4 zeigt das Multimeter 0 V." },
  diode: { label: "Diode mit Lastwiderstand", nodes: ["Plus", "nach Diode", "Masse"], hint: "Miss die Durchlassspannung der Diode und die Spannung am Lastwiderstand." },
  open: { label: "Unterbrochene Leitung", nodes: ["Plus", "vor Unterbrechung", "Masse"], hint: "Mit Durchgangs- oder Spannungsmessung lässt sich die Unterbrechung eingrenzen." },
};

export function createMultimeterLab() {
  const state = { circuit: "led", mode: "voltage", redJack: "voltage", power: true, supply: 5, resistance: 330, secondResistance: 1000, thirdResistance: 1000, fourthResistance: 1200, redNode: "vor LED", blackNode: "Masse" };
  return {
    id: "multimeter", title: "Multimeter", status: "Nutzbar", summary: "Messleitungen an einfachen Schaltungen",
    mount(target) {
      target.innerHTML = `<article class="lab-card"><h2>Multimeter und einfache Schaltungen</h2><p>Wähle Messbuchse, Messart und die Anschlusspunkte der Leitungen. Das Lab bewertet auch typische Fehlanschlüsse.</p><div class="meter-layout"><section><output class="meter-display meter-live-display" aria-live="polite"></output><span class="meter-live-jack" data-red-jack></span><div class="circuit-diagram" data-circuit aria-label="Schaltbild"></div><p class="scope-note" data-feedback></p></section><aside class="scope-controls" data-controls></aside></div></article>`;
      const display = target.querySelector(".meter-display"); const feedback = target.querySelector("[data-feedback]"); const circuit = target.querySelector("[data-circuit]"); const controls = target.querySelector("[data-controls]"); const jack = target.querySelector("[data-red-jack]");
      const render = () => {
        syncNodes(state);
        const result = measure(state);
        display.textContent = result.display;
        display.dataset.state = result.kind;
        feedback.textContent = `${result.explanation} ${CIRCUITS[state.circuit].hint}`;
        jack.textContent = state.redJack === "current" ? "mA · rot" : "V Ω · rot";
        circuit.innerHTML = renderCircuit(state);
        for (const node of circuit.querySelectorAll("[data-node]")) {
          const selectNode = () => { state.redNode = node.dataset.node; render(); };
          node.addEventListener("click", selectNode);
          node.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectNode(); } });
        }
      };
      addSelect(controls, "Schaltung", Object.entries(CIRCUITS).map(([value, item]) => [value, item.label]), state.circuit, (value) => { state.circuit = value; state.redNode = CIRCUITS[value].nodes[1]; }, render);
      addCheck(controls, "Versorgung eingeschaltet", state.power, (value) => state.power = value, render);
      addSelect(controls, "Messart", [["voltage", "Gleichspannung"], ["current", "Gleichstrom"], ["resistance", "Widerstand"], ["continuity", "Durchgang"]], state.mode, (value) => state.mode = value, render);
      addSelect(controls, "Rote Messbuchse", [["voltage", "V / Ω"], ["current", "mA"]], state.redJack, (value) => state.redJack = value, render);
      addSelect(controls, "Rote Leitung", allNodes(), state.redNode, (value) => state.redNode = value, render);
      addSelect(controls, "Schwarze Leitung", allNodes(), state.blackNode, (value) => state.blackNode = value, render);
      addNumber(controls, "Versorgung", state.supply, (value) => state.supply = clamp(value, 1, 12), "V", render, .1);
      addNumber(controls, "R1 / Vorwiderstand", state.resistance, (value) => state.resistance = clamp(value, 10, 10000), "Ω", render, 10);
      addNumber(controls, "R2", state.secondResistance, (value) => state.secondResistance = clamp(value, 10, 10000), "Ω", render, 10);
      addNumber(controls, "R3", state.thirdResistance, (value) => state.thirdResistance = clamp(value, 10, 10000), "Ω", render, 10);
      addNumber(controls, "R4 / Sensor", state.fourthResistance, (value) => state.fourthResistance = clamp(value, 10, 10000), "Ω", render, 10);
      render();
    }, dispose() {},
  };
}

function measure(state) {
  if (state.redJack === "current" && state.mode !== "current") return result("Buchse!", "error", "Die rote Leitung steckt in der mA-Buchse, aber der Drehschalter steht nicht auf Strom. An einer realen Quelle kann das einen Kurzschluss verursachen.");
  if (state.redJack !== "current" && state.mode === "current") return result("Buchse!", "error", "Für die Strommessung muss die rote Leitung in die mA-Buchse. Das Messgerät wird anschließend in Reihe eingefügt.");
  if ((state.mode === "resistance" || state.mode === "continuity") && state.power) return result("OL", "error", "Widerstand und Durchgang dürfen nur spannungsfrei gemessen werden. Schalte die Versorgung aus.");

  const volts = nodeVoltages(state);
  if (state.mode === "voltage") {
    const value = (volts[state.redNode] ?? 0) - (volts[state.blackNode] ?? 0);
    return result(`${value.toFixed(2)} V`, "ok", "Spannung wird parallel zwischen roter und schwarzer Messleitung gemessen. Ein negatives Vorzeichen bedeutet vertauschte Polarität.");
  }
  if (state.mode === "current") {
    const series = state.redNode === "Strommessstelle" && state.blackNode === "Stromrückleitung";
    if (!series) return result("0.00 mA", "error", "Strom wird in Reihe gemessen. Verbinde die rote Leitung mit I+ und die schwarze Leitung mit I−; das Multimeter schließt dann die vorbereitete Lücke.");
    return result(`${(circuitCurrent(state) * 1000).toFixed(2)} mA`, "ok", "Das Multimeter schließt die vorbereitete Lücke in Reihe. Der gesamte Schaltungsstrom fließt durch das Messgerät.");
  }
  const resistance = resistanceBetween(state);
  if (state.mode === "continuity") return resistance < 50 ? result("BEEP", "ok", `Durchgang erkannt: ungefähr ${resistance.toFixed(1)} Ω.`) : result("OL", "ok", "Kein niederohmiger Durchgang zwischen den gewählten Punkten.");
  return Number.isFinite(resistance) ? result(`${formatResistance(resistance)}`, "ok", "Das Lab bestimmt den idealisierten Widerstand zwischen den Leitungen bei ausgeschalteter Versorgung.") : result("OL", "ok", "Zwischen den gewählten Punkten besteht keine leitende Verbindung.");
}

function nodeVoltages(state) {
  const supply = state.power ? state.supply : 0;
  const result = { Plus: supply, Masse: 0, Strommessstelle: 0, Stromrückleitung: 0 };
  if (!state.power) { for (const node of CIRCUITS[state.circuit].nodes) result[node] = 0; return result; }
  if (state.circuit === "led") { const current = circuitCurrent(state); result["vor LED"] = Math.min(2, supply); result.Strommessstelle = current ? result["vor LED"] : 0; }
  if (state.circuit === "divider") { result.Mitte = supply * state.secondResistance / (state.resistance + state.secondResistance); result.Strommessstelle = result.Mitte; }
  if (state.circuit === "transistorSwitch") { result.Basis = Math.min(.72, supply); result.Emitter = 0; result.Kollektor = supply > .72 ? .2 : supply; result.Strommessstelle = result.Kollektor; }
  if (state.circuit === "commonEmitter") {
    result.Basis = supply * state.thirdResistance / (state.secondResistance + state.thirdResistance);
    result.Emitter = Math.max(0, result.Basis - .7);
    const collectorCurrent = result.Emitter / Math.max(state.fourthResistance, 1);
    result.Kollektor = Math.max(result.Emitter + .2, supply - collectorCurrent * state.resistance);
    result.Strommessstelle = result.Kollektor;
  }
  if (state.circuit === "wheatstone") {
    result["Brücke links"] = supply * state.secondResistance / (state.resistance + state.secondResistance);
    result["Brücke rechts"] = supply * state.fourthResistance / (state.thirdResistance + state.fourthResistance);
    result.Strommessstelle = 0;
  }
  if (state.circuit === "diode") { result["nach Diode"] = Math.max(0, supply - .7); result.Strommessstelle = result["nach Diode"]; }
  if (state.circuit === "open") { result["vor Unterbrechung"] = supply; result.Strommessstelle = 0; }
  return result;
}
function circuitCurrent(state) {
  if (!state.power || state.circuit === "open") return 0;
  if (state.circuit === "divider") return state.supply / (state.resistance + state.secondResistance);
  if (state.circuit === "wheatstone") return state.supply / (state.resistance + state.secondResistance) + state.supply / (state.thirdResistance + state.fourthResistance);
  if (state.circuit === "transistorSwitch") return Math.max(0, state.supply - .2) / state.resistance;
  if (state.circuit === "commonEmitter") return Math.max(0, state.supply - nodeVoltages(state).Kollektor) / state.resistance;
  if (state.circuit === "diode") return Math.max(0, state.supply - .7) / state.resistance;
  return Math.max(0, state.supply - 2) / state.resistance;
}
function resistanceBetween(state) {
  const pair = new Set([state.redNode, state.blackNode]);
  if (state.redNode === state.blackNode) return 0;
  if (state.circuit === "open" && pair.has("vor Unterbrechung") && pair.has("Masse")) return Infinity;
  if (state.circuit === "divider" && pair.has("Plus") && pair.has("Mitte")) return state.resistance;
  if (state.circuit === "divider" && pair.has("Mitte") && pair.has("Masse")) return state.secondResistance;
  if (state.circuit === "led" && pair.has("Plus") && pair.has("vor LED")) return state.resistance;
  if (state.circuit === "wheatstone" && pair.has("Plus") && pair.has("Brücke links")) return state.resistance;
  if (state.circuit === "wheatstone" && pair.has("Brücke links") && pair.has("Masse")) return state.secondResistance;
  if (state.circuit === "wheatstone" && pair.has("Plus") && pair.has("Brücke rechts")) return state.thirdResistance;
  if (state.circuit === "wheatstone" && pair.has("Brücke rechts") && pair.has("Masse")) return state.fourthResistance;
  if (state.circuit === "diode" && pair.has("nach Diode") && pair.has("Masse")) return state.resistance;
  return Infinity;
}
function renderCircuit(state) {
  const reading = measure(state);
  const currentMeterClosed = state.mode !== "current" || (state.redJack === "current" && state.redNode === "Strommessstelle" && state.blackNode === "Stromrückleitung");
  const schematic = schematicDefinition(state);
  const nodePositions = Object.fromEntries(schematic.nodes.map(([name, x, y]) => [name, [x, y]]));
  const red = nodePositions[state.redNode] || nodePositions.Plus;
  const black = nodePositions[state.blackNode] || nodePositions.Masse;
  const nodes = schematic.nodes.map(([name, x, y, label]) => `<g class="schematic-node${state.redNode === name ? " is-red" : ""}${state.blackNode === name ? " is-black" : ""}" data-node="${name}" role="button" tabindex="0" aria-label="Rote Messleitung an ${name} anschließen"><circle cx="${x}" cy="${y}" r="7"/><text x="${x + 9}" y="${y + (name.startsWith("Strom") ? 22 : 18)}">${label}</text></g>`).join("");
  const currentFeed = state.mode === "current"
    ? `<line class="schematic-wire" x1="115" y1="70" x2="140" y2="70"/><line class="schematic-wire" x1="190" y1="70" x2="210" y2="70"/>`
    : `<line class="schematic-wire" x1="115" y1="70" x2="210" y2="70"/>`;
  return `<svg class="circuit-schematic${state.power && currentMeterClosed && circuitCurrent(state) > 0 ? " is-powered" : ""}" viewBox="0 0 760 320" role="img" aria-label="Schaltplan mit Spannungsquelle, Bauteilen und angeschlossenem Multimeter">
    <text class="schematic-title" x="24" y="28">${CIRCUITS[state.circuit].label}</text>
    ${currentFeed}${schematic.body}
    <line class="schematic-wire" x1="115" y1="70" x2="115" y2="145"/><line class="schematic-component" x1="82" y1="145" x2="148" y2="145"/><line class="schematic-component" x1="96" y1="176" x2="134" y2="176"/><line class="schematic-wire" x1="115" y1="176" x2="115" y2="260"/>
    <text x="31" y="154">${state.supply.toFixed(1)} V</text><text x="95" y="126">+</text><text x="98" y="200">−</text>
    <path class="probe-lead probe-red" d="M615 164 C560 164 555 105 ${red[0]} ${red[1]}"/><path class="probe-lead probe-black" d="M615 218 C555 218 555 275 ${black[0]} ${black[1]}"/>
    <rect class="schematic-meter" x="600" y="88" width="135" height="178" rx="18"/><rect class="schematic-meter-display" x="617" y="108" width="101" height="38" rx="4"/><text class="schematic-meter-value${reading.kind === "error" ? " is-error" : ""}" x="667" y="133" text-anchor="middle">${reading.display}</text><circle class="meter-dial" cx="668" cy="178" r="23"/><path class="meter-dial-mark" d="M668 178 l13 -14"/><circle class="meter-jack-red" cx="620" cy="164" r="6"/><circle class="meter-jack-black" cx="620" cy="218" r="6"/><text x="640" y="166">V Ω / mA</text><text x="640" y="221">COM</text><text class="meter-label" x="667" y="250" text-anchor="middle">MULTIMETER</text>
    ${nodes}
  </svg><div class="probe-state"><span class="probe-red-label">Rot: ${state.redNode}</span><span>Schwarz: ${state.blackNode}</span><span>${state.power ? `${state.supply.toFixed(1)} V EIN` : "Versorgung AUS"}</span><span>Knoten anklicken = rote Leitung versetzen</span></div>`;
}

function schematicDefinition(state) {
  const baseNodes = [["Plus", 115, 70, "+"], ["Strommessstelle", 140, 70, "I+"], ["Stromrückleitung", 190, 70, "I−"], ["Masse", 115, 260, "0 V / Masse"]];
  if (state.circuit === "led") return {
    nodes: [...baseNodes, ["vor LED", 350, 70, "vor LED"]],
    body: `${resistorH(210, 320, 70, "R1", state.resistance)}<line class="schematic-wire" x1="320" y1="70" x2="365" y2="70"/><path class="schematic-component schematic-led" d="M365 52 L365 88 L402 70 Z M407 49 V91"/><line class="schematic-wire" x1="407" y1="70" x2="490" y2="70"/><line class="schematic-wire" x1="490" y1="70" x2="490" y2="260"/><line class="schematic-wire" x1="490" y1="260" x2="115" y2="260"/><path class="led-rays" d="M377 48 l17 -17 m-5 3 l6 -3 l-2 7 M390 52 l17 -17 m-5 3 l6 -3 l-2 7"/><text x="375" y="112">LED</text>`,
  };
  if (state.circuit === "divider") return {
    nodes: [...baseNodes, ["Mitte", 330, 165, "Mitte"]],
    body: `<line class="schematic-wire" x1="210" y1="70" x2="330" y2="70"/>${resistorV(330, 70, 145, "R1", state.resistance)}<line class="schematic-wire" x1="330" y1="145" x2="330" y2="180"/>${resistorV(330, 180, 245, "R2", state.secondResistance)}<line class="schematic-wire" x1="330" y1="245" x2="330" y2="260"/><line class="schematic-wire" x1="330" y1="260" x2="115" y2="260"/>`,
  };
  if (state.circuit === "transistorSwitch") return {
    nodes: [...baseNodes, ["Kollektor", 350, 140, "Kollektor"], ["Basis", 285, 190, "Basis"], ["Emitter", 350, 235, "Emitter"]],
    body: `<line class="schematic-wire" x1="210" y1="70" x2="350" y2="70"/>${resistorV(350, 70, 130, "RC", state.resistance)}<line class="schematic-wire" x1="350" y1="130" x2="350" y2="145"/>${npnSymbol(350, 190)}<line class="schematic-wire" x1="350" y1="235" x2="350" y2="260"/><line class="schematic-wire" x1="350" y1="260" x2="115" y2="260"/><line class="schematic-wire" x1="210" y1="70" x2="210" y2="190"/>${resistorH(210, 270, 190, "RB", state.secondResistance)}<line class="schematic-wire" x1="270" y1="190" x2="295" y2="190"/>`,
  };
  if (state.circuit === "commonEmitter") return {
    nodes: [...baseNodes, ["Kollektor", 395, 135, "Kollektor"], ["Basis", 315, 180, "Basis"], ["Emitter", 395, 225, "Emitter"]],
    body: `<line class="schematic-wire" x1="210" y1="70" x2="395" y2="70"/>${resistorV(395, 70, 125, "RC", state.resistance)}<line class="schematic-wire" x1="395" y1="125" x2="395" y2="140"/>${npnSymbol(395, 180)}${resistorV(395, 220, 260, "RE", state.fourthResistance)}<line class="schematic-wire" x1="395" y1="260" x2="115" y2="260"/>${resistorV(265, 70, 165, "R2", state.secondResistance)}${resistorV(265, 195, 260, "R3", state.thirdResistance)}<line class="schematic-wire" x1="265" y1="165" x2="265" y2="195"/><line class="schematic-wire" x1="265" y1="180" x2="340" y2="180"/><line class="schematic-wire" x1="265" y1="70" x2="210" y2="70"/><line class="schematic-wire" x1="265" y1="260" x2="115" y2="260"/>`,
  };
  if (state.circuit === "wheatstone") return {
    nodes: [...baseNodes, ["Brücke links", 280, 165, "Brücke links"], ["Brücke rechts", 430, 165, "Brücke rechts"]],
    body: `<line class="schematic-wire" x1="210" y1="70" x2="430" y2="70"/>${resistorV(280, 70, 150, "R1", state.resistance)}${resistorV(280, 180, 260, "R2", state.secondResistance)}${resistorV(430, 70, 150, "R3", state.thirdResistance)}${resistorV(430, 180, 260, "R4 Sensor", state.fourthResistance)}<line class="schematic-wire" x1="280" y1="150" x2="280" y2="180"/><line class="schematic-wire" x1="430" y1="150" x2="430" y2="180"/><text x="318" y="157">Brückenausgang</text><line class="schematic-wire" x1="280" y1="260" x2="115" y2="260"/><line class="schematic-wire" x1="430" y1="260" x2="115" y2="260"/>`,
  };
  if (state.circuit === "diode") return {
    nodes: [...baseNodes, ["nach Diode", 330, 70, "nach Diode"]],
    body: `<line class="schematic-wire" x1="210" y1="70" x2="260" y2="70"/><path class="schematic-component" d="M260 52 L260 88 L297 70 Z M302 49 V91"/><line class="schematic-wire" x1="302" y1="70" x2="360" y2="70"/>${resistorV(360, 70, 230, "R1 Last", state.resistance)}<line class="schematic-wire" x1="360" y1="230" x2="360" y2="260"/><line class="schematic-wire" x1="360" y1="260" x2="115" y2="260"/>`,
  };
  return {
    nodes: [...baseNodes, ["vor Unterbrechung", 330, 70, "vor Unterbrechung"]],
    body: `<line class="schematic-wire" x1="210" y1="70" x2="330" y2="70"/><line class="schematic-wire" x1="330" y1="70" x2="375" y2="70"/><line class="schematic-wire" x1="415" y1="70" x2="490" y2="70"/><line class="schematic-component" x1="375" y1="70" x2="407" y2="48"/><line class="schematic-wire" x1="490" y1="70" x2="490" y2="260"/><line class="schematic-wire" x1="490" y1="260" x2="115" y2="260"/><text x="345" y="42">Unterbrechung</text>`,
  };
}

function resistorH(x1, x2, y, label, value) { const width = x2 - x1; return `<line class="schematic-wire" x1="${x1}" y1="${y}" x2="${x1 + 12}" y2="${y}"/><rect class="schematic-component schematic-resistor" x="${x1 + 12}" y="${y - 11}" width="${width - 24}" height="22"/><line class="schematic-wire" x1="${x2 - 12}" y1="${y}" x2="${x2}" y2="${y}"/><text x="${(x1 + x2) / 2}" y="${y - 18}" text-anchor="middle">${label} ${formatResistance(value)}</text>`; }
function resistorV(x, y1, y2, label, value) { const height = y2 - y1; return `<line class="schematic-wire" x1="${x}" y1="${y1}" x2="${x}" y2="${y1 + 10}"/><rect class="schematic-component schematic-resistor" x="${x - 11}" y="${y1 + 10}" width="22" height="${Math.max(18, height - 20)}"/><line class="schematic-wire" x1="${x}" y1="${y2 - 10}" x2="${x}" y2="${y2}"/><text x="${x + 16}" y="${(y1 + y2) / 2 + 4}">${label}</text><text x="${x + 16}" y="${(y1 + y2) / 2 + 17}">${formatResistance(value)}</text>`; }
function npnSymbol(x, y) { return `<circle class="transistor-body" cx="${x}" cy="${y}" r="43"/><line class="schematic-component" x1="${x - 55}" y1="${y}" x2="${x - 15}" y2="${y}"/><line class="schematic-component" x1="${x - 15}" y1="${y - 25}" x2="${x - 15}" y2="${y + 25}"/><line class="schematic-component" x1="${x - 15}" y1="${y - 16}" x2="${x}" y2="${y - 45}"/><line class="schematic-component" x1="${x - 15}" y1="${y + 16}" x2="${x}" y2="${y + 45}"/><path class="transistor-arrow" d="M${x - 2} ${y + 41} l-14 -4 l7 -12 Z"/><text x="${x + 18}" y="${y + 5}">NPN</text>`; }
function syncNodes(state) { const valid = new Set(allNodes().map(([value]) => value)); if (!valid.has(state.redNode)) state.redNode = CIRCUITS[state.circuit].nodes[1]; if (!valid.has(state.blackNode)) state.blackNode = "Masse"; }
function allNodes() { return [["Plus", "Plus"], ["vor LED", "vor LED"], ["Mitte", "Mitte des Teilers"], ["Kollektor", "Transistor: Kollektor"], ["Basis", "Transistor: Basis"], ["Emitter", "Transistor: Emitter"], ["Brücke links", "Wheatstone: Brücke links"], ["Brücke rechts", "Wheatstone: Brücke rechts"], ["nach Diode", "nach Diode"], ["vor Unterbrechung", "vor Unterbrechung"], ["Strommessstelle", "I+ der Strommesslücke"], ["Stromrückleitung", "I− der Strommesslücke"], ["Masse", "Masse"]]; }
function result(display, kind, explanation) { return { display, kind, explanation }; }
function formatResistance(value) { if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MΩ`; if (value >= 1000) return `${(value / 1000).toFixed(2)} kΩ`; return `${value.toFixed(1)} Ω`; }
function control(label) { const section = document.createElement("section"); section.className = "control-group"; section.innerHTML = `<h3>${label}</h3>`; return section; }
function addNumber(parent, label, initial, set, unit, changed, step) { const section = control(label); const input = document.createElement("input"); input.type = "number"; input.setAttribute("aria-label", label); input.value = initial; input.step = step; input.addEventListener("input", () => { set(Number(input.value)); changed(); }); const output = document.createElement("output"); output.textContent = unit; section.append(input, output); parent.append(section); }
function addSelect(parent, label, options, initial, set, changed) { const section = control(label); const select = document.createElement("select"); select.setAttribute("aria-label", label); for (const [value, text] of options) select.add(new Option(text, value)); select.value = initial; select.addEventListener("change", () => { set(select.value); changed(); }); section.append(select); parent.append(section); }
function addCheck(parent, label, initial, set, changed) { const section = control(label); const input = document.createElement("input"); input.type = "checkbox"; input.checked = initial; input.setAttribute("aria-label", label); input.addEventListener("change", () => { set(input.checked); changed(); }); section.append(input); parent.append(section); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
