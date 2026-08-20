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
        reportedIncidentKeys: [],
        operatorAlert: null,
      };
    }
    return state.ideDebugSessions[key];
  }

  function activeSession(project = projectById(state.activeProjectId)) {
    return sessionFor(project, state.activeIdeComponentId || "primary-iot-device");
  }

  async function loadServerSession(project) {
    if (!project?.id) return null;
    const envelope = await getJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/debug-session`);
    state.projectDebugSessions[project.id] = { ...envelope, resumed: false };
    syncBuildProfile(project);
    return envelope.session || null;
  }

  function serverSessionState(project) {
    return state.projectDebugSessions[project?.id] || { session: null, debug_firmware_devices: [], resumed: false };
  }

  function buildProfile(project) {
    const selected = document.querySelector("#ideBuildProfileSelect")?.value;
    if (selected === "debug" || selected === "standard") return selected;
    return serverSessionState(project).session ? "debug" : "standard";
  }

  function syncBuildProfile(project) {
    const select = document.querySelector("#ideBuildProfileSelect");
    if (!select) return;
    const active = Boolean(serverSessionState(project).session);
    select.value = active ? "debug" : "standard";
    select.dataset.debugActive = String(active);
  }

  async function startServerSession(project) {
    const components = ideDeviceConfigurationComponents(project).filter((item) => item.abstract_type === "iot_device");
    const units = projectSoftwareUnits(project).filter((unit) => unit.build_system === "platformio");
    const envelope = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/debug-session`, {
      component_ids: components.map((item) => item.component_id),
      software_unit_ids: units.map((item) => item.software_unit_id),
      device_ids: Array.from(new Set([
        ...components.map((item) => item.inventory_device_id),
        ...units.map((item) => item.device_id),
      ].filter(Boolean))),
    });
    state.projectDebugSessions[project.id] = { ...envelope, resumed: true };
    syncBuildProfile(project);
    renderWorkspace(project);
  }

  async function continueServerSession(project) {
    const envelope = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/debug-session/activity`, {});
    state.projectDebugSessions[project.id] = { ...envelope, resumed: true };
    syncBuildProfile(project);
    renderWorkspace(project);
  }

  async function recordUserActivity(project) {
    if (!serverSessionState(project).session) return;
    const envelope = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/debug-session/activity`, {});
    state.projectDebugSessions[project.id] = { ...envelope, resumed: true };
  }

  async function endServerSession(project) {
    const envelope = await deleteJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/debug-session`);
    state.projectDebugSessions[project.id] = { ...envelope, resumed: false };
    syncBuildProfile(project);
    renderWorkspace(project);
  }

  function renderServerSession(project) {
    const server = serverSessionState(project);
    const session = server.session;
    const installed = server.debug_firmware_devices || [];
    if (!session) {
      const installedWarning = installed.length
        ? `<p>Auf ${installed.length} Gerät${installed.length === 1 ? "" : "en"} kann noch Debug-Firmware installiert sein. Baue und flashe Standard-Firmware, um den normalen Zustand wiederherzustellen.</p>`
        : "<p>Eine Debug-Session verwendet instrumentierte Firmware. ELF, Map und Build-Log bleiben für die zeitlich begrenzte Diagnose serverintern geschützt.</p>";
      return `<section class="device-debug-session ${installed.length ? "warning" : ""}">
        <header><div><p class="eyebrow">Debug-Session</p><h4>${installed.length ? "Debug-Firmware möglicherweise noch installiert" : "Keine Debug-Session aktiv"}</h4></div></header>
        ${installedWarning}
        <p>Beim Start müssen alle betroffenen IoT-Firmwares erneut gebaut und anschließend per USB, OTA oder FlashBox geflasht werden.</p>
        <div class="device-debug-session-actions"><button type="button" class="primary" data-debug-session-start>Debug-Session starten</button><a class="button-link" href="/app/ide/?project=${encodeURIComponent(project.id)}">Standard-Firmware bauen</a></div>
      </section>`;
    }
    const expires = new Date(session.expires_at).toLocaleString("de-DE");
    const status = ({ build_required: "Debug-Build und Flash erforderlich", building: "Debug-Build läuft", ready_to_flash: "Debug-Build bereit – jetzt flashen", active: "Debug-Firmware aktiv", build_failed: "Debug-Build fehlgeschlagen" })[session.status] || session.status;
    return `<section class="device-debug-session active">
      <header><div><p class="eyebrow">Debug-Session</p><h4>${escapeHtml(status)}</h4></div><span class="device-debug-mode-badge">bis ${escapeHtml(expires)}</span></header>
      <p>Die Session ist an den Projektstand und ihre Debug-Builds gebunden. Browser-Schließen beendet sie nicht.</p>
      ${["build_required", "ready_to_flash", "build_failed"].includes(session.status) ? "<p><strong>Hinweis:</strong> Für die Debug-Funktionen muss die Debug-Firmware auf die betroffenen IoT-Devices geflasht werden.</p>" : ""}
      <div class="device-debug-session-actions">
        ${server.resumed ? "" : '<button type="button" class="primary" data-debug-session-continue>Debug-Session fortsetzen</button>'}
        <a class="button-link primary" href="/app/ide/?project=${encodeURIComponent(project.id)}">Debug bauen &amp; flashen</a>
        <button type="button" data-debug-session-end>Session beenden</button>
      </div>
    </section>`;
  }

  function renderTarget() {
    return document.querySelector("#debugDeviceView");
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
    const target = renderTarget();
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
        ${renderServerSession(project)}
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
        ${renderDiagnostics(session)}
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
    const diagnostics = diagnosticsForStatus(status);
    const system = diagnostics?.sections?.system || {};
    const fields = [
      ["Firmware", status.firmware_version || status.runtimeVersion || status.basissoftwareVersion || "unbekannt"],
    ];
    if (status.basissoftware_version || status.basissoftwareVersion) fields.push(["Basissoftware", status.basissoftware_version || status.basissoftwareVersion]);
    if (status.basissoftware_variant || status.basissoftwareVariant) fields.push(["Variante", status.basissoftware_variant || status.basissoftwareVariant]);
    if (status.build_id) fields.push(["Build-ID", shortBuildId(status.build_id)]);
    if (status.uptime_ms !== undefined || status.uptimeMs !== undefined) fields.push(["Laufzeit", formatDuration(status.uptime_ms ?? status.uptimeMs)]);
    if (status.reset_reason) fields.push(["Resetgrund", status.reset_reason]);
    if (status.wifi_state || status.wifiStationState) {
      fields.push(["WLAN", status.wifi_state || status.wifiStationState]);
      fields.push(["WLAN-Verbindungsstatus", diagnosticCode(status.wifi_last_connect_status ?? status.wifiLastConnectStatus)]);
      fields.push(["WLAN-Trennungsgrund", diagnosticCode(status.wifi_last_disconnect_reason ?? status.wifiLastDisconnectReason)]);
    }
    if (status.ota) fields.push(["OTA", status.ota.error ? `${status.ota.state || "Fehler"} · ${status.ota.error}` : status.ota.state || "bereit"]);
    if (status.diagnostic_log) {
      fields.push(["Diagnoselog", `${formatBytes(status.diagnostic_log.used_bytes)} / ${formatBytes(status.diagnostic_log.capacity_bytes)}`]);
      fields.push(["Verworfene Logbytes", status.diagnostic_log.dropped_bytes]);
    }
    if (system.sdk_version || system.idf_version) fields.push([system.sdk || "SDK", system.sdk_version || system.idf_version]);
    if (system.mcu || system.target) fields.push(["Controller", system.mcu || `${String(system.target).toUpperCase()} · Rev. ${system.chip_revision ?? "?"}`]);
    if (system.cpu_cores !== undefined) fields.push(["CPU-Kerne", system.cpu_cores]);
    return `<dl class="device-debug-status-grid">${fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("")}</dl>`;
  }

  function diagnosticsForStatus(status) {
    if (status?.diagnostics?.schema_version >= 2) return status.diagnostics;
    const legacy = status?.runtime_resources;
    if (!legacy) return null;
    return {
      schema_version: 2,
      capabilities: ["system", "memory", "rtos_tasks"],
      platform: { family: "esp32", sdk: "esp-idf", rtos: "freertos" },
      sections: {
        system: legacy.system || {},
        memory: { heap: legacy.heap || {}, regions: legacy.memory_regions || {}, stack_thresholds: legacy.stack_thresholds || {} },
        tasks: { items: legacy.tasks || [], count_total: legacy.task_count_total, status: legacy.task_list_status },
      },
    };
  }

  function statusUptime(status) {
    const value = status?.uptime_ms
      ?? status?.uptimeMs
      ?? diagnosticsForStatus(status)?.sections?.timing?.uptime_ms;
    const uptime = Number(value);
    return Number.isFinite(uptime) ? uptime : null;
  }

  function shortBuildId(value) {
    const buildId = String(value || "");
    return buildId ? `${buildId.slice(0, 12)}…` : "nicht gemeldet";
  }

  function basissoftwareCriticalIncidents(status) {
    const tasks = diagnosticsForStatus(status)?.sections?.tasks?.items || [];
    const incidents = tasks.filter((task) => task.owner === "basissoftware" && task.status === "critical").map((task) => ({
      type: "task_stack_critical",
      task_name: String(task.name || "unknown"),
      minimum_free_stack_bytes: Number(task.minimum_free_stack_bytes),
    }));
    const crash = status?.crash_report;
    if (crash?.available && crash.fault_owner === "basissoftware") {
      incidents.push({
        type: "basissoftware_crash",
        task_name: String(crash.task_name || "unknown"),
        fault_code: String(crash.fault_code || "unknown"),
      });
    }
    return incidents;
  }

  function renderDiagnostics(session) {
    const diagnostics = diagnosticsForStatus(session.status);
    if (!diagnostics) return "";
    const capabilities = new Set(Array.isArray(diagnostics.capabilities) ? diagnostics.capabilities : []);
    const memory = diagnostics.sections?.memory;
    const taskSection = diagnostics.sections?.tasks;
    const timing = diagnostics.sections?.timing;
    const reset = diagnostics.sections?.reset;
    const tasks = Array.isArray(taskSection?.items) ? taskSection.items : [];
    const problematic = tasks.filter((task) => task.status !== "ok");
    const heap = memory?.heap || {};
    const internal = memory?.regions?.internal || {};
    const psram = memory?.regions?.psram || {};
    const sram = memory?.sram || {};
    const heapStatus = heap.status || "unknown";
    const taskCount = Number(taskSection?.count_total) || tasks.length;
    const memoryCards = [];
    if (memory?.heap) {
      memoryCards.push(`<div class="${escapeAttribute(heapStatus)}"><strong>Heap-Minimum</strong><span>${escapeHtml(formatBytes(heap.minimum_free_bytes))}</span><small>${escapeHtml(heapStatus === "ok" ? "ausreichende Reserve" : `${heapStatus.toUpperCase()} · Grenze ${formatBytes(heapStatus === "critical" ? heap.critical_below_bytes : heap.warning_below_bytes)}`)}</small></div>`);
      memoryCards.push(`<div class="${escapeAttribute(fragmentationState(heap.fragmentation_percent))}"><strong>Größter Heap-Block</strong><span>${escapeHtml(formatBytes(heap.largest_free_block_bytes))}</span><small>${escapeHtml(formatPercent(heap.fragmentation_percent))} Fragmentierung</small></div>`);
      memoryCards.push(`<div><strong>Interner RAM frei</strong><span>${escapeHtml(formatBytes(internal.free_bytes))}</span><small>Minimum ${escapeHtml(formatBytes(internal.minimum_free_bytes))} · größter Block ${escapeHtml(formatBytes(internal.largest_free_block_bytes))}</small></div>`);
      if (psram.available) memoryCards.push(`<div><strong>PSRAM frei</strong><span>${escapeHtml(formatBytes(psram.free_bytes))}</span><small>Minimum ${escapeHtml(formatBytes(psram.minimum_free_bytes))} · größter Block ${escapeHtml(formatBytes(psram.largest_free_block_bytes))}</small></div>`);
    }
    if (memory?.sram) {
      memoryCards.push(`<div><strong>SRAM frei geschätzt</strong><span>${escapeHtml(formatBytesExact(sram.free_estimate_bytes))}</span><small>Minimum ${escapeHtml(formatBytesExact(sram.minimum_free_estimate_bytes))} von ${escapeHtml(formatBytesExact(sram.total_bytes))}</small></div>`);
      memoryCards.push(`<div><strong>Stack-/Heap-Abstand</strong><span>${escapeHtml(formatBytesExact(sram.stack_heap_gap_bytes))}</span><small>Heap belegt ${escapeHtml(formatBytesExact(sram.heap_used_bytes))}</small></div>`);
    }
    if (timing) memoryCards.push(`<div><strong>Loop-Laufzeit</strong><span>${escapeHtml(formatMicroseconds(timing.last_loop_duration_us))}</span><small>Maximum ${escapeHtml(formatMicroseconds(timing.maximum_loop_duration_us))}</small></div>`);
    if (reset) memoryCards.push(`<div><strong>Letzter Reset</strong><span>${escapeHtml(reset.primary_reason || "unbekannt")}</span><small>MCUSR 0x${escapeHtml(Number(reset.raw_flags || 0).toString(16).padStart(2, "0"))}</small></div>`);
    if (capabilities.has("rtos_tasks")) {
      memoryCards.push(`<div><strong>Stack-Auffälligkeiten</strong><span>${problematic.length}</span><small>Minimum seit Task-Start</small></div>`);
      memoryCards.push(`<div><strong>CPU-Auslastung</strong><span>nicht gemessen</span><small>Keine erfundene Prozentangabe aus einer Momentaufnahme</small></div>`);
    }
    return `<section class="device-debug-resources ${escapeAttribute(heapStatus)}">
      <header><div><p class="eyebrow">Plattformdiagnose</p><h4>${capabilities.has("rtos_tasks") ? "Speicher und RTOS-Tasks" : "Speicher und Bare-Metal-Runtime"}</h4></div><span>${escapeHtml(diagnostics.platform?.family || "Embedded")}${capabilities.has("rtos_tasks") ? ` · ${taskCount} Tasks${taskSection?.status === "truncated" ? " · erste 32 gezeigt" : ""}` : " · kein RTOS"}</span></header>
      ${memoryCards.length ? `<div class="device-debug-resource-summary">${memoryCards.join("")}</div>` : ""}
      ${capabilities.has("rtos_tasks") ? `<div class="device-debug-task-table"><table><thead><tr><th>Task</th><th>Verantwortung</th><th>Zustand</th><th>Core</th><th>Priorität</th><th>Basis</th><th>kleinste Stack-Reserve</th><th>Status</th></tr></thead><tbody>
        ${tasks.map((task) => `<tr class="${escapeAttribute(task.status || "unknown")}"><td>${escapeHtml(task.name || "unbekannt")}</td><td>${escapeHtml(taskOwnerLabel(task.owner))}</td><td>${escapeHtml(taskStateLabel(task.state))}</td><td>${escapeHtml(task.core === null || task.core === undefined ? "beliebig" : String(task.core))}</td><td>${escapeHtml(String(task.priority ?? "–"))}</td><td>${escapeHtml(String(task.base_priority ?? "–"))}</td><td>${escapeHtml(formatBytes(task.minimum_free_stack_bytes))}</td><td><span>${escapeHtml(String(task.status || "unknown").toUpperCase())}</span></td></tr>`).join("") || '<tr><td colspan="8">Task-Liste nicht verfügbar.</td></tr>'}
      </tbody></table></div>` : ""}
      ${session.operatorAlert ? `<p class="device-debug-operator-alert ${escapeAttribute(session.operatorAlert.kind)}">${escapeHtml(session.operatorAlert.message)}</p>` : ""}
    </section>`;
  }

  function taskOwnerLabel(owner) {
    return ({
      basissoftware: "Basissoftware",
      shared_runtime: "Basissoftware + Projekt",
      platform_runtime: "Plattform / RTOS",
      project_or_dependency: "Projekt / Bibliothek",
    })[owner] || "nicht zugeordnet";
  }

  function taskStateLabel(taskState) {
    return ({ running: "läuft", ready: "bereit", blocked: "wartet", suspended: "pausiert", deleted: "beendet" })[taskState] || "unbekannt";
  }

  function fragmentationState(value) {
    const percent = Number(value);
    if (!Number.isFinite(percent)) return "unknown";
    if (percent >= 70) return "critical";
    if (percent >= 50) return "warning";
    return "ok";
  }

  function formatPercent(value) {
    const percent = Number(value);
    return Number.isFinite(percent) ? `${Math.round(percent)} %` : "nicht gemeldet";
  }

  async function reportBasissoftwareIncidents(project, session) {
    const incidents = basissoftwareCriticalIncidents(session.status);
    if (!incidents.length) return;
    const buildId = String(session.status?.build_id || session.status?.crash_report?.build_id || "").toLowerCase();
    const key = `${buildId}|${incidents.map((incident) => `${incident.type}:${incident.task_name}:${incident.minimum_free_stack_bytes ?? incident.fault_code}`).join("|")}`;
    const reportedIncidentKeys = Array.isArray(session.reportedIncidentKeys) ? session.reportedIncidentKeys : [];
    if (reportedIncidentKeys.includes(key)) return;
    try {
      await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/basissoftware-incidents`, {
        component_id: session.componentId,
        software_unit_id: state.activeSoftwareUnitIds[project.id] || "",
        build_id: buildId,
        basissoftware_version: session.status?.basissoftware_version || session.status?.basissoftwareVersion || "",
        incidents,
      });
      session.reportedIncidentKeys = [...reportedIncidentKeys, key].slice(-32);
      session.operatorAlert = { kind: "reported", message: "Kritischer Basissoftwarefehler wurde mit höchster Priorität an das Admin-System gemeldet." };
    } catch (error) {
      session.operatorAlert = { kind: "failed", message: `Kritischer Basissoftwarefehler erkannt, aber die Betreiber-Meldung ist fehlgeschlagen: ${error.message}` };
    }
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
      <li class="${frame.resolved ? "resolved" : "unresolved"}"><code>${escapeHtml(frame.address)}</code><span>${escapeHtml(frame.resolved ? frame.function : frame.protected ? "GerNetiX-Basissoftware" : "nicht aufgelöst")}</span><small>${escapeHtml(frame.resolved ? `${frame.file}:${frame.line}` : frame.protected ? "Interne Symbole geschützt" : "Kein Symbol im passenden ELF")}</small>${frame.resolved ? `<button type="button" data-debug-source="${escapeAttribute(frame.file)}" data-debug-line="${escapeAttribute(String(frame.line))}">Stelle öffnen</button>` : ""}</li>`).join("")}</ol></div>`;
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

  function formatBytesExact(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes)) return "nicht gemeldet";
    return bytes < 1024 ? `${Math.round(bytes)} Byte` : `${(bytes / 1024).toFixed(1)} KiB`;
  }

  function formatMicroseconds(value) {
    const microseconds = Number(value);
    if (!Number.isFinite(microseconds)) return "nicht gemessen";
    return microseconds >= 1000 ? `${(microseconds / 1000).toFixed(2)} ms` : `${Math.round(microseconds)} µs`;
  }

  function diagnosticCode(value) {
    const code = Number(value);
    if (!Number.isFinite(code)) return "nicht gemeldet";
    return code === 0 ? "kein Fehler gemeldet" : `Code ${code}`;
  }

  function diagnosticLogStats(text) {
    const match = String(text || "").match(/^GerNetiX event log: capacity=(\d+) bytes used=(\d+) droppedBytes=(\d+)/m);
    if (!match) return null;
    return { capacity_bytes: Number(match[1]), used_bytes: Number(match[2]), dropped_bytes: Number(match[3]) };
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
    if (!options.silent) await recordUserActivity(project).catch(() => {});
    if (!options.silent) {
      session.message = "Diagnose wird gelesen…";
      session.messageKind = "running";
      render(project);
    }
    try {
      const result = session.connection === "usb"
        ? await readUsb(session)
        : await readNetwork(session);
      const previousUptime = statusUptime(session.status);
      const currentUptime = statusUptime(result.status);
      if (previousUptime !== null && currentUptime !== null && currentUptime < previousUptime) {
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
      session.status = { ...result.status, diagnostic_log: diagnosticLogStats(result.logs) };
      appendEvents(session, normalizeLog(result.logs));
      await symbolizeCrashIfPossible(project, session);
      await reportBasissoftwareIncidents(project, session);
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
    const targetLine = Math.max(1, Number(line) || 1);
    navigate(`/app/ide/?project=${encodeURIComponent(project.id)}&source=${encodeURIComponent(source.path)}&line=${encodeURIComponent(String(targetLine))}`);
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
    void recordUserActivity(project);
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
    void recordUserActivity(project);
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

  function bindTarget(target) {
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
      else if (event.target.closest("[data-debug-session-start]")) void startServerSession(project);
      else if (event.target.closest("[data-debug-session-continue]")) void continueServerSession(project);
      else if (event.target.closest("[data-debug-session-end]")) void endServerSession(project);
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

  function bind() {
    bindTarget(document.querySelector("#debugDeviceView"));
    document.querySelector("#debugOpenIdeLink")?.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(event.currentTarget.getAttribute("href"));
    });
    document.querySelector("#debugDeviceList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-debug-device]");
      if (!button) return;
      const project = projectById(state.activeProjectId);
      const previousSession = activeSession(project);
      if (previousSession.running) stopPolling(project, previousSession);
      state.activeIdeComponentId = button.dataset.debugDevice;
      const softwareUnitId = button.dataset.debugSoftwareUnit || "";
      if (softwareUnitId) state.activeSoftwareUnitIds[project.id] = softwareUnitId;
      const url = new URL(window.location.href);
      url.searchParams.set("device", state.activeIdeComponentId);
      history.replaceState({}, "", `${url.pathname}${url.search}`);
      renderWorkspace(project);
      void refreshPorts(project);
    });
  }

  function renderWorkspace(project) {
    const devices = ideDeviceConfigurationComponents(project)
      .filter((component) => component.abstract_type === "iot_device");
    const list = document.querySelector("#debugDeviceList");
    document.querySelector("#debugProjectTitle").textContent = project.name;
    document.querySelector("#debugDeviceListTitle").textContent = `${devices.length} IoT-Device${devices.length === 1 ? "" : "s"}`;
    document.querySelector("#debugOpenIdeLink").href = `/app/ide/?project=${encodeURIComponent(project.id)}`;
    list.innerHTML = devices.map((component) => {
      const softwareUnit = softwareUnitForIdeComponent(project, component);
      const boardName = component.board_configuration?.name
        || softwareUnit?.build_config?.board_configuration?.name
        || component.board_profile_id
        || "Board noch nicht zugeordnet";
      return `<button type="button" class="${component.component_id === state.activeIdeComponentId ? "active" : ""}" data-debug-device="${escapeAttribute(component.component_id)}" data-debug-software-unit="${escapeAttribute(softwareUnit?.software_unit_id || "")}">
        <strong>${escapeHtml(component.label || "IoT-Device")}</strong>
        <span>${escapeHtml(softwareUnit?.title || "Firmware")}</span>
        <small>${escapeHtml(boardName)}</small>
      </button>`;
    }).join("") || '<p class="empty">Dieses Projekt enthält kein modelliertes IoT-Device.</p>';
    if (devices.length) render(project);
    else document.querySelector("#debugDeviceView").innerHTML = '<div class="debug-workspace-empty"><strong>Keine IoT-Devices</strong><p>Dieses Projekt enthält keine Geräte, für die eine lokale Diagnose angeboten werden kann.</p><a class="button-link primary" href="/app/development-platform/">Zur Entwicklungsplattform</a></div>';
  }

  async function loadWorkspace() {
    const query = new URLSearchParams(window.location.search);
    const projectId = query.get("project") || "";
    const project = state.projects.find((item) => item.id === projectId);
    const target = document.querySelector("#debugDeviceView");
    if (!project) {
      if (target) target.innerHTML = '<div class="debug-workspace-empty"><strong>Projekt nicht gefunden</strong><p>Öffne zuerst ein Entwicklungsprojekt.</p><a class="button-link primary" href="/app/development-platform/">Entwicklungsprojekte verwalten</a></div>';
      return;
    }
    state.activeProjectId = project.id;
    await loadServerSession(project);
    const devices = ideDeviceConfigurationComponents(project)
      .filter((component) => component.abstract_type === "iot_device");
    if (devices.length) await loadProjectSources(project);
    const requestedDeviceId = query.get("device") || "";
    const selected = devices.find((component) => component.component_id === requestedDeviceId)
      || devices.find((component) => component.component_id === state.activeIdeComponentId)
      || devices[0];
    state.activeIdeComponentId = selected?.component_id || "";
    const softwareUnit = selected ? softwareUnitForIdeComponent(project, selected) : null;
    if (softwareUnit) state.activeSoftwareUnitIds[project.id] = softwareUnit.software_unit_id;
    renderWorkspace(project);
    if (selected) await refreshPorts(project);
  }

  return { appendEvents, basissoftwareCriticalIncidents, bind, buildProfile, diagnosticLogStats, diagnosticsForStatus, loadServerSession, loadWorkspace, normalizeLog, refresh, render, startSession: startServerSession, statusUptime, stopAllPolling };
})();

function stopIdeDeviceDebugPolling() {
  GerNetiXDeviceDebug.stopAllPolling();
}

function loadDeviceDebugWorkspace() {
  return GerNetiXDeviceDebug.loadWorkspace();
}

GerNetiXDeviceDebug.bind();
window.GerNetiXDeviceDebug = GerNetiXDeviceDebug;

// Die Fehlersuche meldet sich selbst an und hoert auf die Bitte, das
// Abfragen zu beenden. Beides ersetzt Aufrufe quer zwischen Nachbarn.
registerPlatformComponent("deviceDebug", () => GerNetiXDeviceDebug);
window.addEventListener(IDE_DEBUG_STOP_EVENT, () => stopIdeDeviceDebugPolling());
