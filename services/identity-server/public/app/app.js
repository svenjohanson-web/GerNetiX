const state = {
  account: null,
  projects: [],
  devices: [],
  usbPorts: [],
  discoveredDevices: [],
  avrBootloaderResult: null,
  processorBoards: [],
  boardFeatureCatalog: [],
  boardFeatureCatalogStatus: { state: "idle", message: "" },
  provisioningBoardConfigurationMode: "",
  provisioningKnownBoardId: "",
  provisioningFeatureSelections: {},
  provisioningDatasheetUrl: "",
  provisioningUpdateProfile: "",
  provisioningUsbFlashSucceeded: false,
  provisioningUsbFlashRunning: false,
  provisioningPairingToken: "",
  provisioningBinding: "",
  provisioningWifiNetworks: [],
  provisioningWifiSetupRunning: false,
  provisioningWifiSetupSucceeded: false,
  provisioningSerialScanCompleted: false,
  provisioningSerialScanRunning: false,
  provisioningSerialPort: null,
  sensorCatalog: [],
  sensorCatalogStatus: { state: "idle", message: "" },
  builds: [],
  billing: null,
  aiUsage: null,
  progress: [],
  workspace: null,
  serviceStatus: {},
  activeProjectId: "",
  activeDeviceId: "",
  activeRecoveryDeviceId: "",
  recoveryCheckResult: null,
  activeLearnTab: "catalog",
  projectFilter: "all",
  inventoryEsp32Method: "",
  activeStep: 0,
  activeIdeStep: 0,
  guidedCodeChats: {},
  sourcePath: "src/main.cpp",
  projectSourcesByProjectId: {},
  ideDirtySources: {},
  ideViewMode: "file",
  activeIdeComponentId: "",
  developmentPlatform: null,
  esptoolModule: null,
  activeSerialTransport: null,
  ideLayoutPersistenceReady: false,
};

const routeMap = {
  dashboard: "dashboardView",
  "development-platform": "developmentPlatformView",
  "development-hardware": "developmentHardwareView",
  learn: "learnView",
  ide: "ideView",
  "device-management": "deviceManagementView",
  "device-provisioning": "deviceProvisioningView",
  "device-recovery": "deviceRecoveryView",
  "device-inventory": "devicesView",
  builds: "buildsView",
  downloads: "downloadsView",
  billing: "billingView",
  help: "helpView",
  auth: "dashboardView",
};

let deviceOnboardingController = null;
let guidedProjectViewController = null;
let developmentPlatformController = null;
let lastRenderedRoute = "";

function deviceOnboarding() {
  if (!deviceOnboardingController) {
    deviceOnboardingController = DeviceOnboardingController.create({
      state,
      model: DeviceOnboardingModel,
      getJson,
      postJson,
      deleteJson,
      delay,
      loadIdeEsptoolModule,
      fallbackProcessorBoards,
      renderDashboard,
      renderDevices,
      renderIdeShell,
      escapeHtml,
      meta,
      openHelpTopic: HelpView.openDialog,
    });
  }
  return deviceOnboardingController;
}

function guidedProjectView() {
  if (!guidedProjectViewController) {
    guidedProjectViewController = GuidedProjectView.create({
      state,
      getJson,
      postJson,
      putJson,
      progressFor,
      escapeHtml,
      escapeAttribute,
      meta,
      openHelpTopic: HelpView.openDialog,
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
      navigate,
      escapeHtml,
      escapeAttribute,
      meta,
    });
  }
  return developmentPlatformController;
}

bootstrap();

document.querySelector("#mainMenuButton").addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMainMenu();
});
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
    closeMainMenu();
    navigate(link.getAttribute("href"));
  });
});
document.querySelector("#mainMenu").addEventListener("click", (event) => {
  event.stopPropagation();
});
document.querySelector("#platformBreadcrumb").addEventListener("click", (event) => {
  const link = event.target.closest("[data-breadcrumb-route]");
  if (!link) return;
  event.preventDefault();
  navigate(link.dataset.breadcrumbRoute);
});
document.querySelectorAll("[data-device-management-route]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.deviceManagementRoute));
});
document.querySelector("#enablePushButton")?.addEventListener("click", enablePushNotifications);
document.querySelector("#sendPushTestButton")?.addEventListener("click", sendPushTestNotification);
document.querySelector("#pushProjectSelect")?.addEventListener("change", (event) => { state.activeProjectId = event.target.value; });
document.querySelector("#ideProjectBrowser").addEventListener("click", (event) => {
  const deviceConnectionsButton = event.target.closest("[data-device-connections]");
  if (deviceConnectionsButton) {
    openDeviceConnections(deviceConnectionsButton.dataset.deviceConnections);
    return;
  }
  const sensorPropertiesButton = event.target.closest("[data-sensor-properties]");
  if (sensorPropertiesButton) {
    openSensorProperties(sensorPropertiesButton.dataset.sensorProperties);
    return;
  }
  const driverManagementButton = event.target.closest("[data-driver-management]");
  if (driverManagementButton) {
    openDriverManagement();
    return;
  }
  const boardPropertiesButton = event.target.closest("[data-board-properties]");
  if (boardPropertiesButton) {
    openBoardProperties(boardPropertiesButton.dataset.boardProperties);
    return;
  }
  const hardwareConfigurationButton = event.target.closest("[data-hardware-configuration]");
  if (hardwareConfigurationButton) {
    navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
    return;
  }
  const componentFeaturesButton = event.target.closest("[data-component-features]");
  if (componentFeaturesButton) {
    openComponentFeatures();
    return;
  }
  const workerDispatcherButton = event.target.closest("[data-worker-dispatcher-configuration]");
  if (workerDispatcherButton) {
    openWorkerDispatcherConfiguration(workerDispatcherButton.dataset.workerDispatcherConfiguration);
    return;
  }
  const webserverConfigurationButton = event.target.closest("[data-webserver-configuration]");
  if (webserverConfigurationButton) {
    openWebserverConfiguration();
    return;
  }
  const deviceWebButton = event.target.closest("[data-device-web]");
  if (deviceWebButton) {
    openDeviceWebView();
    return;
  }
  const pwaDashboardButton = event.target.closest("[data-pwa-dashboard]");
  if (pwaDashboardButton) {
    openPwaDashboardView();
    return;
  }
  const button = event.target.closest("[data-source-path]");
  if (button) openIdeSource(button.dataset.sourcePath);
});
document.querySelector("#ideDeviceSelect").addEventListener("change", () => {
  state.activeDeviceId = document.querySelector("#ideDeviceSelect").value;
  syncSelectedDevicePort();
  loadIdeProject();
});
document.querySelector("#refreshUsbPortsButton").addEventListener("click", refreshUsbPorts);
document.querySelector("#buildButton").addEventListener("click", startBuild);
document.querySelector("#usbFlashButton").addEventListener("click", startUsbFlash);
document.querySelector("#otaFlashButton").addEventListener("click", startOtaFlash);
document.querySelector("#checkOtaConnectivityButton").addEventListener("click", checkAllocatedDeviceConnectivity);
document.querySelector("#clearIdeTerminalButton").addEventListener("click", clearIdeTerminal);
document.querySelector("#showIdeTerminalButton").addEventListener("click", () => setIdeConsoleView("terminal"));
document.querySelector("#showIdeProjectInformationButton").addEventListener("click", () => setIdeConsoleView("project-information"));
document.querySelector("#showIdeProjectHintsButton").addEventListener("click", () => setIdeConsoleView("hints"));
document.querySelector("#sourceEditor").addEventListener("input", () => markIdeSourceDirty());
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
  if (document.querySelector("#ideView")?.classList.contains("hidden") || !state.activeProjectId) return;
  event.preventDefault();
  saveSource();
});
document.querySelector("#ideComponentFeaturesView").addEventListener("submit", (event) => {
  if (event.target.matches("[data-event-configuration-form]")) {
    saveEventConfiguration(event);
    return;
  }
  saveComponentFeatures(event);
});
document.querySelector("#idePwaDashboardView").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-pwa-dashboard-editor]")) openPwaDashboardEditor();
});
document.querySelector("#pwaDashboardEditorForm").addEventListener("submit", savePwaDashboard);
document.querySelector("#pwaDashboardDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-pwa-dashboard-editor]")) {
    event.currentTarget.close();
  }
});
document.querySelector("#ideBoardPropertiesView").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-hardware-configuration]")) {
    navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
  }
});
document.querySelector("#ideBoardPropertiesView").addEventListener("submit", saveBoardPeripheralUsage);
document.querySelector("#ideSensorPropertiesView").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-hardware-configuration]")) navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
});
document.querySelector("#ideDeviceConnectionsView").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-hardware-configuration]")) navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
});
document.querySelector("#ideDriverManagementView").addEventListener("click", handleDriverManagementClick);
document.querySelector("#ideDeviceWebView").addEventListener("submit", loadDeviceWebPreview);
document.querySelector("#recoveryDeviceSelect").addEventListener("change", () => {
  state.activeRecoveryDeviceId = document.querySelector("#recoveryDeviceSelect").value;
  state.recoveryCheckResult = null;
  renderDeviceRecovery();
});
document.querySelector("#refreshRecoveryDevicesButton").addEventListener("click", refreshRecoveryDevices);
document.querySelector("#recoveryCheckUsbButton").addEventListener("click", () => checkRecoveryFirmware("usb"));
document.querySelector("#recoveryCheckOtaButton").addEventListener("click", () => checkRecoveryFirmware("ota"));
document.querySelectorAll('input[name="deviceDiscoveryMethod"]').forEach((input) => {
  input.addEventListener("change", selectDeviceDiscoveryMethod);
});
document.querySelector("#deviceDiscoverySearchButton").addEventListener("click", searchDevicesForInventory);
document.querySelector("#scanProvisioningSerialPortsButton").addEventListener("click", scanProvisioningSerialPorts);
document.querySelector("#selectProvisioningSerialPortButton").addEventListener("click", selectProvisioningSerialPort);
document.querySelector("#checkProvisioningSerialPortButton").addEventListener("click", identifyEsp32Bootloader);
document.querySelector("#flashProvisioningBasissoftwareButton").addEventListener("click", flashProvisioningBasissoftware);
document.querySelector("#scanProvisioningWifiButton").addEventListener("click", scanProvisioningWifiNetworks);
document.querySelector("#connectProvisioningWifiButton").addEventListener("click", connectProvisioningWifi);
document.querySelector("#avrBootloaderIdentifyButton").addEventListener("click", identifyAvrBootloaderExperimental);
document.querySelector("#claimSelectedDiscoveredDevicesButton").addEventListener("click", claimSelectedDiscoveredDevices);
document.querySelector("#inventoryBoardShortName").addEventListener("input", syncInventoryNodeNamePreview);
window.addEventListener("popstate", renderRoute);
document.addEventListener("click", closeMainMenu);

async function bootstrap() {
  developmentPlatform().init();
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
  developmentPlatform().setAssistantConfig(summary.development_assistant || null, state.billing);
  developmentPlatform().setProjectTemplates(
    summary.development_project_templates || [],
    summary.development_project_template_previews || [],
  );
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
  state.activeDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
  state.activeRecoveryDeviceId = state.activeRecoveryDeviceId || state.activeDeviceId;
}

function renderAll() {
  document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : "";
  renderDashboard();
  renderProjects();
  renderLearn();
  developmentPlatform().render();
  renderIdeShell();
  renderDeviceRecovery();
  renderNetworkDiscovery();
  renderDevices();
  renderBuilds();
  renderBilling();
}

function renderRoute() {
  const route = routeName();
  const enteringDevelopmentPlatform = route === "development-platform" && lastRenderedRoute !== "development-platform";
  document.body.classList.toggle("ide-workspace-active", route === "ide");
  document.body.classList.toggle("development-workspace-active", route === "development-platform");
  document.body.classList.toggle("development-hardware-active", route === "development-hardware");
  renderBreadcrumb(route);
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== routeMap[route]));
  document.querySelectorAll(".tabs a").forEach((link) => link.classList.toggle("active", link.dataset.route === topLevelRouteName(route)));
  document.querySelectorAll("[data-device-management-route]").forEach((button) => {
    button.classList.toggle("active", deviceManagementRouteFor(route) === button.dataset.deviceManagementRoute);
  });
  if (enteringDevelopmentPlatform) developmentPlatform().enterProjectStart();
  else if (route === "development-platform") developmentPlatform().render();
  if (route === "development-platform") loadProcessorBoardCatalog();
  if (route === "development-hardware") {
    loadProcessorBoardCatalog();
    loadSensorCatalog();
    developmentPlatform().renderHardwareConfiguration();
  }
  if (route === "ide") loadIdeProject();
  if (route === "device-recovery") {
    renderDeviceRecovery();
    refreshUsbPorts(false);
  }
  if (route === "device-provisioning") loadDevicePageTools();
  if (route === "downloads") renderDownloads();
  if (route === "help") renderHelpTopic();
  lastRenderedRoute = route;
}

function renderHelpTopic() {
  HelpView.render({
    hasAccount: Boolean(state.account),
    premium: Boolean(state.billing?.entitlements?.includes("learn_guided_projects")),
  });
}

function renderBreadcrumb(route) {
  const target = document.querySelector("#platformBreadcrumb");
  const location = currentLocationTrail(route);
  target.innerHTML = `
    <div class="breadcrumb-line">
      ${location.map((item, index) => breadcrumbNode(item, index === location.length - 1, index > 0)).join("")}
    </div>
  `;
}

function breadcrumbNode(item, current, withSeparator) {
  const label = escapeHtml(item.label);
  const separator = withSeparator ? `<i aria-hidden="true">/</i>` : "";
  if (current || !item.route) return `${separator}<span aria-current="${current ? "page" : "false"}">${label}</span>`;
  return `${separator}<a href="${escapeAttribute(item.route)}" data-breadcrumb-route="${escapeAttribute(item.route)}">${label}</a>`;
}

function currentLocationTrail(route) {
  const project = projectById(state.activeProjectId);
  const locations = {
    dashboard: [{ label: "Plattform", route: "/app/dashboard/" }],
    "development-platform": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Entwicklungsplattform", route: "/app/development-platform/" },
    ],
    "development-hardware": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Entwicklungsplattform", route: "/app/development-platform/" },
      { label: "Hardware-Zuordnung", route: "" },
    ],
    learn: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Lernplattform", route: "/app/learn/" },
    ],
    ide: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Entwicklungsplattform", route: "/app/development-platform/" },
      { label: project?.name || "Projekt", route: "" },
    ],
    "device-management": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Device Management", route: "/app/device-management/" },
    ],
    "device-provisioning": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Device Management", route: "/app/device-management/" },
      { label: "Provisioning", route: "/app/device-management/provisioning/" },
    ],
    "device-inventory": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Device Management", route: "/app/device-management/" },
      { label: "Inventar", route: "/app/device-management/inventory/" },
    ],
    "device-recovery": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Device Management", route: "/app/device-management/" },
      { label: "Recovery", route: "/app/device-management/recovery/" },
    ],
    builds: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Builds", route: "/app/builds/" },
    ],
    downloads: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Downloads", route: "/app/downloads/" },
    ],
    billing: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Billing", route: "/app/billing/" },
    ],
    help: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Hilfe", route: "/app/help/" },
    ],
  };
  return locations[route] || locations.dashboard;
}

function routeName() {
  if (/^\/app\/development-platform\/hardware\/?$/.test(window.location.pathname)) return "development-hardware";
  if (/^\/app\/device-management\/?$/.test(window.location.pathname)) return "device-management";
  const deviceManagementMatch = window.location.pathname.match(/^\/app\/device-management\/([^/]+)/);
  if (deviceManagementMatch) {
    return {
      provisioning: "device-provisioning",
      inventory: "device-inventory",
      recovery: "device-recovery",
    }[deviceManagementMatch[1]] || "device-provisioning";
  }
  const match = window.location.pathname.match(/^\/app\/([^/]+)/);
  const route = match ? match[1] : "dashboard";
  if (route === "projects") return "learn";
  if (route === "devices") return "device-inventory";
  if (route === "device-recovery") return "device-recovery";
  return route;
}

function topLevelRouteName(route) {
  if (["device-management", "device-provisioning", "device-inventory", "device-recovery"].includes(route)) return "device-management";
  if (["ide", "development-hardware"].includes(route)) return "development-platform";
  return route;
}

function deviceManagementRouteFor(route) {
  return {
    "device-provisioning": "/app/device-management/provisioning/",
    "device-inventory": "/app/device-management/inventory/",
    "device-recovery": "/app/device-management/recovery/",
  }[route] || "";
}

function navigate(route) {
  history.pushState({}, "", route);
  renderRoute();
}

async function renderDownloads() {
  const target = document.querySelector("#usbHelperDownloads");
  const status = document.querySelector("#usbHelperStatus");
  if (!target || !status) return;

  const platform = /Mac/i.test(navigator.platform) ? "macos" : /Win/i.test(navigator.platform) ? "windows" : "";
  document.querySelector("#usbHelperRecommendation")?.classList.toggle("hidden", !platform);
  try {
    const payload = await getJson("/api/platform/downloads");
    const downloads = payload.downloads || [];
    target.innerHTML = downloads.map((item) => `
      <a class="button-link ${item.platform === platform ? "primary" : ""} ${item.available ? "" : "disabled"}"
        ${item.available ? `href="${escapeAttribute(item.url)}" download` : 'aria-disabled="true"'}>
        ${escapeHtml(item.label)}
        <small>${escapeHtml(item.available ? item.detail : "Noch nicht bereit")}</small>
      </a>
    `).join("");
    const available = downloads.filter((item) => item.available).length;
    status.textContent = available
      ? `${available} Installationspaket${available === 1 ? "" : "e"} verfügbar.`
      : "Die Installationspakete werden gerade vorbereitet.";
  } catch (error) {
    target.innerHTML = "";
    status.textContent = "Die Download-Verfügbarkeit konnte nicht geladen werden.";
  }
}

function toggleMainMenu() {
  const menu = document.querySelector("#mainMenu");
  const button = document.querySelector("#mainMenuButton");
  const open = menu.classList.toggle("hidden") === false;
  button.setAttribute("aria-expanded", open ? "true" : "false");
}

function closeMainMenu() {
  const menu = document.querySelector("#mainMenu");
  const button = document.querySelector("#mainMenuButton");
  if (!menu || menu.classList.contains("hidden")) return;
  menu.classList.add("hidden");
  button?.setAttribute("aria-expanded", "false");
}

async function loadDevicePageTools() {
  await loadProcessorBoardCatalog();
  await loadBoardFeatureCatalog();
  await refreshUsbPorts(false);
}

async function loadBoardFeatureCatalog() {
  if (["loading", "ready"].includes(state.boardFeatureCatalogStatus.state)) return;
  state.boardFeatureCatalogStatus = { state: "loading", message: "Boardausstattung wird geladen." };
  await getJson("/api/platform/hardware/board-feature-options")
    .then((result) => {
      state.boardFeatureCatalog = result.items || [];
      state.boardFeatureCatalogStatus = {
        state: "ready",
        message: state.boardFeatureCatalog.length ? "" : "Der Hardware Catalog enthält keine Ausstattungsoptionen.",
      };
      renderNetworkDiscovery();
    })
    .catch((error) => {
      state.boardFeatureCatalog = [];
      state.boardFeatureCatalogStatus = { state: "error", message: error.message || "Hardware Catalog ist nicht erreichbar." };
      renderNetworkDiscovery();
    });
}

async function loadProcessorBoardCatalog() {
  if (!state.processorBoards.length) {
    await getJson("/api/platform/hardware/processor-boards")
      .then((boards) => {
        state.processorBoards = boards.items || [];
        renderNetworkDiscovery();
        if (routeName() === "development-platform") developmentPlatform().render();
        if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
      })
      .catch((error) => setInventoryStatus("error", error.message));
  }
}

async function loadSensorCatalog() {
  if (["loading", "ready"].includes(state.sensorCatalogStatus.state)) return;
  state.sensorCatalogStatus = { state: "loading", message: "Sensorarten werden geladen." };
  if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
  await getJson("/api/platform/hardware/sensors")
    .then((sensors) => {
      state.sensorCatalog = sensors.items || [];
      state.sensorCatalogStatus = {
        state: "ready",
        message: state.sensorCatalog.length ? "" : "Der Hardware Catalog ist erreichbar, enthaelt aber keine Sensorarten.",
      };
      if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
    })
    .catch((error) => {
      state.sensorCatalog = [];
      state.sensorCatalogStatus = { state: "error", message: error.message || "Hardware Catalog ist nicht erreichbar." };
      if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
    });
}

function renderDashboard() {
  const developmentProjects = accountDevelopmentProjects();
  const pushProjectSelect = document.querySelector("#pushProjectSelect");
  if (pushProjectSelect) {
    pushProjectSelect.innerHTML = developmentProjects.length
      ? developmentProjects.map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`).join("")
      : `<option value="">Kein Projekt vorhanden</option>`;
    pushProjectSelect.value = developmentProjects.some((project) => project.id === state.activeProjectId) ? state.activeProjectId : developmentProjects[0]?.id || "";
  }
  document.querySelector("#dashboardSummary").innerHTML = [
    ["Account", state.account.username],
    ["Entwicklungsprojekte", developmentProjects.length],
    ["Geräte", state.devices.length],
    ["Builds", state.builds.length],
    ["Letzter Modus", state.workspace.lastMode || "kein Eintrag"],
  ].map(summaryItem).join("");
  renderAiRating("#dashboardAiUsage");
}

function renderProjects() {
  const projectList = document.querySelector("#projectList");
  if (!projectList) return;
  const catalogProjects = learningCatalogProjects();
  projectList.innerHTML = catalogProjects.length ? catalogProjects.map((project) => `
    <article class="project-card learning-catalog-card">
      <div>
        <div class="learning-catalog-card-head">
          <p class="eyebrow">${escapeHtml(project.type || "Lernprojekt")}</p>
          <span class="learning-access-badge ${escapeAttribute(project.accessModel || "subscription")}">${escapeHtml(learningAccessLabel(project.accessModel))}</span>
        </div>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.description)}</p>
      </div>
      <dl class="learning-catalog-facts">
        ${meta("Lernschritte", `${project.steps.length}`)}
        ${meta("Umgebung", project.targetRuntime || "Modell und Planung")}
        ${meta("Hardware", project.hardwareProfileId || "optional")}
      </dl>
      <div class="card-actions">
        <button class="primary" type="button" data-open-project="${escapeHtml(project.id)}">Lernprojekt starten</button>
      </div>
    </article>
  `).join("") : `<p class="empty">Im Lernprojekt-Katalog sind noch keine Projekte verfuegbar.</p>`;
  document.querySelectorAll("#projectList [data-open-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInIde(button.dataset.openProject));
  });
}

function learningAccessLabel(accessModel) {
  return {
    free: "Frei verfuegbar",
    purchased: "Kurs gekauft",
    subscription: "Im Abo enthalten",
  }[accessModel] || "Im Abo enthalten";
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
  return state.projects.filter((project) => project.projectOrigin === "account_project" || hasStartedLearningProject(project.id));
}

function learningCatalogProjects() {
  return state.projects.filter((project) => project.projectOrigin !== "account_project");
}

function accountDevelopmentProjects() {
  return state.projects.filter((project) => project.projectOrigin === "account_project"
    && ["development_project", "custom_project"].includes(project.type));
}

function hasStartedLearningProject(projectId) {
  const progress = state.progress.find((item) => item.projectId === projectId);
  return Boolean(progress && (progress.updatedAt || progress.currentStep > 0 || progress.completedSteps?.length));
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
  renderDeviceWebView(project);
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
  if (Number(stored.buildHeight) > 0) elements.buildHeight.style.height = `${stored.buildHeight}px`;
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
  const sourceEditing = ideSourceIsEditable(project, state.sourcePath);
  document.querySelector("#ideDeviceTools").classList.toggle("hidden", !hardwareTools);
  const allocated = allocatedIdeDevice(project);
  const actionReason = ideActionUnavailableReason(project, allocated);
  const buildButton = document.querySelector("#buildButton");
  const usbButton = document.querySelector("#usbFlashButton");
  const otaButton = document.querySelector("#otaFlashButton");
  const otaReason = !allocated
    ? "OTA nicht verfügbar: Kein Device zugeordnet."
    : allocated.connectivity_status !== "online"
      ? `OTA nicht verfügbar: Das Device ist nicht online (${allocated.connectivity_status || "unknown"}).`
      : allocated.ota_status !== "ready"
        ? `OTA nicht verfügbar: Das Device meldet den OTA-Status ${allocated.ota_status || "unknown"}.`
        : "";
  buildButton.disabled = false;
  usbButton.disabled = false;
  otaButton.disabled = !allocated || allocated.ota_status !== "ready" || allocated.connectivity_status !== "online";
  buildButton.title = actionReason;
  usbButton.title = actionReason || (!allocated?.usb_flash_supported ? "Das zugeordnete Device unterstuetzt keinen USB-Flash." : "");
  otaButton.title = actionReason || otaReason;
  renderIdeProjectInformation(project);
  document.querySelector("#sourceEditor").readOnly = !sourceEditing;
}

function renderIdeProjectInformation(project) {
  const target = document.querySelector("#ideProjectInformation");
  const noticeTarget = document.querySelector("#ideActionReason");
  if (!target || !noticeTarget || !project) return;
  const allocated = allocatedIdeDevice(project);
  const buildConfig = project.buildConfig || {};
  const buildProfile = [buildConfig.environment, buildConfig.board, buildConfig.framework].filter(Boolean).join(" · ") || "nicht konfiguriert";
  const targetSystem = project.targetRuntime || buildConfig.platform || "noch nicht festgelegt";
  const deviceLabel = allocated
    ? `${allocated.display_name || allocated.device_id} · ${allocated.connectivity_status || "Status unbekannt"}`
    : "nicht zugeordnet";
  target.innerHTML = [
    ["Projekt", project.name || project.id],
    ["Projektart", project.type || "Entwicklungsprojekt"],
    ["Zielsystem", targetSystem],
    ["Build-Profil", buildProfile],
    ["Aktive Datei", state.sourcePath || "keine Datei gewaehlt"],
    ["Device", deviceLabel],
  ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const notices = [];
  const healthNotices = ideProjectHealthNotices(project);
  const actionReason = ideActionUnavailableReason(project, allocated);
  if (actionReason) notices.push(actionReason);
  if (!project.buildConfig) notices.push("Fuer dieses Projekt ist noch kein Build-Profil hinterlegt.");
  if (allocated && !allocated.usb_flash_supported) notices.push("Das zugeordnete Device unterstuetzt keinen USB-Flash.");
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
  const showHints = view === "hints";
  const workspace = document.querySelector("#ideConsoleWorkspace");
  const terminalButton = document.querySelector("#showIdeTerminalButton");
  const informationButton = document.querySelector("#showIdeProjectInformationButton");
  const hintsButton = document.querySelector("#showIdeProjectHintsButton");
  workspace.classList.toggle("show-project-information", showProjectInformation);
  workspace.classList.toggle("show-hints", showHints);
  terminalButton.classList.toggle("active", !showProjectInformation && !showHints);
  terminalButton.setAttribute("aria-selected", String(!showProjectInformation && !showHints));
  informationButton.classList.toggle("active", showProjectInformation);
  informationButton.setAttribute("aria-selected", String(showProjectInformation));
  hintsButton.classList.toggle("active", showHints);
  hintsButton.setAttribute("aria-selected", String(showHints));
}

function ideActionUnavailableReason(project, allocated) {
  if (!projectNeedsHardwareTools(project)) return "";
  if (!allocated) {
    const compatible = state.devices.filter((device) => deviceCompatibleWithProject(project, device));
    return compatible.length
      ? "Vor Build oder Flash: Ordne der IoT-Device-Komponente zuerst ein Inventar-Device zu."
      : "Vor Build oder Flash: Kein kompatibles Board im Inventar. Fuege das Board zum Inventar hinzu und ordne es dem Projekt zu.";
  }
  return "";
}

function renderIdeDeviceAllocation(project) {
  document.querySelector("#ideDeviceAllocation").dataset.visible = String(projectNeedsHardwareTools(project));
}

function deviceCompatibleWithProject(project, device) {
  const projectPlatform = String(project?.buildConfig?.platform || "").toLowerCase();
  const devicePlatform = String(device?.build_config?.platform || "").toLowerCase();
  if (projectPlatform && devicePlatform) return projectPlatform === devicePlatform;
  return String(project?.targetRuntime || "").toLowerCase().includes("esp")
    && String(device?.hardware_profile_id || "").toLowerCase().includes("esp");
}

function componentDeviceAllocations(project) {
  const configured = Array.isArray(project?.buildConfig?.component_device_allocations)
    ? project.buildConfig.component_device_allocations
    : [];
  if (configured.length) return configured;
  const primary = primaryComponentPath(project);
  return project?.linkedDeviceId && primary ? [{ component_path: primary, device_id: project.linkedDeviceId }] : [];
}

function allocatedIdeDevice(project = projectById(state.activeProjectId), componentPath = primaryComponentPath(project)) {
  const allocation = componentDeviceAllocations(project).find((item) => item.component_path === componentPath);
  if (!allocation?.device_id) return null;
  return state.devices.find((device) => device.device_id === allocation.device_id) || null;
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
  const openFolders = new Set(Array.from(target.querySelectorAll("details[data-tree-path][open]"))
    .map((folder) => folder.dataset.treePath));
  const treeSources = projectBrowserSources(project, sources).concat(projectVirtualTreeEntries(project));
  target.innerHTML = treeSources.length
    ? renderSourceTree(sourceTree(project.name, treeSources), 0, openFolders)
    : `<p class="empty">Keine Projektdateien.</p>`;
}

function projectBrowserSources(project, sources) {
  const mappings = projectHardwareComponents(project)
    .filter((component) => component.abstract_type === "iot_device" && component.component_path)
    .map((component) => ({
      sourcePrefix: String(component.component_path).replace(/\/$/, ""),
      treePrefix: `Komponenten/${componentTreeLabel(component)}`,
    }))
    .sort((left, right) => right.sourcePrefix.length - left.sourcePrefix.length);
  const mappedSources = !mappings.length ? sources : sources.map((source) => {
    const mapping = mappings.find((item) => source.path === item.sourcePrefix || source.path.startsWith(`${item.sourcePrefix}/`));
    if (!mapping) return source;
    let relativePath = source.path.slice(mapping.sourcePrefix.length).replace(/^\//, "");
    if (/^Konfiguration\//.test(relativePath) && !/^Konfiguration\/(Hardware|Software)\//.test(relativePath)) {
      relativePath = relativePath.replace(/^Konfiguration\//, "Konfiguration/Hardware/");
    }
    return { ...source, treePath: [mapping.treePrefix, relativePath].filter(Boolean).join("/") };
  });
  return mappedSources.filter((source) => !["device_sensor_input_config", "device_actuator_output_config"].includes(source.role)
    && !/\/Konfiguration\/Hardware\/(Sensoren\/in|Aktoren\/out)\.md$/i.test(String(source.treePath || source.path || "")));
}

function projectVirtualTreeEntries(project) {
  const entries = [];
  const hardwareComponents = projectHardwareComponents(project);
  if (projectNeedsHardwareTools(project)) {
    const primaryPath = primaryComponentPath(project);
    const primaryDevice = hardwareComponents.find((component) => component.abstract_type === "iot_device" && component.component_path === primaryPath);
    const component = primaryDevice ? `Komponenten/${componentTreeLabel(primaryDevice)}` : (primaryPath || "Komponenten/IoT-Device 1");
    entries.push(
      { path: `${component}/Konfiguration/Software/Eigenschaften`, role: "", virtualAction: "component-features" },
      { path: `${component}/Konfiguration/Software/Treiber/Verwaltung`, role: "", virtualAction: "driver-management" },
      { path: `${component}/Konfiguration/Software/Webserver/Konfiguration`, role: "", virtualAction: "webserver-configuration" },
      { path: `${component}/Konfiguration/Software/Webserver/Vorschau`, role: "", virtualAction: "device-web" },
    );
  }
  hardwareComponents.forEach((component) => {
    const label = componentTreeLabel(component);
    if (component.abstract_type === "iot_device") {
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Hardware/Board/Boardeigenschaften`,
        role: "",
        virtualAction: "board-properties",
        componentId: component.component_id,
      });
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Hardware/Angeschlossene Komponenten`,
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

function isArchitectureBaselinePath(sourcePath) {
  const path = String(sourcePath || "").replace(/\\/g, "/");
  return path.startsWith("Architektur/") || path === "docs/architecture.puml";
}

function ideSourceIsEditable(project, sourcePath) {
  return projectNeedsSourceEditing(project) && !isArchitectureBaselinePath(sourcePath);
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
          : file.virtualAction === "webserver-configuration"
            ? "data-webserver-configuration"
          : file.virtualAction === "device-web"
            ? "data-device-web"
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
  document.querySelector("#ideActiveSourceLabel").textContent = `${primaryComponentPath(project)}/Konfiguration/Software/Eigenschaften`;
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
  document.querySelector("#ideActiveSourceLabel").textContent = `${primaryComponentPath(project)}/Konfiguration/Software/Treiber/Verwaltung`;
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

function renderDriverManagement(project) {
  const target = document.querySelector("#ideDriverManagementView");
  if (!target || !project) return;
  const managedDrivers = availableManagedDrivers(project);
  const projectDrivers = projectDriverSources(project);
  target.innerHTML = `<div class="driver-management-workspace">
    <header><div><p class="eyebrow">Software · Wiederverwendung</p><h3>Treiberverwaltung</h3></div><span class="driver-origin-badge combined">Bibliothek + KI</span></header>
    <p class="helper-text">Beide Arbeitsweisen erzeugen normale Projekttreiber. Die Herkunft bleibt sichtbar; übernommene KI-Treiber können anschließend genauso geprüft, versioniert und wiederverwendet werden wie bewusst ausgewählte Bibliothekstreiber.</p>
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

function openWebserverConfiguration() {
  state.ideViewMode = "webserver-configuration";
  const project = projectById(state.activeProjectId);
  document.querySelector("#ideActiveSourceLabel").textContent = `${primaryComponentPath(project)}/Konfiguration/Software/Webserver/Konfiguration`;
  renderWebserverConfiguration(project);
  renderIdeViewMode(project);
}

async function openBoardProperties(componentId) {
  state.ideViewMode = "board-properties";
  state.activeIdeComponentId = String(componentId || "");
  const project = projectById(state.activeProjectId);
  const component = projectHardwareComponents(project).find((item) => item.component_id === state.activeIdeComponentId);
  document.querySelector("#ideActiveSourceLabel").textContent = `Komponenten/${component?.label || "IoT-Device"}/Konfiguration/Hardware/Board/Boardeigenschaften`;
  await loadProcessorBoardCatalog();
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
  const component = projectHardwareComponents(project).find((item) => item.component_id === state.activeIdeComponentId && item.abstract_type === "iot_device");
  document.querySelector("#ideActiveSourceLabel").textContent = `Komponenten/${component?.label || "IoT-Device"}/Konfiguration/Hardware/Angeschlossene Komponenten`;
  renderDeviceConnections(project);
  renderIdeViewMode(project);
}

function renderDeviceConnections(project) {
  const target = document.querySelector("#ideDeviceConnectionsView");
  if (!target || !project) return;
  const components = projectHardwareComponents(project);
  const device = components.find((item) => item.component_id === state.activeIdeComponentId && item.abstract_type === "iot_device");
  if (!device) {
    target.innerHTML = '<div class="device-connections-empty"><h3>IoT-Device nicht gefunden</h3><p>Die Komponente ist nicht mehr Teil der gespeicherten Hardware-Konfiguration.</p></div>';
    return;
  }
  const connected = components.filter((item) => ["sensor", "actuator"].includes(item.abstract_type) && item.target_device_id === device.component_id);
  target.innerHTML = `<div class="device-connections-workspace">
    <header><div><p class="eyebrow">Hardware · IoT-Device</p><h3>${escapeHtml(device.label)}</h3></div><button type="button" data-open-hardware-configuration>Anschlüsse bearbeiten</button></header>
    <p class="helper-text">Alle direkt mit diesem IoT-Device verbundenen Sensoren und Aktoren werden gemeinsam dargestellt.</p>
    <dl class="device-connections-meta"><div><dt>Board</dt><dd>${escapeHtml(sensorConfigurationValue(device.board_profile_id))}</dd></div><div><dt>Verbundene Komponenten</dt><dd>${connected.length}</dd></div></dl>
    ${connected.length ? `<table class="device-connections-table"><thead><tr><th>Art</th><th>Komponente</th><th>Konkreter Typ</th><th>Verbindung</th><th>Funktion</th></tr></thead><tbody>
      ${connected.map((component) => {
        const properties = component.properties || {};
        const connection = [component.pin, component.secondary_pin, properties.phase_v_pin, properties.phase_w_pin].filter(Boolean).join(" · ");
        const functionLabel = component.abstract_type === "sensor"
          ? (properties.measurement_mode === "periodic_log" ? "Zyklischer Datenlogger" : "Messwert erfassen")
          : (properties.motor_driver_type ? `Motorsteuerung: ${properties.motor_driver_type}` : "Aktor ansteuern");
        return `<tr><td><span class="connection-type-badge ${component.abstract_type}">${component.abstract_type === "sensor" ? "Sensor" : "Aktor"}</span></td><td>${escapeHtml(component.label)}</td><td>${escapeHtml(sensorConfigurationValue(component.concrete_type))}</td><td><code>${escapeHtml(sensorConfigurationValue(connection, "nicht verbunden"))}</code></td><td>${escapeHtml(functionLabel)}</td></tr>`;
      }).join("")}
    </tbody></table>` : '<div class="device-connections-empty"><strong>Noch keine Komponenten verbunden</strong><p>Ordne im Hardware-Schritt Sensoren oder Aktoren diesem IoT-Device zu.</p></div>'}
  </div>`;
}

function openDeviceWebView() {
  state.ideViewMode = "device-web";
  const project = projectById(state.activeProjectId);
  document.querySelector("#ideActiveSourceLabel").textContent = `${primaryComponentPath(project)}/Konfiguration/Software/Webserver/Vorschau`;
  renderDeviceWebView(project);
  renderIdeViewMode(project);
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
  const webserverConfiguration = state.ideViewMode === "webserver-configuration";
  const boardProperties = state.ideViewMode === "board-properties";
  const sensorProperties = state.ideViewMode === "sensor-properties";
  const deviceConnections = state.ideViewMode === "device-connections";
  const driverManagement = state.ideViewMode === "driver-management";
  const deviceWeb = state.ideViewMode === "device-web";
  const pwaDashboard = state.ideViewMode === "pwa-dashboard";
  const virtualView = componentFeatures || webserverConfiguration || boardProperties || sensorProperties || deviceConnections || driverManagement || deviceWeb || pwaDashboard;
  const plantUml = /\.(puml|plantuml)$/i.test(sourcePath) && /@startuml/i.test(source);
  const image = /\.(svg|png|jpe?g|gif|webp)$/i.test(sourcePath);
  const architectureBaseline = isArchitectureBaselinePath(sourcePath);
  document.querySelector("#sourceEditor").readOnly = !ideSourceIsEditable(project, sourcePath);
  document.querySelector("#ideViewerPanel").classList.toggle("plantuml-split", plantUml && !virtualView);
  document.querySelector("#ideViewerModeLabel").textContent = componentFeatures ? "Softwareeigenschaften" : webserverConfiguration ? "Webserver-Konfiguration" : boardProperties ? "Boardeigenschaften" : sensorProperties ? "Sensorkonfiguration" : deviceConnections ? "Angeschlossene Komponenten" : driverManagement ? "Treiberverwaltung" : deviceWeb ? "Webserver-Vorschau" : pwaDashboard ? "PWA-Dashboard" : architectureBaseline ? "Freigegebene Architektur-Baseline · schreibgeschützt" : plantUml ? "PlantUML · Quelle und Grafik" : image ? "Grafik" : "Datei";
  document.querySelector("#sourcePanel").classList.toggle("hidden", virtualView || image);
  document.querySelector("#ideImageView").classList.toggle("hidden", virtualView || (!plantUml && !image));
  document.querySelector("#ideModelView").classList.add("hidden");
  document.querySelector("#ideComponentFeaturesView").classList.toggle("hidden", !componentFeatures && !webserverConfiguration);
  document.querySelector("#ideBoardPropertiesView").classList.toggle("hidden", !boardProperties);
  document.querySelector("#ideSensorPropertiesView").classList.toggle("hidden", !sensorProperties);
  document.querySelector("#ideDeviceConnectionsView").classList.toggle("hidden", !deviceConnections);
  document.querySelector("#ideDriverManagementView").classList.toggle("hidden", !driverManagement);
  document.querySelector("#ideDeviceWebView").classList.toggle("hidden", !deviceWeb);
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

function renderWebserverConfiguration(project) {
  const target = document.querySelector("#ideComponentFeaturesView");
  if (!target || !project?.buildConfig) {
    if (target) target.innerHTML = `<p class="empty">Keine Webserver-Konfiguration vorhanden.</p>`;
    return;
  }
  const config = effectiveComponentFeatures(project);
  target.innerHTML = `<form class="component-features-form webserver-configuration-form">
    <header><div><p class="eyebrow">Software · Webserver</p><h3>Konfiguration</h3></div>
      <span class="basis-variant-badge">Basis: ${escapeHtml(config.basisVariant || "ohne Variante")}</span></header>
    <p class="helper-text">Hier konfigurierst du die projektspezifische Weboberfläche. Die laufende Ansicht findest du direkt daneben unter Vorschau.</p>
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
    <footer><button type="submit">Webserver-Konfiguration speichern</button><span data-component-feature-status></span></footer>
  </form>`;
}

function renderBoardProperties(project) {
  const target = document.querySelector("#ideBoardPropertiesView");
  if (!target) return;
  const deviceComponent = projectHardwareComponents(project)
    .find((component) => component.abstract_type === "iot_device" && component.component_id === state.activeIdeComponentId);
  if (!deviceComponent) {
    target.innerHTML = '<div class="board-properties-empty"><h3>IoT-Device nicht gefunden</h3><p>Waehle die Boardeigenschaften direkt unter einer IoT-Device-Komponente im Projektbrowser.</p></div>';
    return;
  }
  const allocated = allocatedIdeDevice(project);
  const boardProfileId = deviceComponent?.board_profile_id || allocated?.hardware_profile_id || "";
  const board = state.processorBoards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
    .filter(Boolean).some((id) => String(id) === String(boardProfileId)));
  if (!board) {
    target.innerHTML = `<div class="board-properties-empty">
      <h3>Boardeigenschaften noch nicht verfügbar</h3>
      <p>Wähle zuerst ein reales Board in der Hardware-Konfiguration. Danach werden GPIO-, ADC-, PWM- und I²C-Ressourcen hier angezeigt.</p>
      <button type="button" data-open-hardware-configuration>Board zuordnen</button>
    </div>`;
    return;
  }
  const profile = board.pin_profile || {};
  const peripheralProfile = board.peripheral_profile || {};
  const resources = Array.isArray(peripheralProfile.resources) && peripheralProfile.resources.length
    ? peripheralProfile.resources
    : [
      { id: "gpio", title: "GPIO", description: "Digitale Ein- und Ausgänge", configurable: true, pin_profile_key: "digital_pins" },
      { id: "adc", title: "ADC", description: "Analoge Eingänge", configurable: true, pin_profile_key: "analog_inputs" },
      { id: "pwm", title: "PWM", description: "Pulsweitenmodulation", configurable: true, pin_profile_key: "pwm_pins" },
      { id: "i2c", title: "I²C", description: "Bus-Anschlüsse", configurable: true, pin_profile_key: "i2c" },
    ];
  const abstractions = Array.isArray(peripheralProfile.abstractions) ? peripheralProfile.abstractions : [];
  const drivers = Array.isArray(peripheralProfile.drivers) ? peripheralProfile.drivers : [];
  const peripheralUsage = effectiveBoardPeripheralUsage(project, deviceComponent.component_id);
  const configurablePeripherals = resources.filter((resource) => resource.configurable);
  target.innerHTML = `<div class="board-properties-workspace">
    <header><div><p class="eyebrow">Hardware · Board</p><h3>${escapeHtml(board.title || deviceComponent?.label || "Boardeigenschaften")}</h3></div>
      <button type="button" data-open-hardware-configuration>Belegung konfigurieren</button></header>
    <p class="helper-text">Diese Ressourcen werden vom gewählten Board bereitgestellt. Die konkrete Belegung erfolgt bei den Sensoren und Aktoren in der Hardware-Konfiguration.</p>
    <dl class="board-properties-meta">
      <div><dt>Prozessorfamilie</dt><dd>${escapeHtml(board.processor_family || deviceComponent?.processor_family || "nicht angegeben")}</dd></div>
      <div><dt>MCU</dt><dd>${escapeHtml(board.mcu_variant || deviceComponent?.processor_variant || "nicht angegeben")}</dd></div>
    </dl>
    <form class="board-peripheral-usage-form" data-component-id="${escapeAttribute(deviceComponent.component_id)}">
      <header><div><p class="eyebrow">IoT-Device-Konfiguration</p><h4>Verwendete Boardfunktionen</h4></div></header>
      <div class="board-peripheral-options">${configurablePeripherals.map((resource) => {
        const supported = boardPeripheralSupported(resource, profile);
        return `<label class="component-feature-card ${supported ? "" : "locked"}">
          <input type="checkbox" name="peripheral" value="${escapeAttribute(resource.id)}" ${peripheralUsage.has(resource.id) ? "checked" : ""} ${supported ? "" : "disabled"}>
          <span><strong>${escapeHtml(resource.title)} verwenden</strong><small>${escapeHtml(resource.description)}</small></span>
          <em>${escapeHtml(boardPeripheralAvailability(resource, profile))}</em>
        </label>`;
      }).join("")}</div>
      <footer><button type="submit">Boardfunktionen speichern</button><span data-board-peripheral-status></span></footer>
    </form>
    <section class="board-capability-hierarchy" aria-label="Hierarchie der Boardfunktionen">
      ${boardCapabilityLayer("Treiber und Steuerungen", "Anwendungsebene", drivers, resources, abstractions, profile, "driver")}
      <div class="board-capability-connector"><span>nutzt</span><b>↓</b></div>
      ${boardCapabilityLayer("Runtime-Abstraktionen", "Basissoftware / OS", abstractions, resources, abstractions, profile, "runtime")}
      <div class="board-capability-connector"><span>abstrahiert</span><b>↓</b></div>
      ${boardCapabilityLayer("MCU-Peripherie", "ESP32-Ressourcen", resources, resources, abstractions, profile, "resource")}
    </section>
  </div>`;
}

function boardPeripheralSupported(resource, pinProfile) {
  if (resource.supported === false) return false;
  if (!resource.pin_profile_key) return true;
  return Array.isArray(pinProfile?.[resource.pin_profile_key]) && pinProfile[resource.pin_profile_key].length > 0;
}

function boardPeripheralAvailability(resource, pinProfile) {
  if (!boardPeripheralSupported(resource, pinProfile)) return "Vom Board nicht bereitgestellt";
  const pins = resource.pin_profile_key ? pinProfile?.[resource.pin_profile_key] : null;
  if (Array.isArray(pins)) return `${pins.length} Anschlüsse verfügbar`;
  if (resource.managed_by) return "Durch Runtime verwaltet";
  return "Vom Board bereitgestellt";
}

function boardCapabilityLayer(title, subtitle, items, resources, abstractions, pinProfile, layerType) {
  const labels = new Map([...resources, ...abstractions, ...items].map((item) => [item.id, item.title]));
  return `<section class="board-capability-layer">
    <header><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div><span>${items.length}</span></header>
    <div>${items.map((item) => {
      const dependencies = Array.isArray(item.depends_on) ? item.depends_on : [];
      const sensorFunction = item.configures === "sensor";
      const availability = layerType === "driver"
        ? sensorFunction ? "Bei einer Sensor-Komponente konfigurierbar" : "Beim Motor-Aktor auswählbar"
        : layerType === "runtime" ? "Durch Runtime verwaltet" : boardPeripheralAvailability(item, pinProfile);
      return `<article class="board-capability-node ${item.managed_by ? "managed" : ""}">
        <header><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(availability)}</small></header>
        <p>${escapeHtml(item.description || "")}</p>
        ${dependencies.length ? `<div>${dependencies.map((id) => `<code>${escapeHtml(labels.get(id) || id)}</code>`).join("")}</div>` : ""}
        ${layerType === "driver" ? `<button type="button" data-open-hardware-configuration>${sensorFunction ? "Beim Sensor konfigurieren" : "Beim Aktor auswählen"}</button>` : ""}
      </article>`;
    }).join("")}</div>
  </section>`;
}

function effectiveBoardPeripheralUsage(project, componentId) {
  const configured = project?.buildConfig?.component_hardware_features?.[componentId]?.enabled;
  return new Set(Array.isArray(configured) ? configured : []);
}

async function saveBoardPeripheralUsage(event) {
  if (!event.target.matches(".board-peripheral-usage-form")) return;
  event.preventDefault();
  const project = projectById(state.activeProjectId);
  const componentId = event.target.dataset.componentId || "";
  const status = event.target.querySelector("[data-board-peripheral-status]");
  const enabled = new FormData(event.target).getAll("peripheral").map(String);
  status.textContent = "Wird gespeichert...";
  try {
    const response = await postJson(`/api/user-ide/projects/${encodeURIComponent(project.id)}/component-hardware-features`, {
      component_id: componentId,
      enabled,
    });
    state.projects = state.projects.filter((item) => item.id !== response.project.id).concat(response.project);
    renderBoardProperties(response.project);
    document.querySelector("[data-board-peripheral-status]").textContent = "Gespeichert.";
  } catch (error) {
    status.textContent = error.message;
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
    if (webserverOnly) renderWebserverConfiguration(response.project);
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

function renderDeviceWebView(project) {
  const target = document.querySelector("#ideDeviceWebView");
  if (!target) return;
  const stored = localStorage.getItem(deviceWebStorageKey(project)) || "";
  const url = stored || suggestedDeviceWebUrl(project);
  const features = effectiveComponentFeatures(project);
  target.innerHTML = `<div class="device-web-workspace">
    <form class="device-web-toolbar"><label>Board-Adresse<input name="device_web_url" value="${escapeAttribute(url)}" placeholder="http://gernetix-board.local/"></label><button type="submit">Anzeigen</button>${url ? `<a href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">Im Browser öffnen</a>` : ""}</form>
    <div class="device-web-info"><strong>Webserver des Entwicklungsprojekts</strong><span>${features.webserver.measurement_chart ? "Messwertdiagramm konfiguriert" : "Statusseite der Basissoftware"}</span></div>
    ${url ? `<iframe title="Device-Webserver" src="${escapeAttribute(url)}"></iframe>` : `<div class="device-web-empty"><strong>Noch keine Board-Adresse bekannt</strong><p>Ordne ein Device zu oder trage seine lokale Adresse ein.</p></div>`}
  </div>`;
}

function loadDeviceWebPreview(event) {
  if (!event.target.matches(".device-web-toolbar")) return;
  event.preventDefault();
  const project = projectById(state.activeProjectId);
  const data = new FormData(event.target);
  let url = String(data.get("device_web_url") || "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
  localStorage.setItem(deviceWebStorageKey(project), url);
  renderDeviceWebView(project);
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

async function startBuild() {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project) return setFlashStatus("error", "Bitte zuerst ein Projekt öffnen.");
  setFlashStatus("running", "Build laeuft...");
  try {
    await persistCurrentSource(project);
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      device_id: device?.device_id || "",
      mode: "build",
    });
    const completed = await waitForCompletedBuild(build);
    state.builds.unshift(completed);
    renderIdeProjectInformation(project);
    if (completed.status !== "succeeded") appendBuildFailureLog(completed.build_log);
    setFlashStatus(completed.status === "succeeded" ? "ok" : "error", completed.status === "succeeded"
      ? "Build erfolgreich abgeschlossen."
      : `Build fehlgeschlagen: ${completed.error || "Unbekannter Buildfehler."}`);
    renderBuilds();
  } catch (error) {
    setFlashStatus("error", error.message);
  }
}

async function startUsbFlash() {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project || !device) return setFlashStatus("error", "Bitte zuerst der IoT-Device-Komponente ein Inventar-Device zuordnen.");
  if (!device.usb_flash_supported) return setFlashStatus("error", "Das zugeordnete Device unterstuetzt keinen USB-Flash.");
  if (!navigator.serial) return setFlashStatus("error", "Web Serial ist nicht verfügbar. Bitte Chrome oder Edge auf Desktop verwenden.");
  setFlashStatus("running", "Echter PlatformIO-Build wird gestartet...");
  let activeBuild = null;
  try {
    await persistCurrentSource(project);
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      device_id: device.device_id,
      mode: "build_and_usb_flash",
    });
    activeBuild = await waitForCompletedBuild(build);
    state.builds.unshift(activeBuild);
    renderIdeProjectInformation(project);
    if (activeBuild.status !== "succeeded") {
      appendBuildFailureLog(activeBuild.build_log);
      throw new Error(activeBuild.error || "PlatformIO-Build ist fehlgeschlagen.");
    }
    setFlashStatus("running", "Build erfolgreich. USB-Gerät im Browser auswählen...");
    const flashResult = await flashBuildViaWebSerial(activeBuild);
    await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(activeBuild.build_job_id)}/browser-usb-flash-result`, {
      status: "succeeded",
      chip_name: flashResult.chipName,
      logs: flashResult.logs,
    });
    activeBuild.flash_status = "succeeded";
    setFlashStatus("ok", `Web-Serial-Flash erfolgreich: ${flashResult.chipName}`);
    renderBuilds();
  } catch (error) {
    if (activeBuild?.build_job_id) {
      await postJson(`/api/user-ide/build-jobs/${encodeURIComponent(activeBuild.build_job_id)}/browser-usb-flash-result`, {
        status: "failed",
        error: error.message,
      }).catch(() => {});
    }
    setFlashStatus("error", error.message);
  }
}

async function waitForCompletedBuild(build) {
  let current = build;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const otaComplete = build.mode !== "build_and_flash"
      || ["rebooting", "confirmed", "delivered", "succeeded", "failed"].includes(current.flash_status);
    if (["failed", "replaced"].includes(current.status) || (current.status === "succeeded" && otaComplete)) return { ...build, ...current };
    if (attempt % 5 === 0) {
      const waitingForBoard = build.mode === "build_and_flash" && current.status === "succeeded";
      const message = waitingForBoard
        ? `Build fertig. OTA-Auftrag ist ${current.flash_status || "veröffentlicht"}; warte auf das Board... ${attempt}s`
        : `PlatformIO-Build läuft... ${attempt}s`;
      setFlashStatus("running", message);
    }
    await delay(1000);
    current = await getJson(`/api/user-ide/build-jobs/${encodeURIComponent(build.build_deploy_job_id || build.build_job_id)}/status`);
  }
  throw new Error("PlatformIO-Build hat das Zeitlimit überschritten.");
}

function appendBuildFailureLog(buildLog) {
  const lines = String(buildLog || "").split(/\r?\n/).filter(Boolean);
  const relevant = lines.filter((line) => /fatal error:|error:|\*\*\*|\[FAILED\]/i.test(line));
  (relevant.length ? relevant : lines.slice(-6)).slice(-8).forEach((line) => appendIdeTerminal("error", line));
}

async function flashBuildViaWebSerial(build) {
  const manifest = Array.isArray(build.flash_manifest) ? build.flash_manifest : [];
  const required = ["bootloader.bin", "partitions.bin", "firmware.bin"];
  if (!required.every((name) => manifest.some((item) => item.name === name))) {
    throw new Error("Build enthält kein vollständiges ESP32-Web-Serial-Flashpaket.");
  }
  const fileArray = await Promise.all(manifest.map(async (item) => {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error(`${item.name} konnte nicht geladen werden.`);
    return { data: new Uint8Array(await response.arrayBuffer()), address: Number(item.address) };
  }));
  const port = await navigator.serial.requestPort();
  const { ESPLoader, Transport } = await loadIdeEsptoolModule();
  const transport = new Transport(port, false);
  state.activeSerialTransport = transport;
  const logs = [];
  const log = (value) => {
    const line = String(value || "").trim();
    if (!line) return;
    logs.push(line);
    appendIdeTerminal("running", line);
  };
  try {
    const loader = new ESPLoader({
      transport,
      baudrate: 115200,
      terminal: { clean() {}, writeLine: log, write: log },
      debugLogging: false,
    });
    const chipName = await loader.main();
    await loader.writeFlash({
      fileArray,
      flashMode: "dio",
      flashFreq: "40m",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (_index, written, total) => {
        const percent = Math.round((written / Math.max(total, 1)) * 100);
        if (percent % 10 === 0) log(`Firmware schreiben: ${percent}%`);
      },
    });
    await loader.after("hard_reset");
    await transport.disconnect();
    state.activeSerialTransport = null;
    return { chipName, logs };
  } catch (error) {
    try { await transport.disconnect(); } catch {}
    state.activeSerialTransport = null;
    throw error;
  }
}

async function loadIdeEsptoolModule() {
  if (!state.esptoolModule) state.esptoolModule = await import("/vendor/esptool-js/bundle.js");
  return state.esptoolModule;
}

async function startOtaFlash() {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project || !device) return setFlashStatus("error", "Bitte zuerst der IoT-Device-Komponente ein Inventar-Device zuordnen.");
  if (device.connectivity_status !== "online") return setFlashStatus("error", `Das zugeordnete Device ist nicht online (${device.connectivity_status || "unknown"}).`);
  if (device.ota_status !== "ready") return setFlashStatus("error", "Das zugeordnete Device ist nicht OTA-ready.");
  setFlashStatus("running", "Build und OTA-Flash laufen...");
  try {
    await persistCurrentSource(project);
    const build = await postJson("/api/user-ide/build-jobs", {
      project_slug: project.slug,
      device_id: device.device_id,
      mode: "build_and_flash",
    });
    const completed = await waitForCompletedBuild(build);
    state.builds.unshift(completed);
    renderIdeProjectInformation(project);
    if (completed.status !== "succeeded") {
      appendBuildFailureLog(completed.build_log);
      throw new Error(completed.error || "Build für das OTA-Update ist fehlgeschlagen.");
    }
    if (["rebooting", "confirmed", "delivered", "succeeded"].includes(completed.flash_status)) {
      setFlashStatus("ok", `OTA-Auftrag erfolgreich übergeben: ${completed.flash_status}`);
    } else {
      setFlashStatus("error", `Firmware gebaut, OTA-Übertragung nicht bestätigt: ${completed.flash_status || "unbekannter Status"}`);
    }
    renderBuilds();
  } catch (error) {
    setFlashStatus("error", error.message);
  }
}

async function checkAllocatedDeviceConnectivity() {
  const project = projectById(state.activeProjectId);
  const device = allocatedIdeDevice(project);
  if (!project || !device) return setFlashStatus("error", "Bitte zuerst der IoT-Device-Komponente ein Inventar-Device zuordnen.");
  const button = document.querySelector("#checkOtaConnectivityButton");
  button.disabled = true;
  setFlashStatus("running", `Erreichbarkeit von ${device.display_name || device.device_id} wird geprüft...`);
  try {
    const result = await postJson(`/api/user-ide/devices/${encodeURIComponent(device.device_id)}/connectivity-check`, {});
    if (!result.reachable) {
      setFlashStatus("error", result.message || "Das Board wurde im lokalen Netzwerk nicht gefunden.");
      return;
    }
    Object.assign(device, result.device || {}, { connectivity_status: "online" });
    updateIdeProjectTools(project);
    renderIdeDeviceAllocation(project);
    setFlashStatus("ok", `Board online: ${result.hostname || device.display_name || device.device_id}`);
  } catch (error) {
    setFlashStatus("error", `Online-Prüfung fehlgeschlagen: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function refreshRecoveryDevices() {
  setRecoveryStatus("running", "Devices werden aktualisiert...");
  try {
    const response = await getJson("/api/user-ide/devices");
    state.devices = response.items || [];
    if (!state.devices.some((device) => device.device_id === state.activeRecoveryDeviceId)) {
      state.activeRecoveryDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
    }
    state.recoveryCheckResult = null;
    renderIdeShell();
    renderDeviceRecovery();
    setRecoveryStatus("ok", state.devices.length ? `${state.devices.length} Device(s) geladen.` : "Keine Devices fuer diesen Account gefunden.");
  } catch (error) {
    setRecoveryStatus("error", error.message);
  }
}

async function checkRecoveryFirmware(mode) {
  const device = selectedRecoveryDevice();
  if (!device) {
    setRecoveryStatus("error", "Bitte zuerst ein Device waehlen.");
    return;
  }
  setRecoveryStatus("running", `Firmwarecheck ueber ${mode.toUpperCase()} laeuft...`);
  try {
    const result = await postJson("/api/user-ide/device-recovery/check-firmware", {
      device_id: device.device_id,
      mode,
      upload_port: mode === "usb" ? selectedRecoveryUsbPort(device) : "",
    });
    state.recoveryCheckResult = result;
    renderDeviceRecovery();
    setRecoveryStatus(result.status === "ready" ? "ok" : "error", result.summary);
  } catch (error) {
    setRecoveryStatus("error", error.message);
  }
}

function renderDeviceRecovery() {
  const select = document.querySelector("#recoveryDeviceSelect");
  if (!select) return;
  if (!state.activeRecoveryDeviceId && state.devices.length) {
    state.activeRecoveryDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0].device_id;
  }
  select.innerHTML = state.devices.length
    ? state.devices.map((device) => `<option value="${escapeHtml(device.device_id)}">${escapeHtml(device.display_name)} - ${escapeHtml(device.build_target_label || device.hardware_profile_id || "Device")}</option>`).join("")
    : `<option value="">Keine Devices</option>`;
  select.value = state.activeRecoveryDeviceId || "";
  const device = selectedRecoveryDevice();
  document.querySelector("#recoveryDeviceTitle").textContent = device ? device.display_name : "Kein Device gewaehlt";
  document.querySelector("#recoveryDeviceMeta").innerHTML = device ? [
    ["Device ID", device.device_id],
    ["Hardware", device.hardware_profile_id],
    ["Boardprofil", device.build_target_label || "kein Boardprofil"],
    ["Connectivity", device.connectivity_status || "unknown"],
    ["OTA", device.ota_status || "unknown"],
    ["USB", device.usb_flash_supported ? usbFlashLabel(device) : "nicht konfiguriert"],
  ].map(([key, value]) => meta(key, value)).join("") : "";
  document.querySelector("#recoveryDeviceList").innerHTML = state.devices.length ? state.devices.map((item) => `
    <button class="recovery-device-card ${item.device_id === state.activeRecoveryDeviceId ? "active-method" : ""}" type="button" data-recovery-device="${escapeHtml(item.device_id)}">
      <strong>${escapeHtml(item.display_name)}</strong>
      <span>${escapeHtml(item.build_target_label || item.hardware_profile_id || "Device")}</span>
      <small>${escapeHtml(item.connectivity_status || "unknown")} · OTA ${escapeHtml(item.ota_status || "unknown")}</small>
    </button>
  `).join("") : `<p class="empty">Keine Devices fuer diesen Account gefunden.</p>`;
  document.querySelectorAll("[data-recovery-device]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeRecoveryDeviceId = button.dataset.recoveryDevice;
      state.recoveryCheckResult = null;
      renderDeviceRecovery();
    });
  });
  const usbButton = document.querySelector("#recoveryCheckUsbButton");
  const otaButton = document.querySelector("#recoveryCheckOtaButton");
  usbButton.disabled = !device;
  otaButton.disabled = !device;
  renderRecoveryCheckResult();
}

function renderRecoveryCheckResult() {
  const target = document.querySelector("#recoveryCheckResult");
  if (!target) return;
  const result = state.recoveryCheckResult;
  if (!result) {
    target.innerHTML = `<p class="empty">Noch kein Firmwarecheck ausgefuehrt.</p>`;
    return;
  }
  target.innerHTML = `
    <article class="recovery-result ${result.status === "ready" ? "ok" : "blocked"}">
      <div>
        <p class="eyebrow">${escapeHtml(result.mode.toUpperCase())}</p>
        <h3>${escapeHtml(result.summary)}</h3>
        <p>${escapeHtml(result.next_action || "")}</p>
      </div>
      <dl class="meta-list compact">
        ${result.checks.map((check) => meta(check.check_id, `${check.status}: ${check.message}`)).join("")}
      </dl>
    </article>
  `;
}

function selectedRecoveryDevice() {
  return state.devices.find((device) => device.device_id === state.activeRecoveryDeviceId) || state.devices[0] || null;
}

function selectedRecoveryUsbPort(device) {
  return selectedUsbPort() || bestUsbPortForDevice(device)?.port || device?.upload_port || "";
}

function setRecoveryStatus(kind, text) {
  const status = document.querySelector("#recoveryStatus");
  if (!status) return;
  status.className = `flash-status ${kind}`;
  status.textContent = text;
  status.classList.toggle("hidden", !text);
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

async function scanProvisioningSerialPorts() {
  return deviceOnboarding().scanProvisioningSerialPorts();
}

async function selectProvisioningSerialPort() {
  return deviceOnboarding().selectProvisioningSerialPort();
}

async function flashProvisioningBasissoftware() {
  return deviceOnboarding().flashProvisioningBasissoftware();
}

async function scanProvisioningWifiNetworks() {
  return deviceOnboarding().scanProvisioningWifiNetworks();
}

async function connectProvisioningWifi() {
  return deviceOnboarding().connectProvisioningWifi();
}

function selectDeviceDiscoveryMethod() {
  return deviceOnboarding().selectDeviceDiscoveryMethod();
}

async function searchDevicesForInventory() {
  return deviceOnboarding().searchDevicesForInventory();
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
  const count = document.querySelector("#inventoryDeviceCount");
  count.textContent = `${state.devices.length} ${state.devices.length === 1 ? "Board" : "Boards"}`;
  document.querySelector("#deviceList").innerHTML = state.devices.length ? state.devices.map((device) => `
    <article class="device-row">
      <div class="device-card-main">
        <div class="device-card-title">
          <div>
            <h3>${escapeHtml(device.display_name)}</h3>
            <p>${escapeHtml(device.build_target_label || "ESP32-Board")}</p>
          </div>
          <span class="device-status-pill ${deviceStatusClass(device.connectivity_status)}">${escapeHtml(deviceConnectivityLabel(device.connectivity_status))}</span>
        </div>
        <dl class="device-facts">
          <div><dt>Gerätestatus</dt><dd>${escapeHtml(deviceAuthenticityLabel(device.authenticity_status))}</dd></div>
          <div><dt>Firmware-Update</dt><dd>${escapeHtml(deviceOtaLabel(device.ota_status))}</dd></div>
          <div><dt>USB</dt><dd>${escapeHtml(device.usb_flash_supported ? usbFlashLabel(device) : "Nicht eingerichtet")}</dd></div>
        </dl>
        <details class="device-technical">
          <summary>Technische Details</summary>
          <dl class="meta-list compact">
            ${meta("Device-ID", device.device_id)}
            ${meta("Hardwareprofil", device.hardware_profile_id)}
            ${meta("Node-Name", device.node_name || "nicht gesetzt")}
          </dl>
        </details>
        <div class="device-basissoftware-profile">
          <label>Update- und Speicherprofil
            <select data-device-profile-select="${escapeHtml(device.account_device_id)}">
              ${["full", "medium", "low"].map((profile) => `<option value="${profile}" ${deviceBasissoftwareProfileClass(device) === profile ? "selected" : ""}>${escapeHtml(deviceBasissoftwareProfileLabel(profile))}</option>`).join("")}
            </select>
          </label>
          <button class="secondary" type="button" data-save-device-profile="${escapeHtml(device.account_device_id)}">Profil ändern</button>
          <small>Jederzeit änderbar. Bei einem anderen Partitionslayout ist einmalig ein USB-Flash erforderlich.</small>
        </div>
        <div class="device-card-actions">
          <button class="danger subtle-danger" type="button" data-unpair-device="${escapeHtml(device.account_device_id)}">Zuordnung aufheben</button>
        </div>
      </div>
    </article>
  `).join("") : `<div class="inventory-empty"><strong>Noch keine Boards registriert</strong><span>Öffne „Neues Board hinzufügen“, um ein Gerät zu suchen oder manuell zu erfassen.</span></div>`;
  document.querySelectorAll("[data-unpair-device]").forEach((button) => {
    button.addEventListener("click", () => unpairInventoryDevice(button.dataset.unpairDevice));
  });
  document.querySelectorAll("[data-save-device-profile]").forEach((button) => {
    button.addEventListener("click", () => saveDeviceBasissoftwareProfile(button.dataset.saveDeviceProfile));
  });
}

function deviceBasissoftwareProfileClass(device) {
  return device.instance_configuration?.basissoftware_profile?.class || "full";
}

function deviceBasissoftwareProfileLabel(profile) {
  return ({
    full: "FULL – Maximale Ausfallsicherheit",
    medium: "MEDIUM – Speicheroptimiert",
    low: "LOW – Minimalkonfiguration",
  })[profile] || profile;
}

async function saveDeviceBasissoftwareProfile(accountDeviceId) {
  const device = state.devices.find((item) => item.account_device_id === accountDeviceId);
  const select = document.querySelector(`[data-device-profile-select="${CSS.escape(accountDeviceId)}"]`);
  if (!device || !select) return;
  setInventoryStatus("running", `Profil für ${device.display_name} wird gespeichert...`);
  try {
    const result = await putJson(`/api/platform/devices/${encodeURIComponent(accountDeviceId)}`, {
      basissoftware_profile: select.value,
    });
    state.devices = state.devices.map((item) => item.account_device_id === accountDeviceId ? result.device : item);
    renderDevices();
    renderIdeShell();
    setInventoryStatus(result.requires_usb_reflash ? "running" : "ok", result.message);
  } catch (error) {
    setInventoryStatus("error", error.message);
  }
}

function deviceConnectivityLabel(status) {
  return ({ online: "Online", offline: "Offline", usb_connected: "USB verbunden", unknown: "Status unbekannt" })[status] || "Status unbekannt";
}

function deviceStatusClass(status) {
  return status === "online" || status === "usb_connected" ? "is-online" : status === "offline" ? "is-offline" : "is-unknown";
}

function deviceAuthenticityLabel(status) {
  return ({
    gernetix_verified: "Von GerNetiX bestätigt",
    gernetix_verified_pending_proof: "Bestätigung ausstehend",
    community_unverified: "Nicht bestätigt",
  })[status] || "Unbekannt";
}

function deviceOtaLabel(status) {
  return ({
    ready: "Bereit",
    updating: "Update läuft",
    blocked: "Nicht verfügbar",
    unsupported: "Nur USB",
    profile_change_pending: "Profilwechsel per USB erforderlich",
    unknown: "Noch nicht geprüft",
  })[status] || "Noch nicht geprüft";
}

function syncInventoryNodeNamePreview() {
  return deviceOnboarding().syncInventoryNodeNamePreview();
}

async function unpairInventoryDevice(accountDeviceId) {
  const device = state.devices.find((item) => item.account_device_id === accountDeviceId);
  if (!device) return;
  const confirmed = window.confirm(`Zuordnung von ${device.display_name} zu diesem Account aufheben? Das registrierte physische Device und seine Provisionierung bleiben erhalten.`);
  if (!confirmed) return;
  setInventoryStatus("running", `Account-Zuordnung von ${device.display_name} wird aufgehoben...`);
  try {
    await deleteJson(`/api/platform/devices/${encodeURIComponent(accountDeviceId)}`);
    state.devices = state.devices.filter((item) => item.account_device_id !== accountDeviceId);
    if (state.activeDeviceId === device.device_id) {
      state.activeDeviceId = state.devices.find((item) => item.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
    }
    renderIdeShell();
    renderDevices();
    renderDashboard();
    setInventoryStatus("ok", `${device.display_name} ist nicht mehr mit diesem Account gekoppelt.`);
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
    {
      hardware_item_id: "hardware.processor_board.raspberry_pi_zero_2w",
      title: "Raspberry Pi Zero 2 W",
      processor_family: "raspberry_pi",
      module_name: "Zero 2 W",
      mcu_variant: "Broadcom BCM2710A1",
      capability_ids: ["processor_linux_sbc", "wifi", "linux_runtime", "usb_identification"],
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
  const automaticLabel = state.usbPorts.length
    ? "Automatisch ermitteln"
    : "Automatisch (kein USB-Port erkannt)";
  select.innerHTML = `<option value="">${automaticLabel}</option>${detected}`;
  select.title = state.usbPorts.length
    ? "Nur fuer USB-Flash: Port automatisch ermitteln oder einen erkannten Port auswaehlen."
    : "Nur fuer USB-Flash: Momentan wurde kein USB-Serial-Port erkannt.";
  if (current && Array.from(select.options).some((option) => option.value === current)) select.value = current;
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
  appendIdeTerminal(kind, text);
}

function appendIdeTerminal(kind, text) {
  const terminal = document.querySelector("#ideTerminalOutput");
  if (!terminal || !text) return;
  const normalizedText = String(text).replace(/\x1b\[[0-9;]*m/g, "").trim();
  const previous = terminal.querySelector(".terminal-line:last-of-type");
  if (previous?.dataset.message === `${kind}:${normalizedText}`) return;
  if (kind === "running" && previous?.classList.contains("terminal-running")) {
    previous.textContent = `[${new Date().toLocaleTimeString()}] ${normalizedText}`;
    previous.dataset.message = `${kind}:${normalizedText}`;
    terminal.scrollTop = terminal.scrollHeight;
    return;
  }
  const line = document.createElement("span");
  line.className = `terminal-line terminal-${kind}`;
  line.dataset.message = `${kind}:${normalizedText}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${normalizedText}`;
  terminal.append(document.createTextNode("\n"), line);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearIdeTerminal() {
  const terminal = document.querySelector("#ideTerminalOutput");
  if (!terminal) return;
  terminal.innerHTML = '<span class="terminal-muted">GerNetiX Build-Terminal bereit.</span>';
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

async function enablePushNotifications() {
  const status = document.querySelector("#pushStatus");
  const projectId = selectedPushProjectId();
  if (!projectId) { status.textContent = "Lege zuerst ein Projekt an oder waehle eines aus."; return; }
  if (!window.isSecureContext || !("PushManager" in window) || !("Notification" in window)) { status.textContent = "Push ist nur in der installierten HTTPS-App auf diesem iPhone verfuegbar."; return; }
  try {
    const registration = await navigator.serviceWorker.ready;
    const config = await getJson("/api/push/public-key");
    if (!config.enabled) { status.textContent = "Push wird vom Server noch vorbereitet."; return; }
    if (Notification.permission === "default" && await Notification.requestPermission() !== "granted") { status.textContent = "Push-Erlaubnis wurde nicht erteilt."; return; }
    if (Notification.permission !== "granted") { status.textContent = "Push ist in den iPhone-Einstellungen deaktiviert."; return; }
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.public_key) });
    await postJson(`/api/push/projects/${encodeURIComponent(projectId)}/subscribe`, subscription.toJSON());
    status.textContent = "Push-Meldungen sind auf diesem Geraet fuer das ausgewaehlte Projekt aktiv.";
  } catch (error) { status.textContent = error.message || "Push konnte nicht aktiviert werden."; }
}
async function sendPushTestNotification() {
  const status = document.querySelector("#pushStatus");
  const projectId = selectedPushProjectId();
  if (!projectId) { status.textContent = "Waehle zuerst ein Projekt aus."; return; }
  try {
    const result = await postJson(`/api/push/projects/${encodeURIComponent(projectId)}/test`, {});
    status.textContent = result.push?.enabled ? "Testnachricht wurde an die aktivierten Geraete dieses Projekts gesendet." : "Push wird vom Server noch vorbereitet.";
  } catch (error) { status.textContent = error.message || "Testnachricht konnte nicht gesendet werden."; }
}
function selectedPushProjectId() {
  return String(document.querySelector("#pushProjectSelect")?.value || state.activeProjectId || "").trim();
}
function base64UrlToBytes(value) { const padded = String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value).length / 4) * 4, "="); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); }

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/app/push-sw.js").catch(() => {});
}
