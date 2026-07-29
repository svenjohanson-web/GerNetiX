const DEMO_ID = "touch-spielesammlung";
const title = document.querySelector("#flash-title");
const portStep = document.querySelector("#port-step");
const portButton = document.querySelector("#choose-port");
const portStatus = document.querySelector("#port-status");
const flashStep = document.querySelector("#flash-step");
const flashButton = document.querySelector("#flash-button");
const flashStatus = document.querySelector("#flash-status");
const serialServicePort = document.querySelector("#serial-service-port");
const transportButtons = Array.from(document.querySelectorAll("[data-transport]"));
const usbTransport = document.querySelector("#usb-transport");
const accountTransport = document.querySelector("#account-transport");
const accountTransportCopy = document.querySelector("#account-transport-copy");
const accountTransportLink = document.querySelector("#account-transport-link");
const serialSupportDialog = document.querySelector("#serial-support-dialog");
const serialSupportCopy = document.querySelector("#serial-support-copy");
const macSerialHelperOption = document.querySelector("#mac-serial-helper-option");
const serialService = window.GerNetiXSerialService?.create?.() || null;
let selectedDemo = null;
let selectedPort = null;

loadGameCollection();

transportButtons.forEach((button) => button.addEventListener("click", () => selectTransport(button.dataset.transport)));
serialSupportDialog.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-serial-support]")) {
    closeSerialSupportDialog();
  }
});

function selectTransport(transport) {
  const isUsb = transport === "usb";
  transportButtons.forEach((button) => {
    const selected = button.dataset.transport === transport;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  usbTransport.hidden = !isUsb;
  accountTransport.hidden = isUsb;
  if (isUsb) return;

  const isOta = transport === "ota";
  accountTransportCopy.textContent = isOta
    ? "OTA ist für ein Board gedacht, das bereits mit GerNetiX eingerichtet, im WLAN und online ist. Nach der Anmeldung wählst du dieses Board aus deinem Inventar aus."
    : "Die FlashBox übernimmt den USB-Flash am Zielgerät. Nach der Anmeldung wählst du deine inventarisierte FlashBox und das Zielboard aus.";
  const next = `/app/dashboard/?install=${encodeURIComponent(DEMO_ID)}&transport=${transport}`;
  accountTransportLink.href = `/app/auth/?next=${encodeURIComponent(next)}`;
  accountTransportLink.textContent = isOta ? "Anmelden und OTA vorbereiten" : "Anmelden und FlashBox auswählen";
}

async function loadGameCollection() {
  try {
    const response = await fetch(`api/public/demos/${DEMO_ID}`);
    if (!response.ok) throw new Error("Release nicht verfügbar");
    selectedDemo = await response.json();
    const release = selectedDemo.releases?.[0];
    if (!release) throw new Error("Kein veröffentlichter Release vorhanden");
    title.textContent = `S3 Touch-Spielesammlung installieren · Version ${release.version}`;
    portButton.disabled = false;
    portStatus.textContent = "Wähle jetzt den COM-Port des angeschlossenen Boards.";
  } catch {
    portStatus.textContent = "Die Spielesammlung ist gerade nicht verfügbar. Bitte versuche es später erneut.";
  }
}

portButton.addEventListener("click", async () => {
  if (!navigator.serial) {
    await selectSerialServicePort();
    return;
  }
  try {
    selectedPort = await navigator.serial.requestPort();
    const info = selectedPort.getInfo();
    portStatus.textContent = `COM-Port ausgewählt (USB ${hex(info.usbVendorId)}:${hex(info.usbProductId)}).`;
    flashStep.hidden = false;
    flashButton.disabled = false;
    flashStatus.textContent = "Der Port ist ausgewählt. Die Spielesammlung kann jetzt geflasht werden.";
  } catch (error) {
    portStatus.textContent = error.name === "NotFoundError" ? "Es wurde kein COM-Port ausgewählt." : "Der COM-Port konnte nicht geöffnet werden.";
  }
});

async function selectSerialServicePort() {
  portButton.disabled = true;
  portStatus.textContent = "Installierter GerNetiX Serial Helper wird geprüft …";
  try {
    if (!serialService || !await serialService.available()) {
      portStatus.textContent = "Kein laufender Serial Helper gefunden. Wähle im Dialog die Installation oder einen kompatiblen Browser.";
      showSerialSupportDialog();
      return;
    }
    const ports = await serialService.ports();
    if (!ports.length) {
      portStatus.textContent = "Der GerNetiX Serial Helper läuft, findet aber noch kein USB-Gerät. Prüfe Datenkabel und Verbindung.";
      return;
    }
    renderSerialServicePorts(ports);
    const selectedPath = serialServicePort.value;
    const port = ports.find((item) => item.path === selectedPath) || ports[0];
    selectedPort = { ...port, source: "gernetix_serial_service" };
    const probe = await serialService.probe(selectedPort.path);
    portStatus.textContent = `${probe.chipName || "USB-Board"} über den installierten GerNetiX Serial Helper erkannt (${selectedPort.path}).`;
    flashStep.hidden = false;
    flashButton.disabled = false;
    flashStatus.textContent = "Der lokale Serial Helper ist bereit. Die Spielesammlung kann jetzt geflasht werden.";
  } catch (error) {
    portStatus.textContent = error.message || "Der installierte Serial Helper konnte den USB-Port nicht prüfen.";
  } finally {
    portButton.disabled = !selectedDemo;
  }
}

function renderSerialServicePorts(ports) {
  serialServicePort.innerHTML = ports.map((port) =>
    `<option value="${escapeHtml(port.path)}">${escapeHtml(port.displayName || port.path)}</option>`).join("");
  serialServicePort.hidden = ports.length < 2;
}

function showSerialSupportDialog() {
  const mac = isMacPlatform();
  macSerialHelperOption.hidden = !mac;
  serialSupportCopy.textContent = mac
    ? "Dieser Browser kann nicht direkt auf den USB-Port zugreifen. Auf dem Mac hast du zwei Möglichkeiten:"
    : "Dieser Browser kann nicht direkt auf den USB-Port zugreifen. Verwende Chrome oder Edge auf einem Desktop-Rechner.";
  if (typeof serialSupportDialog.showModal === "function") serialSupportDialog.showModal();
  else serialSupportDialog.setAttribute("open", "");
}

function closeSerialSupportDialog() {
  if (typeof serialSupportDialog.close === "function") serialSupportDialog.close();
  else serialSupportDialog.removeAttribute("open");
}

function isMacPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  return /Mac/i.test(platform);
}

flashButton.addEventListener("click", () => {
  if (!selectedPort || !selectedDemo) return;
  flashStatus.textContent = "Flash-Manifest wird geladen …";
  flashSelectedDemo().catch((error) => { flashStatus.textContent = `Flash fehlgeschlagen: ${error.message || "unbekannter Fehler"}`; });
});

async function flashSelectedDemo() {
  const release = selectedDemo.releases?.[0];
  if (!release) throw new Error("Kein veröffentlichter Release vorhanden.");
  const manifestResponse = await fetch(`api/public/demos/${DEMO_ID}/releases/${encodeURIComponent(release.version)}/flash-manifest`);
  if (!manifestResponse.ok) throw new Error("Flash-Manifest konnte nicht geladen werden.");
  const manifest = await manifestResponse.json();
  flashStatus.textContent = "Board wird verbunden …";
  const fileArray = await Promise.all(manifest.assets.map(async (asset) => {
    const relativeAssetPath = asset.download_url.replace(/^\//, "");
    const assetUrl = new URL(relativeAssetPath, new URL(".", location.href));
    const response = await fetch(assetUrl);
    if (!response.ok) throw new Error(`${asset.file_name} konnte nicht geladen werden (${response.status}).`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== asset.size_bytes) throw new Error(`${asset.file_name} hat eine unerwartete Größe.`);
    return { name: asset.file_name, address: asset.flash_offset, data };
  }));
  if (selectedPort.source === "gernetix_serial_service") {
    const result = await serialService.flash({
      port: selectedPort.path,
      files: fileArray,
      onProgress(job) {
        const progressLine = [...(job.logs || [])].reverse().find((line) => /Writing at|%|Hash of data verified/i.test(line));
        flashStatus.textContent = progressLine || "Spielesammlung wird über den GerNetiX Serial Helper geschrieben …";
      },
    });
    if (result.status !== "succeeded") throw new Error(result.error || "USB-Flash über den Serial Helper fehlgeschlagen.");
    flashStatus.textContent = "Spielesammlung wurde über den GerNetiX Serial Helper erfolgreich geflasht und neu gestartet.";
    return;
  }
  const { Transport, ESPLoader } = await import("/vendor/esptool-js/bundle.js");
  const transport = new Transport(selectedPort, false);
  const loader = new ESPLoader({ transport, baudrate: 115200, terminal: { clean: () => {}, writeLine: () => {}, write: () => {} } });
  await loader.main();
  flashStatus.textContent = "Übertragung wird vorbereitet …";
  await loader.writeFlash({
    fileArray,
    flashMode: manifest.flash_mode,
    flashFreq: manifest.flash_freq,
    flashSize: manifest.flash_size,
    compress: true,
    reportProgress(fileIndex, written, total) {
      const asset = manifest.assets[fileIndex];
      const assetPercent = total ? Math.round((written / total) * 100) : 0;
      const overallPercent = Math.min(99, Math.round(((fileIndex + (total ? written / total : 0)) / manifest.assets.length) * 100));
      flashStatus.textContent = `Übertrage ${asset.file_name}: ${assetPercent}% (${overallPercent}% gesamt) …`;
    },
  });
  flashStatus.textContent = "Board wird neu gestartet …";
  const resetSucceeded = await resetFlashedBoard(loader);
  await transport.disconnect();
  flashStatus.textContent = resetSucceeded
    ? "Spielfläche wurde erfolgreich auf das Board geflasht und neu gestartet."
    : "Spielfläche wurde erfolgreich geflasht. Bitte drücke jetzt einmal die RESET-Taste am Board.";
}

async function resetFlashedBoard(loader) {
  try {
    await loader.after("custom_reset", false, "D0|R1|W120|R0|W120");
    return true;
  } catch {
    return false;
  }
}

function hex(value) { return value === undefined ? "unbekannt" : `0x${value.toString(16).padStart(4, "0")}`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]); }
