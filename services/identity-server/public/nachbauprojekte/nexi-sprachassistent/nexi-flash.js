"use strict";

const DEMO_ID = "nexi-basic-waveshare-s3";
const portButton = document.querySelector("#choose-port");
const portStatus = document.querySelector("#port-status");
const retryReleaseButton = document.querySelector("#retry-release");
const flashButton = document.querySelector("#flash-button");
const flashStatus = document.querySelector("#flash-status");
const serialServicePort = document.querySelector("#serial-service-port");
const supportDialog = document.querySelector("#serial-support-dialog");
const supportCopy = document.querySelector("#serial-support-copy");
const macHelper = document.querySelector("#mac-serial-helper-option");
const serialService = window.GerNetiXSerialService?.create?.() || null;
let selectedDemo = null;
let selectedPort = null;
let releaseRetryTimer = null;

setActionEnabled(portButton, false, portStatus, "Noch nicht möglich: Der geprüfte Nexi-Release wird geladen …");
setActionEnabled(flashButton, false, flashStatus, "Noch nicht möglich: Zuerst muss der geprüfte Release geladen und ein USB-Port gewählt werden.");
loadRelease();

supportDialog.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-serial-support]")) closeSupportDialog();
});

retryReleaseButton.addEventListener("click", loadRelease);

async function loadRelease() {
  window.clearTimeout(releaseRetryTimer);
  retryReleaseButton.hidden = true;
  setActionEnabled(portButton, false, portStatus, "Noch nicht möglich: Der geprüfte Nexi-Release wird geladen …");
  setActionEnabled(flashButton, false, flashStatus, "Noch nicht möglich: Der geprüfte Nexi-Release wird geladen und danach muss ein USB-Port gewählt werden.");
  try {
    const response = await fetch(`api/public/demos/${DEMO_ID}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    selectedDemo = await response.json();
    const release = selectedDemo.releases?.[0];
    if (!release) throw new Error("Kein Release veröffentlicht");
    document.querySelector("#flash-title").textContent = `Nexi Basic ${release.version} auf das Waveshare-Board flashen`;
    const source = release.source_commit_sha ? ` · Quellstand ${release.source_commit_sha.slice(0, 12)}` : "";
    setActionEnabled(portButton, true, portStatus, `Release ${release.version} ist bereit${source} · Firmware SHA-256 ${release.firmware_sha256.slice(0, 12)}…`);
    setActionEnabled(flashButton, false, flashStatus, "Noch nicht möglich: Wähle zuerst den USB-Port des Waveshare-Boards.");
  } catch (error) {
    const detail = error?.message || "Netzwerkfehler";
    const reason = `Nicht möglich: Der geprüfte Nexi-Release ist gerade nicht verfügbar (${detail}). Automatischer neuer Versuch in 5 Sekunden.`;
    setActionEnabled(portButton, false, portStatus, reason);
    setActionEnabled(flashButton, false, flashStatus, reason);
    retryReleaseButton.hidden = false;
    releaseRetryTimer = window.setTimeout(loadRelease, 5000);
  }
}

portButton.addEventListener("click", async () => {
  if (!navigator.serial) return selectSerialServicePort();
  try {
    selectedPort = await navigator.serial.requestPort();
    const info = selectedPort.getInfo();
    portStatus.textContent = `USB-Port gewählt (${hex(info.usbVendorId)}:${hex(info.usbProductId)}).`;
    enableFlash("Das Board ist verbunden. Nexi Basic kann jetzt geflasht werden.");
  } catch (error) {
    const reason = error.name === "NotFoundError" ? "Noch nicht möglich: Es wurde kein USB-Port ausgewählt." : "Noch nicht möglich: Der USB-Port konnte nicht geöffnet werden.";
    portStatus.textContent = reason;
    setActionEnabled(flashButton, false, flashStatus, reason);
  }
});

async function selectSerialServicePort() {
  setActionEnabled(portButton, false, portStatus, "Noch nicht möglich: Der GerNetiX Serial Helper wird geprüft …");
  setActionEnabled(flashButton, false, flashStatus, "Noch nicht möglich: Der USB-Port und das angeschlossene Board werden geprüft …");
  try {
    if (!serialService || !await serialService.available()) {
      const reason = "Noch nicht möglich: Kein laufender Serial Helper gefunden.";
      portStatus.textContent = reason;
      flashStatus.textContent = reason;
      showSupportDialog();
      return;
    }
    const ports = await serialService.ports();
    if (!ports.length) throw new Error("Der Serial Helper findet kein USB-Gerät. Prüfe Datenkabel und Verbindung.");
    serialServicePort.innerHTML = ports.map((port) => `<option value="${escapeHtml(port.path)}">${escapeHtml(port.displayName || port.path)}</option>`).join("");
    serialServicePort.hidden = ports.length < 2;
    const selectedPath = serialServicePort.value;
    selectedPort = { ...(ports.find((port) => port.path === selectedPath) || ports[0]), source: "gernetix_serial_service" };
    const probe = await serialService.probe(selectedPort.path);
    if (!/ESP32[- ]?S3/i.test(probe.chipName || "")) throw new Error("Das verbundene Gerät ist kein ESP32-S3. Es wird nichts geschrieben.");
    if (sizeMb(probe.flashSize) < 16) throw new Error("Das verbundene Gerät meldet weniger als 16 MB Flash. Es wird nichts geschrieben.");
    portStatus.textContent = `${probe.chipName || "USB-Board"} erkannt (${selectedPort.path}).`;
    enableFlash("Der Serial Helper ist bereit. Nexi Basic kann jetzt geflasht werden.");
  } catch (error) {
    const reason = `Noch nicht möglich: ${error.message || "Der Serial Helper konnte den USB-Port nicht prüfen."}`;
    portStatus.textContent = reason;
    setActionEnabled(flashButton, false, flashStatus, reason);
  } finally {
    setActionEnabled(portButton, Boolean(selectedDemo), portStatus, portStatus.textContent);
  }
}

function enableFlash(message) {
  setActionEnabled(flashButton, true, flashStatus, message);
}

flashButton.addEventListener("click", () => {
  if (!selectedPort || !selectedDemo) return;
  setActionEnabled(flashButton, false, flashStatus, "Noch nicht möglich: Der Flashvorgang läuft bereits …");
  flashSelectedRelease().catch((error) => {
    setActionEnabled(flashButton, true, flashStatus, `Flash fehlgeschlagen: ${error.message || "unbekannter Fehler"}`);
  });
});

async function flashSelectedRelease() {
  const release = selectedDemo.releases?.[0];
  const manifestResponse = await fetch(`api/public/demos/${DEMO_ID}/releases/${encodeURIComponent(release.version)}/flash-manifest`);
  if (!manifestResponse.ok) throw new Error("Flash-Manifest konnte nicht geladen werden.");
  const manifest = await manifestResponse.json();
  if (manifest.chip !== "esp32s3" || manifest.flash_size !== "16MB") throw new Error("Release passt nicht zum vorgesehenen Waveshare-Board.");
  const files = await Promise.all(manifest.assets.map(async (asset) => {
    flashStatus.textContent = `${asset.file_name} wird geprüft …`;
    const response = await fetch(new URL(asset.download_url.replace(/^\//, ""), new URL(".", location.href)));
    if (!response.ok) throw new Error(`${asset.file_name} konnte nicht geladen werden.`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== asset.size_bytes) throw new Error(`${asset.file_name} hat eine unerwartete Größe.`);
    if (await sha256(data) !== asset.sha256) throw new Error(`${asset.file_name} hat nicht die veröffentlichte Prüfsumme.`);
    return { name: asset.file_name, address: asset.flash_offset, data };
  }));
  if (selectedPort.source === "gernetix_serial_service") {
    const result = await serialService.flash({ port: selectedPort.path, files, onProgress(job) {
      flashStatus.textContent = [...(job.logs || [])].reverse().find((line) => /Writing at|%|Hash of data verified/i.test(line)) || "Nexi Basic wird geschrieben …";
    } });
    if (result.status !== "succeeded") throw new Error(result.error || "Flash über den Serial Helper fehlgeschlagen.");
  } else {
    const { Transport, ESPLoader } = await import("/vendor/esptool-js/bundle.js");
    const transport = new Transport(selectedPort, false);
    const loader = new ESPLoader({ transport, baudrate: 115200, terminal: { clean() {}, writeLine() {}, write() {} } });
    const info = selectedPort.getInfo?.() || {};
    const chipName = await loader.main(info.usbVendorId === 0x303A && info.usbProductId === 0x1001 ? "usb_reset" : "default_reset");
    if (!/ESP32[- ]?S3/i.test(chipName || "")) throw new Error("Das verbundene Gerät ist kein ESP32-S3. Es wird nichts geschrieben.");
    const flashSize = await loader.detectFlashSize();
    if (sizeMb(flashSize) < 16) throw new Error("Das verbundene Gerät meldet weniger als 16 MB Flash. Es wird nichts geschrieben.");
    await loader.writeFlash({ fileArray: files, flashMode: manifest.flash_mode, flashFreq: manifest.flash_freq, flashSize: manifest.flash_size, compress: true,
      reportProgress(index, written, total) { flashStatus.textContent = `Übertrage ${manifest.assets[index].file_name}: ${total ? Math.round(written / total * 100) : 0} % …`; } });
    try { await loader.after("custom_reset", false, "D0|R1|W120|R0|W120"); } catch { /* Nutzer kann RESET drücken. */ }
    await transport.disconnect();
  }
  setActionEnabled(flashButton, false, flashStatus, "Nicht erneut möglich: Nexi Basic wurde erfolgreich geflasht. Falls das Board nicht startet, drücke einmal RESET.");
}

function setActionEnabled(button, enabled, reasonNode, message) {
  button.disabled = !enabled;
  button.toggleAttribute("aria-disabled", !enabled);
  button.title = enabled ? "" : message;
  reasonNode.textContent = message;
  reasonNode.classList.toggle("disabled-action-reason", !enabled);
}

function showSupportDialog() {
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  macHelper.hidden = !/Mac/i.test(platform);
  supportCopy.textContent = /Mac/i.test(platform) ? "Safari benötigt für USB den lokalen Serial Helper. Alternativ kannst du Chrome oder Edge verwenden." : "Verwende Chrome oder Edge auf einem Desktop-Rechner mit USB-Anschluss.";
  if (typeof supportDialog.showModal === "function") supportDialog.showModal(); else supportDialog.setAttribute("open", "");
}

function closeSupportDialog() { if (typeof supportDialog.close === "function") supportDialog.close(); else supportDialog.removeAttribute("open"); }
function sizeMb(value) { const match = String(value || "").match(/([0-9]+(?:\.[0-9]+)?)\s*(MB|Mbit)/i); return match ? Number(match[1]) * (/Mbit/i.test(match[2]) ? 1 / 8 : 1) : 0; }
async function sha256(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
function hex(value) { return value === undefined ? "unbekannt" : `0x${value.toString(16).padStart(4, "0")}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]); }
