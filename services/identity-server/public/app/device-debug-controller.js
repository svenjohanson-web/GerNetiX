const GerNetiXDeviceDebug = (() => {
  const pollingTimers = new Map();
  const severityOrder = { marker: 0, info: 1, warn: 2, error: 3, fatal: 4 };

  function sessionKey(projectId, componentId) {
    return `${projectId || "project"}:${componentId || "device"}`;
  }

  function sessionFor(project, componentId) {
    const key = sessionKey(project?.id, componentId);
    if (!state.ideDebugSessions[key]) {
      state.ideDebugSessions[key] = {
        componentId,
        connection: "usb",
        port: "",
        baseUrl: suggestedDeviceWebUrl(project),
        status: null,
        events: [],
        severity: "all",
        subsystem: "all",
        running: false,
        message: "Noch keine Diagnose gelesen.",
        messageKind: "idle",
        bootSequence: 1,
        symbolization: null,
      };
    }
    return state.ideDebugSessions[key];
  }

  function activeSession(project = projectById(state.activeProjectId)) {
    return sessionFor(project, state.activeIdeComponentId || "primary-iot-device");
  }

  function open(componentId = "", softwareUnitId = "") {
    const project = projectById(state.activeProjectId);
    if (!project) return;
    state.ideViewMode = "device-debug";
    state.activeIdeComponentId = componentId || "primary-iot-device";
    if (softwareUnitId && projectSoftwareUnits(project).some((unit) => unit.software_unit_id === softwareUnitId)) {
      state.activeSoftwareUnitIds[project.id] = softwareUnitId;
    }
    const component = ideDeviceConfigurationComponents(project)
      .find((item) => item.component_id === state.activeIdeComponentId);
    document.querySelector("#ideActiveSourceLabel").textContent = `Komponenten/${componentTreeLabel(component)}/Debug & Diagnose`;
    render(project);
    renderIdeViewMode(project);
    void refreshPorts(project);
  }

  async function refreshPorts(project = projectById(state.activeProjectId)) {
    const session = activeSession(project);
    try {
      const serviceStatus = await state.serialService.status();
      const ports = await state.serialService.ports();
      state.serialServiceAvailable = true;
      state.provisioningSerialServicePorts = ports;
      session.serialServiceVersion = String(serviceStatus?.version || "");
      session.serialServiceCapabilities = Array.isArray(serviceStatus?.capabilities) ? serviceStatus.capabilities.map(String) : [];
      if (!session.port || !ports.some((item) => portPath(item) === session.port)) {
        session.port = portPath(ports[0]);
      }
      session.message = ports.length ? `Serial Service ${session.serialServiceVersion || ""} bereit. Wähle einen Port und lies den Status.` : `Serial Service ${session.serialServiceVersion || ""} bereit, aber kein USB-Port erkannt.`;
      session.messageKind = ports.length ? "ok" : "warning";
    } catch (error) {
      state.serialServiceAvailable = false;
      session.message = `Serial Service nicht erreichbar: ${error.message}`;
      session.messageKind = "error";
    }
    render(project);
  }

  function portPath(port) {
    return String(port?.path || port?.port || "");
  }

  function render(project = projectById(state.activeProjectId)) {
    const target = document.querySelector("#ideDeviceDebugView");
    if (!target || !project) return;
    const session = activeSession(project);
    const component = ideDeviceConfigurationComponents(project)
      .find((item) => item.component_id === session.componentId);
    const ports = state.provisioningSerialServicePorts || [];
    const events = filteredEvents(session);
    const subsystemOptions = [...new Set(session.events.map((event) => event.subsystem).filter(Boolean))].sort();
    target.innerHTML = `
      <div class="device-debug-workspace">
        <header class="device-debug-head">
          <div><p class="eyebrow">Lokale Diagnosesitzung</p><h3>${escapeHtml(component?.label || "IoT-Device")}</h3><p>Produktive Basisdiagnose lesen, ohne Projektzustand oder Credentials zu verändern.</p></div>
          <span class="device-debug-mode-badge">Lokal · lesend</span>
        </header>
        <section class="device-debug-connection" aria-label="Diagnoseverbindung">
          <label>Verbindung<select data-device-debug-connection>
            <option value="usb" ${session.connection === "usb" ? "selected" : ""}>USB / Serial Service</option>
            <option value="network" ${session.connection === "network" ? "selected" : ""} ${session.serialServiceCapabilities?.includes("local_device_diagnostics") ? "" : "disabled"}>Lokales Gerätenetz · Serial Service 0.3.7+</option>
          </select></label>
          <label class="${session.connection === "usb" ? "" : "hidden"}">Serieller Port<select data-device-debug-port>
            <option value="">Port wählen</option>
            ${ports.map((port) => `<option value="${escapeAttribute(portPath(port))}" ${portPath(port) === session.port ? "selected" : ""}>${escapeHtml(port.name || portPath(port))}</option>`).join("")}
          </select></label>
          <label class="${session.connection === "network" ? "" : "hidden"}">Lokale Geräteadresse<input data-device-debug-url value="${escapeAttribute(session.baseUrl || "")}" placeholder="http://gernetix-esp32.local/"></label>
          <div class="device-debug-connection-actions">
            <button type="button" data-device-debug-refresh-ports>USB-Ports suchen</button>
            <button type="button" class="primary" data-device-debug-refresh>Status und Logs lesen</button>
          </div>
        </section>
        <p class="device-debug-message ${escapeAttribute(session.messageKind)}" role="status">${escapeHtml(session.message)}</p>
        ${renderStatus(session.status)}
        ${renderCrashReport(session)}
        <section class="device-debug-log-panel">
          <header>
            <div><p class="eyebrow">Ereignisstrom</p><h4>Live-Logs</h4></div>
            <div class="device-debug-log-actions">
              <button type="button" data-device-debug-toggle-live>${session.running ? "Live-Ansicht stoppen" : "Live-Ansicht starten"}</button>
              <button type="button" data-device-debug-marker>Reproduktion markieren</button>
              <button type="button" data-device-debug-export ${session.events.length || session.status ? "" : "disabled"}>JSON exportieren</button>
            </div>
          </header>
          <div class="device-debug-filters">
            <label>Schweregrad<select data-device-debug-severity><option value="all">Alle</option>${["info", "warn", "error", "fatal", "marker"].map((value) => `<option value="${value}" ${session.severity === value ? "selected" : ""}>${value.toUpperCase()}</option>`).join("")}</select></label>
            <label>Subsystem<select data-device-debug-subsystem><option value="all">Alle</option>${subsystemOptions.map((value) => `<option value="${escapeAttribute(value)}" ${session.subsystem === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>
            <span>${events.length} von ${session.events.length} Ereignissen</span>
          </div>
          <ol class="device-debug-events" aria-live="polite">${events.length ? events.map(renderEvent).join("") : '<li class="empty">Noch keine Diagnoseereignisse gelesen.</li>'}</ol>
        </section>
        <p class="device-debug-security-note">WLAN-Passwörter, Tokens, private Schlüssel und vollständige Netzwerkpayloads gehören in keinen Diagnosepfad. Der Export bleibt lokal auf diesem Rechner.</p>
      </div>`;
  }

  function renderStatus(status) {
    if (!status) return '<section class="device-debug-status-empty"><strong>Noch kein Status</strong><p>Verbinde ein Board und lies den aktuellen Diagnosezustand.</p></section>';
    const fields = [
      ["Firmware", status.firmware_version || status.runtimeVersion || status.basissoftwareVersion || "unbekannt"],
      ["Basissoftware", status.basissoftware_version || status.basissoftwareVersion || "unbekannt"],
      ["Variante", status.basissoftware_variant || status.basissoftwareVariant || "unbekannt"],
      ["Build-ID", shortBuildId(status.build_id)],
      ["Laufzeit", formatDuration(status.uptime_ms ?? status.uptimeMs)],
      ["Resetgrund", status.reset_reason || "nicht gemeldet"],
      ["Heap frei", formatBytes(status.free_heap_bytes)],
      ["Heap-Minimum", formatBytes(status.minimum_free_heap_bytes)],
      ["WLAN", status.wifi_state || status.wifiStationState || "nicht gemeldet"],
    ];
    return `<dl class="device-debug-status-grid">${fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("")}</dl>`;
  }

  function shortBuildId(value) {
    const buildId = String(value || "");
    return buildId ? `${buildId.slice(0, 12)}…` : "nicht gemeldet";
  }

  function renderCrashReport(session) {
    const report = session.status?.crash_report;
    if (!report) return "";
    const symbolization = session.symbolization || { status: "idle" };
    const stateLabel = report.bootloop_suspected
      ? "Bootloop vermutet"
      : report.available ? "Vorheriger Boot analysierbar" : "Kein vorheriger Crash gespeichert";
    const frames = Array.isArray(symbolization.frames) ? symbolization.frames : [];
    return `<section class="device-debug-crash ${report.bootloop_suspected ? "critical" : ""}">
      <header><div><p class="eyebrow">Crash-Analyse</p><h4>Letzter Absturz</h4></div><span>${escapeHtml(stateLabel)}</span></header>
      <dl>
        <div><dt>Resetgrund</dt><dd>${escapeHtml(report.reset_reason || "unbekannt")}</dd></div>
        <div><dt>Fehlstarts</dt><dd>${escapeHtml(String(report.failed_boot_count ?? 0))}</dd></div>
        <div><dt>Uptime davor</dt><dd>${escapeHtml(formatDuration(report.uptime_before_reset_ms))}</dd></div>
        <div><dt>Minimum-Heap</dt><dd>${escapeHtml(formatBytes(report.minimum_free_heap_bytes))}</dd></div>
        <div><dt>Task</dt><dd>${escapeHtml(report.task_name || "nicht erfasst")}</dd></div>
        <div><dt>Fehlercode</dt><dd>${escapeHtml(report.fault_code || "nicht erfasst")}</dd></div>
        <div><dt>Build-ID</dt><dd title="${escapeAttribute(report.build_id || "")}">${escapeHtml(shortBuildId(report.build_id))}</dd></div>
        <div><dt>Speicherweg</dt><dd>RTC · keine Flash-Schreibzyklen</dd></div>
      </dl>
      ${renderSymbolization(symbolization, frames)}
    </section>`;
  }

  function renderSymbolization(symbolization, frames) {
    const messages = {
      idle: "Keine Crash-Adressen vorhanden.",
      pending: "Passendes ELF wird geprüft und lokal symbolisiert…",
      build_artifact_mismatch: "build_artifact_mismatch: Kein Build mit exakt passender Build-ID gefunden.",
      build_elf_missing: "Der passende Build besitzt kein ELF-Artefakt.",
      error: symbolization.message || "Symbolisierung ist fehlgeschlagen.",
    };
    if (!frames.length) return `<p class="device-debug-symbol-status ${escapeAttribute(symbolization.status || "idle")}">${escapeHtml(messages[symbolization.status] || messages.idle)}</p>`;
    return `<div class="device-debug-stack"><strong>Symbolisierter Stack</strong><ol>${frames.map((frame) => `
      <li class="${frame.resolved ? "resolved" : "unresolved"}"><code>${escapeHtml(frame.address)}</code><span>${escapeHtml(frame.resolved ? frame.function : "nicht aufgelöst")}</span><small>${escapeHtml(frame.resolved ? `${frame.file}:${frame.line}` : "Kein Symbol im passenden ELF")}</small>${frame.resolved ? `<button type="button" data-debug-source="${escapeAttribute(frame.file)}" data-debug-line="${escapeAttribute(String(frame.line))}">Stelle öffnen</button>` : ""}</li>`).join("")}</ol></div>`;
  }

  function renderEvent(event) {
    return `<li class="device-debug-event ${escapeAttribute(event.severity)}"><time>${escapeHtml(formatEventTime(event))}</time><span class="device-debug-severity">${escapeHtml(event.severity.toUpperCase())}</span><code>${escapeHtml(event.subsystem)}</code><p>${escapeHtml(event.message)}</p></li>`;
  }

  function formatEventTime(event) {
    if (event.severity === "marker") return new Date(event.client_time).toLocaleTimeString();
    return Number.isFinite(event.uptime_ms) ? `${(event.uptime_ms / 1000).toFixed(3)} s` : "–";
  }

  function formatDuration(value) {
    const milliseconds = Number(value);
    if (!Number.isFinite(milliseconds)) return "nicht gemeldet";
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min ${seconds % 60} s`;
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes)) return "nicht gemeldet";
    return `${Math.round(bytes / 1024)} KiB`;
  }

  function filteredEvents(session) {
    return session.events.filter((event) => (session.severity === "all" || event.severity === session.severity)
      && (session.subsystem === "all" || event.subsystem === session.subsystem));
  }

  function normalizeLog(text) {
    return String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
      if (/^GerNetiX event log:/i.test(line)) return [];
      const match = line.match(/^\[(\d+) ms\]\s+(INFO|WARN|ERROR|FATAL|DEBUG)\s+([^:]+):\s*(.*)$/i);
      if (!match) return [{ uptime_ms: null, severity: "info", subsystem: "serial", message: line, raw: line }];
      return [{
        uptime_ms: Number(match[1]),
        severity: match[2].toLowerCase() === "debug" ? "info" : match[2].toLowerCase(),
        subsystem: normalizeSubsystem(match[3]),
        message: match[4],
        raw: line,
      }];
    });
  }

  function normalizeSubsystem(value) {
    return String(value || "runtime").trim().replace(/[^a-zA-Z0-9_.-]/g, "_").toLowerCase().slice(0, 48) || "runtime";
  }

  function appendEvents(session, incoming) {
    const existing = new Set(session.events.filter((event) => event.severity !== "marker")
      .map((event) => `${event.boot_sequence || 1}|${event.uptime_ms}|${event.severity}|${event.subsystem}|${event.message}`));
    for (const event of incoming) {
      event.boot_sequence = event.boot_sequence || session.bootSequence || 1;
      const key = `${event.boot_sequence}|${event.uptime_ms}|${event.severity}|${event.subsystem}|${event.message}`;
      if (!existing.has(key)) {
        session.events.push(event);
        existing.add(key);
      }
    }
    session.events = session.events.slice(-256).sort((left, right) => {
      if (left.severity === "marker" || right.severity === "marker") return 0;
      return (left.uptime_ms ?? 0) - (right.uptime_ms ?? 0) || severityOrder[left.severity] - severityOrder[right.severity];
    });
  }

  async function refresh(project = projectById(state.activeProjectId), options = {}) {
    const session = activeSession(project);
    if (!project || session.refreshing) return;
    session.refreshing = true;
    if (!options.silent) {
      session.message = "Diagnose wird gelesen…";
      session.messageKind = "running";
      render(project);
    }
    try {
      const result = session.connection === "usb"
        ? await readUsb(session)
        : await readNetwork(session);
      const previousUptime = Number(session.status?.uptime_ms ?? session.status?.uptimeMs);
      const currentUptime = Number(result.status?.uptime_ms ?? result.status?.uptimeMs);
      if (Number.isFinite(previousUptime) && Number.isFinite(currentUptime) && currentUptime < previousUptime) {
        session.bootSequence = (session.bootSequence || 1) + 1;
        session.events.push({
          severity: "marker",
          subsystem: "runtime",
          message: "Neuer Gerätestart erkannt",
          client_time: new Date().toISOString(),
          uptime_ms: null,
          boot_sequence: session.bootSequence,
        });
      }
      session.status = result.status;
      appendEvents(session, normalizeLog(result.logs));
      await symbolizeCrashIfPossible(project, session);
      session.message = `Diagnose gelesen · ${new Date().toLocaleTimeString()} · ${session.events.length} Ereignisse`;
      session.messageKind = "ok";
    } catch (error) {
      session.message = error.message;
      session.messageKind = "error";
      if (session.running) stopPolling(project, session);
    } finally {
      session.refreshing = false;
      render(project);
    }
  }

  async function symbolizeCrashIfPossible(project, session) {
    const report = session.status?.crash_report;
    const buildId = String(report?.build_id || "").toLowerCase();
    const addresses = Array.isArray(report?.backtrace_addresses)
      ? report.backtrace_addresses.filter((value) => /^0x[a-f0-9]{1,16}$/i.test(String(value))).slice(0, 32)
      : [];
    const key = `${buildId}|${addresses.join(",")}`;
    if (session.symbolization?.key === key && session.symbolization.status !== "error") return;
    if (!buildId || !addresses.length) {
      session.symbolization = { key, status: "idle", frames: [] };
      return;
    }
    const build = state.builds.find((item) => String(item.build_id || "").toLowerCase() === buildId);
    if (!build) {
      session.symbolization = { key, status: "build_artifact_mismatch", frames: [] };
      return;
    }
    if (!Array.isArray(build.artifacts) || !build.artifacts.some((artifact) => artifact.file_name === "firmware.elf")) {
      session.symbolization = { key, status: "build_elf_missing", frames: [] };
      return;
    }
    session.symbolization = { key, status: "pending", frames: [] };
    try {
      const result = await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(build.build_job_id)}/symbolize`, {
        build_id: buildId,
        addresses,
      });
      session.symbolization = { key, status: result.status || "symbolized", frames: result.frames || [] };
    } catch (error) {
      session.symbolization = {
        key,
        status: error?.payload?.error === "build_artifact_mismatch" ? "build_artifact_mismatch" : "error",
        message: error.message,
        frames: [],
      };
    }
  }

  async function openFrameSource(project, file, line) {
    const sources = state.projectSourcesByProjectId[project.id] || [];
    const normalizedFile = String(file || "").replace(/\\/g, "/");
    const source = sources.find((item) => normalizedFile === item.path || normalizedFile.endsWith(`/${item.path}`));
    if (!source) {
      const session = activeSession(project);
      session.message = `Die symbolisierte Datei ${normalizedFile} gehört nicht zu den sichtbaren Projektquellen.`;
      session.messageKind = "warning";
      render(project);
      return;
    }
    await openIdeSource(source.path);
    const editor = document.querySelector("#sourceEditor");
    const targetLine = Math.max(1, Number(line) || 1);
    const offset = String(editor.value || "").split(/\n/).slice(0, targetLine - 1).reduce((sum, value) => sum + value.length + 1, 0);
    editor.setSelectionRange(offset, offset);
    editor.focus();
  }

  async function readUsb(session) {
    if (!session.port) throw new Error("Wähle zuerst den seriellen Port des Boards.");
    // A serial port can only be owned by one request at a time. Keep status
    // and ring-buffer reads sequential even though both operations are read-only.
    const statusResponse = await state.serialService.serialRequest(session.port, "diagnostics_status");
    const logsResponse = await state.serialService.serialRequest(session.port, "diagnostics_logs");
    return { status: statusResponse.payload || {}, logs: logsResponse.payload?.text || "" };
  }

  async function readNetwork(session) {
    if (!session.serialServiceCapabilities?.includes("local_device_diagnostics")) {
      throw new Error("Für die lokale WLAN-Diagnose wird GerNetiX Serial Service 0.3.7 oder neuer benötigt.");
    }
    let baseUrl = String(session.baseUrl || "").trim();
    if (!baseUrl) throw new Error("Gib die lokale Adresse des Boards ein.");
    if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
    baseUrl = baseUrl.replace(/\/+$/, "");
    session.baseUrl = `${baseUrl}/`;
    const result = await state.serialService.deviceDiagnostics(session.baseUrl);
    return { status: result.status || {}, logs: result.logs || "" };
  }

  function toggleLive(project = projectById(state.activeProjectId)) {
    const session = activeSession(project);
    if (session.running) {
      stopPolling(project, session);
      render(project);
      return;
    }
    session.running = true;
    session.message = "Live-Ansicht aktiv. Die Diagnose wird alle zwei Sekunden gelesen.";
    session.messageKind = "running";
    render(project);
    void refresh(project, { silent: true });
    const key = sessionKey(project?.id, session.componentId);
    pollingTimers.set(key, window.setInterval(() => void refresh(project, { silent: true }), 2000));
  }

  function stopPolling(project = projectById(state.activeProjectId), session = activeSession(project)) {
    const key = sessionKey(project?.id, session.componentId);
    const timer = pollingTimers.get(key);
    if (timer) window.clearInterval(timer);
    pollingTimers.delete(key);
    session.running = false;
  }

  function stopAllPolling() {
    for (const timer of pollingTimers.values()) window.clearInterval(timer);
    pollingTimers.clear();
    Object.values(state.ideDebugSessions).forEach((session) => { session.running = false; });
  }

  function addMarker(project = projectById(state.activeProjectId)) {
    const session = activeSession(project);
    session.events.push({
      severity: "marker",
      subsystem: "reproduction",
      message: "Reproduktion beginnt hier",
      client_time: new Date().toISOString(),
      uptime_ms: null,
    });
    session.events = session.events.slice(-256);
    render(project);
  }

  function exportJson(project = projectById(state.activeProjectId)) {
    const session = activeSession(project);
    if (!session.events.length && !session.status) return;
    const payload = {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      project_id: project.id,
      component_id: session.componentId,
      connection: session.connection,
      status: session.status,
      events: session.events,
      redaction: { credentials_included: false, network_payloads_included: false },
    };
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gernetix-diagnose-${String(session.componentId || "device").replace(/[^a-z0-9_-]/gi, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bind() {
    const target = document.querySelector("#ideDeviceDebugView");
    if (!target) return;
    target.addEventListener("change", (event) => {
      const project = projectById(state.activeProjectId);
      const session = activeSession(project);
      if (event.target.matches("[data-device-debug-connection]")) session.connection = event.target.value;
      if (event.target.matches("[data-device-debug-port]")) session.port = event.target.value;
      if (event.target.matches("[data-device-debug-url]")) session.baseUrl = event.target.value;
      if (event.target.matches("[data-device-debug-severity]")) session.severity = event.target.value;
      if (event.target.matches("[data-device-debug-subsystem]")) session.subsystem = event.target.value;
      render(project);
    });
    target.addEventListener("input", (event) => {
      if (event.target.matches("[data-device-debug-url]")) activeSession().baseUrl = event.target.value;
    });
    target.addEventListener("click", (event) => {
      const project = projectById(state.activeProjectId);
      if (event.target.closest("[data-device-debug-refresh-ports]")) void refreshPorts(project);
      else if (event.target.closest("[data-device-debug-refresh]")) void refresh(project);
      else if (event.target.closest("[data-device-debug-toggle-live]")) toggleLive(project);
      else if (event.target.closest("[data-device-debug-marker]")) addMarker(project);
      else if (event.target.closest("[data-device-debug-export]")) exportJson(project);
      else if (event.target.closest("[data-debug-source]")) {
        const button = event.target.closest("[data-debug-source]");
        void openFrameSource(project, button.dataset.debugSource, button.dataset.debugLine);
      }
    });
  }

  return { appendEvents, bind, normalizeLog, open, refresh, render, stopAllPolling };
})();

function openIdeDeviceDebug(componentId, softwareUnitId) {
  GerNetiXDeviceDebug.open(componentId, softwareUnitId);
}

function renderIdeDeviceDebug(project) {
  GerNetiXDeviceDebug.render(project);
}

function stopIdeDeviceDebugPolling() {
  GerNetiXDeviceDebug.stopAllPolling();
}

GerNetiXDeviceDebug.bind();
window.GerNetiXDeviceDebug = GerNetiXDeviceDebug;
