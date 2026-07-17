const container = document.querySelector("#demos");
const count = document.querySelector("#count");
const flow = document.querySelector("#flash-flow");
const title = document.querySelector("#flash-title");
const gameOptions = document.querySelector("#game-options");
const portStep = document.querySelector("#port-step");
const portButton = document.querySelector("#choose-port");
const portStatus = document.querySelector("#port-status");
const flashStep = document.querySelector("#flash-step");
const flashButton = document.querySelector("#flash-button");
const flashStatus = document.querySelector("#flash-status");
let selectedDemo = null;
let selectedPort = null;

fetch("api/public/demos")
  .then((response) => response.ok ? response.json() : Promise.reject(response))
  .then(({ items }) => renderDemos(items.length ? items : localPreview()))
  .catch(() => container.replaceChildren(message("Die Demoanwendungen sind gerade nicht erreichbar. Bitte versuche es später erneut.")));

function localPreview() {
  if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return [];
  return [{
    demo_id: "touch-spielesammlung",
    title: 'ESP32 Touch 2,8" Spielesammlung',
    description: "Vorschau der ersten Touch-Demo für das ESP32-S3 ES3C28P Touch-Board.",
    board_hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    games: ["Nibbles"],
    preview: true,
  }];
}

function renderDemos(items) {
  count.textContent = `${items.length} verfügbar`;
  if (!items.length) return container.replaceChildren(message("Die ersten Demoanwendungen werden gerade vorbereitet."));
  container.replaceChildren(...items.map((demo) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    const heading = document.createElement("h3"); heading.textContent = demo.title;
    const description = document.createElement("p"); description.textContent = demo.description;
    const board = document.createElement("p"); board.className = "board"; board.textContent = `Unterstütztes Board: ${demo.board_hardware_item_id}`;
    const note = document.createElement("p"); note.className = "note"; note.textContent = demo.preview ? "Lokale Vorschau · Release steht noch aus" : "USB-Flash · kein Konto erforderlich";
    card.append(heading, description, board, note);
    card.addEventListener("click", () => selectDemo(demo));
    return card;
  }));
}

function selectDemo(demo) {
  selectedDemo = demo;
  selectedPort = null;
  title.textContent = demo.title;
  const buttons = demo.games.map((game) => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "game-option"; button.textContent = game;
    button.addEventListener("click", () => selectGame(button));
    return button;
  });
  gameOptions.replaceChildren(...buttons);
  if (buttons[0]) selectGame(buttons[0]);
  flow.hidden = false;
  flow.scrollIntoView({ behavior: "smooth", block: "start" });
}

function selectGame(button) {
  gameOptions.querySelectorAll(".game-option").forEach((item) => item.classList.toggle("selected", item === button));
  portStep.hidden = false;
  flashStep.hidden = true;
  portStatus.textContent = `„${button.textContent}“ ist ausgewählt. Wähle jetzt den COM-Port des angeschlossenen Boards.`;
}

portButton.addEventListener("click", async () => {
  if (!navigator.serial) {
    portStatus.textContent = "Web Serial ist nicht verfügbar. Verwende Chrome oder Edge auf einem Desktop-PC.";
    return;
  }
  try {
    selectedPort = await navigator.serial.requestPort();
    const info = selectedPort.getInfo();
    portStatus.textContent = `COM-Port ausgewählt (USB ${hex(info.usbVendorId)}:${hex(info.usbProductId)}).`;
    flashStep.hidden = false;
    flashButton.disabled = Boolean(selectedDemo.preview);
    flashStatus.textContent = selectedDemo.preview
      ? "Für diese lokale Vorschau gibt es noch kein geprüftes Firmware-Release zum Flashen."
      : "Der Port ist ausgewählt. Das signierte Release kann jetzt geflasht werden.";
  } catch (error) {
    portStatus.textContent = error.name === "NotFoundError" ? "Es wurde kein COM-Port ausgewählt." : "Der COM-Port konnte nicht geöffnet werden.";
  }
});

flashButton.addEventListener("click", () => {
  if (!selectedPort || selectedDemo.preview) return;
  flashStatus.textContent = "Flash-Manifest wird geladen …";
  flashSelectedDemo().catch((error) => { flashStatus.textContent = `Flash fehlgeschlagen: ${error.message || "unbekannter Fehler"}`; });
});

async function flashSelectedDemo() {
  const detail = await (await fetch(`api/public/demos/${encodeURIComponent(selectedDemo.demo_id)}`)).json();
  const release = detail.releases?.[0];
  if (!release) throw new Error("Kein veröffentlichter Release vorhanden.");
  const manifestResponse = await fetch(`api/public/demos/${encodeURIComponent(selectedDemo.demo_id)}/releases/${encodeURIComponent(release.version)}/flash-manifest`);
  if (!manifestResponse.ok) throw new Error("Flash-Manifest konnte nicht geladen werden.");
  const manifest = await manifestResponse.json();
  flashStatus.textContent = "Board wird verbunden …";
  const { Transport, ESPLoader } = await import("/vendor/esptool-js/bundle.js");
  const transport = new Transport(selectedPort, false);
  const loader = new ESPLoader({ transport, baudrate: 115200, terminal: { clean: () => {}, writeLine: () => {}, write: () => {} } });
  await loader.main();
  const fileArray = await Promise.all(manifest.assets.map(async (asset) => ({
    address: asset.flash_offset,
    data: new Uint8Array(await (await fetch(asset.download_url)).arrayBuffer()),
  })));
  flashStatus.textContent = "Bootloader, Partitionstabelle und Nibbles werden geflasht …";
  await loader.writeFlash({ fileArray, flashMode: manifest.flash_mode, flashFreq: manifest.flash_freq, flashSize: manifest.flash_size, compress: true });
  await loader.after("hard_reset");
  await transport.disconnect();
  flashStatus.textContent = "Nibbles wurde erfolgreich auf das Board geflasht.";
}

function hex(value) { return value === undefined ? "unbekannt" : `0x${value.toString(16).padStart(4, "0")}`; }
function message(text) { const node = document.createElement("p"); node.className = "loading"; node.textContent = text; return node; }
