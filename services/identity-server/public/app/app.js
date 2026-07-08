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
  inventoryProcessorFamily: "",
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

let deviceOnboardingController = null;
let guidedProjectViewController = null;

function deviceOnboarding() {
  if (!deviceOnboardingController) {
    deviceOnboardingController = DeviceOnboardingController.create({
      state,
      model: DeviceOnboardingModel,
      getJson,
      postJson,
      delay,
      fallbackProcessorBoards,
      renderDashboard,
      renderDevices,
      renderEsp32UsbPortOptions,
      renderIdeShell,
      renderInventoryUsbPortOptions,
      escapeHtml,
      meta,
    });
  }
  return deviceOnboardingController;
}

function guidedProjectView() {
  if (!guidedProjectViewController) {
    guidedProjectViewController = GuidedProjectView.create({
      state,
      postJson,
      progressFor,
      escapeHtml,
      escapeAttribute,
      meta,
    });
  }
  return guidedProjectViewController;
}

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
document.querySelector("#inventoryProcessorFamily").addEventListener("change", selectInventoryProcessorFamily);
document.querySelector("#inventoryHardwareType").addEventListener("change", selectInventoryHardwareType);
document.querySelector("#inventoryHardwareProfile").addEventListener("change", syncInventoryCapabilities);
document.querySelector("#inventoryBoardShortName").addEventListener("input", syncInventoryNodeNamePreview);
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
  return deviceOnboarding().discoverNetworkDevices();
}

async function identifyEsp32Bootloader() {
  return deviceOnboarding().identifyEsp32Bootloader();
}

async function identifyAvrBootloaderExperimental() {
  return deviceOnboarding().identifyAvrBootloaderExperimental();
}

function renderNetworkDiscovery() {
  return deviceOnboarding().renderNetworkDiscovery();
}

async function claimDiscoveredDevice(discoveryId) {
  return deviceOnboarding().claimDiscoveredDevice(discoveryId);
}

async function claimSelectedDiscoveredDevices() {
  return deviceOnboarding().claimSelectedDiscoveredDevices();
}

function setDiscoveryStatus(kind, text) {
  return deviceOnboarding().setDiscoveryStatus(kind, text);
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
        ${meta("node_name", device.node_name || "nicht gesetzt")}
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
  return deviceOnboarding().renderDeviceInventoryForm();
}

function selectInventoryProcessorFamily() {
  return deviceOnboarding().selectInventoryProcessorFamily();
}

function selectInventoryHardwareType() {
  return deviceOnboarding().selectInventoryHardwareType();
}

function syncInventoryCapabilities() {
  return deviceOnboarding().syncInventoryCapabilities();
}

function syncInventoryNodeNamePreview() {
  return deviceOnboarding().syncInventoryNodeNamePreview();
}

function selectedInventoryHardwareFamily() {
  return deviceOnboarding().selectedInventoryHardwareFamily();
}

async function createInventoryDevice(event) {
  return deviceOnboarding().createInventoryDevice(event);
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
  return deviceOnboarding().setInventoryStatus(kind, text);
}

function fallbackProcessorBoards() {
  return [
    {
      hardware_item_id: "hardware.processor_board.generic_esp_wroom32",
      title: "Generisches ESP32-Board mit ESP-WROOM-32 Modul",
      processor_family: "esp32",
      module_name: "ESP-WROOM-32",
      mcu_variant: "ESP32",
      capability_ids: ["processor_esp32", "wifi", "ota", "device_http_status", "basissoftware_supported", "usb_identification", "flash_firmware", "arduino_framework_runtime"],
    },
    {
      hardware_item_id: "hardware.processor_board.espressif_esp32_s3_devkitc_1",
      title: "Espressif ESP32-S3-DevKitC-1",
      processor_family: "esp32",
      module_name: "ESP32-S3-WROOM-1",
      mcu_variant: "ESP32-S3",
      capability_ids: ["processor_esp32", "wifi", "ota", "device_http_status", "basissoftware_supported", "usb_identification", "flash_firmware", "arduino_framework_runtime"],
    },
    {
      hardware_item_id: "hardware.processor_board.wemos_d1_mini_esp12f",
      title: "Wemos D1 mini / ESP-12F",
      processor_family: "esp8266",
      module_name: "ESP-12F",
      mcu_variant: "ESP8266EX",
      capability_ids: ["processor_esp8266", "wifi", "device_http_status", "basissoftware_supported", "usb_identification", "flash_firmware", "arduino_framework_runtime"],
    },
    {
      hardware_item_id: "hardware.processor_board.arduino_nano_r3_atmega328p",
      title: "Arduino Nano R3 / ATmega328P",
      processor_family: "avr_8bit",
      mcu_variant: "ATmega328P",
      capability_ids: ["processor_avr_8bit", "processor_arduino_avr", "arduino_framework_runtime", "atmel_avr_bare_metal_runtime", "usb_identification", "flash_firmware"],
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
  return guidedProjectView().renderProjectViewManifest(project);
}

function guidedViews(project) {
  return guidedProjectView().guidedViews(project);
}

function focusIdeStepSource(project) {
  return guidedProjectView().focusIdeStepSource(project);
}

function summaryItem([label, value]) {
  return DomUtils.summaryItem([label, value]);
}

function meta(label, value) {
  return DomUtils.meta(label, value);
}

async function getJson(url) {
  return ApiClient.getJson(url);
}

async function postJson(url, body) {
  return ApiClient.postJson(url, body);
}

async function putJson(url, body) {
  return ApiClient.putJson(url, body);
}

async function deleteJson(url) {
  return ApiClient.deleteJson(url);
}

function escapeHtml(value) {
  return DomUtils.escapeHtml(value);
}

function escapeAttribute(value) {
  return DomUtils.escapeAttribute(value);
}

function delay(ms) {
  return DomUtils.delay(ms);
}
