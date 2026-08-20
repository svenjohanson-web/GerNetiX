/*
 * Die gemeinsame Ausgabe der Werkbank: Statuszeile und Terminal.
 *
 * Beides gehoert zur Ansicht, nicht zum Bauen. Bisher lag es im
 * Gerätebau-Controller und hiess nach dem Flashen -- setFlashStatus. Gerufen
 * wurde es aber auch, um zu melden, dass eine Datei gespeichert oder eine
 * Debug-Sitzung gestartet wurde. Der Name behauptete einen Zusammenhang, den
 * es nicht gibt, und die IDE musste in den Bau-Controller greifen, um dem
 * Nutzer etwas zu sagen.
 *
 * Die beiden Knoten #flashStatus und #ideTerminalOutput werden nirgends sonst
 * angefasst; diese vier Funktionen sind ihr vollstaendiger Besitzer.
 *
 * "Werkbank" ist das Wort, das dieses Projekt fuer IDE und Gerätebau
 * zusammen schon verwendet -- loadBuildWorkbenchAssets, loadIdeWorkbenchAssets.
 */
import { GerNetiXFlashProgress } from "@app/flash-progress.js";

/*
 * Der offene Flash-Dialog spiegelt dieselben Zeilen mit.
 *
 * Er gehoert dem Gerätebau-Controller, der ihn anlegt und oeffnet. Statt ihn
 * von hier aus zu suchen, meldet er sich an: so bleibt sein Lebenslauf dort,
 * wo er gefuehrt wird, und diese Ansicht kennt nur die eine Frage, ob gerade
 * jemand mitliest.
 */
let angemeldeterFlashDialog = null;

function connectFlashDialog(dialog) {
  angemeldeterFlashDialog = dialog || null;
}

function showStatus(kind, text, percent = null) {
  const status = document.querySelector("#flashStatus");
  GerNetiXFlashProgress.render(status, kind, text, percent);
  appendTerminalLine(kind, text);
}

/*
 * Erfolg ohne stehenbleibende Statuszeile: die Meldung steht im Terminal,
 * die Leiste verschwindet.
 */
function clearStatus(text) {
  const status = document.querySelector("#flashStatus");
  status.className = "flash-status hidden";
  status.textContent = "";
  appendTerminalLine("ok", text);
}

function appendTerminalLine(kind, text) {
  const terminal = document.querySelector("#ideTerminalOutput");
  if (!terminal || !text) return;
  const normalizedText = String(text).replace(/\x1b\[[0-9;]*m/g, "").trim();
  angemeldeterFlashDialog?.write(kind, normalizedText);
  const previous = terminal.querySelector(".terminal-line:last-of-type");
  if (previous?.dataset.message === `${kind}:${normalizedText}`) return;
  if (kind === "running" && previous?.classList.contains("terminal-running")) {
    previous.textContent = `[${new Date().toLocaleTimeString()}] ${normalizedText}`;
    previous.dataset.message = `${kind}:${normalizedText}`;
    terminal.scrollTop = terminal.scrollHeight;
    return;
  }
  const line = document.createElement("span");
  line.className = `terminal-line terminal-${kind}`;
  line.dataset.message = `${kind}:${normalizedText}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${normalizedText}`;
  terminal.append(document.createTextNode("\n"), line);
  terminal.scrollTop = terminal.scrollHeight;
}

function resetTerminal() {
  const terminal = document.querySelector("#ideTerminalOutput");
  if (!terminal) return;
  terminal.innerHTML = '<span class="terminal-muted">GerNetiX Build-Terminal bereit.</span>';
}

export {
  appendTerminalLine,
  clearStatus,
  connectFlashDialog,
  resetTerminal,
  showStatus,
};

/* ---- Uebergangsbruecke ---- */
/*
 * app-event-bindings.js wird beim Start geladen und darf diese Datei darum
 * nicht einfuehren -- sie kommt erst mit der Werkbank. Die beiden Namen, die
 * es aus seinen Ereignisbehandlungen heraus braucht, stehen hier global.
 */
Object.assign(globalThis, {
  resetTerminal,
  showStatus,
});
/* ---- /Uebergangsbruecke ---- */
