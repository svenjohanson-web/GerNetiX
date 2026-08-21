import { themedPlantUmlSource } from "@app/app-runtime-utils.js";

/*
 * PlantUML-Werkzeuge der Entwicklungsplattform.
 *
 * Herausgeloest aus development-platform.js: die Funktionen arbeiten
 * ausschliesslich mit ihren Parametern und greifen auf keinen gemeinsamen
 * Zustand zu. Sie liegen deshalb als flaches Modul vor, nicht in einer Huelle.
 *
 * Fachliche Diagramme (Touchscreen, Hausautomatisierung) bleiben dort, wo ihre
 * Konfigurationsoptionen liegen. Hier steht nur, was aus einer Quelle ein
 * darstellbares Diagramm macht.
 */

function plantUmlLabel(value) {
  return String(value || "").replace(/["\r\n]/g, " ").trim();
}

function sanitizeArchitectureDiagram(diagram) {
  if (!diagram?.source) return null;
  const derivedFrom = diagram.derived_from || diagram.derivedFrom || "";
  return {
    ...diagram,
    source: normalizeArchitecturePlantUml(stripPlantUmlNotes(diagram.source), derivedFrom),
  };
}

function stripPlantUmlNotes(source) {
  const lines = String(source || "").split(/\r?\n/);
  const cleaned = [];
  let inNote = false;
  lines.forEach((line) => {
    if (/^\s*note\b/i.test(line)) {
      inNote = true;
      return;
    }
    if (inNote) {
      if (/^\s*end\s+note\b/i.test(line)) inNote = false;
      return;
    }
    cleaned.push(line);
  });
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeArchitecturePlantUml(source, derivedFrom = "") {
  const isTemplate = derivedFrom === "project_template" || /Startarchitektur aus Projekttemplate/i.test(source);
  let normalized = String(source || "")
    .replace(/^(\s*)(?:node|component|database|cloud|queue|artifact)\s+("[^"]+")(\s+as\s+[A-Za-z_][A-Za-z0-9_]*)?/gmi, "$1rectangle $2$3");
  if (isTemplate) {
    normalized = normalized
      .replace(/ESP32 Datenlogger/g, "IoT-Device Datenlogger")
      .replace(/ESP32 Device/g, "IoT-Device")
      .replace(/ESP32-Device/g, "IoT-Device")
      .replace(/^\s*Startarchitektur aus Projekttemplate;.*$/gmi, "");
  }
  return numberGenericIotDeviceInstances(normalized).replace(/\n{3,}/g, "\n\n").trim();
}

function numberGenericIotDeviceInstances(source) {
  const text = String(source || "");
  const usedNumbers = new Set(Array.from(text.matchAll(/\bIoT[- ]Device\s+(\d+)\b/gi), (match) => Number(match[1])));
  let nextNumber = 1;
  return text.replace(/(\brectangle\s+")IoT[- ]Device(")/gi, (_match, prefix, suffix) => {
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    const instanceNumber = nextNumber;
    usedNumbers.add(instanceNumber);
    nextNumber += 1;
    return `${prefix}IoT-Device ${instanceNumber}${suffix}`;
  });
}

async function renderPlantUmlImage(image, source) {
  const status = image.closest(".plantuml-viewer")?.querySelector(".plantuml-status");
  if (!source) return;
  try {
    image.src = await createPlantUmlSvgUrl(source);
    image.addEventListener("load", () => {
      image.classList.add("loaded");
      if (status) status.textContent = "Gerendert aus PlantUML.";
    }, { once: true });
    image.addEventListener("error", () => {
      if (status) status.textContent = "PlantUML-Bild konnte nicht geladen werden.";
    }, { once: true });
  } catch {
    if (status) status.textContent = "PlantUML-Bild konnte im Browser nicht erzeugt werden.";
  }
}

async function createPlantUmlSvgUrl(source) {
  const bytes = new TextEncoder().encode(themedPlantUmlSource(source));
  const compressed = await deflateForPlantUml(bytes);
  return `https://www.plantuml.com/plantuml/svg/${encodePlantUmlBytes(compressed)}`;
}

async function deflateForPlantUml(bytes) {
  if (typeof CompressionStream === "undefined") throw new Error("CompressionStream unavailable");
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return compressed.slice(2, -4);
}

function encodePlantUmlBytes(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    output += appendPlantUml3Bytes(bytes[index], bytes[index + 1] ?? 0, bytes[index + 2] ?? 0);
  }
  return output;
}

function appendPlantUml3Bytes(byte1, byte2, byte3) {
  const c1 = byte1 >> 2;
  const c2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
  const c3 = ((byte2 & 0xf) << 2) | (byte3 >> 6);
  const c4 = byte3 & 0x3f;
  return encodePlantUml6Bit(c1 & 0x3f)
    + encodePlantUml6Bit(c2 & 0x3f)
    + encodePlantUml6Bit(c3 & 0x3f)
    + encodePlantUml6Bit(c4 & 0x3f);
}

function encodePlantUml6Bit(value) {
  if (value < 10) return String.fromCharCode(48 + value);
  value -= 10;
  if (value < 26) return String.fromCharCode(65 + value);
  value -= 26;
  if (value < 26) return String.fromCharCode(97 + value);
  value -= 26;
  if (value === 0) return "-";
  if (value === 1) return "_";
  return "?";
}

export {
  appendPlantUml3Bytes,
  createPlantUmlSvgUrl,
  encodePlantUml6Bit,
  encodePlantUmlBytes,
  normalizeArchitecturePlantUml,
  numberGenericIotDeviceInstances,
  plantUmlLabel,
  renderPlantUmlImage,
  sanitizeArchitectureDiagram,
  stripPlantUmlNotes,
};
