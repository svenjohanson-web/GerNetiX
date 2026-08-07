"use strict";

const DEMO_ID = "nexi-basic-waveshare-s3";
const openFlashButton = document.querySelector("#open-flash-dialog");
const retryReleaseButton = document.querySelector("#retry-release");
const flashEntryStatus = document.querySelector("#flash-entry-status");
const serialService = window.GerNetiXSerialService?.create?.() || null;
const flashDialog = window.GerNetiXFlashDialog.create();
let selectedDemo = null;
let selectedPort = null;
let displayedFlashPercent = 0;
let unchangedFlashPolls = 0;

setEntryEnabled(false, "Noch nicht möglich: Der geprüfte Nexi-Release wird geladen.");
retryReleaseButton.addEventListener("click", loadRelease);
loadRelease();

async function loadRelease() {
  retryReleaseButton.hidden = true;
  retryReleaseButton.disabled = true;
  setEntryEnabled(false, "Noch nicht möglich: Der geprüfte Nexi-Release wird geladen.");
  try {
    const response = await fetch(`api/public/demos/${DEMO_ID}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    selectedDemo = await response.json();
    const release = selectedDemo.releases?.[0];
    if (!release) throw new Error("Kein Release veröffentlicht");
    document.querySelector("#flash-title").textContent = `Nexi Basic ${release.version} auf das Waveshare-Board flashen`;
    setEntryEnabled(true, `Nexi Basic ${release.version} ist bereit.`);
  } catch (error) {
    const detail = error?.message || "Netzwerkfehler";
    setEntryEnabled(false, `Nicht möglich: Der geprüfte Nexi-Release ist gerade nicht verfügbar (${detail}). Bitte prüfe die Verfügbarkeit später erneut.`);
    retryReleaseButton.hidden = false;
    retryReleaseButton.disabled = false;
  }
}

openFlashButton.addEventListener("click", () => {
  const release = selectedDemo?.releases?.[0];
  if (!release) return;
  flashDialog.open({
    title: "Nexi Basic flashen",
    description: "Die veröffentlichte Flash-Datei ist für das Waveshare ESP32-S3 AI Smart Speaker Board mit 16 MB Flash geprüft.",
    artifact: {
      name: release.firmware_file_name || "firmware.bin",
      version: release.version,
      sizeBytes: release.firmware_size_bytes,
      sha256: release.firmware_sha256,
    },
    methods: {
      usb: { enabled: true },
      ota: { enabled: false, reason: "Nexi Basic wird vor der ersten Gerätezuordnung per USB installiert." },
      flashbox: { enabled: false, reason: "Für den öffentlichen Nexi-Release ist keine persönliche FlashBox zugeordnet." },
    },
    progressPresentation: "guided",
    async onExecute(method, progress) {
      if (method !== "usb") throw new Error("Dieser Übertragungsweg ist für Nexi Basic nicht verfügbar.");
      await ensureUsbPort(progress.write);
      await flashSelectedRelease(progress.write, progress.setArtifact, progress.setProgress);
    },
    onComplete() { window.location.assign("inbetriebnahme/index.html"); },
  });
});

async function ensureUsbPort(log) {
  if (selectedPort) return selectedPort;
  if (navigator.serial) {
    log("running", "Wähle jetzt das angeschlossene Waveshare-Board aus.");
    selectedPort = await navigator.serial.requestPort();
    return selectedPort;
  }
  if (!serialService || !await serialService.available()) throw new Error("Kein laufender GerNetiX Serial Helper gefunden. Installiere den Helper oder verwende Chrome/Edge.");
  const ports = await serialService.ports();
  if (!ports.length) throw new Error("Der Serial Helper findet kein USB-Gerät. Prüfe Datenkabel und Verbindung.");
  if (ports.length > 1) throw new Error("Mehrere USB-Geräte gefunden. Trenne die anderen Geräte vorübergehend und öffne Flashen erneut.");
  selectedPort = { ...ports[0], source: "gernetix_serial_service" };
  log("running", "Das angeschlossene Board wird geprüft …");
  const probe = await serialService.probe(selectedPort.path);
  validateBoard(probe.chipName, probe.flashSize);
  log("ok", "Das passende ESP32-S3-Board wurde erkannt.");
  return selectedPort;
}

async function flashSelectedRelease(log, setArtifact, setProgress) {
  const release = selectedDemo.releases[0];
  displayedFlashPercent = 0;
  unchangedFlashPolls = 0;
  log("running", "Das geprüfte Firmware-Paket wird vorbereitet …");
  const manifestResponse = await fetch(`api/public/demos/${DEMO_ID}/releases/${encodeURIComponent(release.version)}/flash-manifest`);
  if (!manifestResponse.ok) throw new Error("Flash-Manifest konnte nicht geladen werden.");
  const manifest = await manifestResponse.json();
  if (manifest.chip !== "esp32s3" || manifest.flash_size !== "16MB") throw new Error("Release passt nicht zum vorgesehenen Waveshare-Board.");
  const mainAsset = manifest.assets.find((asset) => asset.file_name === "firmware.bin") || manifest.assets[0];
  setArtifact({ name: mainAsset.file_name, version: release.version, sizeBytes: mainAsset.size_bytes, sha256: mainAsset.sha256 });
  const files = await Promise.all(manifest.assets.map(async (asset, index) => {
    log("running", `Firmware-Bestandteil ${index + 1} von ${manifest.assets.length} wird geprüft …`);
    const response = await fetch(new URL(asset.download_url.replace(/^\//, ""), new URL(".", location.href)));
    if (!response.ok) throw new Error(`${asset.file_name} konnte nicht geladen werden.`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== asset.size_bytes) throw new Error(`${asset.file_name} hat eine unerwartete Größe.`);
    if (await sha256(data) !== asset.sha256) throw new Error(`${asset.file_name} hat nicht die veröffentlichte Prüfsumme.`);
    return { name: asset.file_name, address: asset.flash_offset, data };
  }));
  if (selectedPort.source === "gernetix_serial_service") {
    log("running", "Nexi wird auf das Board übertragen …");
    const result = await serialService.flash({
      port: selectedPort.path,
      files,
      onProgress(job) {
        setProgress(presentFlashProgress(job));
        const message = job?.message || (job?.phase === "verifying"
          ? "Die geschriebene Firmware wird geprüft …"
          : "Nexi wird auf das Board übertragen …");
        log(job?.status === "failed" ? "error" : "running", message);
      },
      onUpdateProgress(update) {
        setProgress({ percent: update?.percent ?? 0, label: update?.phase === "install" ? "Installieren" : "Helper-Update" });
        log("running", update?.message || "Der lokale Helper wird aktualisiert …");
      },
    });
    if (result.status !== "succeeded") throw new Error(result.error || "Flash über den Serial Helper fehlgeschlagen.");
  } else {
    const { Transport, ESPLoader } = await import("/vendor/esptool-js/bundle.js");
    const transport = new Transport(selectedPort, false);
    try {
      const loader = new ESPLoader({ transport, baudrate: 115200, terminal: { clean() {}, writeLine() {}, write() {} } });
      const info = selectedPort.getInfo?.() || {};
      const chipName = await loader.main(info.usbVendorId === 0x303A && info.usbProductId === 0x1001 ? "usb_reset" : "default_reset");
      const flashSize = await loader.detectFlashSize();
      validateBoard(chipName, flashSize);
      await loader.writeFlash({ fileArray: files, flashMode: manifest.flash_mode, flashFreq: manifest.flash_freq, flashSize: manifest.flash_size, compress: true, reportProgress(index, written, total) {
        const percent = total ? Math.round(written / total * 100) : 0;
        setProgress({ percent, label: "Flashen" });
        log("running", `Nexi wird übertragen: ${percent} %`);
      } });
      try { await loader.after("custom_reset", false, "D0|R1|W120|R0|W120"); } catch { log("running", "Falls das Board nicht startet, einmal RESET drücken."); }
    } finally {
      await transport.disconnect().catch(() => {});
    }
  }
  setProgress({ percent: 100, label: "Fertig" });
  log("ok", "Nexi Basic wurde erfolgreich geflasht.");
}

function presentFlashProgress(job) {
  const rawPercent = Math.max(0, Math.min(100, Number(job?.percent) || 0));
  const running = ["queued", "running"].includes(job?.status);
  const phaseLabel = job?.phase === "verifying" ? "Prüfen" : "Flashen";
  if (rawPercent > displayedFlashPercent) {
    displayedFlashPercent = rawPercent;
    unchangedFlashPolls = 0;
  } else if (running) {
    unchangedFlashPolls += 1;
    const phaseCeiling = rawPercent >= 75 ? 98 : 72;
    if (unchangedFlashPolls % 2 === 0 && displayedFlashPercent < phaseCeiling) {
      displayedFlashPercent += 1;
    }
  }
  if (job?.status === "succeeded") displayedFlashPercent = 100;
  const estimated = running && displayedFlashPercent > rawPercent;
  return {
    percent: displayedFlashPercent,
    label: estimated ? `${phaseLabel} (geschätzt)` : phaseLabel,
    active: running,
  };
}

function validateBoard(chipName, flashSize) {
  if (!/ESP32[- ]?S3/i.test(chipName || "")) throw new Error("Das verbundene Gerät ist kein ESP32-S3. Es wird nichts geschrieben.");
  if (sizeMb(flashSize) < 16) throw new Error("Das verbundene Gerät meldet weniger als 16 MB Flash. Es wird nichts geschrieben.");
}
function setEntryEnabled(enabled, message) { openFlashButton.disabled = !enabled; openFlashButton.title = enabled ? "" : message; flashEntryStatus.textContent = message; flashEntryStatus.classList.toggle("disabled-action-reason", !enabled); }
function sizeMb(value) { const match = String(value || "").match(/([0-9]+(?:\.[0-9]+)?)\s*(MB|Mbit)/i); return match ? Number(match[1]) * (/Mbit/i.test(match[2]) ? 1 / 8 : 1) : 0; }
async function sha256(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
