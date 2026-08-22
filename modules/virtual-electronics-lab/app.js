import { createOscilloscopeLab } from "./labs/oscilloscope.js?v=20260813-cursors-1";
import { createMultimeterLab } from "./labs/multimeter.js?v=20260813-filter-separation-1";
import { createFilterLab } from "./labs/filter-lab.js?v=20260813-filter-lab-1";
import { createRadioLab } from "./labs/radio-lab.js?v=20260814-radio-rc-range-1";
import { createSpectrumAnalyzerLab } from "./labs/spectrum-analyzer.js";
import { createNetworkAnalyzerLab } from "./labs/network-analyzer.js";
import { createLogicAnalyzerLab } from "./labs/logic-analyzer.js";
import { createPinMultiplexingLab } from "./labs/pin-multiplexing.js?v=20260814-pinmux-1";
import { createPowerSupplyLab } from "./labs/power-supply.js";
import { createLcrMeterLab } from "./labs/lcr-meter.js";
import { createGpioLedThroughputLab } from "./labs/gpio-led-throughput.js";
import { createPt1000ThroughputLab } from "./labs/pt1000-adc-throughput.js?v=20260816-pt1000-ui-1";
import { createButtonDigitalInputThroughputLab } from "./labs/button-digital-input-throughput.js?v=20260817-debounce-ai-1";
import { createFreeCircuitSimulationLab } from "./labs/free-circuit-simulation.js?v=20260817-spice-ac-ui-1";
import { createFixtureTroubleshootingAssistantClient } from "./ai/troubleshooting-assistant-fixture.mjs?v=20260817-debounce-ai-1";
import { createLiveTroubleshootingAssistantClient } from "./ai/troubleshooting-assistant-client.mjs?v=20260817-debounce-ai-1";
import { getLabTemplate, listLabTemplates } from "./lab-template-catalog.mjs?v=20260817-spice-ac-ui-1";

const troubleshootingAssistantClient = window.location.pathname.startsWith("/technik-labs")
  ? createLiveTroubleshootingAssistantClient()
  : createFixtureTroubleshootingAssistantClient();

const labs = [
  createGpioLedThroughputLab(),
  createPt1000ThroughputLab(),
  createButtonDigitalInputThroughputLab({ assistantClient: troubleshootingAssistantClient }),
  createFreeCircuitSimulationLab(),
  createPinMultiplexingLab(),
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
const templateSelect = document.querySelector("#labTemplateSelect");
const templateLoadButton = document.querySelector("#labTemplateLoad");
const templateStatus = document.querySelector("#labTemplateStatus");
const themeStorageKey = "gernetix-public-theme";
let activeLab = null;
const pageParameters = new URLSearchParams(window.location.search);
if (pageParameters.get("embedded") === "1") document.documentElement.classList.add("lab-embedded");

function applyTheme(theme) {
  document.documentElement.dataset.publicTheme = theme;
  const nextLabel = theme === "dark" ? "Helles Design einschalten" : "Dunkles Design einschalten";
  themeToggle.setAttribute("aria-label", nextLabel);
  themeToggle.setAttribute("title", nextLabel);
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.textContent = theme === "dark" ? "☀" : "◐";
}

const savedTheme = window.localStorage.getItem(themeStorageKey);
// Wie auf den uebrigen oeffentlichen Seiten ist hell der Auslieferungszustand.
// Nur eine eigene Wahl des Nutzers weicht davon ab.
applyTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light");
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.publicTheme === "dark" ? "light" : "dark";
  window.localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
});

function showLab(lab, template = null) {
  activeLab?.dispose?.();
  activeLab = lab;
  workspace.replaceChildren();
  lab.loadTemplate?.(template);
  for (const button of navigation.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset.labId === lab.id));
  lab.mount(workspace);
  templateStatus.textContent = template
    ? `${template.title} geladen · Messwerkzeuge: ${template.recommendedInstruments.join(", ")}`
    : "Labor direkt geöffnet. Wähle oben eine Vorlage für einen definierten Startzustand.";
}

const areaLabels = {
  "measurement": "Messen",
  "basic-circuit": "Grundschaltungen",
  "troubleshooting": "Fehlersuche",
  "free-simulation": "Freie Simulation",
};
for (const area of Object.keys(areaLabels)) {
  const templates = listLabTemplates().filter((template) => template.area === area);
  if (!templates.length) continue;
  const group = document.createElement("optgroup");
  group.label = areaLabels[area];
  for (const template of templates) {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.title;
    group.append(option);
  }
  templateSelect.append(group);
}

function loadSelectedTemplate(templateId) {
  const template = getLabTemplate(templateId);
  const lab = template ? labs.find((entry) => entry.id === template.entry.labId) : null;
  if (!template || !lab) {
    templateStatus.textContent = "Die gewählte Vorlage ist nicht verfügbar.";
    return false;
  }
  templateSelect.value = template.id;
  showLab(lab, template);
  return true;
}

templateLoadButton.addEventListener("click", () => loadSelectedTemplate(templateSelect.value));

for (const lab of labs) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.labId = lab.id;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `<span>${lab.status}</span><strong>${lab.title}</strong><small>${lab.summary}</small>`;
  button.addEventListener("click", () => {
    templateSelect.value = "";
    showLab(lab);
  });
  navigation.append(button);
}

const requestedLab = pageParameters.get("lab");
const requestedTemplate = pageParameters.get("template");
if (!loadSelectedTemplate(requestedTemplate)) showLab(labs.find((lab) => lab.id === requestedLab) || labs[0]);
window.addEventListener("beforeunload", () => activeLab?.dispose?.());
