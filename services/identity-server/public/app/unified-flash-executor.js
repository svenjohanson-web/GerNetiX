(function initGerNetiXFlashExecutor(globalScope) {
  "use strict";

  function required(value, message) {
    if (value === undefined || value === null || value === "") throw new Error(message);
    return value;
  }

  async function sha256(bytes, cryptoRef = globalScope.crypto) {
    if (!cryptoRef?.subtle) throw new Error("SHA-256-Prüfung ist in dieser Umgebung nicht verfügbar.");
    const digest = await cryptoRef.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  /*
   * Die Pruefung selbst ist fuer jede Herkunft dieselbe: geladene Groesse und
   * SHA-256 muessen zu dem passen, was der Server angekuendigt hat. Verschieden
   * ist nur, woran die Bytes haengen -- eine veroeffentlichte Firmware nennt
   * Quellpfad und Version, ein frischer Build seinen Auftrag.
   */
  async function fetchAndVerify(file, { fetchRef, write, cryptoRef, sizeBytes, origin }) {
    const name = required(file.name, "Eine Flash-Datei besitzt keinen Namen.");
    const expectedSize = Number(required(sizeBytes, `${name} besitzt keine erwartete Größe.`));
    const expectedSha256 = String(required(file.sha256, `${name} besitzt keine SHA-256-Prüfsumme.`)).toLowerCase();
    write("running", `${name} wird geladen und geprüft …`);
    const response = await fetchRef(file.url, { credentials: file.credentials || "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error(`${name} konnte nicht geladen werden (${response.status}).`);
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength !== expectedSize) throw new Error(`${name} hat eine unerwartete Größe (${data.byteLength} statt ${expectedSize} Byte).`);
    const actualSha256 = await sha256(data, cryptoRef);
    if (actualSha256 !== expectedSha256) throw new Error(`${name} hat nicht die veröffentlichte SHA-256-Prüfsumme.`);
    write("ok", `${name}: Größe und SHA-256 geprüft · ${origin}.`);
    return { name, address: Number(file.address || 0), data };
  }

  function verificationContext(options) {
    const fetchRef = options.fetch || globalScope.fetch?.bind(globalScope);
    if (!fetchRef) throw new Error("Firmware-Download ist in dieser Umgebung nicht verfügbar.");
    return { fetchRef, write: options.write || (() => {}), cryptoRef: options.crypto };
  }

  async function downloadAndVerify(files, options = {}) {
    const context = verificationContext(options);
    if (!Array.isArray(files) || !files.length) throw new Error("Der Flash-Auftrag enthält keine Binärdatei.");
    return Promise.all(files.map((file) => fetchAndVerify(file, {
      ...context,
      sizeBytes: file.sizeBytes,
      origin: `Quelle ${required(file.sourcePath, `${file.name} besitzt keinen Quellpfad.`)}`
        + `@${required(file.sourceVersion, `${file.name} besitzt keine Quellversion.`)}`,
    })));
  }

  /*
   * Frische Buildartefakte tragen keinen Quellpfad, weil sie noch nicht
   * veroeffentlicht sind. Ihre Herkunft ist der Bauauftrag, und das Manifest
   * kommt in der Schreibweise des Servers an.
   */
  async function downloadAndVerifyBuild(manifest, options = {}) {
    const context = verificationContext(options);
    const buildJobId = required(options.buildJobId, "Dem Flash-Auftrag fehlt die Kennung des Builds.");
    if (!Array.isArray(manifest) || !manifest.length) throw new Error("Der Build meldet kein Flash-Manifest.");
    return Promise.all(manifest.map((file) => fetchAndVerify(file, {
      ...context,
      sizeBytes: file.size_bytes,
      origin: `Build ${buildJobId}`,
    })));
  }

  async function resetWebSerial({ loader, transport, strategy = "hard-reset", delay = defaultDelay }) {
    if (strategy === "native-usb-aware") {
      await transport.setDTR(false);
      await transport.setRTS(true);
      await delay(100);
      await transport.setRTS(false);
      await delay(300);
      return true;
    }
    if (strategy === "custom-reset") {
      try { await loader.after("custom_reset", false, "D0|R1|W120|R0|W120"); return true; } catch { return false; }
    }
    await loader.after("hard_reset");
    return true;
  }

  async function executeUsb(config, terminal = {}) {
    const write = terminal.write || (() => {});
    const port = config.port || await config.resolvePort?.(write);
    if (!port) throw new Error("Kein USB-Port für den Flash-Auftrag ausgewählt.");
    terminal.setArtifact?.(config.artifact);
    const fileArray = await downloadAndVerify(config.files, { fetch: config.fetch, crypto: config.crypto, write });
    const flashOptions = config.flash || {};
    if (port.source === "gernetix_serial_service") {
      const serialService = required(config.serialService, "GerNetiX Serial Service ist nicht verfügbar.");
      write("running", `Board wird über den GerNetiX Serial Service verbunden (${port.path}).`);
      const probe = await serialService.probe(port.path);
      config.validateChip?.(probe.chipName || "");
      const seenLogs = new Set();
      const result = await serialService.flash({
        port: port.path,
        chip: "auto",
        files: fileArray,
        flashMode: flashOptions.mode || "dio",
        flashFreq: flashOptions.frequency || "40m",
        flashSize: flashOptions.size || "keep",
        onProgress(job) {
          for (const line of job.logs || []) if (!seenLogs.has(line)) {
            seenLogs.add(line);
            write("running", line);
          }
          config.onProgress?.(job.progress ?? null, job);
        },
      });
      if (result.status !== "succeeded") throw new Error(result.error || "USB-Flash über den Serial Service fehlgeschlagen.");
      write("ok", `${config.successMessage || "Firmware wurde erfolgreich geflasht und neu gestartet."}`);
      return { transport: "usb-helper", chipName: probe.chipName || "", resetSucceeded: true };
    }

    const module = await required(config.loadEsptool, "Web-Serial-Flashmodul ist nicht konfiguriert.")();
    const transport = new module.Transport(port, false);
    try {
      const loader = new module.ESPLoader({
        transport,
        baudrate: Number(config.baudrate || 115200),
        terminal: { clean() {}, writeLine(line) { write("running", line); }, write(line) { write("running", line); } },
        debugLogging: false,
      });
      const portInfo = port.getInfo ? port.getInfo() : {};
      const nativeUsb = portInfo.usbVendorId === 0x303A && portInfo.usbProductId === 0x1001;
      write("running", "Board wird im Bootloader verbunden …");
      const chipName = await loader.main(nativeUsb && config.nativeUsbReset !== false ? "usb_reset" : "default_reset");
      config.validateChip?.(chipName || "");
      await loader.writeFlash({
        fileArray,
        flashMode: flashOptions.mode || "dio",
        flashFreq: flashOptions.frequency || "40m",
        flashSize: flashOptions.size || "keep",
        eraseAll: false,
        compress: true,
        reportProgress(index, written, total) {
          const percent = Math.min(100, Math.round((written / Math.max(total, 1)) * 100));
          write("running", `${fileArray[index]?.name || "Firmware"}: ${percent} %`);
          config.onProgress?.(percent, { index, written, total });
        },
      });
      write("running", "Firmware geschrieben. Board wird neu gestartet …");
      const resetStrategy = nativeUsb && config.nativeUsbReset !== false ? "native-usb-aware" : (config.resetStrategy || "hard-reset");
      const resetSucceeded = await resetWebSerial({ loader, transport, strategy: resetStrategy, delay: config.delay });
      write("ok", resetSucceeded ? (config.successMessage || "Firmware wurde erfolgreich geflasht und neu gestartet.") : "Firmware wurde erfolgreich geflasht. Bitte einmal RESET drücken.");
      return { transport: "web-serial", chipName, resetSucceeded };
    } finally {
      await transport.disconnect().catch(() => {});
    }
  }

  function defaultDelay(milliseconds) {
    return new Promise((resolve) => globalScope.setTimeout(resolve, milliseconds));
  }

  const api = { downloadAndVerify, downloadAndVerifyBuild, executeUsb, resetWebSerial, sha256 };
  globalScope.GerNetiXFlashExecutor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

/*
 * Diese Datei veroeffentlicht ihre Schnittstelle nach UMD-Art durch Zuweisung
 * an das globale Objekt. Es gibt keine gleichnamige Bindung, also wird sie hier
 * angelegt: derselbe Wert, nur ansprechbar fuer den export.
 */
const GerNetiXFlashExecutor = globalThis.GerNetiXFlashExecutor;

export {
  GerNetiXFlashExecutor,
};
