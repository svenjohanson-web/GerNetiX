const state = {
  account: null,
  projects: [],
  devices: [],
  usbPorts: [],
  discoveredDevices: [],
  avrBootloaderResult: null,
  processorBoards: [],
  builds: [],
  billing: null,
  progress: [],
  workspace: null,
  activeProjectId: "",
  activeDeviceId: "",
  inventoryHardwareType: "",
  inventoryEsp32Method: "",
  activeStep: 0,
  activeIdeStep: 0,
  sourcePath: "src/main.cpp",
};

const routeMap = {
  dashboard: "dashboardView",
  learn: "learnView",
  ide: "ideView",
  projects: "projectsView",
  devices: "devicesView",
  builds: "buildsView",
  billing: "billingView",
  auth: "dashboardView",
};

bootstrap();

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/app/auth/";
});

document.querySelectorAll("[data-open-route]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.openRoute));
});
document.querySelector("#continueButton").addEventListener("click", continueLastProject);
document.querySelector("#lessonBackButton").addEventListener("click", () => navigate("/app/learn/"));
document.querySelector("#lessonNextButton").addEventListener("click", nextLessonStep);
document.querySelector("#openIdeButton").addEventListener("click", () => openProjectInIde(state.activeProjectId));
document.querySelector("#ideProjectSelect").addEventListener("change", () => openProjectInIde(document.querySelector("#ideProjectSelect").value));
document.querySelector("#ideDeviceSelect").addEventListener("change", () => {
  state.activeDeviceId = document.querySelector("#ideDeviceSelect").value;
  syncSelectedDevicePort();
  loadIdeProject();
});
document.querySelector("#refreshUsbPortsButton").addEventListener("click", refreshUsbPorts);
document.querySelector("#saveSourceButton").addEventListener("click", saveSource);
document.querySelector("#buildButton").addEventListener("click", startBuild);
document.querySelector("#usbFlashButton").addEventListener("click", startUsbFlash);
document.querySelector("#networkDiscoveryButton").addEventListener("click", discoverNetworkDevices);
document.querySelector("#esp32BootloaderIdentifyButton").addEventListener("click", identifyEsp32Bootloader);
document.querySelector("#avrBootloaderIdentifyButton").addEventListener("click", identifyAvrBootloaderExperimental);
document.querySelector("#claimSelectedDiscoveredDevicesButton").addEventListener("click", claimSelectedDiscoveredDevices);
document.querySelector("#deviceInventoryForm").addEventListener("submit", createInventoryDevice);
document.querySelector("#inventoryHardwareType").addEventListener("change", selectInventoryHardwareType);
document.querySelector("#inventoryHardwareProfile").addEventListener("change", syncInventoryCapabilities);
document.querySelector("#inventoryUsbPort").addEventListener("change", () => {
  setInventoryStatus("running", "USB-Port fuer spaeteres Flashen ausgewaehlt.");
});
document.querySelector("#esp32UsbPort").addEventListener("change", () => {
  setDiscoveryStatus("running", "ESP32 USB-Port fuer Browser-Web-Serial ausgewaehlt.");
});
window.addEventListener("popstate", renderRoute);

async function bootstrap() {
  await refresh();
  renderAll();
  renderRoute();
}

async function refresh() {
  const summary = await getJson("/api/platform/summary");
  state.account = summary.account;
  state.projects = summary.projects;
  state.devices = summary.devices;
  state.builds = summary.builds;
  state.billing = summary.billing;
  state.progress = summary.learning_progress;
  state.workspace = summary.workspace_state;
  const boards = await getJson("/api/platform/hardware/processor-boards").catch(() => ({ items: [] }));
  state.processorBoards = boards.items || [];
  await refreshUsbPorts(false);
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
  state.activeDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
}

function renderAll() {
  document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : "";
  renderDashboard();
  renderProjects();
  renderLearn();
  renderIdeShell();
  renderDeviceInventoryForm();
  renderNetworkDiscovery();
  renderDevices();
  renderBuilds();
  renderBilling();
}

function renderRoute() {
  const route = routeName();
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== routeMap[route]));
  document.querySelectorAll(".tabs a").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
  const projectId = new URLSearchParams(window.location.search).get("project");
  if (route === "learn" && projectId) {
    state.activeProjectId = projectId;
    renderLesson(projectById(projectId));
  }
  if (route === "learn" && !projectId) {
    document.querySelector("#lessonPanel").classList.add("hidden");
  }
  if (route === "ide") loadIdeProject();
}

function routeName() {
  const match = window.location.pathname.match(/^\/app\/([^/]+)/);
  return match ? match[1] : "dashboard";
}

function navigate(route) {
  history.pushState({}, "", route);
  renderRoute();
}

function renderDashboard() {
  const last = state.projects.find((project) => project.id === state.workspace.lastProjectId);
  document.querySelector("#continueText").textContent = last
    ? `${last.name} im ${state.workspace.lastMode === "ide" ? "IDE-Modus" : "Lernmodus"}`
    : "Noch kein Projekt geöffnet";
  document.querySelector("#dashboardSummary").innerHTML = [
    ["Account", state.account.username],
    ["Lernprojekte", state.projects.length],
    ["Geräte", state.devices.length],
    ["Builds", state.builds.length],
    ["Letzter Modus", state.workspace.lastMode || "kein Eintrag"],
  ].map(summaryItem).join("");
}

function renderProjects() {
  document.querySelector("#projectList").innerHTML = state.projects.map((project) => `
    <article class="project-card">
      <p class="eyebrow">${escapeHtml(project.type)}</p>
      <h2>${escapeHtml(project.name)}</h2>
      <p>${escapeHtml(project.description)}</p>
      <dl class="meta-list">
        ${meta("Project.id", project.id)}
        ${meta("ownerUserId", project.ownerUserId)}
        ${meta("targetRuntime", project.targetRuntime)}
        ${meta("linkedDeviceId", project.linkedDeviceId || "kein Device")}
      </dl>
      <div class="card-actions">
        <button type="button" data-open-project="${escapeHtml(project.id)}">Lernprojekt öffnen</button>
      </div>
    </article>
  `).join("");
  document.querySelectorAll("#projectList [data-open-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInLearn(button.dataset.openProject));
  });
}

function renderLearn() {
  document.querySelector("#learnProjectList").innerHTML = state.projects.map((project) => {
    const progress = progressFor(project.id);
    return `
      <article class="project-card">
        <p class="eyebrow">${escapeHtml(project.courseId)}</p>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.description)}</p>
        <dl class="meta-list">
          ${meta("Lektion", project.lessonId)}
          ${meta("Fortschritt", `${progress.completedSteps.length}/${project.steps.length}`)}
          ${meta("Projektdateien", project.sourceFiles.map((file) => file.path).join(", "))}
        </dl>
        <div class="card-actions">
          <button type="button" data-open-project="${escapeHtml(project.id)}">Lernprojekt starten</button>
        </div>
      </article>
    `;
  }).join("");
  document.querySelectorAll("#learnProjectList [data-open-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInLearn(button.dataset.openProject));
  });
}

function renderLesson(project) {
  const progress = progressFor(project.id);
  state.activeStep = Math.min(progress.currentStep || 0, project.steps.length - 1);
  document.querySelector("#lessonPanel").classList.remove("hidden");
  document.querySelector("#lessonSteps").innerHTML = project.steps.map((step, index) => `
    <button class="${index === state.activeStep ? "active" : ""}" type="button" data-step="${index}">
      ${index + 1}. ${escapeHtml(step.title)}
    </button>
  `).join("");
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => setLessonStep(Number(button.dataset.step)));
  });
  renderCurrentStep();
}

function renderCurrentStep() {
  const project = projectById(state.activeProjectId);
  if (!project) return;
  const step = project.steps[state.activeStep];
  document.querySelector("#lessonCounter").textContent = `Schritt ${state.activeStep + 1} von ${project.steps.length}`;
  document.querySelector("#lessonTitle").textContent = step.title;
  document.querySelector("#lessonText").textContent = step.text;
  document.querySelector("#lessonInsight").textContent = step.insight;
}

async function setLessonStep(index) {
  const project = projectById(state.activeProjectId);
  state.activeStep = index;
  const completed = new Set(progressFor(project.id).completedSteps);
  for (let step = 0; step < index; step += 1) completed.add(step);
  await saveLearningProgress(project, index, Array.from(completed));
  renderLesson(project);
}

async function nextLessonStep() {
  const project = projectById(state.activeProjectId);
  const completed = new Set(progressFor(project.id).completedSteps);
  completed.add(state.activeStep);
  const next = Math.min(state.activeStep + 1, project.steps.length - 1);
  await saveLearningProgress(project, next, Array.from(completed));
  renderLesson(project);
}

async function saveLearningProgress(project, currentStep, completedSteps) {
  const progress = await postJson("/api/platform/learning-progress", {
    courseId: project.courseId,
    lessonId: project.lessonId,
    projectId: project.id,
    currentStep,
    completedSteps,
  });
  state.progress = state.progress.filter((item) => item.id !== progress.id).concat(progress);
  state.workspace = await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "learn",
    lastRoute: `/app/learn/?project=${encodeURIComponent(project.id)}`,
  });
}

function renderIdeShell() {
  document.querySelector("#ideProjectSelect").innerHTML = state.projects.map((project) => `
    <option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>
  `).join("");
  document.querySelector("#ideDeviceSelect").innerHTML = state.devices.map((device) => `
    <option value="${escapeHtml(device.device_id)}">${escapeHtml(device.display_name)}${device.usb_flash_supported ? ` - ${device.build_target_label || "USB"}` : ""}</option>
  `).join("");
  document.querySelector("#ideDeviceSelect").value = state.activeDeviceId;
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
  document.querySelector("#ideEmptyState").classList.add("hidden");
  document.querySelector("#ideLayout").classList.remove("hidden");
  document.querySelector("#ideToolbar").classList.remove("hidden");
  state.sourcePath = primarySourcePath(project);
  state.activeIdeStep = Math.min(progressFor(project.id).currentStep || 0, Math.max(0, guidedViews(project).length - 1));
  document.querySelector("#ideProjectSelect").value = projectId;
  updateIdeProjectTools(project);
  document.querySelector("#ideProjectTitle").textContent = project.name;
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
      ["USB Device", selectedDevice()?.display_name || "kein Device"],
      ["Boardprofil", selectedDevice()?.build_target_label || "kein Boardprofil"],
      ["USB Port", selectedUsbPort() || "auto"],
    );
  }
  document.querySelector("#ideProjectMeta").innerHTML = metaItems.map(([key, value]) => meta(key, value)).join("");
  const source = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(state.sourcePath)}`);
  document.querySelector("#sourceEditor").value = source.content || "";
  renderProjectViewManifest(project);
  focusIdeStepSource(project);
  state.workspace = await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(project.id)}`,
  });
}

function renderIdeEmptyState() {
  document.querySelector("#ideEmptyState").classList.remove("hidden");
  document.querySelector("#ideLayout").classList.add("hidden");
  document.querySelector("#ideToolbar").classList.add("hidden");
  document.querySelector("#ideProjectTitle").textContent = "";
  document.querySelector("#ideProjectMeta").innerHTML = "";
  document.querySelector("#sourceEditor").value = "";
  document.querySelector("#ideProjectViewManifest").innerHTML = "";
}

function updateIdeProjectTools(project) {
  const hardwareTools = projectNeedsHardwareTools(project);
  const sourceEditing = projectNeedsSourceEditing(project);
  const sourceVisible = projectShowsSource(project);
  document.querySelector("#ideCurrentProjectLabel").textContent = project ? `Projekt: ${project.name}` : "";
  document.querySelector("#ideProjectSelect").classList.add("hidden");
  document.querySelector("#ideDeviceTools").classList.toggle("hidden", !hardwareTools);
  document.querySelector("#saveSourceButton").classList.toggle("hidden", !sourceEditing);
  document.querySelector("#sourcePanel").classList.toggle("hidden", !sourceVisible);
  document.querySelector("#ideLayout").classList.toggle("model-only", !sourceVisible);
  document.querySelector("#sourceEditor").readOnly = !sourceEditing;
}

function projectNeedsHardwareTools(project) {
  const capabilities = projectCapabilityIds(project);
  return Boolean(project?.buildConfig)
    || capabilities.some((capability) => ["flash_firmware", "ota", "ide_flash_usb", "ide_flash_ota", "cloud_flash"].includes(capability));
}

function projectNeedsSourceEditing(project) {
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

async function saveSource() {
  const project = projectById(state.activeProjectId);
  await putJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(state.sourcePath)}`, {
    content: document.querySelector("#sourceEditor").value,
  });
  await refresh();
  renderAll();
}

async function startBuild() {
  const project = projectById(state.activeProjectId);
  const device = selectedDevice() || state.devices[0];
  if (!device) return;
  const build = await postJson("/api/user-ide/build-jobs", {
    project_slug: project.slug,
    device_id: device.device_id,
    mode: "build",
  });
  state.builds.unshift(build);
  navigate("/app/builds/");
  renderBuilds();
}

async function startUsbFlash() {
  const project = projectById(state.activeProjectId);
  const device = selectedDevice();
  if (!project || !device) return;
  if (!selectedUsbPort() && state.usbPorts.length > 1) {
    setFlashStatus("error", "Mehrere USB-Serial-Ports gefunden. Bitte waehle den aktuellen Port, z. B. COM10.");
    return;
  }
  setFlashStatus("running", "Build und USB-Flash laufen...");
  try {
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      device_id: device.device_id,
      mode: "build_and_usb_flash",
      upload_port: selectedUsbPort(),
    });
    state.builds.unshift(build);
    setFlashStatus(build.status === "succeeded" ? "ok" : "error", `${build.status}: ${build.flash_status || "USB-Flash beendet"}`);
    navigate("/app/builds/");
    renderBuilds();
  } catch (error) {
    setFlashStatus("error", error.message);
  }
}

async function openProjectInLearn(projectId) {
  state.activeProjectId = projectId;
  const project = projectById(projectId);
  await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "learn",
    lastRoute: `/app/learn/?project=${encodeURIComponent(project.id)}`,
  });
  navigate(`/app/learn/?project=${encodeURIComponent(project.id)}`);
  renderLesson(project);
}

async function openProjectInIde(projectId) {
  state.activeProjectId = projectId;
  await postJson("/api/platform/workspace-state", {
    lastProjectId: projectId,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(projectId)}`,
  });
  navigate(`/app/ide/?project=${encodeURIComponent(projectId)}`);
  await loadIdeProject();
}

function continueLastProject() {
  if (!state.workspace.lastProjectId) {
    navigate("/app/learn/");
    return;
  }
  navigate(state.workspace.lastRoute || `/app/${state.workspace.lastMode}/?project=${encodeURIComponent(state.workspace.lastProjectId)}`);
}

async function discoverNetworkDevices() {
  if (selectedInventoryHardwareFamily() !== "esp32") {
    setDiscoveryStatus("running", "Dieser Hardware-Typ wird manuell inventarisiert.");
    return;
  }
  state.inventoryEsp32Method = "wlan";
  state.discoveredDevices = [];
  renderNetworkDiscovery();
  setDiscoveryStatus("running", "Lokales Netzwerk wird nach ESP32-Nodes mit gernetix-* durchsucht...");
  try {
    const result = await getJson("/api/platform/devices/discover?hardware_type=esp32");
    state.discoveredDevices = (result.items || []).filter((device) => hardwareTypeForProfile(device.hardware_profile_id) === "esp32");
    renderNetworkDiscovery();
    const found = state.discoveredDevices.length;
    setDiscoveryStatus("ok", found
      ? `${found} Board${found === 1 ? "" : "s"} gefunden. Markiere die Boards, die auf dein Konto laufen sollen.`
      : "Noch kein ESP32-Node mit gernetix-* gefunden. Das Board muss im gleichen Kunden-WLAN erreichbar sein; fuer USB-Zustaende nutze die USB-Methode.");
  } catch (error) {
    setDiscoveryStatus("error", error.message);
  }
}

async function identifyEsp32Bootloader() {
  if (selectedInventoryHardwareFamily() !== "esp32") {
    setDiscoveryStatus("running", "USB-Pruefung ist nur fuer ESP32 vorgesehen.");
    return;
  }
  if (state.inventoryEsp32Method !== "usb") {
    state.inventoryEsp32Method = "usb";
    state.discoveredDevices = [];
    renderNetworkDiscovery();
    setDiscoveryStatus("running", "ESP32 per USB gewaehlt. Bitte USB-Port auswaehlen und erneut pruefen.");
    return;
  }
  const port = document.querySelector("#esp32UsbPort").value;
  if (!port) {
    setDiscoveryStatus("error", "Bitte zuerst den ESP32-USB-Port auswaehlen.");
    return;
  }
  state.discoveredDevices = [{
    discovery_id: `bootloader-browser-${port}`,
    source_url: port,
    display_name: "ESP32 per Browser-Web-Serial",
    hardware_profile_id: selectedInventoryBoard()?.hardware_item_id || document.querySelector("#inventoryHardwareProfile").value || "hardware.processor_board.esp32_devkit",
    runtime_version: "",
    firmware_version: "",
    provisioning_state: "bootloader_check_required",
    connectivity_status: "usb_browser_required",
    ownership_status: "unregistered",
    esp32_inventory_state: "bootloader_only",
    treatment: "Keine lokale Toolchain verwenden. Per Browser-Web-Serial pruefen oder Basissoftware flashen; danach im Kunden-WLAN erneut suchen.",
    already_in_inventory: false,
  }];
  renderNetworkDiscovery();
  setDiscoveryStatus("running", "Fuer diesen Zustand wird keine lokale Installation verwendet. Der naechste Schritt ist Browser-Web-Serial-Flash, danach im Kunden-WLAN erneut suchen.");
}

async function identifyAvrBootloaderExperimental() {
  if (!("serial" in navigator)) {
    setDiscoveryStatus("error", "Dieser Browser unterstuetzt Web Serial nicht. Bitte Chrome oder Edge auf Desktop verwenden.");
    return;
  }
  setDiscoveryStatus("running", "Arduino-Nano-Bootloader wird experimentell per Browser-Web-Serial geprueft...");
  state.avrBootloaderResult = null;
  try {
    const port = await navigator.serial.requestPort();
    const result = await probeAvrBootloader(port);
    state.avrBootloaderResult = result;
    renderNetworkDiscovery();
    if (result.detected) {
      document.querySelector("#inventoryDisplayName").value = "Mein Arduino Nano";
      document.querySelector("#inventoryConnectivityStatus").value = "usb_connected";
      setInventoryStatus("ok", "Nano-Bootloader experimentell erkannt. Seriennummer bitte eintragen, dann manuell inventarisieren.");
      setDiscoveryStatus("ok", `STK500v1-Bootloader hat bei ${result.baudRate} Baud geantwortet. Das Board wurde nicht geflasht.`);
    } else {
      setDiscoveryStatus("error", "Kein STK500v1-Bootloader erkannt. Das kann an falschem Board, Reset-Timing, Treiber oder anderer Bootloader-Variante liegen.");
    }
  } catch (error) {
    if (error.name === "NotFoundError") {
      setDiscoveryStatus("running", "Keine serielle Schnittstelle ausgewaehlt.");
      return;
    }
    setDiscoveryStatus("error", error.message || "Arduino-Nano-Bootloader konnte nicht geprueft werden.");
  }
}

async function probeAvrBootloader(port) {
  const attempts = [57600, 115200];
  const errors = [];
  for (const baudRate of attempts) {
    try {
      const response = await tryAvrBootloaderSync(port, baudRate);
      if (response.detected) return response;
      errors.push(`${baudRate}: keine STK500-Antwort`);
    } catch (error) {
      errors.push(`${baudRate}: ${error.message}`);
    }
  }
  return {
    detected: false,
    baudRate: "",
    protocol: "stk500v1",
    detail: errors.join("; "),
  };
}

async function tryAvrBootloaderSync(port, baudRate) {
  let reader = null;
  let writer = null;
  try {
    await port.open({ baudRate });
    await resetSerialBootloader(port);
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    const responseBytes = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await writer.write(Uint8Array.from([0x30, 0x20]));
      const chunk = await readSerialBytes(reader, 220);
      responseBytes.push(...chunk);
      if (hasStk500SyncResponse(responseBytes)) {
        return {
          detected: true,
          baudRate,
          protocol: "stk500v1",
          detail: `Antwortbytes: ${responseBytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}`,
        };
      }
      await delay(80);
    }
    return {
      detected: false,
      baudRate,
      protocol: "stk500v1",
      detail: "Keine 0x14/0x10 Bootloader-Antwort",
    };
  } finally {
    try { writer?.releaseLock(); } catch {}
    try { await reader?.cancel(); } catch {}
    try { reader?.releaseLock(); } catch {}
    try { if (port.readable || port.writable) await port.close(); } catch {}
  }
}

async function resetSerialBootloader(port) {
  if (typeof port.setSignals !== "function") {
    await delay(350);
    return;
  }
  await port.setSignals({ dataTerminalReady: false, requestToSend: false });
  await delay(80);
  await port.setSignals({ dataTerminalReady: true, requestToSend: false });
  await delay(350);
}

async function readSerialBytes(reader, timeoutMs) {
  const timeout = delay(timeoutMs).then(() => ({ timeout: true, value: undefined }));
  const result = await Promise.race([reader.read(), timeout]);
  return result?.value ? Array.from(result.value) : [];
}

function hasStk500SyncResponse(bytes) {
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 0x14 && bytes[index + 1] === 0x10) return true;
  }
  return false;
}

function renderNetworkDiscovery() {
  const list = document.querySelector("#networkDiscoveryList");
  if (!list) return;
  renderEsp32UsbPortOptions();
  const family = selectedInventoryHardwareFamily();
  const isEsp32 = family === "esp32";
  const isArduinoNano = family === "arduino_nano";
  const isEsp32Usb = isEsp32 && state.inventoryEsp32Method === "usb";
  document.querySelector("#esp32DiscoveryActions").classList.toggle("hidden", !isEsp32);
  document.querySelector("#avrDiscoveryActions").classList.toggle("hidden", !isArduinoNano);
  document.querySelector("#esp32UsbPortLabel").classList.toggle("hidden", !isEsp32Usb);
  document.querySelector("#networkDiscoveryButton").classList.toggle("active-method", state.inventoryEsp32Method === "wlan");
  document.querySelector("#esp32BootloaderIdentifyButton").classList.toggle("active-method", state.inventoryEsp32Method === "usb");
  document.querySelector("#claimSelectedDiscoveredDevicesButton").classList.toggle("hidden", !isEsp32);
  document.querySelector("#deviceInventoryForm").classList.toggle("hidden", isEsp32);
  document.querySelector("#inventoryTypeHint").textContent = inventoryTypeHintText();
  if (!isEsp32) {
    list.innerHTML = isArduinoNano
      ? renderAvrBootloaderResult()
      : `<p class="empty">Fuer diesen Hardware-Typ ist keine Netzwerksuche noetig.</p>`;
    updateClaimSelectedButton();
    return;
  }
  if (!state.discoveredDevices.length) {
    list.innerHTML = `<p class="empty">Waehle fuer ESP32 zuerst WLAN-Suche oder USB-Pruefung.</p>`;
    updateClaimSelectedButton();
    return;
  }
  list.innerHTML = state.discoveredDevices.map((device) => `
    <article class="discovery-row ${device.ownership_status === "other_account" ? "is-locked" : ""}">
      <label class="discovery-select">
        <input
          type="checkbox"
          data-select-discovered-device="${escapeHtml(device.discovery_id)}"
          ${canClaimDiscoveredDevice(device) ? "" : "disabled"}
        />
      </label>
      <div class="discovery-main">
        <h3>${escapeHtml(device.display_name || device.serial_number || device.source_url)}</h3>
        <p>${escapeHtml(device.source_url)}</p>
        <strong class="state-badge ${escapeHtml(device.esp32_inventory_state || "unknown")}">${escapeHtml(esp32StateText(device))}</strong>
        <strong class="ownership-badge ${escapeHtml(device.ownership_status || "unknown")}">${escapeHtml(ownershipStatusText(device))}</strong>
        <p class="helper-text">${escapeHtml(device.treatment || esp32TreatmentText(device))}</p>
      </div>
      <dl class="meta-list">
        ${meta("serial_number", device.serial_number || "unbekannt")}
        ${meta("hostname", device.hostname || "unbekannt")}
        ${meta("hardware_profile_id", device.hardware_profile_id || "unbekannt")}
        ${meta("connectivity_status", device.connectivity_status || "unbekannt")}
        ${meta("provisioning_state", device.provisioning_state || "unbekannt")}
        ${meta("runtime_version", device.runtime_version || "unbekannt")}
      </dl>
    </article>
  `).join("");
  document.querySelectorAll("[data-select-discovered-device]").forEach((checkbox) => {
    checkbox.addEventListener("change", updateClaimSelectedButton);
  });
  updateClaimSelectedButton();
}

function renderAvrBootloaderResult() {
  const result = state.avrBootloaderResult;
  if (!result) {
    return `<p class="empty">Arduino Nano wird experimentell per Browser-Web-Serial gegen STK500v1-Bootloader getestet. Es wird nichts geflasht.</p>`;
  }
  return `
    <article class="discovery-row avr-result ${result.detected ? "" : "is-locked"}">
      <label class="discovery-select">
        <input type="checkbox" disabled />
      </label>
      <div class="discovery-main">
        <h3>${result.detected ? "Arduino Nano Bootloader erreichbar" : "Arduino Nano Bootloader nicht erkannt"}</h3>
        <p>${escapeHtml(result.protocol)}${result.baudRate ? ` - ${escapeHtml(result.baudRate)} Baud` : ""}</p>
        <strong class="state-badge ${result.detected ? "experimental_ok" : "experimental_failed"}">
          ${result.detected ? "Experimentell erkannt" : "Experimentell nicht erkannt"}
        </strong>
        <p class="helper-text">${result.detected
          ? "Der Browser konnte den STK500v1-Handshake lesen. Bitte Seriennummer eintragen und das Board manuell inventarisieren."
          : "Nicht jedes Nano-kompatible Board antwortet mit dieser Variante. Treiber, Reset-Timing und Bootloader koennen abweichen."}</p>
      </div>
      <dl class="meta-list">
        ${meta("Protokoll", result.protocol)}
        ${meta("Baudrate", result.baudRate || "unbekannt")}
        ${meta("Flash", "nicht ausgefuehrt")}
        ${meta("Lokale Installation", "nicht erforderlich")}
        ${meta("Detail", result.detail || "kein Detail")}
      </dl>
    </article>
  `;
}

function inventoryTypeHintText() {
  const board = selectedInventoryBoard();
  const family = selectedInventoryHardwareFamily();
  if (family === "esp32") {
    return `${board?.title || "ESP32-Board"}: Danach Methode waehlen. WLAN sucht erreichbare gernetix-* Nodes im Kunden-Netz. USB prueft blanke oder fremd geflashte Boards per Browser-Web-Serial.`;
  }
  if (family === "arduino_nano") {
    return `${board?.title || "Arduino Nano"} ist ein experimenteller Browser-Web-Serial-Pfad: Bootloader-Handshake testen, danach manuell inventarisieren. Keine avrdude-Installation, kein lokaler Helper.`;
  }
  return "Diese Hardware wird manuell inventarisiert.";
}

async function claimDiscoveredDevice(discoveryId) {
  const discovered = state.discoveredDevices.find((item) => item.discovery_id === discoveryId);
  if (!discovered) return;
  setDiscoveryStatus("running", `${discovered.display_name || discovered.serial_number} wird ins Inventar uebernommen...`);
  try {
    const device = await postJson("/api/platform/devices/from-discovery", discovered);
    state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
    state.discoveredDevices = state.discoveredDevices.filter((item) => item.discovery_id !== discoveryId);
    state.activeDeviceId = device.device_id;
    renderIdeShell();
    renderNetworkDiscovery();
    renderDevices();
    renderDashboard();
    setDiscoveryStatus("ok", `${device.display_name} wurde deinem Inventar hinzugefuegt.`);
  } catch (error) {
    setDiscoveryStatus("error", error.message);
  }
}

async function claimSelectedDiscoveredDevices() {
  const selectedIds = Array.from(document.querySelectorAll("[data-select-discovered-device]:checked"))
    .map((checkbox) => checkbox.dataset.selectDiscoveredDevice);
  const selected = selectedIds
    .map((id) => state.discoveredDevices.find((item) => item.discovery_id === id))
    .filter(canClaimDiscoveredDevice);
  if (!selected.length) return;
  const confirmed = window.confirm(`${selected.length} Board${selected.length === 1 ? "" : "s"} in dein Inventar uebernehmen?`);
  if (!confirmed) return;
  setDiscoveryStatus("running", `${selected.length} Board${selected.length === 1 ? " wird" : "s werden"} ins Inventar uebernommen...`);
  const claimed = [];
  try {
    for (const discovered of selected) {
      const device = await postJson("/api/platform/devices/from-discovery", discovered);
      claimed.push(device);
      state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
      state.discoveredDevices = state.discoveredDevices.map((item) => item.discovery_id === discovered.discovery_id
        ? { ...item, already_in_inventory: true, ownership_status: "current_account" }
        : item);
      state.activeDeviceId = device.device_id;
    }
    renderIdeShell();
    renderNetworkDiscovery();
    renderDevices();
    renderDashboard();
    setDiscoveryStatus("ok", `${claimed.length} Board${claimed.length === 1 ? "" : "s"} wurde${claimed.length === 1 ? "" : "n"} deinem Inventar hinzugefuegt.`);
  } catch (error) {
    renderNetworkDiscovery();
    setDiscoveryStatus("error", error.message);
  }
}

function updateClaimSelectedButton() {
  const button = document.querySelector("#claimSelectedDiscoveredDevicesButton");
  if (!button) return;
  const count = document.querySelectorAll("[data-select-discovered-device]:checked").length;
  button.disabled = count === 0;
  button.textContent = count
    ? `${count} ausgewaehlte${count === 1 ? "s" : ""} Board${count === 1 ? "" : "s"} uebernehmen`
    : "Ausgewaehlte ins Inventar uebernehmen";
}

function canClaimDiscoveredDevice(device) {
  return device
    && !device.already_in_inventory
    && device.ownership_status !== "other_account"
    && device.esp32_inventory_state === "node_online";
}

function ownershipStatusText(device) {
  if (device.already_in_inventory || device.ownership_status === "current_account") return "Gehoert deinem Konto";
  if (device.ownership_status === "other_account") return "Gehoert bereits einem anderen Konto";
  if (device.ownership_status === "unregistered") return "Noch keinem bekannten Konto zugeordnet";
  return "Kontostatus unbekannt";
}

function esp32StateText(device) {
  if (device.esp32_inventory_state === "node_online") return "Basissoftware: Node im WLAN";
  if (device.esp32_inventory_state === "basissoftware_setup_ap") return "Basissoftware: nicht im Kunden-WLAN";
  if (device.esp32_inventory_state === "bootloader_only") return "Nur Bootloader erkannt";
  return "ESP32-Zustand unbekannt";
}

function esp32TreatmentText(device) {
  if (device.esp32_inventory_state === "node_online") return "Kann nach Kontopruefung ins Inventar uebernommen werden.";
  if (device.esp32_inventory_state === "basissoftware_setup_ap") return "Nicht im normalen Inventarisierungsfluss verwenden, weil der Setup-AP die Backend-Verbindung trennt. Per USB oder Provisioning ins Kunden-WLAN bringen.";
  if (device.esp32_inventory_state === "bootloader_only") return "Basissoftware per Browser-Web-Serial/USB flashen; danach im Kunden-WLAN erneut suchen.";
  return "Zustand pruefen, bevor das Board inventarisiert wird.";
}

function setDiscoveryStatus(kind, text) {
  const status = document.querySelector("#networkDiscoveryStatus");
  if (!status) return;
  status.className = `flash-status ${kind}`;
  status.textContent = text;
}

function renderDevices() {
  document.querySelector("#deviceList").innerHTML = state.devices.map((device) => `
    <article class="device-row">
      <div>
        <h3>${escapeHtml(device.display_name)}</h3>
        <p>${escapeHtml(device.hardware_profile_id)}</p>
        <div class="card-actions">
          <button class="danger" type="button" data-remove-device="${escapeHtml(device.account_device_id)}">Aus Inventar entfernen</button>
        </div>
      </div>
      <dl class="meta-list">
        ${meta("authenticity_status", device.authenticity_status)}
        ${meta("connectivity_status", device.connectivity_status)}
        ${meta("ota_status", device.ota_status)}
        ${meta("usb_flash", device.usb_flash_supported ? usbFlashLabel(device) : "nicht konfiguriert")}
        ${meta("board_profile", device.build_target_label || "kein Boardprofil")}
      </dl>
    </article>
  `).join("");
  document.querySelectorAll("[data-remove-device]").forEach((button) => {
    button.addEventListener("click", () => removeInventoryDevice(button.dataset.removeDevice));
  });
}

function renderDeviceInventoryForm() {
  const boards = state.processorBoards.length ? state.processorBoards : fallbackProcessorBoards();
  const hardwareOptions = hardwareOptionsFromBoards(boards);
  if (!state.inventoryHardwareType || !hardwareOptions.some((type) => type.id === state.inventoryHardwareType)) {
    state.inventoryHardwareType = hardwareOptions[0]?.id || "hardware.processor_board.esp32_devkit";
  }
  document.querySelector("#inventoryHardwareType").innerHTML = hardwareOptions.map((type) => `
    <option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>
  `).join("");
  document.querySelector("#inventoryHardwareType").value = state.inventoryHardwareType;
  const selectedBoards = boards.filter((board) => boardId(board) === state.inventoryHardwareType);
  document.querySelector("#inventoryHardwareProfile").innerHTML = selectedBoards.map((board) => `
    <option value="${escapeHtml(board.hardware_item_id || board.hardware_profile_id)}">${escapeHtml(board.title || board.hardware_item_id || board.hardware_profile_id)}</option>
  `).join("");
  renderInventoryUsbPortOptions();
  const family = selectedInventoryHardwareFamily();
  document.querySelector("#inventoryUsbPortLabel").classList.toggle("hidden", family === "esp32");
  if (family === "esp32") {
    document.querySelector("#inventoryDisplayName").value = selectedInventoryBoard()?.title || "Mein ESP32";
  } else if (family === "arduino_nano") {
    document.querySelector("#inventoryDisplayName").value = "Mein Arduino Nano";
  }
  syncInventoryCapabilities();
  renderNetworkDiscovery();
}

function selectInventoryHardwareType() {
  state.inventoryHardwareType = document.querySelector("#inventoryHardwareType").value;
  state.inventoryEsp32Method = "";
  state.discoveredDevices = [];
  state.avrBootloaderResult = null;
  renderDeviceInventoryForm();
  const board = selectedInventoryBoard();
  const family = selectedInventoryHardwareFamily();
  setDiscoveryStatus("running", family === "esp32"
    ? `${board?.title || "ESP32-Board"} gewaehlt. Waehle jetzt WLAN-Suche oder USB-Pruefung.`
    : family === "arduino_nano"
      ? "Bereit fuer experimentellen Nano-Bootloader-Test per Browser-Web-Serial."
      : "Bereit fuer manuelle USB-Board-Inventarisierung.");
}

function syncInventoryCapabilities() {
  const boardId = document.querySelector("#inventoryHardwareProfile").value;
  const board = state.processorBoards.find((item) => item.hardware_item_id === boardId || item.hardware_profile_id === boardId)
    || fallbackProcessorBoards().find((item) => item.hardware_item_id === boardId);
  document.querySelector("#inventoryCapabilities").value = (board?.capability_ids || []).map((item) => String(item).replace(/^capability\./, "")).join(", ");
}

function hardwareOptionsFromBoards(boards) {
  const seen = new Set();
  return boards
    .filter((board) => {
      const id = boardId(board);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((board) => ({ id: boardId(board), label: board.title || boardId(board) }));
}

function selectedInventoryBoard() {
  const boards = state.processorBoards.length ? state.processorBoards : fallbackProcessorBoards();
  return boards.find((board) => boardId(board) === state.inventoryHardwareType) || null;
}

function selectedInventoryHardwareFamily() {
  return hardwareTypeForBoard(selectedInventoryBoard());
}

function hardwareTypeForBoard(board) {
  if (!board) return "other";
  const capabilities = (board.capability_ids || []).join(" ").toLowerCase();
  if (capabilities.includes("processor_esp32")) return "esp32";
  if (capabilities.includes("processor_arduino_avr")) return "arduino_nano";
  return hardwareTypeForProfile(`${board.hardware_item_id || ""} ${board.hardware_profile_id || ""} ${board.title || ""}`);
}

function boardId(board) {
  return board?.hardware_item_id || board?.hardware_profile_id || "";
}

function hardwareTypeForProfile(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("esp32") || normalized.includes("esp_wroom") || normalized.includes("esp-wroom")) return "esp32";
  if (normalized.includes("arduino_nano") || normalized.includes("arduino nano") || normalized.includes("atmega328p")) return "arduino_nano";
  return "other";
}

async function createInventoryDevice(event) {
  event.preventDefault();
  setInventoryStatus("running", "Geraet wird dem Account-Inventar hinzugefuegt...");
  try {
    const device = await postJson("/api/platform/devices", {
      display_name: document.querySelector("#inventoryDisplayName").value.trim(),
      serial_number: document.querySelector("#inventorySerialNumber").value.trim(),
      hardware_profile_id: document.querySelector("#inventoryHardwareProfile").value,
      technical_capability_ids: document.querySelector("#inventoryCapabilities").value.split(",").map((item) => item.trim()).filter(Boolean),
      connectivity_status: document.querySelector("#inventoryConnectivityStatus").value,
    });
    state.devices = state.devices.filter((item) => item.account_device_id !== device.account_device_id).concat(device);
    state.activeDeviceId = device.device_id;
    renderIdeShell();
    renderDevices();
    setInventoryStatus("ok", `${device.display_name} wurde inventarisiert.`);
    document.querySelector("#inventorySerialNumber").value = "";
  } catch (error) {
    setInventoryStatus("error", error.message);
  }
}

async function removeInventoryDevice(accountDeviceId) {
  const device = state.devices.find((item) => item.account_device_id === accountDeviceId);
  if (!device) return;
  const confirmed = window.confirm(`${device.display_name} aus deinem Inventar entfernen? Das physische Device wird nicht geloescht.`);
  if (!confirmed) return;
  setInventoryStatus("running", `${device.display_name} wird aus dem Inventar entfernt...`);
  try {
    await deleteJson(`/api/platform/devices/${encodeURIComponent(accountDeviceId)}`);
    state.devices = state.devices.filter((item) => item.account_device_id !== accountDeviceId);
    if (state.activeDeviceId === device.device_id) {
      state.activeDeviceId = state.devices.find((item) => item.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
    }
    renderIdeShell();
    renderDevices();
    renderDashboard();
    setInventoryStatus("ok", `${device.display_name} wurde aus deinem Inventar entfernt.`);
  } catch (error) {
    setInventoryStatus("error", error.message);
  }
}

function setInventoryStatus(kind, text) {
  const status = document.querySelector("#inventoryStatus");
  status.className = `flash-status ${kind}`;
  status.textContent = text;
}

function fallbackProcessorBoards() {
  return [
    {
      hardware_item_id: "hardware.processor_board.esp32_devkit",
      title: "ESP32 DevKit",
      capability_ids: ["processor_esp32", "wifi", "ota", "flash_firmware", "arduino_framework_runtime"],
    },
    {
      hardware_item_id: "hardware.processor_board.esp_wroom32",
      title: "ESP-WROOM-32 Dev Board",
      capability_ids: ["processor_esp32", "wifi", "ota", "flash_firmware", "arduino_framework_runtime"],
    },
    {
      hardware_item_id: "hardware.processor_board.esp_wroom32_display",
      title: "ESP-WROOM-32 mit Display",
      capability_ids: ["processor_esp32", "wifi", "ota", "display_output", "flash_firmware", "arduino_framework_runtime"],
    },
    {
      hardware_item_id: "hardware.processor_board.arduino_nano_atmega328p",
      title: "Arduino Nano ATmega328P",
      capability_ids: ["processor_arduino_avr", "arduino_framework_runtime", "atmel_avr_bare_metal_runtime", "flash_firmware"],
    },
  ];
}

function renderBuilds() {
  document.querySelector("#buildList").innerHTML = state.builds.length ? state.builds.map((build) => `
    <article class="build-row">
      <div>
        <h3>${escapeHtml(build.project_title)}</h3>
        <p>${escapeHtml(build.device_label)} · ${escapeHtml(build.mode)}</p>
      </div>
      <dl class="meta-list">
        ${meta("Status", build.status)}
        ${meta("BuildJob", build.build_job_id)}
        ${meta("Flash", build.flash_status || "nicht angefordert")}
      </dl>
    </article>
  `).join("") : `<p class="empty">Noch keine Builds gestartet.</p>`;
}

function selectedDevice() {
  return state.devices.find((device) => device.device_id === state.activeDeviceId) || state.devices[0] || null;
}

function syncSelectedDevicePort() {
  const device = selectedDevice();
  const select = document.querySelector("#usbPortSelect");
  if (!select) return;
  const matched = bestUsbPortForDevice(device);
  if (matched) {
    select.value = matched.port;
    return;
  }
  if (device && device.upload_port) select.value = device.upload_port;
}

async function refreshUsbPorts(showStatus = true) {
  try {
    const result = await getJson("/api/platform/usb-serial/ports");
    state.usbPorts = result.items || [];
    renderUsbPortOptions();
    syncSelectedDevicePort();
    renderDevices();
    if (showStatus) setFlashStatus("ok", state.usbPorts.length
      ? `${state.usbPorts.length} USB-Serial-Port${state.usbPorts.length === 1 ? "" : "s"} gefunden.`
      : "Kein USB-Serial-Port gefunden.");
  } catch (error) {
    state.usbPorts = [];
    renderUsbPortOptions();
    if (showStatus) setFlashStatus("error", error.message);
  }
}

function renderUsbPortOptions() {
  const select = document.querySelector("#usbPortSelect");
  if (!select) return;
  const current = select.value;
  const detected = state.usbPorts.map((port) => `
    <option value="${escapeHtml(port.port)}">${escapeHtml(port.port)} - ${escapeHtml(port.name || port.manufacturer || "USB Serial")}</option>
  `).join("");
  select.innerHTML = `<option value="">auto</option>${detected}`;
  if (current && Array.from(select.options).some((option) => option.value === current)) select.value = current;
  renderInventoryUsbPortOptions();
}

function renderInventoryUsbPortOptions() {
  const select = document.querySelector("#inventoryUsbPort");
  if (!select) return;
  const current = select.value;
  const detected = state.usbPorts.map((port) => `
    <option value="${escapeHtml(port.port)}">${escapeHtml(port.port)} - ${escapeHtml(port.name || port.manufacturer || "USB Serial")}</option>
  `).join("");
  select.innerHTML = `<option value="">USB-Port waehlen</option>${detected}`;
  if (current && Array.from(select.options).some((option) => option.value === current)) {
    select.value = current;
  } else {
    const matched = bestUsbPortForHardwareType(selectedInventoryHardwareFamily());
    if (matched) select.value = matched.port;
  }
}

function renderEsp32UsbPortOptions() {
  const select = document.querySelector("#esp32UsbPort");
  if (!select) return;
  const current = select.value;
  const detected = state.usbPorts.map((port) => `
    <option value="${escapeHtml(port.port)}">${escapeHtml(port.port)} - ${escapeHtml(port.name || port.manufacturer || "USB Serial")}</option>
  `).join("");
  select.innerHTML = `<option value="">ESP32 USB-Port waehlen</option>${detected}`;
  if (current && Array.from(select.options).some((option) => option.value === current)) {
    select.value = current;
  } else {
    const matched = bestUsbPortForHardwareType("esp32");
    if (matched) select.value = matched.port;
  }
}

function selectedUsbPort() {
  return document.querySelector("#usbPortSelect")?.value || "";
}

function bestUsbPortForDevice(device) {
  if (!device || !state.usbPorts.length) return null;
  const profile = String(device.hardware_profile_id || "").toLowerCase();
  const label = `${device.display_name || ""} ${device.build_target_label || ""}`.toLowerCase();
  const candidates = state.usbPorts.map((port) => ({
    ...port,
    haystack: `${port.name || ""} ${port.device_id || ""} ${port.manufacturer || ""}`.toLowerCase(),
  }));
  if (profile.includes("esp32") || label.includes("esp32")) {
    return candidates.find((port) => /cp210|ch340|ch341|usb-serial|usb serial|silicon labs|wch|uart|esp32/.test(port.haystack))
      || (candidates.length === 1 ? candidates[0] : null);
  }
  if (profile.includes("arduino_nano") || label.includes("arduino")) {
    return candidates.find((port) => /arduino|ch340|ch341|usb-serial|usb serial|wch/.test(port.haystack))
      || (candidates.length === 1 ? candidates[0] : null);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function bestUsbPortForHardwareType(type) {
  if (!state.usbPorts.length) return null;
  const candidates = state.usbPorts.map((port) => ({
    ...port,
    haystack: `${port.name || ""} ${port.device_id || ""} ${port.manufacturer || ""}`.toLowerCase(),
  }));
  if (type === "esp32") {
    return candidates.find((port) => /cp210|ch340|ch341|usb-serial|usb serial|silicon labs|wch|uart|esp32/.test(port.haystack))
      || (candidates.length === 1 ? candidates[0] : null);
  }
  if (type === "arduino_nano") {
    return candidates.find((port) => /arduino|ch340|ch341|usb-serial|usb serial|wch/.test(port.haystack))
      || (candidates.length === 1 ? candidates[0] : null);
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function usbFlashLabel(device) {
  const matched = bestUsbPortForDevice(device);
  if (matched) return `bereit (${matched.port} aktuell erkannt)`;
  if (device.upload_port) return `bereit (${device.upload_port} Fallback)`;
  return "bereit (Port vor Flash erkennen)";
}

function setFlashStatus(kind, text) {
  const status = document.querySelector("#flashStatus");
  status.className = `flash-status ${kind}`;
  status.textContent = text;
}

function renderBilling() {
  document.querySelector("#billingSummary").innerHTML = [
    ["Plan", state.billing.plan],
    ["Entitlements", state.billing.entitlements.join(", ")],
    ["KI-Credits", state.billing.ai_credits.available_credits ?? 0],
    ["Verbrauchte Credits", state.billing.ai_credits.consumed_credits ?? 0],
  ].map(summaryItem).join("");
}

function progressFor(projectId) {
  return state.progress.find((item) => item.projectId === projectId) || { currentStep: 0, completedSteps: [] };
}

function projectById(projectId) {
  return state.projects.find((project) => project.id === projectId) || state.projects[0];
}

function primarySourcePath(project) {
  return project?.viewManifest?.primary_source_path || project?.sourceFiles?.[0]?.path || "src/main.cpp";
}

function renderProjectViewManifest(project) {
  const target = document.querySelector("#ideProjectViewManifest");
  if (!target) return;
  const manifest = project?.viewManifest || {};
  const views = guidedViews(project);
  if (!views.length) {
    target.innerHTML = `<p class="empty">Dieses Projekt hat noch keine gespeicherte IDE-Ansicht.</p>`;
    return;
  }
  state.activeIdeStep = Math.min(state.activeIdeStep || 0, views.length - 1);
  const activeView = views[state.activeIdeStep];
  const validation = validateGuidedView(activeView);
  const progress = progressFor(project.id);
  target.innerHTML = `
    <div class="manifest-head">
      <p class="eyebrow">Projektansicht</p>
      <h3>${escapeHtml(manifest.title || "IDE Ansicht")}</h3>
      <p>${escapeHtml(manifest.summary || "")}</p>
    </div>
    <div class="guided-runner">
      <nav class="guided-step-rail" aria-label="Guided IDE Schritte">
        ${views.map((view, index) => `
          <button class="${index === state.activeIdeStep ? "active" : ""} ${progress.completedSteps.includes(index) ? "done" : ""}" type="button" data-ide-step="${index}">
            <span>${index + 1}</span>
            ${escapeHtml(view.title || view.id)}
          </button>
        `).join("")}
      </nav>
      <section class="guided-step-panel">
        <p class="eyebrow">Schritt ${state.activeIdeStep + 1} von ${views.length}</p>
        <div class="guided-artifact-layout">
          <section class="guided-artifact-pane">
            ${renderGuidedArtifact(activeView)}
          </section>
          <aside class="guided-summary-pane">
            ${renderManifestView(activeView, validation)}
            ${renderGuidedValidation(activeView, validation)}
            ${renderGuidedActions(project, activeView, validation)}
          </aside>
        </div>
      </section>
    </div>
  `;
  target.querySelectorAll("[data-ide-step]").forEach((button) => {
    button.addEventListener("click", () => setIdeGuidedStep(project, Number(button.dataset.ideStep)));
  });
  target.querySelector("[data-guided-back]")?.addEventListener("click", () => setIdeGuidedStep(project, Math.max(0, state.activeIdeStep - 1)));
  target.querySelector("[data-guided-next]")?.addEventListener("click", () => completeIdeGuidedStep(project));
  target.querySelector("[data-guided-preview]")?.addEventListener("click", () => openGuidedRuntimePreview(activeView));
  renderGuidedPlantUml(target);
}

function renderGuidedArtifact(view) {
  const artifact = view.payload?.artifact || {};
  if (artifact.type === "code") return renderGuidedCodeArtifact(artifact);
  if (artifact.type === "state_rows") return renderGuidedStateRows(artifact);
  if (artifact.type === "cycle") return renderGuidedCycle(artifact);
  if (view.type === "plantuml" || artifact.type === "plantuml") return renderGuidedPlantUmlArtifact(view);
  if (artifact.type === "svg_note") return renderGuidedSvgNote(artifact);
  return `
    <div class="guided-artifact-empty">
      <p class="eyebrow">Artefakt</p>
      <h3>${escapeHtml(view.title || "Projektartefakt")}</h3>
      <p>${escapeHtml(view.summary || "Dieses Projekt legt fest, welches Artefakt hier angezeigt wird.")}</p>
    </div>
  `;
}

function renderGuidedCodeArtifact(artifact) {
  const lines = String(artifact.content || "").replace(/\r\n/g, "\n").split("\n");
  return `
    <div class="guided-code-viewer">
      <div class="guided-artifact-head">
        <p class="eyebrow">Code Viewer</p>
        <h3>${escapeHtml(artifact.title || "Quellcode")}</h3>
      </div>
      <pre>${lines.map((line, index) => `<span><b>${String(index + 1).padStart(3, " ")}</b>${escapeHtml(line)}</span>`).join("")}</pre>
    </div>
  `;
}

function renderGuidedStateRows(artifact) {
  const rows = artifact.rows || [];
  return `
    <div class="guided-visual-stage">
      <div class="guided-artifact-head">
        <p class="eyebrow">Visualisierung</p>
        <h3>${escapeHtml(artifact.title || "Zustaende")}</h3>
      </div>
      <div class="guided-state-rows">
        ${rows.map((row) => `
          <section class="guided-state-row">
            <div>
              <strong>${escapeHtml(row.label)}</strong>
              <p>${escapeHtml(row.description || "")}</p>
            </div>
            <div class="guided-state-sequence">
              ${(row.states || []).map(renderGuidedStateCard).join("")}
            </div>
          </section>
        `).join("")}
      </div>
    </div>
  `;
}

function renderGuidedCycle(artifact) {
  const states = artifact.states || [];
  const transitions = artifact.transitions || [];
  const firstState = states[0] || { label: "Start", kind: "label" };
  const secondState = states[1] || { label: "Ziel", kind: "label" };
  return `
    <div class="guided-visual-stage">
      <div class="guided-artifact-head">
        <p class="eyebrow">SVG Modell</p>
        <h3>${escapeHtml(artifact.title || "Zustandskreislauf")}</h3>
      </div>
      <section class="guided-cycle" aria-label="${escapeAttribute(artifact.title || "Zustandskreislauf")}">
        <svg class="guided-cycle-arrows" viewBox="0 0 720 360" aria-hidden="true" focusable="false">
          <defs>
            <marker id="guidedCycleArrowHead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z"></path>
            </marker>
          </defs>
          <path class="guided-cycle-path" d="M 230 132 C 310 18, 410 18, 490 132"></path>
          <path class="guided-cycle-path" d="M 490 228 C 410 342, 310 342, 230 228"></path>
        </svg>
        <article class="guided-state-card guided-cycle-state">${renderGuidedStatePicture(firstState)}<strong>${escapeHtml(firstState.label)}</strong></article>
        <div class="guided-cycle-transition guided-cycle-top"><span>${escapeHtml(transitions[0]?.label || "")}</span></div>
        <article class="guided-state-card guided-cycle-state">${renderGuidedStatePicture(secondState)}<strong>${escapeHtml(secondState.label)}</strong></article>
        <div class="guided-cycle-transition guided-cycle-bottom"><span>${escapeHtml(transitions[1]?.label || "")}</span></div>
      </section>
    </div>
  `;
}

function renderGuidedPlantUmlArtifact(view) {
  const source = view.payload?.source || view.payload?.artifact?.source || "";
  const highlightLines = new Set((view.payload?.highlight_lines || view.payload?.highlightLines || []).map(Number));
  const sourceLines = String(source).replace(/\r\n/g, "\n").split("\n");
  return `
    <div class="guided-plantuml-workspace">
      <div class="guided-artifact-head">
        <p class="eyebrow">PlantUML</p>
        <h3>${escapeHtml(view.title || "Zustandsmodell")}</h3>
      </div>
      <figure class="plantuml-viewer">
        <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(source)}" alt="${escapeAttribute(view.title || "PlantUML Diagramm")}">
        <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
      </figure>
      <pre class="plantuml-box highlighted-source">${sourceLines.map((line, index) => `<span class="${highlightLines.has(index + 1) ? "is-highlighted" : ""}"><b>${String(index + 1).padStart(2, " ")}</b>${escapeHtml(line || " ")}</span>`).join("")}</pre>
    </div>
  `;
}

function renderGuidedSvgNote(artifact) {
  return `
    <div class="guided-svg-note">
      <svg viewBox="0 0 720 360" aria-hidden="true" focusable="false">
        <rect x="70" y="70" width="220" height="120" rx="12"></rect>
        <rect x="430" y="70" width="220" height="120" rx="12"></rect>
        <path d="M 290 130 C 340 80, 380 80, 430 130"></path>
        <path d="M 430 170 C 380 230, 340 230, 290 170"></path>
      </svg>
      <h3>${escapeHtml(artifact.title || "Modellartefakt")}</h3>
      <p>${escapeHtml(artifact.text || "")}</p>
    </div>
  `;
}

function renderGuidedStateCard(state) {
  const value = state.value && state.showValue !== false ? `<span>${escapeHtml(state.value)}</span>` : "";
  const substates = state.substates?.length ? `<div class="guided-substates">${state.substates.map((item) => `<em>${escapeHtml(item)}</em>`).join("")}</div>` : "";
  return `
    <article class="guided-state-card">
      ${renderGuidedStatePicture(state)}
      <strong>${escapeHtml(state.label)}</strong>
      ${value}
      ${substates}
    </article>
  `;
}

function renderGuidedStatePicture(state) {
  if (state.kind === "barrel") return `<div class="guided-picture barrel"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
  if (state.kind === "battery") return `<div class="guided-picture battery"><span style="width: ${Number(state.level) || 0}%"></span></div>`;
  if (state.kind === "thermometer") return `<div class="guided-picture thermometer"><span style="height: ${Number(state.level) || 0}%"></span></div>`;
  if (state.kind === "power") return `<div class="guided-picture power ${state.value === "on" ? "on" : "off"}"><span>${state.value === "on" ? "AN" : "AUS"}</span></div>`;
  if (state.kind === "weather") return `<div class="guided-picture weather"><span>${escapeHtml(state.label)}</span></div>`;
  if (state.kind === "label") return `<div class="guided-picture label-state"><span>${escapeHtml(state.value || state.label)}</span></div>`;
  return `<div class="guided-picture stone ${escapeAttribute(state.tone || "warm")}"><span></span></div>`;
}

function renderManifestView(view, validation = null) {
  const typeLabel = {
    source_analysis: "Analyse",
    explanation: "Erklaerung",
    story_slide: "Lernfolie",
    plantuml: "PlantUML",
    implementation_plan: "Umsetzung",
    runtime_preview: "Preview",
  }[view.type] || view.type;
  return `
    <article class="manifest-view-card active-step">
      <div class="manifest-view-title">
        <span>${escapeHtml(typeLabel)}</span>
        <strong>${escapeHtml(view.title || view.id)}</strong>
      </div>
      <p>${escapeHtml(view.summary || "")}</p>
      ${renderManifestPayload(view)}
      ${validation?.focus ? `<pre class="source-focus-box">${escapeHtml(validation.focus)}</pre>` : ""}
    </article>
  `;
}

function renderManifestPayload(view) {
  const payload = view.payload || {};
  if (view.type === "source_analysis") {
    const lines = (view.source_lines || []).length ? `Zeilen: ${(view.source_lines || []).join(", ")}` : "";
    const questions = payload.questions || [];
    return `
      <dl class="meta-list compact">
        ${meta("Datei", view.source_path || "Projektquelle")}
        ${lines ? meta("Fokus", lines) : ""}
      </dl>
      ${questions.length ? `<ul class="manifest-list">${questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    `;
  }
  if (view.type === "explanation") {
    const cards = payload.cards || [];
    return cards.length ? `<div class="explanation-grid">${cards.map((card) => `
      <div>
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.text)}</p>
      </div>
    `).join("")}</div>` : "";
  }
  if (view.type === "story_slide") {
    const lines = payload.model_lines || [];
    const note = payload.note || "";
    return `
      ${note ? `<div class="insight">${escapeHtml(note)}</div>` : ""}
      ${lines.length ? `<div class="model-line-list">${lines.map((line) => `
        <article>
          <span>${escapeHtml(line.label)}</span>
          <p>${escapeHtml(line.text)}</p>
        </article>
      `).join("")}</div>` : ""}
    `;
  }
  if (view.type === "plantuml") {
    const lines = payload.model_lines || [];
    return `
      <p class="helper-text">Links siehst du das gerenderte Diagramm und die PlantUML-Quelle als Projektartefakt.</p>
      ${lines.length ? `<div class="model-line-list">${lines.map((line) => `
        <article>
          <span>${escapeHtml(line.label)}</span>
          <p>${escapeHtml(line.text)}</p>
        </article>
      `).join("")}</div>` : ""}
    `;
  }
  if (view.type === "implementation_plan") {
    const tasks = payload.tasks || [];
    return tasks.length ? `<ul class="manifest-list">${tasks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
  }
  return Object.keys(payload).length ? `<pre class="plantuml-box">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>` : "";
}

function guidedViews(project) {
  return Array.isArray(project?.viewManifest?.views) ? project.viewManifest.views : [];
}

function validateGuidedView(view) {
  const source = document.querySelector("#sourceEditor")?.value || "";
  const payloadSource = view?.payload?.source || "";
  const validation = view?.validation || {};
  const completion = view?.completion || {};
  const focus = sourceFocusText(source, view?.source_lines || view?.editable_lines || []);

  if (validation.type === "source_contains_all" || completion.type === "source_contains_all") {
    const required = validation.must_contain || completion.must_contain || ["delay"];
    const missing = required.filter((item) => !source.includes(item));
    return {
      canContinue: missing.length === 0,
      message: missing.length ? "Dieser Schritt braucht noch eine kleine Ergaenzung." : "",
      focus,
    };
  }

  if (validation.type === "plantuml_contains") {
    const required = validation.must_contain || [];
    const missing = required.filter((item) => !payloadSource.includes(item));
    return {
      canContinue: missing.length === 0,
      message: missing.length ? "Das Diagramm konnte noch nicht passend gelesen werden." : "",
      focus,
    };
  }

  return {
    canContinue: true,
    message: "",
    focus,
  };
}

function sourceFocusText(source, lines) {
  const selected = Array.from(new Set((lines || []).map(Number).filter((line) => line > 0))).sort((left, right) => left - right);
  if (!selected.length) return "";
  const sourceLines = source.split(/\r?\n/);
  return selected
    .map((line) => `${String(line).padStart(3, " ")} | ${sourceLines[line - 1] || ""}`)
    .join("\n");
}

function renderGuidedValidation(view, validation) {
  if (validation.canContinue) return "";
  return `<div class="validation blocked">${escapeHtml(validation.message || "Dieser Schritt ist noch nicht bereit.")}</div>`;
}

function renderGuidedActions(project, view, validation) {
  const views = guidedViews(project);
  const isLast = state.activeIdeStep >= views.length - 1;
  return `
    <div class="guided-actions">
      <button type="button" data-guided-back ${state.activeIdeStep === 0 ? "disabled" : ""}>Zurueck</button>
      ${view.runtime_preview ? `<button type="button" data-guided-preview>${escapeHtml(view.runtime_preview.button_label || "Preview starten")}</button>` : ""}
      <button class="primary" type="button" data-guided-next ${validation.canContinue ? "" : "disabled"}>
        ${isLast ? "Fertig" : "Weiter"}
      </button>
    </div>
  `;
}

async function setIdeGuidedStep(project, index) {
  state.activeIdeStep = Math.max(0, Math.min(index, guidedViews(project).length - 1));
  await saveIdeGuidedProgress(project, state.activeIdeStep, progressFor(project.id).completedSteps);
  renderProjectViewManifest(project);
  focusIdeStepSource(project);
}

async function completeIdeGuidedStep(project) {
  const completed = new Set(progressFor(project.id).completedSteps);
  completed.add(state.activeIdeStep);
  const next = Math.min(state.activeIdeStep + 1, guidedViews(project).length - 1);
  state.activeIdeStep = next;
  await saveIdeGuidedProgress(project, next, Array.from(completed));
  renderProjectViewManifest(project);
  focusIdeStepSource(project);
}

async function saveIdeGuidedProgress(project, currentStep, completedSteps) {
  const progress = await postJson("/api/platform/learning-progress", {
    courseId: project.courseId,
    lessonId: project.lessonId,
    projectId: project.id,
    currentStep,
    completedSteps,
  });
  state.progress = state.progress.filter((item) => item.id !== progress.id).concat(progress);
  state.workspace = await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(project.id)}`,
  });
}

function focusIdeStepSource(project) {
  const view = guidedViews(project)[state.activeIdeStep];
  const line = Number((view?.source_lines || view?.editable_lines || [])[0] || 0);
  const editor = document.querySelector("#sourceEditor");
  if (!editor || !line) return;
  const lines = editor.value.split(/\r?\n/);
  const start = lines.slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0);
  const end = start + (lines[line - 1] || "").length;
  editor.focus();
  editor.setSelectionRange(start, end);
}

function openGuidedRuntimePreview(view) {
  const preview = view.runtime_preview || {};
  const frames = preview.frames || ["Preview bereit."];
  const overlay = document.createElement("div");
  overlay.className = "runtime-modal";
  overlay.innerHTML = `
    <section class="runtime-dialog" role="dialog" aria-modal="true" aria-label="${escapeAttribute(preview.title || "Runtime Preview")}">
      <div class="runtime-dialog-header">
        <div>
          <p class="eyebrow">Runtime Preview</p>
          <h2>${escapeHtml(preview.title || view.title || "Preview")}</h2>
        </div>
        <button type="button" data-close-preview aria-label="Schliessen">Schliessen</button>
      </div>
      <div class="runtime-frame-list">
        ${frames.map((frame, index) => `<div class="runtime-frame"><span>${index + 1}</span>${escapeHtml(frame)}</div>`).join("")}
      </div>
    </section>
  `;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.dataset.closePreview !== undefined) overlay.remove();
  });
  document.body.append(overlay);
}

function renderGuidedPlantUml(root) {
  root.querySelectorAll("[data-plantuml-source]").forEach((image) => renderPlantUmlImage(image, image.dataset.plantumlSource || ""));
}

async function renderPlantUmlImage(image, source) {
  const status = image.closest(".plantuml-viewer")?.querySelector(".plantuml-status");
  if (!source) return;
  try {
    image.src = await createPlantUmlSvgUrl(source);
    image.addEventListener("load", () => {
      image.classList.add("loaded");
      if (status) status.textContent = "Gerendert aus PlantUML.";
    }, { once: true });
    image.addEventListener("error", () => {
      if (status) status.textContent = "PlantUML-Bild konnte nicht geladen werden.";
    }, { once: true });
  } catch {
    if (status) status.textContent = "PlantUML-Bild konnte im Browser nicht erzeugt werden.";
  }
}

async function createPlantUmlSvgUrl(source) {
  const bytes = new TextEncoder().encode(source);
  const compressed = await deflateForPlantUml(bytes);
  return `https://www.plantuml.com/plantuml/svg/${encodePlantUmlBytes(compressed)}`;
}

async function deflateForPlantUml(bytes) {
  if (typeof CompressionStream === "undefined") throw new Error("CompressionStream unavailable");
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return compressed.slice(2, -4);
}

function encodePlantUmlBytes(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    output += appendPlantUml3Bytes(bytes[index], bytes[index + 1] ?? 0, bytes[index + 2] ?? 0);
  }
  return output;
}

function appendPlantUml3Bytes(byte1, byte2, byte3) {
  const c1 = byte1 >> 2;
  const c2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
  const c3 = ((byte2 & 0xf) << 2) | (byte3 >> 6);
  const c4 = byte3 & 0x3f;
  return encodePlantUml6Bit(c1 & 0x3f)
    + encodePlantUml6Bit(c2 & 0x3f)
    + encodePlantUml6Bit(c3 & 0x3f)
    + encodePlantUml6Bit(c4 & 0x3f);
}

function encodePlantUml6Bit(value) {
  if (value < 10) return String.fromCharCode(48 + value);
  value -= 10;
  if (value < 26) return String.fromCharCode(65 + value);
  value -= 26;
  if (value < 26) return String.fromCharCode(97 + value);
  value -= 26;
  if (value === 0) return "-";
  if (value === 1) return "_";
  return "?";
}

function summaryItem([label, value]) {
  return `<article class="summary-item"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong></article>`;
}

function meta(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

async function postJson(url, body) {
  return writeJson("POST", url, body);
}

async function putJson(url, body) {
  return writeJson("PUT", url, body);
}

async function deleteJson(url) {
  const response = await fetch(url, { method: "DELETE" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

async function writeJson(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
