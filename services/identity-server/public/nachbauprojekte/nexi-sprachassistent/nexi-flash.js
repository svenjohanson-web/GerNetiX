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
    actionType: "nexi.flash.usb.start",
    actionTimeoutMs: 10 * 60 * 1000,
    async onExecute(method, progress) {
      if (method !== "usb") throw new Error("Dieser Übertragungsweg ist für Nexi Basic nicht verfügbar.");
      const action = window.GerNetiXActionOps?.begin?.("nexi.flash.usb.start", {
        releaseId: selectedDemo?.releases?.[0]?.version || "",
        timeoutMs: 10 * 60 * 1000,
      });
      try {
        await ensureUsbPort(progress.write, action);
        await flashSelectedRelease(progress.write, progress.setArtifact, progress.setProgress, action);
        action?.succeed();
      } catch (error) {
        action?.fail(actionReason(error));
        throw error;
      }
    },
    onComplete() { window.location.assign("inbetriebnahme/index.html"); },
  });
});

async function ensureUsbPort(log, action) {
  if (selectedPort) return selectedPort;
  if (navigator.serial) {
    log("running", "Wähle jetzt das angeschlossene Waveshare-Board aus.");
    selectedPort = await observed(action, "helper.ports", () => navigator.serial.requestPort(), "local_device_missing");
    return selectedPort;
  }
  if (!serialService) throw operationError("Der GerNetiX Serial Helper kann von dieser Seite nicht angesprochen werden. Lade die Seite neu oder verwende Chrome/Edge.", "local_dependency_unreachable");
  try {
    await observed(action, "helper.status", () => serialService.status(), "local_dependency_unreachable");
  } catch (error) {
    const detail = error?.name === "TypeError"
      ? "Der Browser blockiert die lokale Verbindung oder vertraut dem lokalen Zertifikat nicht"
      : (error?.message || "Unbekannter Verbindungsfehler");
    throw operationError(`Der Browser erreicht den GerNetiX Serial Helper auf diesem Computer nicht. Prüfe, ob der Helper läuft und der Browser lokale Verbindungen zulässt. ${detail}.`, "local_dependency_unreachable");
  }
  const ports = await observed(action, "helper.ports", () => serialService.ports(), "local_dependency_unreachable");
  if (!ports.length) throw operationError("Der Serial Helper findet kein USB-Gerät. Prüfe Datenkabel und Verbindung.", "local_device_missing");
  if (ports.length > 1) throw operationError("Mehrere USB-Geräte gefunden. Trenne die anderen Geräte vorübergehend und öffne Flashen erneut.", "multiple_local_devices");
  selectedPort = { ...ports[0], source: "gernetix_serial_service" };
  log("running", "Das angeschlossene Board wird geprüft …");
  const probe = await observed(action, "board.probe", () => serialService.probe(selectedPort.path), "board_probe_failed");
  try { validateBoard(probe.chipName, probe.flashSize); } catch (error) { error.opsReasonCode = "board_incompatible"; throw error; }
  log("ok", "Das passende ESP32-S3-Board wurde erkannt.");
  return selectedPort;
}

async function flashSelectedRelease(log, setArtifact, setProgress, action) {
  const release = selectedDemo.releases[0];
  displayedFlashPercent = 0;
  unchangedFlashPolls = 0;
  log("running", "Das geprüfte Firmware-Paket wird vorbereitet …");
  const manifest = await observed(action, "manifest.load", async () => {
    const manifestResponse = await fetch(`api/public/demos/${DEMO_ID}/releases/${encodeURIComponent(release.version)}/flash-manifest`);
    if (!manifestResponse.ok) throw operationError("Flash-Manifest konnte nicht geladen werden.", "manifest_unavailable");
    return manifestResponse.json();
  }, "manifest_unavailable");
  if (manifest.chip !== "esp32s3" || manifest.flash_size !== "16MB") throw operationError("Release passt nicht zum vorgesehenen Waveshare-Board.", "board_incompatible");
  const mainAsset = manifest.assets.find((asset) => asset.file_name === "firmware.bin") || manifest.assets[0];
  setArtifact({ name: mainAsset.file_name, version: release.version, sizeBytes: mainAsset.size_bytes, sha256: mainAsset.sha256 });
  const files = await observed(action, "firmware.download", () => Promise.all(manifest.assets.map(async (asset, index) => {
    log("running", `Firmware-Bestandteil ${index + 1} von ${manifest.assets.length} wird geprüft …`);
    const response = await fetch(new URL(asset.download_url.replace(/^\//, ""), new URL(".", location.href)));
    if (!response.ok) throw operationError(`${asset.file_name} konnte nicht geladen werden.`, "artifact_download_failed");
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== asset.size_bytes) throw operationError(`${asset.file_name} hat eine unerwartete Größe.`, "artifact_verification_failed");
    if (await sha256(data) !== asset.sha256) throw operationError(`${asset.file_name} hat nicht die veröffentlichte Prüfsumme.`, "artifact_verification_failed");
    return { name: asset.file_name, address: asset.flash_offset, data };
  })), (error) => actionReason(error, "artifact_download_failed"));
  if (selectedPort.source === "gernetix_serial_service") {
    log("running", "Nexi wird auf das Board übertragen …");
    let verifySpan = null;
    let result;
    try {
      result = await observed(action, "board.flash", () => serialService.flash({
        port: selectedPort.path,
        actionId: action?.id || "",
        files,
        onProgress(job) {
          if (job?.phase === "verifying" && !verifySpan) verifySpan = action?.startSpan?.("flash.verify");
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
      }), (error) => actionReason(error, verifySpan ? "flash_verification_failed" : "flash_failed"));
      verifySpan?.succeed();
    } catch (error) {
      verifySpan?.fail("flash_verification_failed");
      throw error;
    }
    if (result.status !== "succeeded") throw operationError(result.error || "Flash über den Serial Helper fehlgeschlagen.", "flash_failed");
  } else {
    await observed(action, "board.flash", async () => {
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
    }, (error) => actionReason(error, "flash_failed"));
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
  if (!/ESP32[- ]?S3/i.test(chipName || "")) throw operationError("Das verbundene Gerät ist kein ESP32-S3. Es wird nichts geschrieben.", "board_incompatible");
  if (sizeMb(flashSize) < 16) throw operationError("Das verbundene Gerät meldet weniger als 16 MB Flash. Es wird nichts geschrieben.", "board_incompatible");
}
async function observed(action, spanType, operation, reasonCode) {
  if (!action?.step) return operation();
  return action.step(spanType, operation, reasonCode);
}
function actionReason(error, fallback = "unknown_client_failure") {
  if (error?.opsReasonCode) return error.opsReasonCode;
  if (["serial_service_update_required", "serial_service_update_failed", "serial_service_update_timeout"].includes(error?.code)) return "helper_update_failed";
  return fallback;
}
function operationError(message, reasonCode) { const error = new Error(message); error.opsReasonCode = reasonCode; return error; }
function setEntryEnabled(enabled, message) { openFlashButton.disabled = !enabled; openFlashButton.title = enabled ? "" : message; flashEntryStatus.textContent = message; flashEntryStatus.classList.toggle("disabled-action-reason", !enabled); }
function sizeMb(value) { const match = String(value || "").match(/([0-9]+(?:\.[0-9]+)?)\s*(MB|Mbit)/i); return match ? Number(match[1]) * (/Mbit/i.test(match[2]) ? 1 / 8 : 1) : 0; }
async function sha256(bytes) { const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
