/*
 * Auswertung der Anforderungen eines Entwicklungsprojekts.
 *
 * Herausgeloest aus development-platform.js: aus Projektbeschreibung und
 * Chatverlauf werden Funktionsklasse, Zugriffsweite, Geraeteanzahl und offene
 * Fragen abgeleitet. Reine Textauswertung, ohne Zustand und ohne DOM.
 */

function compactRequirementText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177).trim()}...`;
}

function detectRequirementPatterns(text) {
  const normalized = String(text || "").toLowerCase();
  return [
    [/\b(observer|benachrichtigung|benachrichtigen|ereignis)\b/, "Observer / Benachrichtigung"],
    [/\b(datenlogger|data logger|logger|messdaten|messwerte)\b/, "Datenlogger"],
    [/\b(touchscreen game loop|touch[- ]?display|touchscreen.*spiel|spiel.*touchscreen|game loop)\b/, "Touchscreen Game Loop"],
    [/\b(remote|steuerung|steuern|schalten|aktor)\b/, "Remote-Steuerung / Aktorik"],
    [/\b(regelung|regelstrecke|autonom|ohne wlan|lokal ausfuehren)\b/, "Lokale Regel-/Steuerstrecke"],
    [/\b(zustandsmodell|state|states|synchronisiert|broadcast)\b/, "Synchronisiertes Zustandsmodell"],
  ].filter(([pattern]) => pattern.test(normalized)).map(([, label]) => label);
}

function detectAccessScope(text) {
  const normalized = String(text || "").toLowerCase();
  if (/\b(weltweit|internet|remote|von unterwegs|extern erreichbar)\b/.test(normalized)) return "weltweit / ueber Internet";
  if (/\b(nur lokal|lokal|heimnetz|wlan|lan)\b/.test(normalized)) return "lokal / eigenes Netzwerk";
  if (/lokal funktionieren oder weltweit erreichbar/.test(normalized)) return "noch offen: lokal oder weltweit";
  return "";
}

function detectIotDeviceScope(text) {
  const normalized = String(text || "").toLowerCase();
  const explicitCount = normalized.match(/\b(\d+|ein|eine|einen|mehrere)\s+(iot[- ]?)?(devices?|logger|esp32|boards?)\b/);
  if (explicitCount) return `${explicitCount[1]} ${explicitCount[3]}`.replace(/\bein(en|e)?\b/, "1");
  if (/\besp32\b/.test(normalized)) return "ESP32 als IoT-Device beteiligt";
  if (/wie viele iot-devices/.test(normalized)) return "noch offen";
  return "";
}

function extractOpenRequirementQuestions(messages) {
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant")?.content || "";
  return latestAssistant
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
    .filter((line) => line.endsWith("?"))
    .filter((line) => /ereignis|benachrichtigt|lokal|weltweit|iot-devices|messwerte|gemessen|abrufbar|logger/i.test(line))
    .slice(0, 4);
}

function requirementSummaryItems(project, chat) {
  const messages = Array.isArray(chat) ? chat : [];
  const transcript = messages.map((message) => message.content || "").join("\n");
  const items = [];
  if (project?.description) {
    items.push(["Projektkern", compactRequirementText(project.description)]);
  }
  const patterns = detectRequirementPatterns(transcript);
  if (patterns.length) items.push(["Funktionsklasse", patterns.join(", ")]);
  const access = detectAccessScope(transcript);
  if (access) items.push(["Zugriff", access]);
  const devices = detectIotDeviceScope(`${project?.description || ""}\n${transcript}`);
  if (devices) items.push(["IoT-Devices", devices]);
  const openQuestions = extractOpenRequirementQuestions(messages);
  if (openQuestions.length) items.push(["Offene Klaerung", openQuestions.join("\n")]);
  return items;
}

export {
  compactRequirementText,
  detectAccessScope,
  detectIotDeviceScope,
  detectRequirementPatterns,
  extractOpenRequirementQuestions,
  requirementSummaryItems,
};
