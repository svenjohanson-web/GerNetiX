const state = { port: null, probe: null, release: null, esptool: null, busy: false, hardwareAcknowledged: false };
const expected = { chip: "ESP32-S3" };

const $ = (selector) => document.querySelector(selector);
$("#autoSearchButton").addEventListener("click", () => findFlashbox(true));
$("#manualPortButton").addEventListener("click", () => findFlashbox(false));
$("#flashButton").addEventListener("click", flashInitialImage);
$("#inventoryLaterButton").addEventListener("click", () => { $("#inventoryLaterStatus").textContent = "Kein Problem. Du kannst die FlashBox später unter Geräte → Inventar mit deinem Account verbinden."; });
$("#hardwareConfirmation").addEventListener("change", updateFlashButton);
$("#hardwareCheckContinueButton").addEventListener("click", confirmHardwareCheck);
showOnlyStage(0);
loadRelease();

async function loadRelease() {
  try {
    const response = await fetch("/api/public/flashbox/initial-firmware", { credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Initialimage ist nicht freigegeben.");
    state.release = payload;
    renderDetails("#releaseDetails", [["Release", payload.version], ["Datei", payload.file_name], ["Gr&ouml;&szlig;e", formatBytes(payload.size_bytes)], ["SHA-256", payload.sha256], ["Zielprofil", payload.hardware_profile]]);
    status("#releaseStatus", "ok", "Freigegebenes, versioniertes Initialimage ist bereit.");
  } catch (error) {
    status("#releaseStatus", "error", error.message);
  }
  updateFlashButton();
}

async function findFlashbox(automatic) {
  if (!navigator.serial) { status("#connectionStatus", "error", "Web Serial wird von diesem Browser nicht unterst&uuml;tzt. Bitte Chrome oder Edge am Desktop verwenden."); return; }
  setBusy(true);
  try {
    let port = null;
    if (automatic) port = (await navigator.serial.getPorts()).find((candidate) => candidate.getInfo?.().usbVendorId === 0x303A);
    if (!port) port = await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x303A }] });
    state.port = port;
    state.hardwareAcknowledged = false;
    $("#hardwareCheckContinueButton").hidden = true;
    showOnlyStage(1);
    status("#connectionStatus", "ok", "FlashBox-USB-Gerät gefunden. Hardwareprüfung läuft jetzt.");
    markDone("stepConnect");
    markActive("stepCheck");
    status("#hardwareStatus", "running", "ESP32-Bootloader sowie Flash- und RAM-Angaben werden geprüft …");
    const probe = await probeEsp32S3(port);
    state.probe = probe;
    renderDetails("#hardwareDetails", [["Chip", probe.chipName], ["Flash", probe.flashSize], ["Interner RAM", probe.ramSize], ["PSRAM", probe.psramSize], ["USB", usbDescription(port)]]);
    const okay = probe.isS3;
    $("#hardwareConfirmation").disabled = true;
    $("#hardwareConfirmation").checked = false;
    if (okay) { status("#hardwareStatus", "ok", "ESP32-S3 erkannt. Pr&uuml;fe die angezeigten Werte und best&auml;tige danach, dass du mit Schritt 3 fortfahren m&ouml;chtest."); $("#hardwareCheckContinueButton").hidden = false; }
    else { status("#hardwareStatus", "error", `Keine kompatible FlashBox: erforderlich ist ein ${expected.chip}.`); $("#manualPortButton").hidden = false; markActive("stepCheck"); }
  } catch (error) {
    state.probe = null;
    $("#hardwareConfirmation").disabled = true;
    $("#hardwareCheckContinueButton").hidden = true;
    $("#manualPortButton").hidden = false;
    status("#connectionStatus", "error", error.message || "Kein ESP32-Bootloader gefunden.");
    status("#hardwareStatus", "error", "Bitte BOOT halten, RESET kurz dr&uuml;cken und danach einen COM-Port ausw&auml;hlen.");
  } finally { setBusy(false); updateFlashButton(); }
}

async function probeEsp32S3(port) {
  let transport;
  try {
    const { ESPLoader, Transport } = await loadEsptool();
    transport = new Transport(port, false);
    const loader = new ESPLoader({ transport, baudrate: 115200, terminal: { clean() {}, writeLine() {}, write() {} }, debugLogging: false });
    const info = port.getInfo?.() || {};
    const chipName = await loader.main(info.usbVendorId === 0x303A && info.usbProductId === 0x1001 ? "usb_reset" : "default_reset");
    const flashSize = await loader.detectFlashSize();
    const features = await loader.chip?.getChipFeatures?.(loader) || [];
    const psramFeature = features.find((feature) => /PSRAM/i.test(String(feature))) || "nicht erkannt";
    const flashMb = sizeMb(flashSize);
    const psramMb = sizeMb(psramFeature);
    return { chipName: chipName || "ESP32", isS3: /ESP32[- ]?S3/i.test(chipName || ""), flashSize: flashSize || "unbekannt", flashMb, ramSize: /ESP32[- ]?S3/i.test(chipName || "") ? "512 KB intern" : "unbekannt", psramSize: psramFeature, psramMb };
  } finally {
    try { await transport?.disconnect(); } catch {}
    try { if (port.readable || port.writable) await port.close(); } catch {}
  }
}

async function flashInitialImage() {
  if (!state.port || !state.probe || !state.release || !$("#hardwareConfirmation").checked) return;
  setBusy(true); showOnlyStage(3); markActive("stepFlash"); status("#flashStatus", "running", "Initialimage wird geladen und gepr&uuml;ft …");
  let transport;
  try {
    const response = await fetch(state.release.content_url, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Initialimage konnte nicht geladen werden.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (await sha256(bytes) !== state.release.sha256) throw new Error("Pr&uuml;fsumme des Initialimages stimmt nicht. Es wird nichts geschrieben.");
    const { ESPLoader, Transport } = await loadEsptool();
    transport = new Transport(state.port, false);
    const loader = new ESPLoader({ transport, baudrate: 115200, terminal: { clean() {}, writeLine() {}, write() {} }, debugLogging: false });
    const info = state.port.getInfo?.() || {};
    const chipName = await loader.main(info.usbVendorId === 0x303A && info.usbProductId === 0x1001 ? "usb_reset" : "default_reset");
    if (!/ESP32[- ]?S3/i.test(chipName || "")) throw new Error("USB-Verbindung hat kein ESP32-S3 gemeldet. Es wird nichts geschrieben.");
    await loader.writeFlash({ fileArray: [{ data: bytes, address: 0 }], flashMode: "dio", flashFreq: "40m", flashSize: "keep", eraseAll: false, compress: true, reportProgress: (_index, written, total) => status("#flashStatus", "running", `Initialimage wird geschrieben: ${Math.min(100, Math.round(written / Math.max(total, 1) * 100))} %`) });
    await loader.after("hard_reset");
    status("#flashStatus", "ok", `FlashBox-Initialimage ${state.release.version} wurde erfolgreich geschrieben. Als N&auml;chstes kannst du die FlashBox nach der Anmeldung aktivieren.`);
    $("#inventoryNext").hidden = false;
    markDone("stepFlash");
    markActive("stepAccount");
  } catch (error) { status("#flashStatus", "error", error.message || "USB-Flash fehlgeschlagen."); }
  finally { try { await transport?.disconnect(); } catch {} try { if (state.port?.readable || state.port?.writable) await state.port.close(); } catch {} setBusy(false); updateFlashButton(); }
}

function confirmHardwareCheck() {
  if (!state.probe?.isS3 || state.busy) return;
  state.hardwareAcknowledged = true;
  $("#hardwareCheckContinueButton").hidden = true;
  $("#hardwareConfirmation").disabled = false;
  markDone("stepCheck");
  markActive("stepConfirm");
  showOnlyStage(2);
  updateFlashButton();
}

async function loadEsptool() { if (!state.esptool) state.esptool = await import("/vendor/esptool-js/bundle.js"); return state.esptool; }
function sizeMb(value) { const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*(?:MB|MiB)/i); return match ? Number(match[1]) : 0; }
function usbDescription(port) { const info = port.getInfo?.() || {}; return info.usbVendorId ? `VID ${info.usbVendorId.toString(16).padStart(4, "0").toUpperCase()} · PID ${(info.usbProductId || 0).toString(16).padStart(4, "0").toUpperCase()}` : "serieller Port"; }
function formatBytes(value) { return `${(Number(value) / 1024 / 1024).toFixed(2)} MB`; }
async function sha256(bytes) { const hash = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function status(selector, kind, text) { const node = $(selector); node.className = `status ${kind}`; node.textContent = text; }
function renderDetails(selector, values) { $(selector).classList.remove("empty"); $(selector).innerHTML = values.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join(""); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function setBusy(value) { state.busy = value; $("#autoSearchButton").disabled = value; $("#manualPortButton").disabled = value; }
function updateFlashButton() { $("#flashButton").disabled = state.busy || !state.release || !state.probe || !state.hardwareAcknowledged || !$("#hardwareConfirmation").checked; }
function markDone(id) { $("#" + id).classList.add("done"); }
function markActive(id) { document.querySelectorAll(".steps li").forEach((item) => item.classList.remove("active")); $("#" + id).classList.add("active"); }
function showOnlyStage(index) { document.querySelectorAll("main > .card").forEach((card, cardIndex) => { card.hidden = cardIndex !== index; }); }
