(function initGerNetiXFlashDialog(globalScope) {
  "use strict";

  const METHOD_ORDER = ["usb", "ota", "flashbox"];
  const METHOD_LABELS = { usb: "USB", ota: "OTA", flashbox: "FlashBox" };
  let dialogCounter = 0;

  function normalizeMethod(id, method = {}) {
    const enabled = method.enabled !== false;
    return {
      id,
      label: method.label || METHOD_LABELS[id] || id,
      enabled,
      reason: enabled ? "" : (method.reason || `${METHOD_LABELS[id] || id} ist für dieses Flash-Ziel nicht verfügbar.`),
    };
  }

  function normalizeMethods(methods = {}) {
    return METHOD_ORDER.map((id) => normalizeMethod(id, methods[id] || { enabled: false }));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
    })[character]);
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!bytes) return "Größe unbekannt";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function create(options = {}) {
    const documentRef = options.document || globalScope.document;
    if (!documentRef) throw new Error("Der zentrale Flash-Dialog benötigt ein Document.");
    dialogCounter += 1;
    const titleId = `gernetixFlashDialogTitle${dialogCounter}`;
    const artifactTitleId = `gernetixFlashArtifactTitle${dialogCounter}`;
    const terminalTitleId = `gernetixFlashTerminalTitle${dialogCounter}`;
    const dialog = documentRef.createElement("dialog");
    dialog.className = "gernetix-flash-dialog";
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.innerHTML = `
      <div class="gernetix-flash-dialog__header">
        <div><p>Flashen</p><h2 id="${titleId}">Firmware übertragen</h2></div>
        <button type="button" data-flash-close aria-label="Flash-Dialog schließen">Schließen</button>
      </div>
      <p class="gernetix-flash-dialog__intro" data-flash-description></p>
      <section class="gernetix-flash-dialog__artifact" aria-labelledby="${artifactTitleId}">
        <span id="${artifactTitleId}">Flash-Datei</span><div data-flash-artifact></div>
      </section>
      <fieldset class="gernetix-flash-dialog__methods"><legend>Übertragungsweg</legend><div data-flash-methods></div><p data-flash-method-reason aria-live="polite"></p></fieldset>
      <section class="gernetix-flash-dialog__terminal" aria-labelledby="${terminalTitleId}">
        <header><strong id="${terminalTitleId}">TERMINAL</strong><button type="button" data-flash-clear>Leeren</button></header>
        <pre data-flash-terminal aria-live="polite">GerNetiX Flash-Terminal bereit.</pre>
      </section>
      <footer><button type="button" data-flash-cancel>Abbrechen</button><button class="primary" type="button" data-flash-execute>Flashen</button></footer>`;
    (options.host || documentRef.body).append(dialog);

    let config = {};
    let selectedMethod = "usb";
    let running = false;
    const terminal = dialog.querySelector("[data-flash-terminal]");
    const executeButton = dialog.querySelector("[data-flash-execute]");
    const reason = dialog.querySelector("[data-flash-method-reason]");

    function selected() {
      return normalizeMethods(config.methods).find((method) => method.id === selectedMethod);
    }

    function renderArtifact(artifact = {}) {
      const name = artifact.name || "Firmware wird vor dem Flashen gebaut";
      const source = artifact.sourcePath && artifact.sourceVersion ? `Quelle ${artifact.sourcePath}@${artifact.sourceVersion}` : "";
      const metadata = [artifact.version, artifact.sizeBytes ? formatBytes(artifact.sizeBytes) : "", artifact.sha256 ? `SHA-256 ${String(artifact.sha256).slice(0, 16)}…` : "", source].filter(Boolean);
      dialog.querySelector("[data-flash-artifact]").innerHTML = `<strong>${escapeHtml(name)}</strong><small>${escapeHtml(metadata.join(" · ") || "Der genaue Artefaktstand erscheint nach dem Build.")}</small>`;
    }

    function renderSelection() {
      const method = selected();
      reason.textContent = method?.enabled ? `${method.label} ist ausgewählt.` : `Nicht möglich: ${method?.reason || "Dieser Übertragungsweg ist nicht verfügbar."}`;
      executeButton.disabled = running || !method?.enabled;
      executeButton.title = executeButton.disabled ? reason.textContent : "";
      executeButton.textContent = running ? "Flashen läuft…" : `${method?.label || "Firmware"} flashen`;
      dialog.querySelectorAll("[data-flash-method]").forEach((input) => { input.checked = input.value === selectedMethod; });
    }

    function renderMethods() {
      dialog.querySelector("[data-flash-methods]").innerHTML = normalizeMethods(config.methods).map((method) => `
        <label class="${method.enabled ? "" : "unavailable"}"><input type="radio" name="gernetix-flash-method" value="${method.id}" data-flash-method><span><strong>${escapeHtml(method.label)}</strong><small>${escapeHtml(method.enabled ? "Verfügbar" : method.reason)}</small></span></label>`).join("");
      renderSelection();
    }

    function write(kind, message) {
      const normalized = String(message || "").replace(/\x1b\[[0-9;]*m/g, "").trim();
      if (!normalized) return;
      const line = `[${new Date().toLocaleTimeString()}] ${normalized}`;
      terminal.textContent = terminal.textContent === "GerNetiX Flash-Terminal bereit." ? line : `${terminal.textContent}\n${line}`;
      terminal.dataset.kind = kind || "running";
      terminal.scrollTop = terminal.scrollHeight;
    }

    function open(nextConfig = {}) {
      config = nextConfig;
      dialog.querySelector(`#${titleId}`).textContent = nextConfig.title || "Firmware übertragen";
      dialog.querySelector("[data-flash-description]").textContent = nextConfig.description || "Wähle den Übertragungsweg und starte den einheitlichen GerNetiX-Flashvorgang.";
      renderArtifact(nextConfig.artifact);
      const methods = normalizeMethods(nextConfig.methods);
      selectedMethod = nextConfig.selectedMethod && methods.some((method) => method.id === nextConfig.selectedMethod)
        ? nextConfig.selectedMethod
        : (methods.find((method) => method.enabled)?.id || methods[0].id);
      terminal.textContent = "GerNetiX Flash-Terminal bereit.";
      running = false;
      renderMethods();
      write("running", `Flash-Auftrag geöffnet: ${nextConfig.artifact?.name || "Firmware-Build"}.`);
      if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    }

    async function execute() {
      const method = selected();
      if (running || !method?.enabled) return;
      running = true;
      renderSelection();
      write("running", `${method.label}: Flashvorgang gestartet.`);
      try {
        await config.onExecute?.(method.id, { write, setArtifact: renderArtifact });
      } catch (error) {
        write("error", `Flash fehlgeschlagen: ${error?.message || "unbekannter Fehler"}`);
      } finally {
        running = false;
        renderSelection();
      }
    }

    dialog.addEventListener("change", (event) => {
      if (!event.target.matches("[data-flash-method]")) return;
      selectedMethod = event.target.value;
      renderSelection();
      config.onMethodChange?.(selectedMethod);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target.closest("[data-flash-execute]")) execute();
      if (event.target.closest("[data-flash-clear]")) terminal.textContent = "GerNetiX Flash-Terminal bereit.";
      if ((event.target === dialog || event.target.closest("[data-flash-close], [data-flash-cancel]")) && !running) dialog.close?.();
    });
    dialog.addEventListener("cancel", (event) => { if (running) event.preventDefault(); });

    return { open, write, setArtifact: renderArtifact, setRunning(value) { running = Boolean(value); renderSelection(); }, element: dialog };
  }

  const api = { create, normalizeMethods, formatBytes };
  globalScope.GerNetiXFlashDialog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
