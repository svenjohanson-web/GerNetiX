import { createOscilloscopeLab } from "./labs/oscilloscope.js?v=20260813-cursors-1";
import { createMultimeterLab } from "./labs/multimeter.js?v=20260813-filter-separation-1";
import { createFilterLab } from "./labs/filter-lab.js?v=20260813-filter-lab-1";
import { createRadioLab } from "./labs/radio-lab.js?v=20260814-radio-rc-range-1";
import { createSpectrumAnalyzerLab } from "./labs/spectrum-analyzer.js";
import { createNetworkAnalyzerLab } from "./labs/network-analyzer.js";
import { createLogicAnalyzerLab } from "./labs/logic-analyzer.js";
import { createPowerSupplyLab } from "./labs/power-supply.js";
import { createLcrMeterLab } from "./labs/lcr-meter.js";

const labs = [
  createOscilloscopeLab(),
  createFilterLab(),
  createRadioLab(),
  createMultimeterLab(),
  createPowerSupplyLab(),
  createLcrMeterLab(),
  createLogicAnalyzerLab(),
  createSpectrumAnalyzerLab(),
  createNetworkAnalyzerLab(),
];
const navigation = document.querySelector("#labNavigation");
const workspace = document.querySelector("#labWorkspace");
const themeToggle = document.querySelector("#labThemeToggle");
const themeStorageKey = "gernetix-public-theme";
let activeLab = null;

function applyTheme(theme) {
  document.documentElement.dataset.publicTheme = theme;
  const nextLabel = theme === "dark" ? "Helles Design einschalten" : "Dunkles Design einschalten";
  themeToggle.setAttribute("aria-label", nextLabel);
  themeToggle.setAttribute("title", nextLabel);
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.textContent = theme === "dark" ? "☀" : "◐";
}

const savedTheme = window.localStorage.getItem(themeStorageKey);
const preferredTheme = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : preferredTheme);
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.publicTheme === "dark" ? "light" : "dark";
  window.localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
});

function showLab(lab) {
  activeLab?.dispose?.();
  activeLab = lab;
  workspace.replaceChildren();
  for (const button of navigation.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.labId === lab.id));
  lab.mount(workspace);
}

for (const lab of labs) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.labId = lab.id;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `<span>${lab.status}</span><strong>${lab.title}</strong><small>${lab.summary}</small>`;
  button.addEventListener("click", () => showLab(lab));
  navigation.append(button);
}

const requestedLab = new URLSearchParams(window.location.search).get("lab");
showLab(labs.find((lab) => lab.id === requestedLab) || labs[0]);
window.addEventListener("beforeunload", () => activeLab?.dispose?.());
