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
  aiUsage: null,
  progress: [],
  workspace: null,
  serviceStatus: {},
  activeProjectId: "",
  activeDeviceId: "",
  activeLearnTab: "catalog",
  projectFilter: "all",
  inventoryProcessorFamily: "",
  inventoryHardwareType: "",
  inventoryEsp32Method: "",
  activeStep: 0,
  activeIdeStep: 0,
  sourcePath: "src/main.cpp",
  projectSourcesByProjectId: {},
  ideViewMode: "model",
  ideChat: [],
  developmentPlatform: null,
  aiChat: null,
};

const routeMap = {
  dashboard: "dashboardView",
  "development-platform": "developmentPlatformView",
  "ki-chat": "aiChatView",
  ide: "ideView",
  devices: "devicesView",
  builds: "buildsView",
  billing: "billingView",
  auth: "dashboardView",
};

let deviceOnboardingController = null;
let guidedProjectViewController = null;
let developmentPlatformController = null;
let aiChatController = null;

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

function developmentPlatform() {
  if (!developmentPlatformController) {
    developmentPlatformController = DevelopmentPlatform.create({
      state,
      postJson,
      openProjectInIde,
      escapeHtml,
      escapeAttribute,
      meta,
    });
  }
  return developmentPlatformController;
}

function aiChat() {
  if (!aiChatController) {
    aiChatController = AiChat.create({
      state,
      postJson,
      escapeHtml,
      meta,
    });
  }
  return aiChatController;
}

bootstrap();

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/app/auth/";
});

document.querySelectorAll("[data-open-route]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.openRoute));
});
document.querySelectorAll(".tabs a[data-route]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    navigate(link.getAttribute("href"));
  });
});
document.querySelector("#continueButton").addEventListener("click", continueLastProject);
document.querySelector("#ideProjectSelect").addEventListener("change", () => openProjectInIde(document.querySelector("#ideProjectSelect").value));
document.querySelector("#ideProjectBrowser").addEventListener("click", (event) => {
  const button = event.target.closest("[data-source-path]");
  if (button) openIdeSource(button.dataset.sourcePath);
});
document.querySelectorAll("[data-ide-view-mode]").forEach((button) => {
  button.addEventListener("click", () => setIdeViewMode(button.dataset.ideViewMode));
});
document.querySelector("#ideChatForm").addEventListener("submit", sendIdeChatMessage);
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
  developmentPlatform().init();
  aiChat().init();
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
  state.aiUsage = summary.ai_usage || null;
  state.progress = summary.learning_progress;
  state.workspace = summary.workspace_state;
  state.serviceStatus = summary.service_status || {};
  developmentPlatform().setAssistantConfig(summary.development_assistant || null);
  aiChat().setAssistantConfig(summary.ai_chat || null);
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
  state.activeDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
}

function renderAll() {
  document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : "";
  renderDashboard();
  renderProjects();
  renderLearn();
  developmentPlatform().render();
  aiChat().render();
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
  if (route === "development-platform") developmentPlatform().render();
  if (route === "ki-chat") aiChat().render();
  if (route === "ide") loadIdeProject();
  if (route === "devices") loadDevicePageTools();
}

function routeName() {
  const match = window.location.pathname.match(/^\/app\/([^/]+)/);
  const route = match ? match[1] : "dashboard";
  if (route === "learn" || route === "projects") return "dashboard";
  return route;
}

function navigate(route) {
  history.pushState({}, "", route);
  renderRoute();
}

async function loadDevicePageTools() {
  if (!state.processorBoards.length) {
    getJson("/api/platform/hardware/processor-boards")
      .then((boards) => {
        state.processorBoards = boards.items || [];
        renderDeviceInventoryForm();
      })
      .catch((error) => setInventoryStatus("error", error.message));
  }
  await refreshUsbPorts(false);
}

function renderDashboard() {
  const personalProjects = personalLearningProjects();
  const catalogProjects = learningCatalogProjects();
  const last = state.projects.find((project) => project.id === state.workspace.lastProjectId);
  document.querySelector("#continueText").textContent = last
    ? `${last.name} im ${state.workspace.lastMode === "ide" ? "IDE-Modus" : "Projektmodus"}`
    : "Noch kein Projekt geöffnet";
  document.querySelector("#dashboardSummary").innerHTML = [
    ["Account", state.account.username],
    ["Projektstände", personalProjects.length],
    ["Projektkatalog", catalogProjects.length],
    ["Geräte", state.devices.length],
    ["Builds", state.builds.length],
    ["Service-Kette", serviceChainStatus()],
    ["Letzter Modus", state.workspace.lastMode || "kein Eintrag"],
  ].map(summaryItem).join("");
  renderAiRating("#dashboardAiUsage");
}

function serviceChainStatus() {
  const entries = Object.entries(state.serviceStatus || {});
  if (!entries.length) return "nicht geprueft";
  const failed = entries
    .filter(([, status]) => !status.ok)
    .map(([name, status]) => `${name}: ${status.error || "Fehler"}`);
  return failed.length ? failed.join(" | ") : "ok";
}

function renderProjects() {
  const projectList = document.querySelector("#projectList");
  if (!projectList) return;
  const catalogProjects = learningCatalogProjects();
  projectList.innerHTML = catalogProjects.length ? catalogProjects.map((project) => `
    <article class="project-card">
      <p class="eyebrow">${escapeHtml(project.type)}</p>
      <h2>${escapeHtml(project.name)}</h2>
      <p>${escapeHtml(project.description)}</p>
      <dl class="meta-list">
        ${meta("Kurs", project.courseId)}
        ${meta("Lektion", project.lessonId)}
        ${meta("Zielruntime", project.targetRuntime)}
        ${meta("Projektdateien", project.sourceFiles.map((file) => file.path).join(", "))}
      </dl>
      <div class="card-actions">
        <button type="button" data-open-project="${escapeHtml(project.id)}">Projekt starten</button>
      </div>
    </article>
  `).join("") : `<p class="empty">Noch keine Projekte im Katalog.</p>`;
  document.querySelectorAll("#projectList [data-open-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInIde(button.dataset.openProject));
  });
}

function renderLearn() {
  const learnProjectList = document.querySelector("#learnProjectList");
  if (!learnProjectList) return;
  const personalProjects = personalLearningProjects();
  const filteredProjects = personalProjects.filter((project) => learningProjectFilter(project, progressFor(project.id)) === state.projectFilter || state.projectFilter === "all");
  learnProjectList.innerHTML = filteredProjects.length ? `
    <table class="learning-project-table">
      <thead>
        <tr>
          <th>Projekt</th>
          <th>Status</th>
          <th>Fortschritt</th>
          <th>Device</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${filteredProjects.map((project) => {
    const progress = progressFor(project.id);
    const hasProgress = progress.currentStep > 0 || progress.completedSteps.length > 0;
    const progressText = `${progress.completedSteps.length}/${project.steps.length}`;
    return `
          <tr>
            <td>
              <strong>${escapeHtml(project.name)}</strong>
              <span>${escapeHtml(project.courseId)} · ${escapeHtml(project.lessonId)}</span>
            </td>
            <td><span class="project-status ${learningProjectFilter(project, progress)}">${learningProjectStatus(project, progress)}</span></td>
            <td>${escapeHtml(progressText)}</td>
            <td>${escapeHtml(project.linkedDeviceId || "kein Device")}</td>
            <td><button type="button" data-open-project="${escapeHtml(project.id)}">${hasProgress ? "Fortsetzen" : "Starten"}</button></td>
          </tr>
    `;
  }).join("")}
      </tbody>
    </table>
  ` : `<p class="empty">Keine Projekte für diesen Filter.</p>`;
  document.querySelectorAll("#learnProjectList [data-open-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInIde(button.dataset.openProject));
  });
}

function personalLearningProjects() {
  return state.projects;
}

function learningCatalogProjects() {
  return state.projects;
}

function learningProjectStatus(project, progress) {
  if (progress.completedSteps.length >= project.steps.length) return "abgeschlossen";
  if (progress.currentStep > 0 || progress.completedSteps.length > 0) return "laufend";
  return "bereit";
}

function learningProjectFilter(project, progress) {
  if (progress.completedSteps.length >= project.steps.length) return "finished";
  if (progress.currentStep > 0 || progress.completedSteps.length > 0) return "in_progress";
  return "not_started";
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
  const sources = await loadProjectSources(project);
  state.sourcePath = selectedIdeSourcePath(project, sources);
  state.activeIdeStep = Math.min(progressFor(project.id).currentStep || 0, Math.max(0, guidedViews(project).length - 1));
  document.querySelector("#ideProjectSelect").value = projectId;
  updateIdeProjectTools(project);
  renderIdeProjectBrowser(project, sources);
  document.querySelector("#ideProjectTitle").textContent = project.name;
  document.querySelector("#ideProjectBrowserTitle").textContent = project.name;
  document.querySelector("#ideActiveSourceLabel").textContent = state.sourcePath;
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
  renderAiRating("#ideAiUsage", true);
  await loadIdeSourceContent(project, state.sourcePath);
  renderProjectViewManifest(project);
  focusIdeStepSource(project);
  renderIdeViewMode(project);
  renderIdeChat();
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
  document.querySelector("#ideProjectBrowserTitle").textContent = "Projekt";
  document.querySelector("#ideProjectBrowser").innerHTML = "";
  document.querySelector("#ideActiveSourceLabel").textContent = "";
  document.querySelector("#ideProjectMeta").innerHTML = "";
  document.querySelector("#sourceEditor").value = "";
  document.querySelector("#ideImageView").innerHTML = "";
  document.querySelector("#ideModelView").innerHTML = "";
  document.querySelector("#ideChatMessages").innerHTML = "";
  document.querySelector("#ideProjectViewManifest").innerHTML = "";
}

function updateIdeProjectTools(project) {
  const hardwareTools = projectNeedsHardwareTools(project);
  const sourceEditing = projectNeedsSourceEditing(project);
  document.querySelector("#ideCurrentProjectLabel").textContent = project ? `Projekt: ${project.name}` : "";
  document.querySelector("#ideProjectSelect").classList.add("hidden");
  document.querySelector("#ideDeviceTools").classList.toggle("hidden", !hardwareTools);
  document.querySelector("#saveSourceButton").classList.toggle("hidden", !sourceEditing);
  document.querySelector("#sourceEditor").readOnly = !sourceEditing;
  document.querySelectorAll("[data-ide-view-mode]").forEach((button) => {
    button.classList.toggle("active-method", button.dataset.ideViewMode === state.ideViewMode);
  });
}

function projectNeedsHardwareTools(project) {
  const capabilities = projectCapabilityIds(project);
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
  target.innerHTML = sources.length
    ? renderSourceTree(sourceTree(project.name, sources))
    : `<p class="empty">Keine Projektdateien.</p>`;
}

function sourceTree(projectName, sources) {
  const root = { name: projectName || "Projekt", folders: new Map(), files: [] };
  for (const source of sources) {
    const parts = String(source.path || "").split("/").filter(Boolean);
    let cursor = root;
    for (const part of parts.slice(0, -1)) {
      if (!cursor.folders.has(part)) cursor.folders.set(part, { name: part, folders: new Map(), files: [] });
      cursor = cursor.folders.get(part);
    }
    cursor.files.push({ ...source, name: parts.at(-1) || source.path });
  }
  return root;
}

function renderSourceTree(node, depth = 0) {
  const folders = Array.from(node.folders.values()).sort((left, right) => left.name.localeCompare(right.name));
  const files = node.files.sort((left, right) => left.name.localeCompare(right.name));
  const children = [
    ...folders.map((folder) => renderSourceTree(folder, depth + 1)),
    ...files.map((file) => `
      <button class="${file.path === state.sourcePath ? "active" : ""}" type="button" data-source-path="${escapeAttribute(file.path)}" style="--depth:${depth + 1}">
        <span>${escapeHtml(file.name)}</span>
        <small>${escapeHtml(file.role || file.content_type || "")}</small>
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
  return `
    <details class="ide-tree-folder" style="--depth:${depth}" open>
      <summary>${escapeHtml(node.name)}</summary>
      ${children}
    </details>
  `;
}

async function openIdeSource(sourcePath) {
  const project = projectById(state.activeProjectId);
  if (!project || !sourcePath) return;
  state.sourcePath = sourcePath;
  document.querySelector("#ideActiveSourceLabel").textContent = state.sourcePath;
  await loadIdeSourceContent(project, sourcePath);
  renderIdeProjectBrowser(project, state.projectSourcesByProjectId[project.id] || []);
  renderIdeViewMode(project);
}

async function loadIdeSourceContent(project, sourcePath) {
  const source = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(sourcePath)}`);
  document.querySelector("#sourceEditor").value = source.content || "";
}

function setIdeViewMode(mode) {
  state.ideViewMode = ["model", "code", "image"].includes(mode) ? mode : "model";
  const project = projectById(state.activeProjectId);
  updateIdeProjectTools(project);
  renderIdeViewMode(project);
}

function renderIdeViewMode(project) {
  const mode = state.ideViewMode || "model";
  const sourcePath = state.sourcePath || "";
  document.querySelector("#ideViewerModeLabel").textContent = mode === "image" ? "Image" : mode === "code" ? "Code" : "Modell";
  document.querySelector("#sourcePanel").classList.toggle("hidden", mode === "image");
  document.querySelector("#ideImageView").classList.toggle("hidden", mode !== "image");
  document.querySelector("#ideModelView").classList.toggle("hidden", mode !== "model");
  document.querySelectorAll("[data-ide-view-mode]").forEach((button) => {
    button.classList.toggle("active-method", button.dataset.ideViewMode === mode);
  });
  if (mode === "model") {
    document.querySelector("#ideModelView").innerHTML = renderModelContext(project, sourcePath);
  }
  if (mode === "image") {
    renderIdeImageView(sourcePath, document.querySelector("#sourceEditor").value);
  }
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
  if (/\.puml$/i.test(sourcePath) && /@startuml/i.test(source)) {
    target.innerHTML = `
      <figure class="plantuml-viewer">
        <img class="plantuml-diagram" data-plantuml-source="${escapeAttribute(source)}" alt="${escapeAttribute(sourcePath)}">
        <figcaption class="plantuml-status">PlantUML-Diagramm wird geladen...</figcaption>
      </figure>
    `;
    await renderIdePlantUmlImage(target.querySelector("[data-plantuml-source]"));
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

async function sendIdeChatMessage(event) {
  event.preventDefault();
  const input = document.querySelector("#ideChatInput");
  const content = input.value.trim();
  if (!content) return;
  const project = projectById(state.activeProjectId);
  state.ideChat.push({ role: "user", content });
  input.value = "";
  renderIdeChat();
  setIdeChatStatus("KI denkt...");
  try {
    const context = project ? `\n\nProjekt: ${project.name}\nDatei: ${state.sourcePath}` : "";
    const response = await postJson("/api/platform/ai-chat/chat", {
      messages: state.ideChat.slice(0, -1).concat({ role: "user", content: `${content}${context}` }).slice(-8),
    });
    state.ideChat.push({
      role: "assistant",
      content: response.message?.content || "Keine Antwort erhalten.",
      usage: response.usage || null,
    });
    setIdeChatStatus("Antwort erhalten.");
  } catch (error) {
    state.ideChat.push({ role: "assistant", content: `KI-Chat nicht erreichbar: ${error.message}` });
    setIdeChatStatus("Fehler beim KI-Chat.");
  }
  renderIdeChat();
}

function renderIdeChat() {
  const target = document.querySelector("#ideChatMessages");
  if (!target) return;
  const messages = state.ideChat.length ? state.ideChat : [{ role: "assistant", content: "Bereit fuer Fragen zum aktuellen Projekt." }];
  target.innerHTML = messages.map((message) => `
    <article class="chat-message ${escapeHtml(message.role)}">
      <span>${message.role === "user" ? "Du" : "KI"}</span>
      <p>${escapeHtml(message.content)}</p>
    </article>
  `).join("");
  target.scrollTop = target.scrollHeight;
}

function setIdeChatStatus(text) {
  const target = document.querySelector("#ideChatStatus");
  if (target) target.textContent = text;
}

async function saveSource() {
  const project = projectById(state.activeProjectId);
  await putJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(state.sourcePath)}`, {
    content: document.querySelector("#sourceEditor").value,
  });
  delete state.projectSourcesByProjectId[project.id];
  await refresh();
  await loadIdeProject();
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

async function openProjectInIde(projectId) {
  state.activeProjectId = projectId;
  state.ideChat = [];
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
    navigate("/app/development-platform/");
    return;
  }
  const lastRoute = state.workspace.lastRoute || `/app/${state.workspace.lastMode}/?project=${encodeURIComponent(state.workspace.lastProjectId)}`;
  if (/^\/app\/(?:learn|projects)\//.test(lastRoute)) {
    navigate(`/app/ide/?project=${encodeURIComponent(state.workspace.lastProjectId)}`);
    return;
  }
  navigate(lastRoute);
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

function renderAiRating(selector, compact = false) {
  const target = document.querySelector(selector);
  if (!target) return;
  const rating = state.aiUsage?.rating || {};
  const sources = rating.sources || [];
  if (!sources.length) {
    target.innerHTML = compact
      ? `<p class="helper-text">KI-Nutzung nicht verfuegbar.</p>`
      : `<p class="empty">KI-Nutzung nicht verfuegbar.</p>`;
    return;
  }
  const rows = sources.map((source) => {
    const detail = source.unlimited
      ? `${formatNumber(source.month_tokens)} Tokens, unbegrenzt`
      : `${formatNumber(source.month_tokens)} / ${formatNumber(source.token_limit)} Tokens`;
    return `
      <article class="ai-rating-card">
        <span>${escapeHtml(source.title || source.source_id)}</span>
        <strong>${source.unlimited ? "unbegrenzt" : `${formatMetric(source.used_percent)} %`}</strong>
        <small>${escapeHtml(detail)}</small>
        ${source.unlimited ? "" : usageBar(source.used_percent)}
      </article>
    `;
  }).join("");
  target.innerHTML = compact
    ? `<div class="ide-ai-rating-head"><p class="eyebrow">KI Nutzung</p><strong>${formatMetric(rating.used_percent || 0)} % verbraucht</strong></div><div class="ai-rating-grid compact">${rows}</div>`
    : rows;
}

function usageBar(value) {
  const percent = Math.max(0, Math.min(100, Number(value || 0)));
  return `<span class="usage-bar"><i style="width:${percent}%"></i></span>`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function formatMetric(value) {
  return Number(value || 0).toLocaleString("de-DE", { maximumFractionDigits: 1 });
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
