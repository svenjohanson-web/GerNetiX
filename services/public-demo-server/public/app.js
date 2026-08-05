const DEMO_ID = "touch-spielesammlung";
const title = document.querySelector("#flash-title");
const openFlashButton = document.querySelector("#open-flash-dialog");
const flashEntryStatus = document.querySelector("#flash-entry-status");
const serialService = window.GerNetiXSerialService?.create?.() || null;
const flashDialog = window.GerNetiXFlashDialog.create();
let selectedDemo = null;
let selectedPort = null;
let releaseUnavailableReason = "";

loadGameCollection();

async function loadGameCollection() {
  setEntryEnabled(false, "Release wird geprüft …");
  try {
    const response = await fetch(`api/public/demos/${DEMO_ID}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Release nicht verfügbar (HTTP ${response.status})`);
    selectedDemo = await response.json();
    const release = selectedDemo.releases?.[0];
    if (!release) throw new Error("Kein veröffentlichter Release vorhanden");
    title.textContent = `S3 Touch-Spielesammlung installieren · Version ${release.version}`;
    setEntryEnabled(true, `Release ${release.version} ist bereit. Flashen öffnet den gemeinsamen GerNetiX-Flashdialog.`);
  } catch (error) {
    releaseUnavailableReason = error.message || "Die Spielesammlung ist gerade nicht verfügbar.";
    setEntryEnabled(true, `Flashdialog verfügbar. Der Release fehlt noch: ${releaseUnavailableReason}`);
  }
}

openFlashButton.addEventListener("click", () => {
  const release = selectedDemo?.releases?.[0];
  const releaseReady = Boolean(release);
  const missingReleaseReason = `Kein veröffentlichter Release verfügbar${releaseUnavailableReason ? ` (${releaseUnavailableReason})` : ""}.`;
  flashDialog.open({
    title: "S3 Touch-Spielesammlung flashen",
    description: "Der veröffentlichte Release ist für das ESP32-S3 ES3C28P Touch-Board gebaut. Wähle den Übertragungsweg.",
    artifact: releaseReady
      ? { name: release.firmware_file_name || "firmware.bin", version: release.version, sizeBytes: release.firmware_size_bytes, sha256: release.firmware_sha256 }
      : { name: "Noch keine Flash-Datei veröffentlicht" },
    methods: {
      usb: { enabled: releaseReady, reason: missingReleaseReason },
      ota: { enabled: releaseReady, reason: missingReleaseReason },
      flashbox: { enabled: releaseReady, reason: missingReleaseReason },
    },
    async onExecute(method, terminal) {
      if (method === "usb") {
        await ensureUsbPort(terminal.write);
        await flashSelectedDemo(terminal.write, terminal.setArtifact);
        return;
      }
      const next = `/app/dashboard/?install=${encodeURIComponent(DEMO_ID)}&transport=${method}`;
      terminal.write("running", method === "ota"
        ? "Für OTA wird jetzt das online erreichbare Board aus deinem Inventar ausgewählt."
        : "Für FlashBox wird jetzt deine inventarisierte FlashBox mit Zielboard ausgewählt.");
      window.location.assign(`/app/auth/?next=${encodeURIComponent(next)}`);
    },
  });
});

async function ensureUsbPort(log) {
  if (selectedPort) return selectedPort;
  if (navigator.serial) {
    log("running", "USB-Gerät im Browser auswählen …");
    selectedPort = await navigator.serial.requestPort();
    return selectedPort;
  }
  if (!serialService || !await serialService.available()) throw new Error("Kein laufender GerNetiX Serial Helper gefunden. Installiere den Helper oder verwende Chrome/Edge.");
  const ports = await serialService.ports();
  if (!ports.length) throw new Error("Der Serial Helper findet kein USB-Gerät. Prüfe Datenkabel und Verbindung.");
  if (ports.length > 1) throw new Error("Mehrere USB-Geräte gefunden. Trenne die anderen Geräte vorübergehend und starte erneut.");
  selectedPort = { ...ports[0], source: "gernetix_serial_service" };
  const probe = await serialService.probe(selectedPort.path);
  validateChip(probe.chipName);
  log("ok", `${probe.chipName || "ESP32-S3"} erkannt (${selectedPort.path}).`);
  return selectedPort;
}

async function flashSelectedDemo(log, setArtifact) {
  const release = selectedDemo.releases?.[0];
  if (!release) throw new Error("Kein veröffentlichter Release vorhanden.");
  log("running", "Flash-Manifest wird geladen …");
  const manifestResponse = await fetch(`api/public/demos/${DEMO_ID}/releases/${encodeURIComponent(release.version)}/flash-manifest`);
  if (!manifestResponse.ok) throw new Error("Flash-Manifest konnte nicht geladen werden.");
  const manifest = await manifestResponse.json();
  const mainAsset = manifest.assets.find((asset) => asset.file_name === "firmware.bin") || manifest.assets[0];
  const artifact = { name: mainAsset.file_name, version: release.version, sizeBytes: mainAsset.size_bytes, sha256: mainAsset.sha256,
    sourcePath: manifest.source_path, sourceVersion: manifest.source_version };
  setArtifact(artifact);
  await window.GerNetiXFlashExecutor.executeUsb({
    port: selectedPort,
    serialService,
    artifact,
    files: manifest.assets.map((asset) => ({
      name: asset.file_name,
      url: new URL(asset.download_url.replace(/^\//, ""), new URL(".", location.href)),
      address: asset.flash_offset,
      sizeBytes: asset.size_bytes,
      sha256: asset.sha256,
      sourcePath: manifest.source_path,
      sourceVersion: manifest.source_version,
    })),
    loadEsptool: () => import("/vendor/esptool-js/bundle.js"),
    validateChip,
    resetStrategy: "custom-reset",
    nativeUsbReset: false,
    flash: { mode: manifest.flash_mode, frequency: manifest.flash_freq, size: manifest.flash_size },
    successMessage: "Spielesammlung wurde erfolgreich geflasht und neu gestartet.",
  }, { write: log, setArtifact });
}

function validateChip(chipName) { if (!/ESP32[- ]?S3/i.test(chipName || "")) throw new Error("Das verbundene Gerät ist kein ESP32-S3. Es wird nichts geschrieben."); }
function setEntryEnabled(enabled, message) { openFlashButton.disabled = !enabled; openFlashButton.title = enabled ? "" : message; flashEntryStatus.textContent = message; }
