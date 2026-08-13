export function createPowerSupplyLab() {
  const state = { enabled: true, voltage: 5, currentLimit: .05, load: 100 };
  return {
    id: "power", title: "Labornetzteil", status: "Nutzbar", summary: "Spannung, Last und Strombegrenzung",
    mount(target) {
      target.innerHTML = `<article class="lab-card"><h2>Labornetzteil und Strombegrenzung</h2><p>Stelle Sollspannung, Stromgrenze und Last ein. Beobachte den Wechsel zwischen Konstantspannung (CV) und Konstantstrom (CC).</p><div class="instrument-layout"><section><div class="power-display"><div><small>Spannung</small><strong data-voltage></strong></div><div><small>Strom</small><strong data-current></strong></div><span data-mode></span></div><div class="load-visual"><span>Netzteil</span><i>＋ ───── R Last ───── −</i><strong data-load></strong></div><p class="scope-note" data-feedback></p></section><aside class="scope-controls" data-controls></aside></div></article>`;
      const voltage = target.querySelector("[data-voltage]"); const current = target.querySelector("[data-current]"); const mode = target.querySelector("[data-mode]"); const load = target.querySelector("[data-load]"); const feedback = target.querySelector("[data-feedback]"); const controls = target.querySelector("[data-controls]");
      const render = () => { const idealCurrent = state.voltage / state.load; const limited = idealCurrent > state.currentLimit; const actualCurrent = state.enabled ? Math.min(idealCurrent, state.currentLimit) : 0; const actualVoltage = state.enabled ? actualCurrent * state.load : 0; voltage.textContent = `${actualVoltage.toFixed(2)} V`; current.textContent = `${(actualCurrent * 1000).toFixed(1)} mA`; mode.textContent = state.enabled ? (limited ? "CC" : "CV") : "AUS"; mode.dataset.mode = limited ? "cc" : "cv"; load.textContent = `${state.load.toFixed(0)} Ω`; feedback.textContent = !state.enabled ? "Ausgang ausgeschaltet: Die Sollwerte bleiben eingestellt, an der Last liegt keine Spannung an." : limited ? "Die Last fordert mehr Strom als erlaubt. Das Netzteil senkt seine Ausgangsspannung und arbeitet in Konstantstromregelung (CC)." : "Die Stromgrenze wird nicht erreicht. Das Netzteil hält die eingestellte Spannung und arbeitet in Konstantspannungsregelung (CV)."; };
      addCheck(controls, "Ausgang eingeschaltet", state.enabled, (value) => state.enabled = value, render);
      addNumber(controls, "Sollspannung", state.voltage, (value) => state.voltage = clamp(value, 0, 30), "V", render, .1);
      addNumber(controls, "Stromgrenze", state.currentLimit, (value) => state.currentLimit = clamp(value, .001, 3), "A", render, .01);
      addNumber(controls, "Lastwiderstand", state.load, (value) => state.load = clamp(value, .1, 10000), "Ω", render, 1);
      render();
    }, dispose() {},
  };
}
function control(label) { const section = document.createElement("section"); section.className = "control-group"; section.innerHTML = `<h3>${label}</h3>`; return section; }
function addNumber(parent, label, initial, set, unit, changed, step) { const section = control(label); const input = document.createElement("input"); input.type = "number"; input.setAttribute("aria-label", label); input.value = initial; input.step = step; input.addEventListener("input", () => { set(Number(input.value)); changed(); }); const output = document.createElement("output"); output.textContent = unit; section.append(input, output); parent.append(section); }
function addCheck(parent, label, initial, set, changed) { const section = control(label); const input = document.createElement("input"); input.type = "checkbox"; input.checked = initial; input.setAttribute("aria-label", label); input.addEventListener("change", () => { set(input.checked); changed(); }); section.append(input); parent.append(section); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)); }
