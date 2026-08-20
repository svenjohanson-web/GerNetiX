const GerNetiXSerialService = (() => {
  const MINIMUM_VERIFIED_FLASH_VERSION = "0.3.10";
  const DEFAULT_BASE_URLS = ["https://localhost:43123", "https://127.0.0.1:43123"];

  function create(options = {}) {
    const baseUrls = options.baseUrl ? [options.baseUrl] : DEFAULT_BASE_URLS;
    const updateFlow = Object.prototype.hasOwnProperty.call(options, "updateFlow") ? options.updateFlow : requestBrowserUpdate;
    let baseUrl = baseUrls[0];
    let session = "";

    async function request(path, init = {}, authenticated = true, requestBaseUrl = baseUrl, retryInvalidSession = true) {
      if (authenticated && !session) await connect();
      const { timeoutMs = 15000, ...fetchInit } = init;
      const headers = {
        "Content-Type": "application/json",
        ...(authenticated ? { "X-GerNetiX-Serial-Session": session } : {}),
        ...(fetchInit.headers || {}),
      };
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      let response;
      try {
        response = await fetch(`${requestBaseUrl}${path}`, {
          ...fetchInit,
          headers,
          cache: "no-store",
          targetAddressSpace: "loopback",
          ...(controller ? { signal: controller.signal } : {}),
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          const timeoutError = new Error("Der lokale GerNetiX Serial Service antwortet nicht. Bitte starte den USB-Flash erneut.");
          timeoutError.code = "serial_service_request_timeout";
          throw timeoutError;
        }
        throw error;
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && authenticated) {
          session = "";
          if (payload?.error === "serial_session_invalid" && retryInvalidSession) {
            await connect();
            return request(path, init, true, baseUrl, false);
          }
        }
        const error = new Error(payload?.message || `Der lokale GerNetiX Serial Service antwortet mit Status ${response.status}.`);
        error.code = payload?.error || "serial_service_request_failed";
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    async function status() {
      let lastError = null;
      for (const candidate of baseUrls) {
        try {
          const result = await request("/v1/status", { method: "GET" }, false, candidate);
          baseUrl = candidate;
          return result;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("Der lokale GerNetiX Serial Service ist nicht erreichbar.");
    }

    async function connect() {
      await status();
      const result = await request("/v1/sessions", { method: "POST", body: "{}" }, false);
      session = result.token;
      return result;
    }

    async function available() {
      try {
        await status();
        return true;
      } catch {
        return false;
      }
    }

    async function ports() {
      return preferredPorts((await request("/v1/ports", { method: "GET" })).items || []);
    }

    async function probe(port) {
      return request("/v1/probe", { method: "POST", body: JSON.stringify({ port }) });
    }

    async function flash({ port, files, ...options }) {
      let serviceStatus = await status();
      if (compareVersions(serviceStatus?.version, MINIMUM_VERIFIED_FLASH_VERSION) < 0) {
        const installedVersion = String(serviceStatus?.version || "unbekannt");
        if (typeof updateFlow !== "function") throw updateRequiredError(installedVersion);
        await updateFlow({
          installedVersion,
          requiredVersion: MINIMUM_VERIFIED_FLASH_VERSION,
          onProgress: options.onUpdateProgress,
          readStatus: status,
        });
        serviceStatus = await status();
        if (compareVersions(serviceStatus?.version, MINIMUM_VERIFIED_FLASH_VERSION) < 0) {
          throw updateRequiredError(String(serviceStatus?.version || installedVersion));
        }
      }
      const encodedFiles = files.map((file) => ({
        name: file.name || "firmware.bin",
        address: Number(file.address || 0),
        dataBase64: bytesToBase64(file.data),
      }));
      let job = await request("/v1/flash-jobs", {
        method: "POST",
        body: JSON.stringify({ port, files: encodedFiles, ...options }),
        timeoutMs: 30000,
      });
      options.onProgress?.(job);
      const flashDeadline = Date.now() + 10 * 60 * 1000;
      while (["queued", "running"].includes(job.status)) {
        if (Date.now() >= flashDeadline) {
          const error = new Error("Der lokale Flashjob hat nach zehn Minuten keinen Abschluss gemeldet. Bitte trenne das Board nicht, solange es noch sichtbar arbeitet, und starte den Vorgang anschließend erneut.");
          error.code = "serial_service_flash_timeout";
          throw error;
        }
        await delay(300);
        job = await request(`/v1/flash-jobs/${encodeURIComponent(job.id)}`, { method: "GET", timeoutMs: 10000 });
        options.onProgress?.(job);
      }
      if (job.status !== "succeeded") throw new Error(job.error || "Der lokale USB-Flash ist fehlgeschlagen.");
      return job;
    }

    async function serialRequest(port, action, payload = {}, options = {}) {
      const requestId = crypto.randomUUID();
      return request("/v1/serial/requests", {
        method: "POST",
        body: JSON.stringify({
          port,
          timeoutMs: options.timeoutMs,
          request: {
            type: "gernetix.serial_provisioning",
            action,
            request_id: requestId,
            ...payload,
          },
        }),
        timeoutMs: Math.max(15000, Number(options.timeoutMs) || 15000) + 2000,
      });
    }

    async function deviceDiagnostics(baseUrl) {
      return request("/v1/device-http/diagnostics", {
        method: "POST",
        body: JSON.stringify({ baseUrl }),
      });
    }

    async function waitReady(port, timeoutMs = 30000) {
      return request("/v1/serial/wait-ready", {
        method: "POST",
        body: JSON.stringify({ port, timeoutMs }),
      });
    }

    return { available, connect, deviceDiagnostics, flash, ports, probe, serialRequest, status, waitReady };
  }

  function bytesToBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return btoa(chunks.join(""));
  }

  function preferredPorts(ports) {
    const selectedByDevice = new Map();
    for (const port of Array.isArray(ports) ? ports : []) {
      const path = String(port?.path || port?.port || "");
      const match = path.match(/^\/dev\/(tty|cu)\.(.+)$/i);
      if (!match) {
        selectedByDevice.set(path || `unknown-${selectedByDevice.size}`, port);
        continue;
      }
      const deviceKey = match[2].toLowerCase();
      const selected = selectedByDevice.get(deviceKey);
      if (!selected || match[1].toLowerCase() === "cu") selectedByDevice.set(deviceKey, port);
    }
    return [...selectedByDevice.values()];
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function updateRequiredError(installedVersion) {
    const error = new Error(
      `GerNetiX Serial Service ${MINIMUM_VERIFIED_FLASH_VERSION} oder neuer ist fuer einen verifizierten USB-Flash erforderlich. Installiert ist ${installedVersion}.`,
    );
    error.code = "serial_service_update_required";
    error.installedVersion = installedVersion;
    error.requiredVersion = MINIMUM_VERIFIED_FLASH_VERSION;
    return error;
  }

  async function requestBrowserUpdate({ installedVersion, requiredVersion, onProgress, readStatus }) {
    const platform = /Mac/i.test(window.navigator?.platform || window.navigator?.userAgent || "") ? "macos"
      : /Win/i.test(window.navigator?.platform || window.navigator?.userAgent || "") ? "windows" : "";
    if (!platform || !window.document || typeof window.confirm !== "function") throw updateRequiredError(installedVersion);

    const response = await fetch("/api/platform/downloads", { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) {
      const error = new Error("Melde dich kurz bei GerNetiX an, damit das freigegebene Helper-Paket geladen werden kann.");
      error.code = "serial_service_update_login_required";
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`Das Helper-Update konnte nicht vorbereitet werden (HTTP ${response.status}).`);
      error.code = "serial_service_update_unavailable";
      throw error;
    }
    const downloads = (await response.json()).downloads || [];
    const download = downloads.find((item) => item.platform === platform && item.available
      && compareVersions(item.version, requiredVersion) >= 0);
    if (!download?.url) {
      const error = new Error(`Für ${platform === "macos" ? "macOS" : "Windows"} ist noch kein Helper ${requiredVersion} oder neuer freigegeben.`);
      error.code = "serial_service_update_unavailable";
      throw error;
    }

    const accepted = window.confirm(
      `GerNetiX Serial Service ${installedVersion} muss auf Version ${download.version || requiredVersion} aktualisiert werden.\n\n`
      + "GerNetiX lädt jetzt das freigegebene Installationspaket. Öffne es anschließend und bestätige die Systeminstallation. Danach wird der Flashvorgang automatisch fortgesetzt.\n\nUpdate jetzt laden?",
    );
    if (!accepted) {
      const error = new Error("Das Helper-Update wurde nicht bestätigt. Es wurde nichts installiert und nichts auf das Board geschrieben.");
      error.code = "serial_service_update_declined";
      throw error;
    }

    onProgress?.({ phase: "preparing", percent: 5, message: "Das freigegebene Helper-Update wird vorbereitet …" });
    const packageResponse = await fetch(download.url, { cache: "no-store", credentials: "same-origin" });
    if (!packageResponse.ok) {
      const error = new Error(`Das Helper-Installationspaket konnte nicht geladen werden (HTTP ${packageResponse.status}).`);
      error.code = "serial_service_update_download_failed";
      throw error;
    }
    const packageBytes = await readDownload(packageResponse, download.size_bytes, (loaded, total) => {
      const downloadPercent = total > 0 ? Math.min(100, Math.round(loaded / total * 100)) : 0;
      onProgress?.({
        phase: "download",
        percent: 5 + Math.round(downloadPercent * 0.7),
        message: `Helper-Update wird geladen: ${downloadPercent} %`,
      });
    });
    const packageUrl = window.URL.createObjectURL(new window.Blob(packageBytes));
    const link = window.document.createElement("a");
    link.href = packageUrl;
    link.download = download.file_name || "";
    link.hidden = true;
    window.document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(packageUrl), 60_000);
    onProgress?.({ phase: "install", percent: 80, message: "Öffne das geladene Installationspaket und bestätige die macOS-Installation. GerNetiX wartet und setzt danach automatisch fort …" });

    const deadline = Date.now() + 3 * 60 * 1000;
    while (Date.now() < deadline) {
      await delay(2000);
      try {
        const current = await readStatus();
        if (compareVersions(current?.version, requiredVersion) >= 0) {
          onProgress?.({ phase: "ready", percent: 100, message: `GerNetiX Serial Service ${current.version} ist bereit. Der Flashvorgang wird fortgesetzt …` });
          return current;
        }
      } catch {
        // Der LaunchAgent ist während der Installation kurzzeitig nicht erreichbar.
      }
    }
    const error = new Error("Das Helper-Update wurde nicht innerhalb von drei Minuten erkannt. Öffne das Installationspaket erneut und starte den USB-Flash danach noch einmal.");
    error.code = "serial_service_update_timeout";
    throw error;
  }

  async function readDownload(response, expectedSize, onChunk) {
    const headerSize = Number(response.headers?.get?.("content-length") || 0);
    const total = headerSize || Number(expectedSize || 0);
    if (!response.body?.getReader) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      onChunk(bytes.byteLength, total || bytes.byteLength);
      return [bytes];
    }
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onChunk(loaded, total);
    }
    if (!loaded) onChunk(0, total);
    return chunks;
  }

  function compareVersions(left, right) {
    const leftParts = String(left || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
    const rightParts = String(right || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (difference !== 0) return difference;
    }
    return 0;
  }

  return { compareVersions, create, minimumVerifiedFlashVersion: MINIMUM_VERIFIED_FLASH_VERSION, preferredPorts, requestBrowserUpdate };
})();

window.GerNetiXSerialService = GerNetiXSerialService;

export {
  GerNetiXSerialService,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: app.js.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  GerNetiXSerialService,
});
/* ---- /Uebergangsbruecke ---- */
