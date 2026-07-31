// GerNetiX platform module extracted from app.js.
function renderIdeShell() {
  document.querySelector("#ideDeviceSelect").innerHTML = state.devices.map((device) => `
    <option value="${escapeHtml(device.device_id)}">${escapeHtml(device.display_name)}${device.usb_flash_supported ? ` - ${device.build_target_label || "USB"}` : ""}</option>
  `).join("");
  document.querySelector("#ideDeviceSelect").value = state.activeDeviceId;
  const flashboxSelect = document.querySelector("#flashboxDeviceSelect");
  const flashboxes = inventoryFlashboxes();
  flashboxSelect.innerHTML = flashboxes.map((flashbox) => `
    <option value="${escapeHtml(flashbox.device_id)}">${escapeHtml(flashbox.display_name || flashbox.device_id)}${flashbox.trust_state ? ` - ${escapeHtml(flashbox.trust_state)}` : ""}</option>
  `).join("");
  if (!flashboxes.some((flashbox) => flashbox.device_id === state.activeFlashboxDeviceId)) {
    state.activeFlashboxDeviceId = flashboxes[0]?.device_id || "";
  }
  flashboxSelect.value = state.activeFlashboxDeviceId;
  renderUsbPortOptions();
  syncSelectedDevicePort();
}

async function loadIdeProject() {
  const projectId = new URLSearchParams(window.location.search).get("project");
  if (!projectId) {
    renderIdeEmptyState();
    return;
  }
  state.activeProjectId = projectId;
  const project = projectById(projectId);
  if (!project) {
    renderIdeEmptyState();
    return;
  }
  state.activeSoftwareUnitIds[project.id] ||= project.activeSoftwareUnitId || project.softwareUnits?.[0]?.software_unit_id || "";
  state.activeDeviceId = state.devices.some((device) => device.device_id === project.linkedDeviceId)
    ? project.linkedDeviceId
    : "";
  document.querySelector("#ideDeviceSelect").value = state.activeDeviceId;
  document.querySelector("#ideEmptyState").classList.add("hidden");
  document.querySelector("#ideLayout").classList.remove("hidden");
  document.querySelector("#ideProjectTitle").textContent = project.name;
  document.querySelector("#ideProjectBrowserTitle").textContent = project.name;
  renderIdeCodeAssistant(project);
  if (projectNeedsHardwareTools(project)) await refreshUsbPorts(false);
  const sources = await loadProjectSources(project);
  state.sourcePath = selectedIdeSourcePath(project, sources);
  state.activeIdeStep = Math.min(progressFor(project.id).currentStep || 0, Math.max(0, guidedViews(project).length - 1));
  updateIdeProjectTools(project);
  renderIdeDeviceAllocation(project);
  renderIdeProjectBrowser(project, sources);
  renderComponentFeatures(project);
  document.querySelector("#ideActiveSourceLabel").textContent = state.sourcePath;
  setupIdeLayoutPersistence();
  const metaItems = [
    ["id", project.id],
    ["ownerUserId", project.ownerUserId],
    ["lastOpenedMode", "ide"],
    ["targetRuntime", project.targetRuntime],
    ["Datei", state.sourcePath],
  ];
  if (projectNeedsHardwareTools(project)) {
    metaItems.push(
      ["linkedDeviceId", project.linkedDeviceId || "kein Device"],
      ["IoT-Device-Zuordnung", allocatedIdeDevice(project)?.display_name || "nicht zugeordnet"],
      ["Boardprofil", allocatedIdeDevice(project)?.build_target_label || "kein Boardprofil"],
      ["USB-Port", selectedUsbPort() || (state.usbPorts.length ? "automatisch ermitteln" : "kein Port erkannt")],
    );
  }
  document.querySelector("#ideProjectMeta").innerHTML = metaItems.map(([key, value]) => meta(key, value)).join("");
  renderAiRating("#ideAiUsage", true);
  await loadIdeSourceContent(project, state.sourcePath);
  renderProjectViewManifest(project);
  renderIdeCodeAssistant(project);
  focusIdeStepSource(project);
  renderIdeViewMode(project);
  state.workspace = await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(project.id)}`,
  });
}

function ideLayoutStorageKey() {
  const accountId = state.account?.user_id || state.account?.username || "local";
  return `gernetix.ide.layout.v1:${accountId}`;
}

function setupIdeLayoutPersistence() {
  if (state.ideLayoutPersistenceReady || typeof ResizeObserver === "undefined") return;
  const elements = {
    projectBrowserWidth: document.querySelector("#ideProjectBrowserPanel"),
    assistantWidth: document.querySelector("#ideCodeAssistant"),
    buildHeight: document.querySelector("#ideBuildConsole"),
  };
  if (Object.values(elements).some((element) => !element)) return;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(ideLayoutStorageKey()) || "{}"); } catch {}
  if (Number(stored.projectBrowserWidth) > 0) elements.projectBrowserWidth.style.width = `${stored.projectBrowserWidth}px`;
  if (Number(stored.assistantWidth) > 0) elements.assistantWidth.style.width = `${stored.assistantWidth}px`;
  if (Number(stored.buildHeight) > 0) {
    document.querySelector(".ide-workbench")?.style.setProperty("--ide-console-height", `${stored.buildHeight}px`);
  }
  const observer = new ResizeObserver(() => {
    const chatInput = document.querySelector("[data-code-explorer-chat] textarea");
    const layout = {
      projectBrowserWidth: Math.round(elements.projectBrowserWidth.getBoundingClientRect().width),
      assistantWidth: Math.round(elements.assistantWidth.getBoundingClientRect().width),
      buildHeight: Math.round(elements.buildHeight.getBoundingClientRect().height),
      chatInputHeight: Math.round(chatInput?.getBoundingClientRect().height || stored.chatInputHeight || 120),
    };
    localStorage.setItem(ideLayoutStorageKey(), JSON.stringify(layout));
  });
  Object.values(elements).forEach((element) => observer.observe(element));
  document.addEventListener("pointerup", () => {
    const chatInput = document.querySelector("[data-code-explorer-chat] textarea");
    if (!chatInput) return;
    try {
      const current = JSON.parse(localStorage.getItem(ideLayoutStorageKey()) || "{}");
      current.chatInputHeight = Math.round(chatInput.getBoundingClientRect().height);
      localStorage.setItem(ideLayoutStorageKey(), JSON.stringify(current));
    } catch {}
  });
  state.ideLayoutPersistenceReady = true;
}

function restoreIdeChatInputHeight() {
  const chatInput = document.querySelector("[data-code-explorer-chat] textarea");
  if (!chatInput) return;
  try {
    const stored = JSON.parse(localStorage.getItem(ideLayoutStorageKey()) || "{}");
    if (Number(stored.chatInputHeight) > 0) chatInput.style.height = `${stored.chatInputHeight}px`;
  } catch {}
}

function renderIdeEmptyState() {
  document.querySelector("#ideEmptyState").classList.remove("hidden");
  document.querySelector("#ideLayout").classList.add("hidden");
  document.querySelector("#ideProjectTitle").textContent = "";
  document.querySelector("#ideProjectBrowserTitle").textContent = "Projekt";
  document.querySelector("#ideProjectBrowser").innerHTML = "";
  document.querySelector("#ideActiveSourceLabel").textContent = "";
  document.querySelector("#ideProjectMeta").innerHTML = "";
  document.querySelector("#sourceEditor").value = "";
  document.querySelector("#ideImageView").innerHTML = "";
  document.querySelector("#ideModelView").innerHTML = "";
  document.querySelector("#ideProjectViewManifest").innerHTML = "";
  document.querySelector("#ideCodeAssistant").innerHTML = "";
  document.querySelector("#ideProjectInformation").innerHTML = "";
  document.querySelector("#ideActionReason").innerHTML = "";
  state.ideDirtySources = {};
}

function updateIdeProjectTools(project) {
  const hardwareTools = projectNeedsHardwareTools(project);
  renderIdeSoftwareUnitSelection(project);
  const softwareUnit = activeIdeSoftwareUnit(project);
  const flashableUnits = projectSoftwareUnits(project).filter((unit) => unit.build_system === "platformio");
  const sourceEditing = ideSourceIsEditable(project, state.sourcePath);
  document.querySelector("#ideDeviceTools").classList.remove("hidden");
  const allocated = allocatedIdeDevice(project);
  const actionReason = ideActionUnavailableReason(project, allocated);
  const buildButton = document.querySelector("#buildButton");
  const cleanBuildButton = document.querySelector("#cleanBuildButton");
  const usbButton = document.querySelector("#usbFlashButton");
  const otaButton = document.querySelector("#otaFlashButton");
  const flashBoxButton = document.querySelector("#flashBoxFlashButton");
  const flashboxSelect = document.querySelector("#flashboxDeviceSelect");
  const flashboxes = inventoryFlashboxes();
  [usbButton, otaButton, flashBoxButton, document.querySelector("#checkOtaConnectivityButton")]
    .forEach((element) => element?.classList.toggle("hidden", !hardwareTools));
  const otaReason = !allocated
    ? "OTA nicht verfügbar: Kein Device zugeordnet."
    : allocated.connectivity_status !== "online"
      ? `OTA nicht verfügbar: Das Device ist nicht online (${allocated.connectivity_status || "unknown"}).`
      : allocated.ota_status !== "ready"
        ? `OTA nicht verfügbar: Das Device meldet den OTA-Status ${allocated.ota_status || "unknown"}.`
        : "";
  const supportedFlashTarget = !softwareUnit || flashableUnits.length > 0;
  const unsupportedProjectUnits = projectSoftwareUnits(project).filter((unit) => unit.build_system !== "platformio");
  const flashTargetReason = supportedFlashTarget ? "" : "Flash nicht verfügbar: Das Projekt besitzt keine Software-Einheit mit angeschlossenem Firmware-Runner.";
  buildButton.disabled = false;
  cleanBuildButton.disabled = false;
  usbButton.disabled = !supportedFlashTarget;
  otaButton.disabled = !supportedFlashTarget || !allocated || allocated.ota_status !== "ready" || allocated.connectivity_status !== "online";
  flashBoxButton.disabled = !supportedFlashTarget || !flashboxes.length;
  flashboxSelect.classList.toggle("hidden", !flashboxes.length);
  flashboxSelect.disabled = !flashboxes.length;
  buildButton.title = unsupportedProjectUnits.length
    ? `Gesamtbuild nicht möglich: ${unsupportedProjectUnits.length} Software-Einheit${unsupportedProjectUnits.length === 1 ? " besitzt" : "en besitzen"} noch keinen angeschlossenen Runner.`
    : "Baut alle Software-Einheiten des Projekts als gemeinsamen Gesamtbuild.";
  cleanBuildButton.title = "Löscht die inkrementellen Build-Zustände aller Software-Einheiten dieses Projekts.";
  usbButton.title = flashTargetReason || "Direkter USB-Flash verwendet die Projekt-Boardkonfiguration und das angeschlossene USB-Gerät.";
  otaButton.title = flashTargetReason || actionReason || otaReason;
  flashBoxButton.title = flashTargetReason || actionReason || (!flashboxes.length
    ? "Keine FlashBox im Inventar verfügbar."
    : "FlashBox: Der WLAN-zu-USB-Helper flasht das angeschlossene Zielgerät.");
  renderIdeProjectInformation(project);
  document.querySelector("#sourceEditor").readOnly = !sourceEditing;
}

function activeIdeSoftwareUnit(project = projectById(state.activeProjectId)) {
  const units = project?.softwareUnits || [];
  const selectedId = state.activeSoftwareUnitIds[project?.id] || project?.activeSoftwareUnitId;
  return units.find((unit) => unit.software_unit_id === selectedId) || units[0] || null;
}

function projectSoftwareUnits(project = projectById(state.activeProjectId)) {
  return Array.isArray(project?.softwareUnits) ? project.softwareUnits : [];
}

function renderIdeSoftwareUnitSelection(project) {
  const control = document.querySelector("#ideSoftwareUnitControl");
  const select = document.querySelector("#ideSoftwareUnitSelect");
  if (!control || !select) return;
  const units = projectSoftwareUnits(project).filter((unit) => unit.build_system === "platformio");
  control.classList.remove("hidden");
  select.innerHTML = units.map((unit) => `<option value="${escapeAttribute(unit.software_unit_id)}">${escapeHtml(unit.title)} · ${escapeHtml(unit.build_system || "ohne Runner")}</option>`).join("");
  const active = activeIdeSoftwareUnit(project);
  select.value = units.some((unit) => unit.software_unit_id === active?.software_unit_id)
    ? active.software_unit_id
    : units[0]?.software_unit_id || "";
}

function renderIdeProjectInformation(project) {
  const target = document.querySelector("#ideProjectInformation");
  const noticeTarget = document.querySelector("#ideActionReason");
  if (!target || !noticeTarget || !project) return;
  const allocated = allocatedIdeDevice(project);
  const softwareUnit = activeIdeSoftwareUnit(project);
  const buildConfig = softwareUnit?.build_config || project.buildConfig || {};
  const boardConfiguration = buildConfig.board_configuration || {};
  const boardConfigurationLabel = boardConfiguration.name
    ? `${boardConfiguration.name} · ${boardConfiguration.base_board_profile_id || "Profil nicht gesetzt"}`
    : boardConfiguration.base_board_profile_id || "nicht konfiguriert";
  const boardConfigurationSource = {
    catalog: "GerNetiX-Systemboard",
    account: "Account-Board",
    project: "Projekt-Snapshot",
  }[boardConfiguration.source] || boardConfiguration.source || "nicht angegeben";
  const flashFeatureValue = boardConfiguration.board_features?.flash?.value || "";
  const ramFeatureValue = boardConfiguration.board_features?.ram?.value || "";
  const psramFeatureValue = boardConfiguration.board_features?.psram?.value || "";
  const flashLabel = buildConfig.maximum_program_size_bytes
    ? `${buildConfig.maximum_program_size_bytes} Byte nutzbarer Programmspeicher${flashFeatureValue ? ` · ${formatBoardMemoryValue(flashFeatureValue)} physisch` : ""}`
    : buildConfig.flash_size_mb
      ? `${buildConfig.flash_size_mb} MB physischer Board-Flash${buildConfig.partition_profile_id ? ` · Partition ${buildConfig.partition_profile_id}` : ""}`
      : flashFeatureValue ? formatBoardMemoryValue(flashFeatureValue) : "nicht konfiguriert";
  const ramLabel = buildConfig.maximum_ram_size_bytes
    ? `${buildConfig.maximum_ram_size_bytes} Byte SRAM`
    : [ramFeatureValue && `RAM ${formatBoardMemoryValue(ramFeatureValue)}`, psramFeatureValue && `PSRAM ${formatBoardMemoryValue(psramFeatureValue)}`].filter(Boolean).join(" · ") || "Boardstandard";
  const firmwareSource = buildConfig.firmware_basis_id
    ? `Basissoftware ${buildConfig.firmware_basis_id}${buildConfig.firmware_basis_variant ? ` · ${buildConfig.firmware_basis_variant}` : ""}`
    : "Projektquellen direkt (keine Basissoftware)";
  const templateRef = project.viewManifest?.template_ref || {};
  const templateLabel = project.viewManifest?.template_id
    ? `${project.viewManifest.template_id} · Modell v${templateRef.model_schema_version || templateRef.version || "?"}`
    : "kein Template-Verweis";
  const targetSystem = project.targetRuntime || buildConfig.platform || "noch nicht festgelegt";
  const deviceLabel = allocated
    ? `${allocated.display_name || allocated.device_id} · ${allocated.connectivity_status || "Status unbekannt"}`
    : "nicht zugeordnet";
  target.innerHTML = [
    ["Projekt", project.name || project.id],
    ["Projektart", project.type || "Entwicklungsprojekt"],
    ["Software-Einheit", softwareUnit?.title || "Projektstandard"],
    ["Buildsystem", softwareUnit?.build_system || "nicht festgelegt"],
    ["Quellwurzel", softwareUnit?.source_root || "Projektwurzel"],
    ["Zielsystem", targetSystem],
    ["Board-Konfiguration", boardConfigurationLabel],
    ["Board-Quelle", boardConfigurationSource],
    ["Compiler-Plattform", buildConfig.platform || "nicht konfiguriert"],
    ["PlatformIO-Umgebung", buildConfig.environment || "nicht konfiguriert"],
    ["Compiler-Board", buildConfig.board || "nicht konfiguriert"],
    ["Framework", buildConfig.framework || "nicht konfiguriert"],
    ["Flash", flashLabel],
    ["RAM", ramLabel],
    ["Firmwarequelle", firmwareSource],
    ["Template", templateLabel],
    ["Aktive Datei", state.sourcePath || "keine Datei gewaehlt"],
    ["Device", deviceLabel],
  ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const notices = [];
  const healthNotices = ideProjectHealthNotices(project);
  const actionReason = ideActionUnavailableReason(project, allocated);
  if (actionReason) notices.push(actionReason);
  if (softwareUnit && softwareUnit.build_system !== "platformio") notices.push(`Der Build-Runner ${softwareUnit.build_system || "fuer diese Einheit"} ist noch nicht an den Build-Service angeschlossen.`);
  if ((!softwareUnit || softwareUnit.build_system === "platformio") && !Object.keys(buildConfig).length) notices.push("Fuer diese Software-Einheit ist noch kein Build-Profil hinterlegt.");
  if (allocated && allocated.connectivity_status !== "online") notices.push(`Das Device ist nicht online (${allocated.connectivity_status || "unknown"}).`);
  if (allocated && allocated.ota_status !== "ready") notices.push(`OTA ist noch nicht bereit (${allocated.ota_status || "unknown"}).`);
  const items = [
    ...healthNotices,
    ...Array.from(new Set(notices)).map((notice) => ({ level: "warn", text: notice })),
  ];
  noticeTarget.innerHTML = items.length
    ? items.map((notice) => `<li class="${escapeHtml(notice.level || "warn")}">${escapeHtml(notice.text)}</li>`).join("")
    : '<li class="ok">Keine offenen Hinweise fuer dieses Projekt.</li>';
}

function formatBoardMemoryValue(value) {
  return String(value || "")
    .replace(/^(\d+)_mb$/i, "$1 MB")
    .replace(/^(\d+)_kb$/i, "$1 KB")
    .replace(/^(\d+)_bytes?$/i, "$1 Byte");
}

function ideProjectHealthNotices(project) {
  const sources = state.projectSourcesByProjectId[project?.id] || [];
  const dirtyPaths = dirtyIdeSourcePaths(project?.id);
  const modelFiles = sources.filter((source) => isIdeModelSource(source.path));
  const codeFiles = sources.filter((source) => isIdeCodeSource(source.path));
  const latestBuild = latestBuildForProject(project);
  const notices = [];
  notices.push(dirtyPaths.length
    ? { level: "warn", text: `Ungespeicherte Datei${dirtyPaths.length === 1 ? "" : "en"}: ${dirtyPaths.slice(0, 3).join(", ")}${dirtyPaths.length > 3 ? " ..." : ""}.` }
    : { level: "ok", text: "Keine ungespeicherten Dateien." });
  if (modelFiles.length && codeFiles.length) {
    notices.push({ level: "ok", text: "Modell-Dateien und Quellcode-Dateien sind strukturell konsistent vorhanden." });
  } else if (modelFiles.length && !codeFiles.length) {
    notices.push({ level: "warn", text: "Inkonsistent: Modell-Dateien vorhanden, aber keine Quellcode-Dateien im Projektbaum." });
  } else if (!modelFiles.length && codeFiles.length) {
    notices.push({ level: "warn", text: "Inkonsistent: Quellcode-Dateien vorhanden, aber keine Modell-Dateien im Projektbaum." });
  } else {
    notices.push({ level: "warn", text: "Inkonsistent: Es wurden noch keine Modell- oder Quellcode-Dateien erkannt." });
  }
  if (!projectNeedsSourceEditing(project)) return notices;
  if (!latestBuild) {
    notices.push({ level: "warn", text: "Build ist noch nicht erstellt." });
  } else if (dirtyPaths.length) {
    notices.push({ level: "warn", text: "Build ist nicht aktuell, weil Dateien ungespeichert sind." });
  } else if (latestBuild.status !== "succeeded") {
    notices.push({ level: "warn", text: `Letzter Build ist nicht erfolgreich (${latestBuild.status || "unknown"}).` });
  } else {
    notices.push({ level: "ok", text: "Letzter Build ist erfolgreich und zu den gespeicherten Dateien passend." });
  }
  return notices;
}

function isIdeModelSource(pathValue) {
  const path = String(pathValue || "").toLowerCase();
  return /(^|\/)(architektur|modell|model|models)(\/|$)/.test(path)
    || /\.(puml|plantuml|uml|drawio)$/i.test(path);
}

function isIdeCodeSource(pathValue) {
  const path = String(pathValue || "").toLowerCase();
  return /(^|\/)(src|source|code|quellcode|verhalten\/code)(\/|$)/.test(path)
    || /\.(c|cc|cpp|cxx|h|hpp|ino|js|ts|py)$/i.test(path);
}

function latestBuildForProject(project) {
  const ids = new Set([project?.id, project?.slug, project?.name].filter(Boolean).map(String));
  return state.builds.find((build) => ids.has(String(build.project_id || build.projectId || build.project_slug || build.project_title || ""))) || null;
}

function dirtyIdeSourcePaths(projectId) {
  const prefix = `${projectId || ""}::`;
  return Object.keys(state.ideDirtySources)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length))
    .sort((left, right) => left.localeCompare(right));
}

function markIdeSourceDirty() {
  const project = projectById(state.activeProjectId);
  if (!project || !state.sourcePath || state.ideViewMode !== "file") return;
  state.ideDirtySources[ideDirtyKey(project.id, state.sourcePath)] = true;
  renderIdeProjectInformation(project);
}

function clearIdeSourceDirty(projectId, sourcePath) {
  delete state.ideDirtySources[ideDirtyKey(projectId, sourcePath)];
}

function ideDirtyKey(projectId, sourcePath) {
  return `${projectId || ""}::${sourcePath || ""}`;
}

function setIdeConsoleView(view) {
  const showProjectInformation = view === "project-information";
  const showBuildResults = view === "build-results";
  const showHints = view === "hints";
  const workspace = document.querySelector("#ideConsoleWorkspace");
  const terminalButton = document.querySelector("#showIdeTerminalButton");
  const informationButton = document.querySelector("#showIdeProjectInformationButton");
  const buildResultsButton = document.querySelector("#showIdeBuildResultsButton");
  const hintsButton = document.querySelector("#showIdeProjectHintsButton");
  workspace.classList.toggle("show-project-information", showProjectInformation);
  workspace.classList.toggle("show-build-results", showBuildResults);
  workspace.classList.toggle("show-hints", showHints);
  terminalButton.classList.toggle("active", !showProjectInformation && !showBuildResults && !showHints);
  terminalButton.setAttribute("aria-selected", String(!showProjectInformation && !showBuildResults && !showHints));
  informationButton.classList.toggle("active", showProjectInformation);
  informationButton.setAttribute("aria-selected", String(showProjectInformation));
  buildResultsButton.classList.toggle("active", showBuildResults);
  buildResultsButton.setAttribute("aria-selected", String(showBuildResults));
  hintsButton.classList.toggle("active", showHints);
  hintsButton.setAttribute("aria-selected", String(showHints));
  if (showBuildResults) renderBuilds();
}

function initializeIdeWorkspaceResize() {
  const handle = document.querySelector("#ideWorkspaceResizeHandle");
  if (!handle) return;
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const consolePanel = document.querySelector("#ideBuildConsole");
    if (!consolePanel) return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = consolePanel.getBoundingClientRect().height;
    handle.classList.add("active");
    handle.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      setIdeConsoleHeight(startHeight - (moveEvent.clientY - startY));
    };
    const stop = () => {
      handle.classList.remove("active");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  });
  handle.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") {
      resetIdeConsoleHeight();
      return;
    }
    const currentHeight = document.querySelector("#ideBuildConsole")?.getBoundingClientRect().height || 260;
    setIdeConsoleHeight(currentHeight + (event.key === "ArrowUp" ? 24 : -24));
  });
  handle.addEventListener("dblclick", resetIdeConsoleHeight);
}

function setIdeConsoleHeight(requestedHeight) {
  const handle = document.querySelector("#ideWorkspaceResizeHandle");
  const workbench = handle?.closest(".ide-workbench");
  if (!handle || !workbench) return;
  const minimum = 140;
  const maximum = Math.max(minimum, workbench.getBoundingClientRect().height - 180);
  const height = Math.round(Math.min(maximum, Math.max(minimum, requestedHeight)));
  workbench.style.setProperty("--ide-console-height", `${height}px`);
  handle.setAttribute("aria-valuenow", String(height));
  handle.setAttribute("aria-valuemax", String(Math.round(maximum)));
}

function resetIdeConsoleHeight() {
  const handle = document.querySelector("#ideWorkspaceResizeHandle");
  const workbench = handle?.closest(".ide-workbench");
  workbench?.style.removeProperty("--ide-console-height");
  handle?.removeAttribute("aria-valuenow");
  handle?.removeAttribute("aria-valuemax");
}

function ideActionUnavailableReason(project, allocated) {
  if (!projectNeedsHardwareTools(project)) return "";
  if (!allocated) {
    const compatible = state.devices.filter((device) => deviceCompatibleWithProject(project, device));
    return compatible.length
      ? "Für OTA: Ordne der IoT-Device-Komponente ein Inventar-Device zu. Build und direkter USB-Flash funktionieren auch ohne diese Zuordnung."
      : "Für OTA ist kein kompatibles Board im Inventar. Build und direkter USB-Flash verwenden die Projekt-Boardkonfiguration.";
  }
  return "";
}

function renderIdeDeviceAllocation(project) {
  document.querySelector("#ideDeviceAllocation").dataset.visible = String(projectNeedsHardwareTools(project));
}

function deviceCompatibleWithProject(project, device) {
  const projectPlatform = String(activeIdeSoftwareUnit(project)?.build_config?.platform || project?.buildConfig?.platform || "").toLowerCase();
  const devicePlatform = String(device?.build_config?.platform || "").toLowerCase();
  if (projectPlatform && devicePlatform) return projectPlatform === devicePlatform;
  return String(project?.targetRuntime || "").toLowerCase().includes("esp")
    && String(device?.hardware_profile_id || "").toLowerCase().includes("esp");
}

function componentDeviceAllocations(project) {
  const buildConfig = activeIdeSoftwareUnit(project)?.build_config || project?.buildConfig;
  const configured = Array.isArray(buildConfig?.component_device_allocations)
    ? buildConfig.component_device_allocations
    : [];
  if (configured.length) return configured;
  const primary = primaryComponentPath(project);
  return project?.linkedDeviceId && primary ? [{ component_path: primary, device_id: project.linkedDeviceId }] : [];
}

function allocatedIdeDevice(project = projectById(state.activeProjectId), componentPath = primaryComponentPath(project)) {
  const unitDeviceId = activeIdeSoftwareUnit(project)?.device_id;
  if (unitDeviceId) return state.devices.find((device) => device.device_id === unitDeviceId) || null;
  const allocation = componentDeviceAllocations(project).find((item) => item.component_path === componentPath);
  if (!allocation?.device_id) return null;
  return state.devices.find((device) => device.device_id === allocation.device_id) || null;
}

function projectNeedsHardwareTools(project) {
  const capabilities = projectCapabilityIds(project);
  const softwareUnit = activeIdeSoftwareUnit(project);
  if (softwareUnit) return softwareUnit.build_system === "platformio";
  return Boolean(project?.buildConfig)
    || capabilities.some((capability) => ["flash_firmware", "ota", "ide_flash_usb", "ide_flash_ota", "cloud_flash"].includes(capability));
}

function projectNeedsSourceEditing(project) {
  if (project?.type === "development_project" || project?.type === "custom_project") return true;
  return Boolean(project?.buildConfig)
    || guidedViews(project).some((view) => Array.isArray(view.editable_lines) && view.editable_lines.length > 0);
}

function projectShowsSource(project) {
  return project?.viewManifest?.hide_source_editor !== true;
}

function projectCapabilityIds(project) {
  return (project?.requiredCapabilityIds || [])
    .map((capability) => String(capability).replace(/^system_capability\./, "").replace(/^capability\./, ""))
    .filter(Boolean);
}

async function loadProjectSources(project) {
  if (!project) return [];
  if (!state.projectSourcesByProjectId[project.id]) {
    const response = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources`);
    state.projectSourcesByProjectId[project.id] = (response.items || []).sort((left, right) => left.path.localeCompare(right.path));
  }
  return state.projectSourcesByProjectId[project.id];
}

function selectedIdeSourcePath(project, sources) {
  const current = state.sourcePath;
  if (current && sources.some((source) => source.path === current)) return current;
  const primary = primarySourcePath(project);
  if (primary && sources.some((source) => source.path === primary)) return primary;
  return sources[0]?.path || primary || "src/main.cpp";
}

function renderIdeProjectBrowser(project, sources) {
  const target = document.querySelector("#ideProjectBrowser");
  if (!target) return;
  const openFolders = new Set(Array.from(target.querySelectorAll("details[data-tree-path][open]"))
    .map((folder) => folder.dataset.treePath));
  const treeSources = projectBrowserSources(project, sources).concat(projectVirtualTreeEntries(project));
  target.innerHTML = treeSources.length
    ? renderSourceTree(sourceTree(project.name, treeSources), 0, openFolders)
    : `<p class="empty">Keine Projektdateien.</p>`;
}

function projectBrowserSources(project, sources) {
  const hardwareMappings = projectHardwareComponents(project)
    .filter((component) => component.abstract_type === "iot_device" && component.component_path)
    .map((component) => ({
      sourcePrefix: String(component.component_path).replace(/\/$/, ""),
      treePrefix: `Komponenten/${componentTreeLabel(component)}`,
    }))
    .sort((left, right) => right.sourcePrefix.length - left.sourcePrefix.length);
  const primaryPath = primaryComponentPath(project);
  const mappings = hardwareMappings.length || !projectNeedsHardwareTools(project) || !primaryPath
    ? hardwareMappings
    : [{ sourcePrefix: String(primaryPath).replace(/\/$/, ""), treePrefix: `Komponenten/${String(primaryPath).split("/").at(-1) || "IoT-Device"}` }];
  const primaryMapping = mappings.find((mapping) => mapping.sourcePrefix === String(primaryPath || "").replace(/\/$/, "")) || mappings[0];
  const mappedSources = !mappings.length ? sources : sources.map((source) => {
    const mapping = mappings.find((item) => source.path === item.sourcePrefix || source.path.startsWith(`${item.sourcePrefix}/`));
    if (!mapping) {
      const rootSource = String(source.path || "").match(/^(?:src|source)\/(.+)$/i);
      return rootSource && primaryMapping
        ? { ...source, treePath: `${primaryMapping.treePrefix}/Source/${rootSource[1]}` }
        : source;
    }
    let relativePath = source.path.slice(mapping.sourcePrefix.length).replace(/^\//, "");
    relativePath = relativePath.replace(/^(?:src|source)(?=\/|$)/i, "Source");
    if (/^Konfiguration\//.test(relativePath) && !/^Konfiguration\/(Hardware|Software)\//.test(relativePath)) {
      relativePath = relativePath.replace(/^Konfiguration\//, "Konfiguration/Hardware/");
    }
    return { ...source, treePath: [mapping.treePrefix, relativePath].filter(Boolean).join("/") };
  });
  const hiddenGeneratedRoles = new Set([
    "component_data",
    "component_relations",
    "device_board_config",
    "device_measurement_circuit_config",
    "device_sensor_input_config",
    "device_actuator_output_config",
  ]);
  return mappedSources.filter((source) => !hiddenGeneratedRoles.has(source.role)
    && !(source.role === "component_software_config" && mappings.some((mapping) => String(source.treePath || "").startsWith(`${mapping.treePrefix}/`)))
    && !/\/Konfiguration\/Hardware\/(Sensoren\/in|Aktoren\/out)\.md$/i.test(String(source.treePath || source.path || "")));
}

function projectVirtualTreeEntries(project) {
  const entries = [];
  const configurationDevices = ideDeviceConfigurationComponents(project);
  const primaryPath = primaryComponentPath(project);
  const primaryDevice = configurationDevices.find((component) => component.component_path === primaryPath) || configurationDevices[0];
  if (projectNeedsHardwareTools(project) && primaryDevice) {
    const component = `Komponenten/${componentTreeLabel(primaryDevice)}`;
    entries.push(
      { path: `${component}/Konfiguration/Funktionen`, role: "", virtualAction: "component-features" },
      { path: `${component}/Konfiguration/Treiber`, role: "", virtualAction: "driver-management" },
      { path: `${component}/Konfiguration/Weboberfläche`, role: "", virtualAction: "web-interface" },
    );
  }
  configurationDevices.forEach((component) => {
    const label = componentTreeLabel(component);
    if (component.abstract_type === "iot_device") {
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Board`,
        role: "",
        virtualAction: "board-properties",
        componentId: component.component_id,
      });
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Boardexterne Anschlüsse`,
        role: "",
        virtualAction: "device-connections",
        componentId: component.component_id,
      });
      return;
    }
    if (["event_worker", "event_dispatcher"].includes(component.abstract_type)
      || /ereignis-(?:worker|dispatcher)/i.test(String(component.label || ""))) {
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Software/Regel-Konfiguration`,
        role: "",
        virtualAction: "worker-dispatcher-configuration",
        componentType: /dispatcher/i.test(String(component.label || "")) ? "dispatcher" : "worker",
      });
      return;
    }
    const configurationPath = ["sensor", "actuator", "iot_device"].includes(component.abstract_type)
      ? "Konfiguration/Hardware/Eigenschaften"
      : "Konfiguration/Eigenschaften";
    entries.push({
      path: `Komponenten/${label}/${configurationPath}`,
      role: "",
      virtualAction: component.abstract_type === "sensor" ? "sensor-properties" : "hardware-configuration",
      componentId: component.component_id,
    });
  });
  if (isPwaDashboardProject(project)) {
    entries.push({
      path: "Komponenten/Smartphone-App (PWA)/Konfiguration/PWA-Dashboard",
      role: "",
      virtualAction: "pwa-dashboard",
    });
  }
  return entries;
}

function ideDeviceConfigurationComponents(project) {
  const devices = projectHardwareComponents(project).filter((component) => component.abstract_type === "iot_device");
  if (devices.length || !projectNeedsHardwareTools(project)) return devices;
  const componentPath = primaryComponentPath(project) || "Komponenten/IoT-Device 1";
  return [{
    component_id: "primary-iot-device",
    component_path: componentPath,
    label: String(componentPath).split("/").at(-1) || "IoT-Device",
    abstract_type: "iot_device",
    board_profile_id: project?.buildConfig?.board_configuration?.base_board_profile_id
      || project?.hardwareProfileId
      || project?.hardware_profile_id
      || "",
    board_configuration: project?.buildConfig?.board_configuration || null,
  }];
}

function isPwaDashboardProject(project) {
  return project?.viewManifest?.template_id === "iot_datalogger_web_push_pwa";
}

function componentTreeLabel(component) {
  return String(component?.label || component?.component_id || "Komponente").replace(/[\\/]+/g, "-");
}

function projectHardwareComponents(project) {
  const view = (project?.viewManifest?.views || []).find((item) => item.id === "hardware-configuration");
  const supportedTypes = new Set(["iot_device", "sensor", "actuator", "actor", "structural"]);
  return Array.isArray(view?.payload?.components)
    ? view.payload.components.filter((component) => supportedTypes.has(component.abstract_type))
    : [];
}

function projectHardwareConfiguration(project) {
  const view = (project?.viewManifest?.views || []).find((item) => item.id === "hardware-configuration");
  return view?.payload && typeof view.payload === "object"
    ? structuredClone(view.payload)
    : { schema_version: 5, components: [], updated_at: "" };
}

function isArchitectureBaselinePath(sourcePath) {
  const path = String(sourcePath || "").replace(/\\/g, "/");
  return path.startsWith("Architektur/") || path === "docs/architecture.puml";
}

function ideSourceIsEditable(project, sourcePath) {
  return projectNeedsSourceEditing(project)
    && !isArchitectureBaselinePath(sourcePath)
    && String(sourcePath || "").replace(/\\/g, "/") !== "platformio.ini";
}

function sourceTree(projectName, sources) {
  const root = { name: projectName || "Projekt", path: "", folders: new Map(), files: [] };
  for (const source of sources) {
    const parts = String(source.treePath || source.path || "").split("/").filter(Boolean);
    let cursor = root;
    for (const part of parts.slice(0, -1)) {
      if (!cursor.folders.has(part)) {
        cursor.folders.set(part, {
          name: part,
          path: [cursor.path, part].filter(Boolean).join("/"),
          folders: new Map(),
          files: [],
        });
      }
      cursor = cursor.folders.get(part);
    }
    cursor.files.push({ ...source, name: parts.at(-1) || source.path });
  }
  return root;
}

function renderSourceTree(node, depth = 0, openFolders = new Set()) {
  const folders = Array.from(node.folders.values()).sort((left, right) => left.name.localeCompare(right.name));
  const files = node.files.sort((left, right) => left.name.localeCompare(right.name));
  const children = [
    ...folders.map((folder) => renderSourceTree(folder, depth + 1, openFolders)),
    ...files.map((file) => `
      <button class="${file.path === state.sourcePath ? "active" : ""}" type="button" ${file.virtualAction === "component-features"
          ? "data-component-features"
          : file.virtualAction === "driver-management"
            ? "data-driver-management"
          : file.virtualAction === "sensor-properties"
            ? `data-sensor-properties="${escapeAttribute(file.componentId || "")}"`
          : file.virtualAction === "device-connections"
            ? `data-device-connections="${escapeAttribute(file.componentId || "")}"`
          : file.virtualAction === "web-interface"
            ? "data-web-interface"
            : file.virtualAction === "pwa-dashboard"
              ? "data-pwa-dashboard"
            : file.virtualAction === "board-properties"
              ? `data-board-properties="${escapeAttribute(file.componentId || "")}"`
          : file.virtualAction === "hardware-configuration"
              ? "data-hardware-configuration"
            : file.virtualAction === "worker-dispatcher-configuration"
              ? `data-worker-dispatcher-configuration="${escapeAttribute(file.componentType || "worker")}"`
            : `data-source-path="${escapeAttribute(file.path)}"`} style="--depth:${depth + 1}">
        <span>${escapeHtml(file.name)}</span>
      </button>
    `),
  ].join("");
  if (depth === 0) {
    return `
      <div class="ide-tree-root">
        <strong>${escapeHtml(node.name)}</strong>
        ${children}
      </div>
    `;
  }
  const containsActiveSource = treeContainsSource(node, state.sourcePath);
  return `
    <details class="ide-tree-folder" data-tree-path="${escapeAttribute(node.path)}" style="--depth:${depth}" ${openFolders.has(node.path) || containsActiveSource ? "open" : ""}>
      <summary>${escapeHtml(node.name)}</summary>
      ${children}
    </details>
  `;
}

function treeContainsSource(node, sourcePath) {
  if (node.files.some((file) => file.path === sourcePath)) return true;
  return Array.from(node.folders.values()).some((folder) => treeContainsSource(folder, sourcePath));
}

function openComponentFeatures() {
  state.ideViewMode = "component-features";
  const project = projectById(state.activeProjectId);
  document.querySelector("#ideActiveSourceLabel").textContent = `${primaryComponentPath(project)}/Konfiguration/Funktionen`;
  renderComponentFeatures(project);
  renderIdeViewMode(project);
}

function openWorkerDispatcherConfiguration(kind) {
  return renderEventConfiguration(kind);
  state.ideViewMode = "component-features";
  const target = document.querySelector("#ideComponentFeaturesView");
  const dispatcher = kind === "dispatcher";
  document.querySelector("#ideActiveSourceLabel").textContent = dispatcher ? "Ereignis-Dispatcher · Konfiguration" : "Ereignis-Worker · Konfiguration";
  target.innerHTML = dispatcher
    ? `<form class="component-features-form"><header><p class="eyebrow">Ereignis-Dispatcher</p><h3>Zustellung konfigurieren</h3></header><label>Bedingung<select><option>Folgeereignis liegt vor</option><option>Statuswert erfüllt Bedingung</option></select></label><label>Zielgeräte<input placeholder="z. B. IoT-Zielgerät(e)"></label><label><input type="checkbox"> Projekt-PWA per Push benachrichtigen</label></form>`
    : `<form class="component-features-form"><header><p class="eyebrow">Background Worker</p><h3>Auslöser konfigurieren</h3></header><label>Ereignisname<input placeholder="z. B. tägliche Auswertung"></label><label>Auslöser<select><option>Timer</option><option>Projekt-Ereignis</option></select></label><label>Zyklus<input placeholder="z. B. alle 15 Minuten"></label></form>`;
  renderIdeViewMode(projectById(state.activeProjectId));
}

function renderEventConfiguration(kind) {
  state.ideViewMode = "component-features";
  const project = projectById(state.activeProjectId);
  const target = document.querySelector("#ideComponentFeaturesView");
  const dispatcher = kind === "dispatcher";
  const configuration = project?.viewManifest?.event_configuration?.[kind] || {};
  const targetDevices = projectHardwareComponents(project).filter((component) => component.abstract_type === "iot_device" && /ziel|target/i.test(`${component.label || ""} ${component.component_path || ""}`));
  document.querySelector("#ideActiveSourceLabel").textContent = dispatcher ? "Ereignis-Dispatcher · Konfiguration" : "Ereignis-Worker · Konfiguration";
  target.innerHTML = dispatcher
    ? `<form class="component-features-form" data-event-configuration-form data-event-configuration-kind="dispatcher">
        <header><p class="eyebrow">Ereignis-Dispatcher</p><h3>Zustellung konfigurieren</h3></header>
        <p class="helper-text">Der Dispatcher stellt nur ein vom Worker freigegebenes Folgeereignis zu. Er verarbeitet keine Gerätedaten.</p>
        <label>Bedingung<select name="condition_type"><option value="event_available" ${configuration.condition_type !== "field_equals" ? "selected" : ""}>Folgeereignis liegt vor</option><option value="field_equals" ${configuration.condition_type === "field_equals" ? "selected" : ""}>Ereigniswert erfüllt Bedingung</option></select></label>
        <label>Ereigniswert (optional)<input name="condition_value" maxlength="120" value="${escapeAttribute(configuration.condition_value || "")}" placeholder="z. B. alarm"></label>
        <label>Zielgerät<select name="target_component_id"><option value="">Zielgerät auswählen</option>${targetDevices.map((component) => `<option value="${escapeAttribute(component.component_id || "")}" ${configuration.target_component_id === component.component_id ? "selected" : ""}>${escapeHtml(componentTreeLabel(component))}</option>`).join("")}</select></label>
        <label class="event-configuration-checkbox"><input type="checkbox" name="push_enabled" ${configuration.push_enabled ? "checked" : ""}> Projekt-PWA per Push benachrichtigen</label>
        <footer><span class="form-status" data-event-configuration-status></span><button type="submit">Konfiguration speichern</button></footer>
      </form>`
    : `<form class="component-features-form" data-event-configuration-form data-event-configuration-kind="worker">
        <header><p class="eyebrow">Ereignis-Worker</p><h3>Auslöser konfigurieren</h3></header>
        <p class="helper-text">Der Worker erhält zeitlich begrenzten Projektzugriff. Die Ausführung selbst wird später durch eine freigegebene Regel ergänzt.</p>
        <details class="worker-rule-help"><summary>Hilfe zur Regelsprache</summary>
          <p>Ein Regelausdruck ergibt immer <code>true</code> oder <code>false</code>. Er entscheidet nur, ob ein Folgeereignis freigegeben wird. Zeitplan, Datenzugriff und Aktion werden außerhalb der Regel konfiguriert.</p>
          <table><thead><tr><th>Gültige Werte</th><th>Bedeutung</th></tr></thead><tbody>
            <tr><td><code>event.type</code></td><td>Name des eingegangenen Ereignisses</td></tr>
            <tr><td><code>event.value</code></td><td>Mitgelieferter Text- oder Zahlenwert</td></tr>
            <tr><td><code>state.&lt;name&gt;</code></td><td>Nur ein im Projektmodell ausdrücklich deklarierter Zustandswert</td></tr>
          </tbody></table>
          <p><strong>Erlaubte Operatoren:</strong> <code>==</code>, <code>!=</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code>, <code>&amp;&amp;</code>, <code>||</code> und <code>!</code>.</p>
          <p><strong>Beispiele:</strong></p>
          <pre><code>event.type == "taste_gedrueckt"
event.type == "timer_tick" &amp;&amp; state.hunger &gt;= 80
event.type == "taste_gedrueckt" || event.type == "notruf"</code></pre>
          <p>Schleifen, eigene Funktionen, Netzwerk-, Datei- und beliebige Speicherzugriffe sind nicht erlaubt.</p>
        </details>
        <label>Ereignisname<input name="event_name" maxlength="80" required value="${escapeAttribute(configuration.event_name || "")}" placeholder="z. B. tägliche Auswertung"></label>
        <label>Auslöser<select name="trigger_type"><option value="timer" ${configuration.trigger_type !== "project_event" ? "selected" : ""}>Timer</option><option value="project_event" ${configuration.trigger_type === "project_event" ? "selected" : ""}>Projekt-Ereignis</option></select></label>
        <label>Timer-Zyklus in Minuten<input name="cycle_minutes" type="number" min="1" max="10080" value="${escapeAttribute(configuration.cycle_minutes || 15)}"></label>
        <footer><span class="form-status" data-event-configuration-status></span><button type="submit">Konfiguration speichern</button></footer>
      </form>`;
  renderIdeViewMode(project);
}

async function saveEventConfiguration(event) {
  event.preventDefault();
  const form = event.target;
  const project = projectById(state.activeProjectId);
  const status = form.querySelector("[data-event-configuration-status]");
  const data = new FormData(form);
  if (!project) return;
  status.textContent = "Wird gespeichert...";
  try {
    const response = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/event-configuration`, {
      kind: form.dataset.eventConfigurationKind,
      event_name: data.get("event_name"),
      trigger_type: data.get("trigger_type"),
      cycle_minutes: data.get("cycle_minutes"),
      condition_type: data.get("condition_type"),
      condition_value: data.get("condition_value"),
      target_component_id: data.get("target_component_id"),
      push_enabled: data.get("push_enabled") === "on",
    });
    state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
    renderEventConfiguration(form.dataset.eventConfigurationKind);
    document.querySelector("[data-event-configuration-status]").textContent = "Gespeichert.";
  } catch (error) {
    status.textContent = error.message || "Die Konfiguration konnte nicht gespeichert werden.";
  }
}

async function openDriverManagement() {
  state.ideViewMode = "driver-management";
  const project = projectById(state.activeProjectId);
  document.querySelector("#ideActiveSourceLabel").textContent = `${primaryComponentPath(project)}/Konfiguration/Treiber`;
  await loadProcessorBoardCatalog();
  renderDriverManagement(project);
  document.querySelector("#ideCodeAssistant").classList.remove("hidden");
  renderIdeCodeAssistant(project);
  renderIdeViewMode(project);
}

function projectDriverSources(project) {
  const sources = state.projectSourcesByProjectId[project?.id] || [];
  return sources.filter((source) => /(^|\/)(treiber|drivers?)(\/|$)/i.test(String(source.path || "")));
}

function availableManagedDrivers(project) {
  const boardIds = new Set(projectHardwareComponents(project)
    .filter((component) => component.abstract_type === "iot_device")
    .map((component) => String(component.board_profile_id || ""))
    .filter(Boolean));
  const boards = state.processorBoards.filter((board) => !boardIds.size || [board.hardware_item_id, board.hardware_profile_id, board.id]
    .filter(Boolean).some((id) => boardIds.has(String(id))));
  const drivers = boards.flatMap((board) => Array.isArray(board.peripheral_profile?.drivers) ? board.peripheral_profile.drivers : []);
  return Array.from(new Map(drivers.map((driver) => [driver.id, driver])).values());
}

function driverSourceOrigin(source) {
  if (source.role === "ai_generated_driver") return { className: "ai", label: "KI abgeleitet" };
  if (source.role === "managed_driver") return { className: "managed", label: "Verwaltet" };
  return { className: "", label: "Projekt" };
}

function ideMotorDriverOptions(concreteType) {
  return ({
    dc_motor: [
      { id: "h_bridge", label: "H-Brücke", resources: "PWM + Richtungspins" },
      { id: "low_side_mosfet", label: "MOSFET-Treiber", resources: "PWM + Freigabepin" },
    ],
    servo: [{ id: "servo_pwm", label: "Servo-PWM-Treiber", resources: "PWM-Ausgang" }],
    stepper_motor: [
      { id: "step_dir", label: "STEP/DIR-Treiber", resources: "STEP + DIR" },
      { id: "four_phase", label: "4-Phasen-Treiber", resources: "vier Digitalausgänge" },
    ],
    synchronous_motor: [
      { id: "three_phase_foc", label: "3-Phasen-Treiber mit FOC", resources: "PWM U/V/W + ADC" },
      { id: "three_phase_six_step", label: "3-Phasen-Treiber mit 6-Step", resources: "PWM U/V/W" },
    ],
  })[concreteType] || [];
}

function ideBoardForDevice(device) {
  const configuration = device?.board_configuration || {};
  const selectionId = configuration.account_board_id
    ? `account_board:${configuration.account_board_id}:v${configuration.account_board_version}`
    : device?.board_profile_id || configuration.base_board_profile_id || "";
  return state.processorBoards.find((board) => [board.hardware_item_id, board.hardware_profile_id, board.id]
    .filter(Boolean).some((id) => String(id) === String(selectionId))) || null;
}

function idePinIdentity(pin) {
  const match = String(pin ?? "").toUpperCase().match(/(?:GPIO|D|A)?\s*(-?\d+)/);
  return match ? match[1] : String(pin ?? "").toUpperCase().replace(/\s+/g, "");
}

function ideConfiguredBoardPins(device) {
  const features = device?.board_configuration?.board_features || {};
  return new Set(Object.values(features).flatMap((feature) => Object.values(feature?.pins || {})).map(idePinIdentity));
}

function ideDriverPins(board, kind, device, currentPins = []) {
  const profile = board?.pin_profile || {};
  const pins = kind === "analog" ? profile.analog_inputs : kind === "pwm" ? profile.pwm_pins : profile.digital_pins;
  const occupied = ideConfiguredBoardPins(device);
  const retained = new Set(currentPins.filter(Boolean).map(idePinIdentity));
  return (Array.isArray(pins) ? pins : []).filter((pin) => !occupied.has(idePinIdentity(pin)) || retained.has(idePinIdentity(pin)));
}

function ideDriverPinSelect(name, label, pins, current, required = true) {
  return `<label>${escapeHtml(label)}<select name="${escapeAttribute(name)}" ${required ? "required" : ""}><option value="">${required ? "Pin wählen" : "Nicht verwendet"}</option>${pins.map((pin) => `<option value="${escapeAttribute(pin)}" ${String(pin) === String(current || "") ? "selected" : ""}>${escapeHtml(pin)}</option>`).join("")}</select></label>`;
}

function renderMotorDriverAssignments(project) {
  const components = projectHardwareComponents(project);
  const devices = components.filter((component) => component.abstract_type === "iot_device");
  const motors = components.filter((component) => component.abstract_type === "actuator" && ideMotorDriverOptions(component.concrete_type).length);
  if (!motors.length) return '<p class="driver-empty-state">Dieses Projekt enthält noch keinen Motor-Aktor. Die Treiberkonfiguration erscheint, sobald ein Motor einem IoT-Device zugeordnet ist.</p>';
  return `<div class="motor-driver-assignment-list">${motors.map((motor) => {
    const device = devices.find((item) => item.component_id === motor.target_device_id) || devices[0];
    const board = ideBoardForDevice(device);
    const currentPins = [motor.pin, motor.secondary_pin, motor.properties?.phase_v_pin, motor.properties?.phase_w_pin, motor.properties?.current_sense_pin];
    const pwmPins = ideDriverPins(board, "pwm", device, currentPins);
    const digitalPins = ideDriverPins(board, "digital", device, currentPins);
    const analogPins = ideDriverPins(board, "analog", device, currentPins);
    const options = ideMotorDriverOptions(motor.concrete_type);
    const properties = motor.properties || {};
    const selectedDriver = options.find((item) => item.id === properties.motor_driver_type);
    return `<form class="motor-driver-assignment" data-motor-driver-component="${escapeAttribute(motor.component_id)}">
      <header><div><p class="eyebrow">${escapeHtml(motor.label)}</p><h4>${escapeHtml(motor.concrete_type)}</h4></div><span>${escapeHtml(device?.label || "Kein IoT-Device")}</span></header>
      <p class="helper-text">Boardquelle: <strong>${escapeHtml(board?.title || "Noch keine Boardkonfiguration")}</strong>. Die Treiberkonfiguration verwendet nur Pins und Ressourcen dieses Projektsnapshots.</p>
      <div class="motor-driver-fields">
        <label>Motorsteuerung<select name="motor_driver_type" required><option value="">Treiber wählen</option>${options.map((item) => `<option value="${escapeAttribute(item.id)}" ${item.id === properties.motor_driver_type ? "selected" : ""}>${escapeHtml(item.label)} · ${escapeHtml(item.resources)}</option>`).join("")}</select></label>
        ${ideDriverPinSelect("pin", motor.concrete_type === "stepper_motor" ? "STEP-Pin" : motor.concrete_type === "synchronous_motor" ? "PWM Phase U" : "PWM-Pin", pwmPins, motor.pin)}
        ${["dc_motor", "stepper_motor"].includes(motor.concrete_type) ? ideDriverPinSelect("secondary_pin", "Richtungs-/DIR-Pin", digitalPins, motor.secondary_pin) : ""}
        ${motor.concrete_type === "synchronous_motor" ? `${ideDriverPinSelect("phase_v_pin", "PWM Phase V", pwmPins, properties.phase_v_pin)}${ideDriverPinSelect("phase_w_pin", "PWM Phase W", pwmPins, properties.phase_w_pin)}${ideDriverPinSelect("current_sense_pin", "Strommessung", analogPins, properties.current_sense_pin, false)}` : ""}
        <label>Nennspannung<input name="nominal_voltage_v" type="number" min="1" step="0.1" value="${escapeAttribute(properties.nominal_voltage_v || 5)}"></label>
        <label>Maximalstrom<input name="max_current_a" type="number" min="0.01" step="0.01" value="${escapeAttribute(properties.max_current_a || 0.5)}"></label>
      </div>
      <footer><button type="submit" ${board && pwmPins.length ? "" : "disabled"}>Treiberkonfiguration speichern</button><span data-motor-driver-status>${selectedDriver ? escapeHtml(selectedDriver.resources) : ""}</span></footer>
    </form>`;
  }).join("")}</div>`;
}

function renderDriverManagement(project) {
  const target = document.querySelector("#ideDriverManagementView");
  if (!target || !project) return;
  const managedDrivers = availableManagedDrivers(project);
  const projectDrivers = projectDriverSources(project);
  target.innerHTML = `<div class="driver-management-workspace">
    <header><div><p class="eyebrow">Software · Wiederverwendung</p><h3>Treiberverwaltung</h3></div><span class="driver-origin-badge combined">Bibliothek + KI</span></header>
    <p class="helper-text">Die Boardkonfiguration beschreibt verfügbare Ressourcen. Hier wird der konkrete Treiber ausgewählt und belegt diese Ressourcen spezieller, beispielsweise PWM-, Richtungs- oder Phasenpins für einen Motor.</p>
    <section class="motor-driver-configuration"><header><div><p class="eyebrow">Projektkonfiguration</p><h4>Motor- und Gerätetreiber</h4></div><span>nutzt Boardkonfiguration</span></header>${renderMotorDriverAssignments(project)}</section>
    <section class="driver-workflow-grid">
      <article class="driver-workflow-card managed"><span class="driver-origin-badge managed">Verwaltet</span><h4>Treiber gezielt auswählen</h4><p>Geeignet, wenn der passende Treiber bekannt ist. Abhängigkeiten und unterstützte Boardfunktionen stammen aus dem Hardware Catalog.</p></article>
      <article class="driver-workflow-card ai"><span class="driver-origin-badge ai">KI erkannt</span><h4>Aus einer Funktion ableiten</h4><p>Geeignet, wenn zuerst das gewünschte Verhalten beschrieben oder implementiert wird. Die KI erkennt die wiederverwendbare Treibergrenze und schlägt die Auslagerung vor.</p><button type="button" data-driver-ai-prompt>Aktuelle Funktion mit KI prüfen</button></article>
    </section>
    <section class="driver-management-columns">
      <div class="driver-library-panel"><header><div><h4>Wiederverwendbare Treiber</h4><small>Hardware Catalog</small></div><span>${managedDrivers.length}</span></header>
        <div class="driver-card-list">${managedDrivers.length ? managedDrivers.map((driver) => `<article class="driver-entry-card"><header><strong>${escapeHtml(driver.title)}</strong><span class="driver-origin-badge managed">Bibliothek</span></header><p>${escapeHtml(driver.description || "")}</p><div>${(driver.depends_on || []).map((dependency) => `<code>${escapeHtml(dependency)}</code>`).join("")}</div><button type="button" data-driver-open-hardware>${driver.configures === "sensor" ? "Beim Sensor verwenden" : "Beim Aktor verwenden"}</button></article>`).join("") : '<p class="driver-empty-state">Für das gewählte Board sind noch keine verwalteten Treiber hinterlegt.</p>'}</div>
      </div>
      <div class="driver-library-panel"><header><div><h4>Im Projekt angelegte Treiber</h4><small>Quellcode und KI-Ergebnisse</small></div><span>${projectDrivers.length}</span></header>
        <div class="driver-card-list">${projectDrivers.length ? projectDrivers.map((source) => {
          const origin = driverSourceOrigin(source);
          return `<article class="driver-entry-card"><header><strong>${escapeHtml(String(source.path).split("/").at(-1))}</strong><span class="driver-origin-badge ${origin.className}">${origin.label}</span></header><p>${escapeHtml(source.path)}</p><button type="button" data-driver-source-path="${escapeAttribute(source.path)}">Treiber öffnen</button></article>`;
        }).join("") : '<div class="driver-empty-state"><strong>Noch kein Projekttreiber erkannt</strong><p>Öffne eine Funktion und lasse die KI prüfen, ob daraus ein wiederverwendbarer Treiber unter <code>Treiber/</code> entstehen sollte.</p></div>'}</div>
      </div>
    </section>
  </div>`;
}

function handleDriverManagementClick(event) {
  const project = projectById(state.activeProjectId);
  if (event.target.closest("[data-driver-open-hardware]")) {
    navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
    return;
  }
  const sourceButton = event.target.closest("[data-driver-source-path]");
  if (sourceButton) {
    openIdeSource(sourceButton.dataset.driverSourcePath);
    return;
  }
  if (!event.target.closest("[data-driver-ai-prompt]")) return;
  renderIdeCodeAssistant(project);
  const input = document.querySelector('[data-code-explorer-chat] textarea[name="message"]');
  if (!input) return;
  input.value = "Analysiere die aktuell geöffnete Funktion und den relevanten Projektkontext. Erkenne, ob darin ein wiederverwendbarer Hardware- oder Gerätetreiber steckt. Wenn ja, erkläre zuerst die Treibergrenze, Abhängigkeiten und öffentliche Schnittstelle. Schlage danach eine Auslagerung unter dem Komponentenordner in Treiber/ vor und kennzeichne den Treiber als KI-abgeleitet, bis ich ihn geprüft habe.";
  input.focus();
}

async function saveMotorDriverAssignment(event) {
  if (!event.target.matches(".motor-driver-assignment")) return;
  event.preventDefault();
  const project = projectById(state.activeProjectId);
  const form = event.target;
  const status = form.querySelector("[data-motor-driver-status]");
  const data = new FormData(form);
  const configuration = projectHardwareConfiguration(project);
  const component = configuration.components.find((item) => item.component_id === form.dataset.motorDriverComponent && item.abstract_type === "actuator");
  if (!component) return;
  const pins = [data.get("pin"), data.get("secondary_pin"), data.get("phase_v_pin"), data.get("phase_w_pin")].filter(Boolean);
  if (new Set(pins).size !== pins.length) {
    status.textContent = "Jeder Treiberanschluss benötigt einen eigenen Boardpin.";
    return;
  }
  component.pin = String(data.get("pin") || "");
  component.secondary_pin = String(data.get("secondary_pin") || "");
  component.properties = {
    ...(component.properties || {}),
    motor_driver_type: String(data.get("motor_driver_type") || ""),
    phase_v_pin: String(data.get("phase_v_pin") || ""),
    phase_w_pin: String(data.get("phase_w_pin") || ""),
    current_sense_pin: String(data.get("current_sense_pin") || ""),
    nominal_voltage_v: String(data.get("nominal_voltage_v") || ""),
    max_current_a: String(data.get("max_current_a") || ""),
  };
  status.textContent = "Treiberkonfiguration wird gespeichert…";
  try {
    const response = await postJson(`/api/platform/development-projects/${encodeURIComponent(project.id)}/hardware-configuration`, { hardware_configuration: configuration });
    if (response.project) state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
    renderDriverManagement(response.project || project);
    document.querySelector(`[data-motor-driver-component="${CSS.escape(component.component_id)}"] [data-motor-driver-status]`).textContent = "Gespeichert.";
  } catch (error) {
    status.textContent = error.message || "Treiberkonfiguration konnte nicht gespeichert werden.";
  }
}

function openWebInterface() {
  state.ideViewMode = "web-interface";
  state.webInterfaceTab = "configuration";
  const project = projectById(state.activeProjectId);
  document.querySelector("#ideActiveSourceLabel").textContent = `${primaryComponentPath(project)}/Konfiguration/Weboberfläche`;
  renderWebInterface(project);
  renderIdeViewMode(project);
}

async function openBoardProperties(componentId) {
  state.ideViewMode = "board-properties";
  state.activeIdeComponentId = String(componentId || "");
  const project = projectById(state.activeProjectId);
  const component = ideDeviceConfigurationComponents(project).find((item) => item.component_id === state.activeIdeComponentId)
    || ideDeviceConfigurationComponents(project)[0];
  document.querySelector("#ideActiveSourceLabel").textContent = `Komponenten/${component?.label || "IoT-Device"}/Konfiguration/Board`;
  await Promise.all([loadProcessorBoardCatalog(), loadBoardFeatureCatalog()]);
  renderBoardProperties(project);
  renderIdeViewMode(project);
}

async function openSensorProperties(componentId) {
  state.ideViewMode = "sensor-properties";
  state.activeIdeComponentId = String(componentId || "");
  const project = projectById(state.activeProjectId);
  const component = projectHardwareComponents(project).find((item) => item.component_id === state.activeIdeComponentId && item.abstract_type === "sensor");
  document.querySelector("#ideActiveSourceLabel").textContent = `Komponenten/${component?.label || "Sensor"}/Konfiguration/Hardware/Eigenschaften`;
  await loadSensorCatalog();
  renderSensorProperties(project);
  renderIdeViewMode(project);
}

function sensorConfigurationValue(value, fallback = "noch nicht festgelegt") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function renderSensorProperties(project) {
  const target = document.querySelector("#ideSensorPropertiesView");
  if (!target || !project) return;
  const components = projectHardwareComponents(project);
  const sensor = components.find((item) => item.component_id === state.activeIdeComponentId && item.abstract_type === "sensor");
  if (!sensor) {
    target.innerHTML = '<div class="sensor-properties-empty"><h3>Sensor nicht gefunden</h3><p>Die Sensor-Komponente ist nicht mehr Teil der gespeicherten Hardware-Konfiguration.</p></div>';
    return;
  }
  const device = components.find((item) => item.component_id === sensor.target_device_id && item.abstract_type === "iot_device");
  const catalogSensor = state.sensorCatalog.find((item) => item.sensor_type_id === sensor.concrete_type);
  const properties = sensor.properties || {};
  const modeLabels = { live: "Live-Wert", periodic_log: "Zyklischer Datenlogger" };
  const aggregationLabels = { last: "Letzter Wert", mean: "Mittelwert", min: "Minimum", max: "Maximum", rms: "Effektivwert (RMS)" };
  const storageLabels = { local_history: "Lokale Messwerthistorie", publish: "An angebundenes Ziel übertragen", latest_only: "Nur letzten Datensatz halten" };
  const intervalUnitLabels = { seconds: "Sekunden", minutes: "Minuten", hours: "Stunden" };
  const rows = [
    ["Sensor-Komponente", sensor.label],
    ["Sensorart", sensor.sensor_category],
    ["Erfassung", sensor.signal_type],
    ["Konkreter Sensor", catalogSensor?.title || sensor.concrete_type],
    ["IoT-Device", device?.label || sensor.target_device_id],
    ["Verbindung", sensor.pin],
  ];
  if (sensor.secondary_pin) rows.push([sensor.signal_type === "incremental_ab" ? "Kanal B" : "Zweiter Anschluss", sensor.secondary_pin]);
  const measurementMode = properties.measurement_mode || "live";
  rows.push(["Messmodus", modeLabels[measurementMode] || measurementMode]);
  if (measurementMode === "periodic_log") {
    rows.push(
      ["Messintervall", `${sensorConfigurationValue(properties.sampling_interval_value)} ${intervalUnitLabels[properties.sampling_interval_unit] || properties.sampling_interval_unit || "Sekunden"}`],
      ["Werte pro Datensatz", properties.samples_per_record],
      ["Auswertung", aggregationLabels[properties.aggregation] || properties.aggregation],
      ["Speicherziel", storageLabels[properties.storage_mode] || properties.storage_mode],
    );
    if (properties.retention_records) rows.push(["Maximale Datensätze", properties.retention_records]);
  }
  target.innerHTML = `<div class="sensor-properties-workspace">
    <header><div><p class="eyebrow">Hardware · Sensor</p><h3>${escapeHtml(sensor.label)}</h3></div><button type="button" data-open-hardware-configuration>Zuordnung bearbeiten</button></header>
    <p class="helper-text">Diese Sicht wiederholt die gespeicherte Sensor-Zuordnung aus dem vorherigen Hardware-Schritt für genau diese Komponente.</p>
    <table class="sensor-configuration-table"><thead><tr><th>Eigenschaft</th><th>Gespeicherte Konfiguration</th></tr></thead><tbody>
      ${rows.map(([label, value]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(sensorConfigurationValue(value))}</td></tr>`).join("")}
    </tbody></table>
    <section class="sensor-connection-summary" aria-label="Verbindung des Sensors"><span>${escapeHtml(sensor.label)}</span><b>→</b><code>${escapeHtml(sensorConfigurationValue(sensor.pin, "kein Anschluss"))}</code><b>→</b><span>${escapeHtml(device?.label || "IoT-Device nicht zugeordnet")}</span></section>
  </div>`;
}

function openDeviceConnections(componentId) {
  state.ideViewMode = "device-connections";
  state.activeIdeComponentId = String(componentId || "");
  const project = projectById(state.activeProjectId);
  const component = ideDeviceConfigurationComponents(project).find((item) => item.component_id === state.activeIdeComponentId)
    || ideDeviceConfigurationComponents(project)[0];
  document.querySelector("#ideActiveSourceLabel").textContent = `Komponenten/${component?.label || "IoT-Device"}/Konfiguration/Boardexterne Anschlüsse`;
  renderDeviceConnections(project);
  renderIdeViewMode(project);
}

function renderDeviceConnections(project) {
  const target = document.querySelector("#ideDeviceConnectionsView");
  if (!target || !project) return;
  const components = projectHardwareComponents(project);
  const device = ideDeviceConfigurationComponents(project).find((item) => item.component_id === state.activeIdeComponentId)
    || ideDeviceConfigurationComponents(project)[0];
  if (!device) return;
  const connected = components.filter((item) => ["sensor", "actuator"].includes(item.abstract_type)
    && item.target_device_id === device.component_id && !isBoardIntegratedHardwareComponent(item, device));
  target.innerHTML = `<div class="device-connections-workspace">
    <header><div><p class="eyebrow">Hardware · IoT-Device</p><h3>Boardexterne Anschlüsse</h3><span>${escapeHtml(device.label)}</span></div><button type="button" data-open-hardware-configuration>Externe Hardware bearbeiten</button></header>
    <p class="helper-text">Hier erscheinen ausschließlich zusätzlich am Board angeschlossene Sensoren und Aktoren. Integrierte Kamera-, Display-, Touch-, Audio- und Speicherfunktionen stehen in der Boardkonfiguration.</p>
    <dl class="device-connections-meta"><div><dt>Board</dt><dd>${escapeHtml(sensorConfigurationValue(device.board_profile_id))}</dd></div><div><dt>Boardexterne Komponenten</dt><dd>${connected.length}</dd></div></dl>
    ${connected.length ? `<table class="device-connections-table"><thead><tr><th>Art</th><th>Komponente</th><th>Konkreter Typ</th><th>Verbindung</th><th>Funktion</th></tr></thead><tbody>
      ${connected.map((component) => {
        const properties = component.properties || {};
        const connection = [component.pin, component.secondary_pin, properties.phase_v_pin, properties.phase_w_pin].filter(Boolean).join(" · ");
        const functionLabel = component.abstract_type === "sensor"
          ? (properties.measurement_mode === "periodic_log" ? "Zyklischer Datenlogger" : "Messwert erfassen")
          : (properties.motor_driver_type ? `Motorsteuerung: ${properties.motor_driver_type}` : "Aktor ansteuern");
        return `<tr><td><span class="connection-type-badge ${component.abstract_type}">${component.abstract_type === "sensor" ? "Sensor" : "Aktor"}</span></td><td>${escapeHtml(component.label)}</td><td>${escapeHtml(sensorConfigurationValue(component.concrete_type))}</td><td><code>${escapeHtml(sensorConfigurationValue(connection, "nicht verbunden"))}</code></td><td>${escapeHtml(functionLabel)}</td></tr>`;
      }).join("")}
    </tbody></table>` : '<div class="device-connections-empty"><strong>Keine boardexternen Komponenten</strong><p>Integrierte Ausstattung findest du unter Board. Zusätzliche Sensoren oder Aktoren ordnest du im Hardware-Schritt zu.</p></div>'}
  </div>`;
}

function isBoardIntegratedHardwareComponent(component, device) {
  if (component?.hardware_scope === "board_integrated") return true;
  if (component?.hardware_scope === "board_external") return false;
  const features = device?.board_configuration?.board_features || {};
  if (component?.abstract_type === "sensor" && component?.sensor_category === "image") {
    const camera = features.camera;
    return Boolean(camera?.enabled && (!component.concrete_type || component.concrete_type === "integrated_camera" || !camera.hardware || component.concrete_type === camera.hardware));
  }
  if (component?.abstract_type === "actuator" && component?.concrete_type === "integrated_display") return Boolean(features.display?.enabled);
  if (/^integrated_/.test(component?.concrete_type || "")) {
    const candidate = String(component.concrete_type).replace(/^integrated_/, "");
    const featureId = ({ touchscreen: "touch", touchscreen_controller: "touch", audio: "speaker" })[candidate] || candidate;
    return Boolean(features[featureId]?.enabled);
  }
  return false;
}

function openPwaDashboardView() {
  state.ideViewMode = "pwa-dashboard";
  const project = projectById(state.activeProjectId);
  document.querySelector("#ideActiveSourceLabel").textContent = "Komponenten/Smartphone-App (PWA)/Konfiguration/PWA-Dashboard";
  renderPwaDashboardView(project);
  renderIdeViewMode(project);
}

async function openIdeSource(sourcePath) {
  const project = projectById(state.activeProjectId);
  if (!project || !sourcePath) return;
  state.ideViewMode = "file";
  state.sourcePath = sourcePath;
  document.querySelector("#ideActiveSourceLabel").textContent = state.sourcePath;
  await loadIdeSourceContent(project, sourcePath);
  renderIdeProjectBrowser(project, state.projectSourcesByProjectId[project.id] || []);
  renderIdeProjectInformation(project);
  renderIdeViewMode(project);
  renderIdeCodeAssistant(project);
}

function renderIdeCodeAssistant(project) {
  return guidedProjectView().renderProjectAssistant(project);
}

async function loadIdeSourceContent(project, sourcePath) {
  const source = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(sourcePath)}`);
  document.querySelector("#sourceEditor").value = source.content || "";
  clearIdeSourceDirty(project.id, sourcePath);
}

function renderIdeViewMode(project) {
  const sourcePath = state.sourcePath || "";
  const source = document.querySelector("#sourceEditor").value;
  const componentFeatures = state.ideViewMode === "component-features";
  const webInterface = state.ideViewMode === "web-interface";
  const boardProperties = state.ideViewMode === "board-properties";
  const sensorProperties = state.ideViewMode === "sensor-properties";
  const deviceConnections = state.ideViewMode === "device-connections";
  const driverManagement = state.ideViewMode === "driver-management";
  const pwaDashboard = state.ideViewMode === "pwa-dashboard";
  const virtualView = componentFeatures || webInterface || boardProperties || sensorProperties || deviceConnections || driverManagement || pwaDashboard;
  const plantUml = /\.(puml|plantuml)$/i.test(sourcePath) && /@startuml/i.test(source);
  const image = /\.(svg|png|jpe?g|gif|webp)$/i.test(sourcePath);
  const architectureBaseline = isArchitectureBaselinePath(sourcePath);
  document.querySelector("#sourceEditor").readOnly = !ideSourceIsEditable(project, sourcePath);
  document.querySelector("#ideViewerPanel").classList.toggle("plantuml-split", plantUml && !virtualView);
  document.querySelector("#ideViewerModeLabel").textContent = componentFeatures ? "Softwarefunktionen" : webInterface ? "Weboberfläche" : boardProperties ? "Boardkonfiguration" : sensorProperties ? "Sensorkonfiguration" : deviceConnections ? "Angeschlossene Komponenten" : driverManagement ? "Treiberverwaltung" : pwaDashboard ? "PWA-Dashboard" : architectureBaseline ? "Freigegebene Architektur-Baseline · schreibgeschützt" : plantUml ? "PlantUML · Quelle und Grafik" : image ? "Grafik" : "Datei";
  document.querySelector("#sourcePanel").classList.toggle("hidden", virtualView || image);
  document.querySelector("#ideImageView").classList.toggle("hidden", virtualView || (!plantUml && !image));
  document.querySelector("#ideModelView").classList.add("hidden");
  document.querySelector("#ideComponentFeaturesView").classList.toggle("hidden", !componentFeatures && !webInterface);
  document.querySelector("#ideBoardPropertiesView").classList.toggle("hidden", !boardProperties);
  document.querySelector("#ideSensorPropertiesView").classList.toggle("hidden", !sensorProperties);
  document.querySelector("#ideDeviceConnectionsView").classList.toggle("hidden", !deviceConnections);
  document.querySelector("#ideDriverManagementView").classList.toggle("hidden", !driverManagement);
  document.querySelector("#idePwaDashboardView").classList.toggle("hidden", !pwaDashboard);
  if (!virtualView && (plantUml || image)) renderIdeImageView(sourcePath, source);
}

const pwaDashboardCardDefinitions = [
  ["current_values", "Aktuelle Messwerte", "Die zuletzt übertragenen Werte als kompakte Übersicht."],
  ["history", "Messwertverlauf", "Eine spätere Zeitreihenansicht für gespeicherte Messwerte."],
  ["events", "Ereignisprotokoll", "Eine spätere Liste protokollierter Geräteereignisse."],
  ["device_status", "Board-Status", "Verbindungs- und Aktualitätsstatus des zugeordneten Boards."],
];

function effectivePwaDashboard(project) {
  const configured = project?.viewManifest?.pwa_dashboard || {};
  const visibleCards = new Set(Array.isArray(configured.visible_cards)
    ? configured.visible_cards.map(String)
    : pwaDashboardCardDefinitions.map(([id]) => id));
  return {
    title: String(configured.title || project?.name || "Mein Datenlogger").slice(0, 80),
    visibleCards,
  };
}

function renderPwaDashboardView(project) {
  const target = document.querySelector("#idePwaDashboardView");
  if (!target) return;
  if (!isPwaDashboardProject(project)) {
    target.innerHTML = "<p class=\"empty\">Dieses Projekt besitzt keine Smartphone-App/PWA-Komponente.</p>";
    return;
  }
  const dashboard = effectivePwaDashboard(project);
  const visible = pwaDashboardCardDefinitions.filter(([id]) => dashboard.visibleCards.has(id));
  target.innerHTML = `<div class="pwa-dashboard-workspace">
    <header><div><p class="eyebrow">Smartphone-App / PWA</p><h3>${escapeHtml(dashboard.title)}</h3></div><button type="button" data-open-pwa-dashboard-editor>Dashboard konfigurieren</button></header>
    <p class="helper-text">Die projektprivate Datenhaltung ist in dieser Datenlogger-Vorlage aktiviert. Messquelle, Intervall, Verdichtung und Aufbewahrung werden anschliessend an der Sensor-Konfiguration festgelegt; Alarm- und Senderegeln folgen separat.</p>
    <section class="pwa-phone-preview" aria-label="Vorschau des PWA-Dashboards">
      <div class="pwa-phone-status"><span>9:41</span><strong>${escapeHtml(dashboard.title)}</strong><span>●●●</span></div>
      <div class="pwa-phone-content">${visible.map(([, title, description]) => `<article><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small><span>Vorschau wird nach Datenanbindung gefüllt</span></article>`).join("") || "<p class=\"empty\">Es sind noch keine Bereiche sichtbar.</p>"}</div>
    </section>
  </div>`;
}

function openPwaDashboardEditor() {
  const project = projectById(state.activeProjectId);
  if (!isPwaDashboardProject(project)) return;
  const dashboard = effectivePwaDashboard(project);
  const target = document.querySelector("#pwaDashboardEditorContent");
  target.innerHTML = `<p class="helper-text">Die projektprivate Datenhaltung ist als Grundfunktion aktiv. Lege hier nur fest, welche Bereiche später in der privaten PWA sichtbar sind. Diese Konfiguration enthält ausdrücklich keine Alarm-, Schwellen- oder Senderegeln.</p>
    <label class="pwa-dashboard-title-label">Titel der App<input name="pwa_dashboard_title" maxlength="80" value="${escapeAttribute(dashboard.title)}"></label>
    <fieldset class="pwa-dashboard-card-options"><legend>Sichtbare Bereiche</legend>${pwaDashboardCardDefinitions.map(([id, title, description]) => `<label class="component-feature-card"><input type="checkbox" name="pwa_dashboard_card" value="${id}" ${dashboard.visibleCards.has(id) ? "checked" : ""}><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><em>PWA</em></label>`).join("")}</fieldset>`;
  const dialog = document.querySelector("#pwaDashboardDialog");
  if (!dialog.open) dialog.showModal();
}

async function savePwaDashboard(event) {
  event.preventDefault();
  const project = projectById(state.activeProjectId);
  const status = event.target.querySelector("[data-pwa-dashboard-status]");
  if (!isPwaDashboardProject(project)) return;
  const data = new FormData(event.target);
  status.textContent = "Wird gespeichert...";
  try {
    const response = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/pwa-dashboard`, {
      title: data.get("pwa_dashboard_title"),
      visible_cards: data.getAll("pwa_dashboard_card").map(String),
    });
    state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
    renderPwaDashboardView(response.project);
    status.textContent = "Gespeichert.";
  } catch (error) {
    status.textContent = error.message;
  }
}

function primaryComponentPath(project) {
  return String(project?.buildConfig?.user_source_path || "").match(/^(Komponenten\/[^/]+)\//)?.[1] || "";
}

const componentFeatureDefinitions = [
  ["wifi", "WLAN", "Netzwerkverbindung der Basissoftware"],
  ["mqtt", "MQTT", "Nachrichten, Status und OTA-Auftraege"],
  ["ota", "OTA", "Signierte Firmware-Aktualisierung"],
  ["http", "HTTP", "Lokale Status- und Konfigurations-API"],
  ["webserver", "Webserver", "Lokale Bedien- und Statusoberflaeche"],
];

function effectiveComponentFeatures(project) {
  const configured = project?.buildConfig?.component_features || {};
  const basisId = project?.buildConfig?.firmware_basis_id || "";
  const basisVariant = project?.buildConfig?.firmware_basis_variant || (basisId === "gernetix-runtime-basissoftware" ? "comfort" : "");
  const basisLocks = basisId === "gernetix-runtime-basissoftware" && basisVariant === "comfort"
    ? ["wifi", "mqtt", "ota", "http", "webserver"]
    : [];
  const immutable = new Set([...basisLocks, ...(configured.immutable || [])]);
  const enabled = new Set(configured.enabled || []);
  immutable.forEach((feature) => enabled.add(feature));
  if (configured.webserver?.measurement_chart) enabled.add("measurement_chart");
  return { enabled, immutable, webserver: configured.webserver || {}, basisVariant };
}

function renderComponentFeatures(project) {
  const target = document.querySelector("#ideComponentFeaturesView");
  if (!target || !project?.buildConfig) {
    if (target) target.innerHTML = `<p class="empty">Keine Firmware-Komponente konfigurierbar.</p>`;
    return;
  }
  const config = effectiveComponentFeatures(project);
  target.innerHTML = `<form class="component-features-form">
    <header><div><p class="eyebrow">${escapeHtml(primaryComponentPath(project) || "Komponente")}</p><h3>Eigenschaften</h3></div>
      <span class="basis-variant-badge">Basis: ${escapeHtml(config.basisVariant || "ohne Variante")}</span></header>
    <p class="helper-text">Funktionen der Basissoftware sind geschützt und bleiben beim Build erhalten. Projekterweiterungen kannst du hier zuschalten.</p>
    <div class="component-feature-grid">${componentFeatureDefinitions.map(([id, title, description]) => {
      const locked = config.immutable.has(id);
      return `<label class="component-feature-card ${locked ? "locked" : ""}">
        <input type="checkbox" name="feature" value="${id}" ${config.enabled.has(id) ? "checked" : ""} ${locked ? "disabled" : ""}>
        <span><strong>${title}</strong><small>${description}</small></span>
        <em>${locked ? "Basissoftware · unveränderlich" : "Projekt"}</em>
      </label>`;
    }).join("")}</div>
    <fieldset class="webserver-settings"><legend>Webserver erweitern</legend>
      <label>Titel<input name="webserver_title" value="${escapeAttribute(config.webserver.title || "GerNetiX Device")}"></label>
      <label>Messwert<input name="measurement_label" value="${escapeAttribute(config.webserver.measurement_label || "Messwert")}"></label>
      <label>Einheit<input name="measurement_unit" value="${escapeAttribute(config.webserver.measurement_unit || "")}" placeholder="z. B. °C"></label>
    </fieldset>
    <footer><button type="submit">Eigenschaften speichern</button><span data-component-feature-status></span></footer>
  </form>`;
  target.querySelector(".webserver-settings")?.remove();
}

function renderWebInterface(project) {
  const target = document.querySelector("#ideComponentFeaturesView");
  if (!target || !project?.buildConfig) {
    if (target) target.innerHTML = `<p class="empty">Keine Weboberflächen-Konfiguration vorhanden.</p>`;
    return;
  }
  const config = effectiveComponentFeatures(project);
  const activeTab = state.webInterfaceTab === "preview" ? "preview" : "configuration";
  const stored = localStorage.getItem(deviceWebStorageKey(project)) || "";
  const url = stored || suggestedDeviceWebUrl(project);
  target.innerHTML = `<div class="web-interface-workspace">
    <header><div><p class="eyebrow">Software · IoT-Device</p><h3>Weboberfläche</h3></div>
      <span class="basis-variant-badge">Basis: ${escapeHtml(config.basisVariant || "ohne Variante")}</span></header>
    <div class="web-interface-tabs" role="tablist" aria-label="Weboberfläche">
      <button type="button" role="tab" data-web-interface-tab="configuration" aria-selected="${activeTab === "configuration"}" class="${activeTab === "configuration" ? "active" : ""}">Konfiguration</button>
      <button type="button" role="tab" data-web-interface-tab="preview" aria-selected="${activeTab === "preview"}" class="${activeTab === "preview" ? "active" : ""}">Vorschau</button>
    </div>
    ${activeTab === "configuration" ? `<form class="component-features-form webserver-configuration-form">
      <p class="helper-text">Lege fest, welche Inhalte die lokale Weboberfläche des Boards zeigt.</p>
      <div class="component-feature-grid">
        <label class="component-feature-card">
          <input type="checkbox" name="measurement_chart" ${config.webserver.measurement_chart ? "checked" : ""}>
          <span><strong>Messwertdiagramm</strong><small>Letzte Messwerte auf der lokalen Board-Seite darstellen</small></span>
          <em>Projekt</em>
        </label>
      </div>
      <fieldset class="webserver-settings"><legend>Darstellung</legend>
        <label>Titel<input name="webserver_title" value="${escapeAttribute(config.webserver.title || "GerNetiX Device")}"></label>
        <label>Messwert<input name="measurement_label" value="${escapeAttribute(config.webserver.measurement_label || "Messwert")}"></label>
        <label>Einheit<input name="measurement_unit" value="${escapeAttribute(config.webserver.measurement_unit || "")}" placeholder="z. B. °C"></label>
      </fieldset>
      <footer><button type="submit">Weboberfläche speichern</button><span data-component-feature-status></span></footer>
    </form>` : `<div class="device-web-workspace">
      <form class="device-web-toolbar"><label>Board-Adresse<input name="device_web_url" value="${escapeAttribute(url)}" placeholder="http://gernetix-board.local/"></label><button type="submit">Anzeigen</button>${url ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">Im Browser öffnen</a>` : ""}</form>
      <div class="device-web-info"><strong>Weboberfläche des Entwicklungsprojekts</strong><span>${config.webserver.measurement_chart ? "Messwertdiagramm konfiguriert" : "Statusseite der Basissoftware"}</span></div>
      ${url ? `<iframe title="Device-Webserver" src="${escapeAttribute(url)}"></iframe>` : `<div class="device-web-empty"><strong>Noch keine Board-Adresse bekannt</strong><p>Ordne ein Device zu oder trage seine lokale Adresse ein.</p></div>`}
    </div>`}
  </div>`;
}

function renderBoardProperties(project) {
  const target = document.querySelector("#ideBoardPropertiesView");
  if (!target) return;
  const deviceComponent = ideDeviceConfigurationComponents(project)
    .find((component) => component.component_id === state.activeIdeComponentId) || ideDeviceConfigurationComponents(project)[0];
  if (!deviceComponent) {
    target.innerHTML = '<div class="board-properties-empty"><h3>IoT-Device nicht gefunden</h3><p>Wähle die Boardkonfiguration direkt unter einer IoT-Device-Komponente im Projektbrowser.</p></div>';
    return;
  }
  const allocated = allocatedIdeDevice(project);
  const boardConfiguration = deviceComponent?.board_configuration || project?.buildConfig?.board_configuration || null;
  const boardSelectionId = boardConfiguration?.account_board_id
    ? `account_board:${boardConfiguration.account_board_id}:v${boardConfiguration.account_board_version}`
    : "";
  const boardProfileId = boardSelectionId || deviceComponent?.board_profile_id || allocated?.hardware_profile_id || boardConfiguration?.base_board_profile_id || "";
  const board = state.processorBoards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
    .filter(Boolean).some((id) => String(id) === String(boardProfileId)));
  const projectBoardId = boardConfiguration?.source === "project" && board
    ? `project_board:${project.id}:${deviceComponent.component_id}`
    : "";
  const projectBoard = projectBoardId ? {
    ...board,
    hardware_item_id: projectBoardId,
    hardware_profile_id: projectBoardId,
    id: projectBoardId,
    title: `${boardConfiguration.name || board.title || "Board"} · Projektanpassung`,
    configuration_scope: "project",
    project_base_selection_id: boardProfileId,
    base_board_profile_id: boardConfiguration.base_board_profile_id || board.base_board_profile_id || BoardConfigurationPlugin.boardId(board),
    account_board_id: boardConfiguration.account_board_id || "",
    account_board_version: boardConfiguration.account_board_version || 0,
    default_instance_configuration: {
      ...(board.default_instance_configuration || {}),
      board_features: boardConfiguration.board_features || {},
    },
  } : null;
  const selectableBoards = projectBoard ? [...state.processorBoards, projectBoard] : state.processorBoards;
  const selectedBoardId = projectBoardId || boardProfileId;
  target.innerHTML = `<div class="board-properties-workspace">
    <header><div><p class="eyebrow">Hardware · Boardkonfiguration</p><h3>${escapeHtml(deviceComponent?.label || "IoT-Device")}</h3></div>
      <button type="button" data-open-hardware-configuration>Vollständige Hardware-Zuordnung</button></header>
    <p class="helper-text">GerNetiX-Boards und eigene Account-Boards stammen aus dem Hardware-Katalog. Änderungen werden als eigener, vollständiger Projektsnapshot gespeichert und erscheinen danach unter „Projektanpassungen“.</p>
    <section class="ide-board-configuration-plugin-panel">
      <div data-ide-board-configuration-plugin></div>
      <footer class="ide-board-configuration-plugin-actions">
        <button type="button" class="primary" data-save-ide-board-configuration="project" ${board ? "" : "disabled"}>Boardkonfiguration im Projekt speichern</button>
        <button type="button" data-save-ide-board-configuration="account" class="hidden">Als eigenes Board speichern und verwenden</button>
        <span data-ide-board-configuration-status></span>
      </footer>
    </section>
    ${board ? `<dl class="board-properties-meta">
      <div><dt>Quelle</dt><dd>${escapeHtml(boardConfiguration?.source === "project" ? "Projektanpassung" : boardConfiguration?.source === "account" ? `Eigenes Account-Board · Version ${boardConfiguration.account_board_version || 1}` : "GerNetiX-Board")}</dd></div>
      <div><dt>Basisprofil</dt><dd>${escapeHtml(boardConfiguration?.base_board_profile_id || board.base_board_profile_id || board.hardware_item_id || "nicht angegeben")}</dd></div>
      <div><dt>Prozessorfamilie</dt><dd>${escapeHtml(board.processor_family || deviceComponent?.processor_family || "nicht angegeben")}</dd></div>
      <div><dt>MCU</dt><dd>${escapeHtml(board.mcu_variant || deviceComponent?.processor_variant || "nicht angegeben")}</dd></div>
    </dl>` : ""}
  </div>`;
  const pluginRoot = target.querySelector("[data-ide-board-configuration-plugin]");
  state.ideBoardConfigurationDraft = null;
  BoardConfigurationPlugin.mount(pluginRoot, {
    boards: selectableBoards,
    selectedBoardId,
    features: state.boardFeatureCatalog,
    selections: boardConfiguration?.board_features || board?.default_instance_configuration?.board_features || {},
    name: boardConfiguration?.name || "",
    title: "Board auswählen und konfigurieren",
    allowAccountSave: true,
    status: state.processorBoardCatalogStatus.state === "error" ? state.processorBoardCatalogStatus : state.boardFeatureCatalogStatus,
    onChange(value) {
      state.ideBoardConfigurationDraft = value;
      syncIdeBoardConfigurationActions(target, value);
    },
  });
  const initialValue = BoardConfigurationPlugin.value(pluginRoot);
  state.ideBoardConfigurationDraft = initialValue;
  syncIdeBoardConfigurationActions(target, initialValue);
}

function syncIdeBoardConfigurationActions(target, value) {
  const projectButton = target.querySelector('[data-save-ide-board-configuration="project"]');
  const accountButton = target.querySelector('[data-save-ide-board-configuration="account"]');
  if (projectButton) projectButton.disabled = !value?.board;
  accountButton?.classList.toggle("hidden", !value?.board || !value.modified);
}

async function saveIdeBoardConfiguration(saveAsAccount) {
  const project = projectById(state.activeProjectId);
  const target = document.querySelector("#ideBoardPropertiesView");
  const pluginRoot = target?.querySelector("[data-ide-board-configuration-plugin]");
  const value = BoardConfigurationPlugin.value(pluginRoot);
  const status = target?.querySelector("[data-ide-board-configuration-status]");
  if (!project || !value?.board || !status) return;
  if (saveAsAccount && !value.name) {
    status.textContent = "Gib deinem geänderten Board zuerst einen Namen.";
    pluginRoot.querySelector("[data-board-configuration-name]")?.focus();
    return;
  }
  status.textContent = saveAsAccount ? "Eigenes Board wird gespeichert…" : "Board wird dem Projekt zugeordnet…";
  try {
    const board = value.board;
    const projectSpecific = !saveAsAccount && (value.modified || board.configuration_scope === "project");
    let boardConfiguration = {
      schema_version: 1,
      source: projectSpecific ? "project" : board.configuration_scope === "account" ? "account" : "catalog",
      name: projectSpecific
        ? String(board.title || "").replace(/ · Projektanpassung$/, "")
        : board.configuration_scope === "account" ? String(board.title || "").replace(/ · Mein Board$/, "") : "",
      base_board_profile_id: board.base_board_profile_id || BoardConfigurationPlugin.boardId(board),
      account_board_id: board.account_board_id || "",
      account_board_version: board.account_board_version || 0,
      board_features: value.selections,
      saved_at: board.configuration_scope === "account" ? new Date().toISOString() : "",
    };
    if (saveAsAccount) {
      boardConfiguration = { ...boardConfiguration, source: "custom", name: value.name };
      const endpoint = board.account_board_id
        ? `/api/platform/account-board-configurations/${encodeURIComponent(board.account_board_id)}/versions`
        : "/api/platform/account-board-configurations";
      const savedBoard = await postJson(endpoint, boardConfiguration);
      boardConfiguration = {
        ...boardConfiguration,
        source: "account",
        base_board_profile_id: savedBoard.base_board_profile_id,
        account_board_id: savedBoard.account_board_id,
        account_board_version: savedBoard.version,
        saved_at: savedBoard.created_at,
      };
    }
    const hardwareConfiguration = projectHardwareConfiguration(project);
    let component = hardwareConfiguration.components.find((item) => item.abstract_type === "iot_device" && item.component_id === state.activeIdeComponentId)
      || hardwareConfiguration.components.find((item) => item.abstract_type === "iot_device");
    if (!component) {
      component = {
        component_id: state.activeIdeComponentId || "iot_device_1",
        label: ideDeviceConfigurationComponents(project)[0]?.label || "IoT-Device 1",
        plantuml_type: "component",
        abstract_type: "iot_device",
        concrete_type: "processor_board",
        properties: {},
      };
      hardwareConfiguration.components.push(component);
    }
    Object.assign(component, {
      processor_family: String(board.processor_family || "").toLowerCase(),
      processor_variant: board.mcu_variant || "",
      board_profile_id: saveAsAccount
        ? `account_board:${boardConfiguration.account_board_id}:v${boardConfiguration.account_board_version}`
        : board.project_base_selection_id || BoardConfigurationPlugin.boardId(board),
      board_configuration: boardConfiguration,
    });
    const response = await postJson(`/api/platform/development-projects/${encodeURIComponent(project.id)}/hardware-configuration`, { hardware_configuration: hardwareConfiguration });
    if (response.project) state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
    if (saveAsAccount) await loadProcessorBoardCatalog({ force: true });
    const savedProject = response.project || project;
    const savedDevice = projectHardwareComponents(savedProject).find((item) => item.abstract_type === "iot_device");
    if (savedDevice) state.activeIdeComponentId = savedDevice.component_id;
    renderBoardProperties(savedProject);
    target.querySelector("[data-ide-board-configuration-status]").textContent = saveAsAccount
      ? "Eigenes Account-Board und Projektsnapshot gespeichert."
      : "Board als fester Projektsnapshot gespeichert.";
  } catch (error) {
    status.textContent = error.message || "Boardkonfiguration konnte nicht gespeichert werden.";
  }
}

async function saveComponentFeatures(event) {
  if (!event.target.matches(".component-features-form")) return;
  event.preventDefault();
  const project = projectById(state.activeProjectId);
  const status = event.target.querySelector("[data-component-feature-status]");
  const data = new FormData(event.target);
  status.textContent = "Wird gespeichert...";
  try {
    const webserverOnly = event.target.matches(".webserver-configuration-form");
    const currentConfig = effectiveComponentFeatures(project);
    const enabled = webserverOnly
      ? Array.from(currentConfig.enabled)
      : data.getAll("feature").map(String);
    if (!webserverOnly && currentConfig.enabled.has("measurement_chart")) enabled.push("measurement_chart");
    if (webserverOnly) {
      const measurementChartIndex = enabled.indexOf("measurement_chart");
      if (data.get("measurement_chart") && measurementChartIndex < 0) enabled.push("measurement_chart");
      if (!data.get("measurement_chart") && measurementChartIndex >= 0) enabled.splice(measurementChartIndex, 1);
    }
    const immutable = effectiveComponentFeatures(project).immutable;
    immutable.forEach((feature) => enabled.push(feature));
    const measurementChart = enabled.includes("measurement_chart");
    const response = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/component-features`, {
      enabled: Array.from(new Set(enabled)),
      webserver: {
        title: webserverOnly ? data.get("webserver_title") : currentConfig.webserver.title,
        measurement_chart: measurementChart,
        measurement_label: webserverOnly ? data.get("measurement_label") : currentConfig.webserver.measurement_label,
        measurement_unit: webserverOnly ? data.get("measurement_unit") : currentConfig.webserver.measurement_unit,
      },
    });
    state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
    if (webserverOnly) renderWebInterface(response.project);
    else renderComponentFeatures(response.project);
    document.querySelector("[data-component-feature-status]").textContent = "Gespeichert.";
  } catch (error) {
    status.textContent = error.message;
  }
}

function deviceWebStorageKey(project) {
  return `gernetix.ide.device-web.v1:${state.account?.user_id || "local"}:${project?.id || "project"}`;
}

function suggestedDeviceWebUrl(project) {
  const device = allocatedIdeDevice(project);
  const hostname = String(device?.hostname || device?.node_name || "").replace(/\.local$/i, "");
  return hostname ? `http://${hostname}.local/` : "";
}

function loadDeviceWebPreview(event) {
  if (!event.target.matches(".device-web-toolbar")) return;
  event.preventDefault();
  const project = projectById(state.activeProjectId);
  const data = new FormData(event.target);
  let url = String(data.get("device_web_url") || "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
  localStorage.setItem(deviceWebStorageKey(project), url);
  renderWebInterface(project);
}

function renderModelContext(project, sourcePath) {
  return `
    <div class="ide-model-context">
      <strong>${escapeHtml(project?.name || "Projekt")}</strong>
      <span>${escapeHtml(sourcePath)}</span>
    </div>
  `;
}

async function renderIdeImageView(sourcePath, source) {
  const target = document.querySelector("#ideImageView");
  if (!target) return;
  if (/\.(puml|plantuml)$/i.test(sourcePath) && /@startuml/i.test(source)) {
    target.innerHTML = `
      <figure class="plantuml-viewer">
        <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(source)}" alt="${escapeAttribute(sourcePath)}">
        <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
      </figure>
    `;
    await renderIdePlantUmlImage(target.querySelector("[data-plantuml-source]"));
    return;
  }
  if (/\.svg$/i.test(sourcePath)) {
    target.innerHTML = `<figure class="ide-file-image"><img src="${escapeAttribute(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`)}" alt="${escapeAttribute(sourcePath)}"></figure>`;
    return;
  }
  const rasterType = sourcePath.match(/\.(png|jpe?g|gif|webp)$/i)?.[1]?.toLowerCase();
  if (rasterType) {
    const mimeType = rasterType === "jpg" ? "jpeg" : rasterType;
    const imageSource = /^data:image\//i.test(source) ? source : `data:image/${mimeType};base64,${String(source).replace(/\s/g, "")}`;
    target.innerHTML = `<figure class="ide-file-image"><img src="${escapeAttribute(imageSource)}" alt="${escapeAttribute(sourcePath)}"></figure>`;
    return;
  }
  target.innerHTML = `<p class="empty">Fuer diese Datei gibt es noch keine Image-Ansicht.</p>`;
}

async function renderIdePlantUmlImage(image) {
  const source = image?.dataset.plantumlSource || "";
  const status = image?.closest(".plantuml-viewer")?.querySelector(".plantuml-status");
  if (!image || !source) return;
  try {
    image.src = await createPlantUmlSvgUrl(source);
    image.addEventListener("load", () => {
      image.classList.add("loaded");
      if (status) status.textContent = "Gerendert aus PlantUML.";
    }, { once: true });
  } catch {
    if (status) status.textContent = "PlantUML-Bild konnte im Browser nicht erzeugt werden.";
  }
}

async function saveSource() {
  const project = projectById(state.activeProjectId);
  if (!project || !state.sourcePath || !ideSourceIsEditable(project, state.sourcePath)) return;
  try {
    await persistCurrentSource(project);
    setFlashStatus("ok", `${state.sourcePath} gespeichert.`);
  } catch (error) {
    setFlashStatus("error", `Speichern fehlgeschlagen: ${error.message}`);
  }
}

async function persistCurrentSource(project = projectById(state.activeProjectId)) {
  if (!project || !state.sourcePath || !ideSourceIsEditable(project, state.sourcePath)) return;
  await putJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(state.sourcePath)}`, {
    content: document.querySelector("#sourceEditor").value,
  });
  clearIdeSourceDirty(project.id, state.sourcePath);
  renderIdeProjectInformation(project);
}
