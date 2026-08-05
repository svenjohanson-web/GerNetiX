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

  async function downloadAndVerify(files, options = {}) {
    const fetchRef = options.fetch || globalScope.fetch?.bind(globalScope);
    const write = options.write || (() => {});
    if (!fetchRef) throw new Error("Firmware-Download ist in dieser Umgebung nicht verfügbar.");
    if (!Array.isArray(files) || !files.length) throw new Error("Der Flash-Auftrag enthält keine Binärdatei.");
    return Promise.all(files.map(async (file) => {
      const name = required(file.name, "Eine Flash-Datei besitzt keinen Namen.");
      const sizeBytes = Number(required(file.sizeBytes, `${name} besitzt keine erwartete Größe.`));
      const expectedSha256 = String(required(file.sha256, `${name} besitzt keine SHA-256-Prüfsumme.`)).toLowerCase();
      required(file.sourcePath, `${name} besitzt keinen Quellpfad.`);
      required(file.sourceVersion, `${name} besitzt keine Quellversion.`);
      write("running", `${name} wird geladen und geprüft …`);
      const response = await fetchRef(file.url, { credentials: file.credentials || "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error(`${name} konnte nicht geladen werden (${response.status}).`);
      const data = new Uint8Array(await response.arrayBuffer());
      if (data.byteLength !== sizeBytes) throw new Error(`${name} hat eine unerwartete Größe (${data.byteLength} statt ${sizeBytes} Byte).`);
      const actualSha256 = await sha256(data, options.crypto);
      if (actualSha256 !== expectedSha256) throw new Error(`${name} hat nicht die veröffentlichte SHA-256-Prüfsumme.`);
      write("ok", `${name}: Größe und SHA-256 geprüft · Quelle ${file.sourcePath}@${file.sourceVersion}.`);
      return { name, address: Number(file.address || 0), data };
    }));
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

  const api = { downloadAndVerify, executeUsb, resetWebSerial, sha256 };
  globalScope.GerNetiXFlashExecutor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
