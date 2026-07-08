const state = {
  account: null,
  projects: [],
  devices: [],
  discoveredDevices: [],
  processorBoards: [],
  builds: [],
  billing: null,
  progress: [],
  workspace: null,
  activeProjectId: "",
  activeDeviceId: "",
  activeStep: 0,
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
document.querySelector("#saveSourceButton").addEventListener("click", saveSource);
document.querySelector("#buildButton").addEventListener("click", startBuild);
document.querySelector("#usbFlashButton").addEventListener("click", startUsbFlash);
document.querySelector("#networkDiscoveryButton").addEventListener("click", discoverNetworkDevices);
document.querySelector("#deviceInventoryForm").addEventListener("submit", createInventoryDevice);
document.querySelector("#inventoryHardwareProfile").addEventListener("change", syncInventoryCapabilities);
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
    ["Projekte", state.projects.length],
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
        <button type="button" data-learn-project="${escapeHtml(project.id)}">Lernen</button>
        <button type="button" data-ide-project="${escapeHtml(project.id)}">In IDE öffnen</button>
      </div>
    </article>
  `).join("");
  document.querySelectorAll("[data-learn-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInLearn(button.dataset.learnProject));
  });
  document.querySelectorAll("[data-ide-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInIde(button.dataset.ideProject));
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
          <button type="button" data-learn-project="${escapeHtml(project.id)}">Lernen starten</button>
          <button type="button" data-ide-project="${escapeHtml(project.id)}">In IDE öffnen</button>
        </div>
      </article>
    `;
  }).join("");
  document.querySelectorAll("[data-learn-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInLearn(button.dataset.learnProject));
  });
  document.querySelectorAll("[data-ide-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInIde(button.dataset.ideProject));
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
  syncSelectedDevicePort();
}

async function loadIdeProject() {
  const projectId = new URLSearchParams(window.location.search).get("project") || state.activeProjectId || state.projects[0]?.id;
  if (!projectId) return;
  state.activeProjectId = projectId;
  const project = projectById(projectId);
  state.sourcePath = primarySourcePath(project);
  document.querySelector("#ideProjectSelect").value = projectId;
  document.querySelector("#ideProjectTitle").textContent = project.name;
  document.querySelector("#ideProjectMeta").innerHTML = [
    ["id", project.id],
    ["ownerUserId", project.ownerUserId],
    ["lastOpenedMode", "ide"],
    ["targetRuntime", project.targetRuntime],
    ["Datei", state.sourcePath],
    ["linkedDeviceId", project.linkedDeviceId || "kein Device"],
    ["USB Device", selectedDevice()?.display_name || "kein Device"],
    ["Boardprofil", selectedDevice()?.build_target_label || "kein Boardprofil"],
    ["USB Port", document.querySelector("#usbPortInput").value || "auto"],
  ].map(([key, value]) => meta(key, value)).join("");
  const source = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(state.sourcePath)}`);
  document.querySelector("#sourceEditor").value = source.content || "";
  renderProjectViewManifest(project);
  state.workspace = await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(project.id)}`,
  });
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
  setFlashStatus("running", "Build und USB-Flash laufen...");
  try {
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      device_id: device.device_id,
      mode: "build_and_usb_flash",
      upload_port: document.querySelector("#usbPortInput").value.trim(),
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
  setDiscoveryStatus("running", "Lokales Netzwerk wird nach GerNetiX-Boards durchsucht...");
  try {
    const result = await getJson("/api/platform/devices/discover");
    state.discoveredDevices = result.items || [];
    renderNetworkDiscovery();
    const found = state.discoveredDevices.length;
    setDiscoveryStatus("ok", found
      ? `${found} Board${found === 1 ? "" : "s"} gefunden.`
      : "Noch kein GerNetiX-Board gefunden. Board muss im gleichen Netzwerk erreichbar sein.");
  } catch (error) {
    setDiscoveryStatus("error", error.message);
  }
}

function renderNetworkDiscovery() {
  const list = document.querySelector("#networkDiscoveryList");
  if (!list) return;
  if (!state.discoveredDevices.length) {
    list.innerHTML = `<p class="empty">Noch keine Netzwerksuche gestartet oder kein Board gefunden.</p>`;
    return;
  }
  list.innerHTML = state.discoveredDevices.map((device) => `
    <article class="discovery-row">
      <div>
        <h3>${escapeHtml(device.display_name || device.serial_number || device.source_url)}</h3>
        <p>${escapeHtml(device.source_url)}</p>
        <div class="card-actions">
          ${device.already_in_inventory
            ? `<button type="button" disabled>Bereits im Inventar</button>`
            : `<button class="primary" type="button" data-claim-discovered-device="${escapeHtml(device.discovery_id)}">Ins Inventar uebernehmen</button>`}
        </div>
      </div>
      <dl class="meta-list">
        ${meta("serial_number", device.serial_number || "unbekannt")}
        ${meta("hardware_profile_id", device.hardware_profile_id || "unbekannt")}
        ${meta("provisioning_state", device.provisioning_state || "unbekannt")}
        ${meta("runtime_version", device.runtime_version || "unbekannt")}
      </dl>
    </article>
  `).join("");
  document.querySelectorAll("[data-claim-discovered-device]").forEach((button) => {
    button.addEventListener("click", () => claimDiscoveredDevice(button.dataset.claimDiscoveredDevice));
  });
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
        ${meta("usb_flash", device.usb_flash_supported ? `bereit (${device.upload_port || "auto"})` : "nicht konfiguriert")}
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
  document.querySelector("#inventoryHardwareProfile").innerHTML = boards.map((board) => `
    <option value="${escapeHtml(board.hardware_item_id || board.hardware_profile_id)}">${escapeHtml(board.title || board.hardware_item_id || board.hardware_profile_id)}</option>
  `).join("");
  syncInventoryCapabilities();
}

function syncInventoryCapabilities() {
  const boardId = document.querySelector("#inventoryHardwareProfile").value;
  const board = state.processorBoards.find((item) => item.hardware_item_id === boardId || item.hardware_profile_id === boardId)
    || fallbackProcessorBoards().find((item) => item.hardware_item_id === boardId);
  document.querySelector("#inventoryCapabilities").value = (board?.capability_ids || []).map((item) => String(item).replace(/^capability\./, "")).join(", ");
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
      capability_ids: ["wifi", "ota", "flash_firmware", "arduino_framework_runtime"],
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
  const input = document.querySelector("#usbPortInput");
  if (device && device.upload_port) input.value = device.upload_port;
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
  const views = Array.isArray(manifest.views) ? manifest.views : [];
  if (!views.length) {
    target.innerHTML = `<p class="empty">Dieses Projekt hat noch keine gespeicherte IDE-Ansicht.</p>`;
    return;
  }
  target.innerHTML = `
    <div class="manifest-head">
      <p class="eyebrow">Projektansicht</p>
      <h3>${escapeHtml(manifest.title || "IDE Ansicht")}</h3>
      <p>${escapeHtml(manifest.summary || "")}</p>
    </div>
    <div class="manifest-view-list">
      ${views.map(renderManifestView).join("")}
    </div>
  `;
}

function renderManifestView(view) {
  const typeLabel = {
    source_analysis: "Analyse",
    explanation: "Erklaerung",
    plantuml: "PlantUML",
    implementation_plan: "Umsetzung",
  }[view.type] || view.type;
  return `
    <article class="manifest-view-card">
      <div class="manifest-view-title">
        <span>${escapeHtml(typeLabel)}</span>
        <strong>${escapeHtml(view.title || view.id)}</strong>
      </div>
      <p>${escapeHtml(view.summary || "")}</p>
      ${renderManifestPayload(view)}
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
  if (view.type === "plantuml") {
    return `<pre class="plantuml-box">${escapeHtml(payload.source || "")}</pre>`;
  }
  if (view.type === "implementation_plan") {
    const tasks = payload.tasks || [];
    return tasks.length ? `<ul class="manifest-list">${tasks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
  }
  return Object.keys(payload).length ? `<pre class="plantuml-box">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>` : "";
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
