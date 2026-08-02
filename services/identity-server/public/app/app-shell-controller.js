// GerNetiX platform module extracted from app.js.
async function bootstrap() {
  if (isPublicInformationPage) {
    try {
      const summary = await getJson("/api/platform/summary");
      state.account = summary.account;
      state.billing = summary.billing;
      state.knowledgeUpdates = summary.knowledge_updates || [];
      state.knowledgeHistory = summary.knowledge_history || [];
    } catch {
      state.account = null;
      state.billing = null;
    }
    document.body.classList.toggle("public-information-anonymous", !state.account);
    await initializePlatformI18n();
    document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : (isPublicKnowledgePage ? "Wissensportal" : "Öffentliche Hilfe");
    document.querySelector("#logoutButton").textContent = state.account ? "Abmelden" : "Anmelden";
    renderRoute();
    return;
  }
  developmentPlatform().init();
  await refreshBootstrap();
  await initializePlatformI18n();
  renderAll();
  renderRoute();
  void hydratePlatformState();
}

async function initializePlatformI18n() {
  try {
    platformI18n = await window.GerNetiXI18n.create({
      accountLocale: state.account?.preferred_locale || "",
    });
    platformI18n.translateDocument();
    syncLanguageControls(platformI18n.locale);
  } catch (error) {
    console.warn("Platform translations could not be initialized.", error);
  }
}

function syncLanguageControls(locale) {
  const select = document.querySelector("#platformLanguage");
  if (select) select.value = locale;
}

async function changePlatformLocale(event) {
  if (!platformI18n) return;
  const previousLocale = platformI18n.locale;
  const nextLocale = event.target.value;
  try {
    await platformI18n.setLocale(nextLocale);
    syncLanguageControls(nextLocale);
    quizController?.render();
    renderRoute();
    if (state.account) {
      const result = await patchJson("/api/account/preferences", { preferred_locale: nextLocale });
      state.account = { ...state.account, ...result.account };
    }
  } catch (error) {
    await platformI18n.setLocale(previousLocale);
    syncLanguageControls(previousLocale);
    quizController?.render();
    renderRoute();
  }
}

async function loadPlatformDownloads() {
  try {
    const payload = await getJson("/api/platform/downloads");
    state.platformDownloads = payload.downloads || [];
  } catch {
    state.platformDownloads = [];
  }
  document.querySelectorAll("[data-serial-service-install]").forEach(configureSerialServiceInstallLink);
}

function preferredSerialServiceDownload() {
  const platform = /Mac/i.test(navigator.platform) ? "macos" : /Win/i.test(navigator.platform) ? "windows" : "";
  return platform
    ? state.platformDownloads.find((item) => item.platform === platform && item.available) || null
    : null;
}

function configureSerialServiceInstallLink(link) {
  const download = preferredSerialServiceDownload();
  link.href = download?.url || "/app/downloads/";
  if (download) link.setAttribute("download", download.file_name || "");
  else link.removeAttribute("download");
  return link;
}

function showSerialServiceChoiceDialog() {
  const dialog = document.querySelector("#serialServiceChoiceDialog");
  const install = document.querySelector("#serialServiceChoiceInstall");
  const status = document.querySelector("#serialServiceChoiceStatus");
  if (!dialog || !install) return;
  configureSerialServiceInstallLink(install);
  const download = preferredSerialServiceDownload();
  install.textContent = download ? "WebHelper jetzt installieren" : "Downloads öffnen";
  if (status) status.textContent = download
    ? "Die Installation beginnt erst, wenn du den WebHelper auswählst."
    : "Für dieses Betriebssystem ist noch kein Installationspaket veröffentlicht.";
  if (!dialog.open) dialog.showModal();
}

async function refresh() {
  const summary = await getJson("/api/platform/summary");
  state.account = summary.account;
  state.projects = summary.projects;
  state.devices = summary.devices;
  state.builds = summary.builds;
  state.communitySummary = summary.community_summary || { available: false, total: 0, public: { open: 0, closed: 0 }, private: { open: 0, closed: 0 }, messages: { unread: 0, threads: 0 } };
  state.knowledgeUpdates = summary.knowledge_updates || [];
  state.knowledgeHistory = summary.knowledge_history || [];
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

async function refreshBootstrap() {
  const summary = await getJson("/api/platform/bootstrap");
  state.account = summary.account;
  state.projects = summary.projects || [];
  state.workspace = summary.workspace_state || {};
  state.billing = summary.billing || null;
  state.devices = [];
  state.builds = [];
  state.progress = [];
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
  developmentPlatform().setAssistantConfig(summary.development_assistant || null, state.billing);
  developmentPlatform().setProjectTemplates(
    summary.development_project_templates || [],
    summary.development_project_template_previews || [],
  );
}

async function hydratePlatformState() {
  await Promise.all([
    loadPlatformDownloads(),
    refresh().then(() => {
      renderAll();
      renderRoute();
    }),
  ]).catch(() => {});
}

function renderAll() {
  document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : "";
  renderDashboard();
  renderAccountSetup();
  renderProjects();
  renderLearn();
  developmentPlatform().render();
  renderIdeShell();
  renderDeviceRecovery();
  renderNetworkDiscovery();
  renderDevices();
  renderBuilds();
  renderShopConfiguration();
  renderBilling();
}

function renderRoute() {
  const route = routeName();
  if (lastRenderedRoute === "debug" && route !== "debug") stopIdeDeviceDebugPolling();
  const enteringDevelopmentPlatform = route === "development-platform" && lastRenderedRoute !== "development-platform";
  const routeQuery = new URLSearchParams(window.location.search);
  const requestedArchitectureProjectId = routeQuery.get("view") === "architecture" ? routeQuery.get("project") || "" : "";
  document.body.classList.toggle("ide-workspace-active", route === "ide");
  document.body.classList.toggle("debug-workspace-active", route === "debug");
  document.body.classList.toggle("development-workspace-active", route === "development-platform");
  document.body.classList.toggle("development-hardware-active", route === "development-hardware");
  renderBreadcrumb(route);
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== routeMap[route]));
  document.querySelectorAll(".tabs a").forEach((link) => link.classList.toggle("active", link.dataset.route === topLevelRouteName(route)));
  document.querySelectorAll("#mainMenu .app-menu-group").forEach((group) => {
    group.open = Boolean(group.querySelector("a.active"));
  });
  document.querySelectorAll("[data-device-management-route]").forEach((button) => {
    button.classList.toggle("active", deviceManagementRouteFor(route) === button.dataset.deviceManagementRoute);
  });
  if (route === "development-platform" && requestedArchitectureProjectId) developmentPlatform().openArchitecture(requestedArchitectureProjectId);
  else if (enteringDevelopmentPlatform) developmentPlatform().enterProjectStart();
  else if (route === "development-platform") developmentPlatform().render();
  if (route === "development-platform") {
    loadProcessorBoardCatalog();
    loadBoardFeatureCatalog();
  }
  if (route === "development-hardware") {
    loadProcessorBoardCatalog();
    loadBoardFeatureCatalog();
    loadSensorCatalog();
    developmentPlatform().renderHardwareConfiguration();
  }
  if (route === "ide") loadIdeProject();
  if (route === "debug") loadDeviceDebugWorkspace();
  if (route === "learn") {
    loadProcessorBoardCatalog();
    renderProjects();
    renderLearn();
  }
  if (route === "learning-project-overview") renderLearningProjectOverview();
  if (route === "learning-project") learningProject().render();
  if (route === "quiz") quiz().render();
  if (route === "device-recovery") {
    renderDeviceRecovery();
    refreshUsbPorts(false);
  }
  if (route === "device-provisioning") loadDevicePageTools();
  if (route === "downloads") renderDownloads();
  if (route === "shop") loadCommunityMarketplace();
  if (route === "community") loadCommunityPortal();
  if (route === "messages") loadMessages();
  if (["help", "knowledge"].includes(route)) renderInformationTopic();
  lastRenderedRoute = route;
}

function learningProject() {
  if (!learningProjectController) {
    learningProjectController = LearningProjectController.create({
      state,
      postJson,
      navigate,
      renderLearn,
      renderDashboard,
      renderGuidedProject,
      projectById,
      progressFor,
      escapeHtml,
      localizeProject: (project) => LearningProjectLocales.project(project, currentLearningLocale()),
      learningText,
    });
  }
  return learningProjectController;
}

function quiz() {
  if (!quizController) {
    quizController = GerNetiXQuiz.create({
      mount: document.querySelector("#quizMount"),
      getLocale: () => platformI18n?.locale || document.documentElement.lang || "de",
    });
  }
  return quizController;
}

function renderInformationTopic() {
  InformationView.render({
    hasAccount: Boolean(state.account),
    premium: Boolean(state.billing?.entitlements?.includes("learn_guided_projects")),
    newChapterIds: state.knowledgeUpdates.map((update) => update.chapter_id),
    knowledgeHistory: state.knowledgeHistory,
    showKnowledgeHistory: new URLSearchParams(window.location.search).get("ansicht") === "historie",
    onKnowledgeChapterOpen: markKnowledgeChapterRead,
    surface: routeName() === "knowledge" ? "knowledge" : "help",
  });
}

async function markKnowledgeChapterRead(chapterId) {
  const update = state.knowledgeUpdates.find((item) => item.chapter_id === chapterId);
  if (!state.account || !update || update.marking) return;
  update.marking = true;
  try {
    const payload = await postJson(`/api/platform/knowledge/chapters/${encodeURIComponent(chapterId)}/read`, {});
    state.knowledgeUpdates = state.knowledgeUpdates.filter((item) => item.chapter_id !== chapterId);
    state.knowledgeHistory = state.knowledgeHistory.map((item) => item.chapter_id === chapterId && item.is_current
      ? { ...item, is_new: false, seen_at: payload.read?.seen_at || item.seen_at }
      : item);
    renderKnowledgeUpdates();
    document.querySelectorAll(`[data-knowledge-new="${CSS.escape(chapterId)}"]`).forEach((badge) => badge.remove());
  } catch {
    update.marking = false;
  }
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
    about: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Über uns", route: "" },
    ],
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
    "learning-project-overview": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Lernplattform", route: "/app/learn/" },
      { label: "Projektübersicht", route: "" },
    ],
    "learning-project": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Lernplattform", route: "/app/learn/" },
      { label: "Lernprojekt", route: "" },
    ],
    quiz: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Quiz", route: "/app/quiz/" },
    ],
    ide: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Entwicklungsplattform", route: "/app/development-platform/" },
      { label: project?.name || "Projekt", route: project ? `/app/ide/?project=${encodeURIComponent(project.id)}` : "" },
      { label: "Entwicklung", route: "" },
    ],
    debug: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Entwicklungsplattform", route: "/app/development-platform/" },
      { label: project?.name || "Projekt", route: project ? `/app/ide/?project=${encodeURIComponent(project.id)}` : "" },
      { label: "Debug & Diagnose", route: "" },
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
    downloads: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Downloads", route: "/app/downloads/" },
    ],
    shop: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Webshop", route: "/app/shop/" },
    ],
    billing: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Billing", route: "/app/billing/" },
    ],
    help: [
      { label: state.account ? "Plattform" : "Startseite", route: state.account ? "/app/dashboard/" : "/" },
      { label: "Hilfe", route: "/hilfe/" },
    ],
    community: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Community & Begleitung", route: "" },
    ],
    messages: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Nachrichten", route: "" },
    ],
    knowledge: [
      { label: "Wissensportal", route: "/wissen/" },
    ],
    "account-setup": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Profil", route: "" },
    ],
  };
  return locations[route] || locations.dashboard;
}

function routeName() {
  if (/^\/hilfe\/?$/.test(window.location.pathname)) return "help";
  if (/^\/wissen\/?$/.test(window.location.pathname)) return "knowledge";
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
  return routeMap[route] ? route : "dashboard";
}

function topLevelRouteName(route) {
  if (["learning-project-overview", "learning-project"].includes(route)) return "learn";
  if (["device-management", "device-provisioning", "device-inventory", "device-recovery"].includes(route)) return "device-management";
  if (["ide", "debug", "development-hardware"].includes(route)) return "development-platform";
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
  const target = new URL(route, window.location.origin);
  if (/^\/app\/auth(?:\/|$)/.test(target.pathname)) {
    window.location.assign(target.pathname + target.search + target.hash);
    return;
  }
  const protectedAppRoute = /^\/app\/(?!auth(?:\/|$))/.test(target.pathname);
  if (protectedAppRoute && !isServerAuthenticatedAppShell && !state.account) {
    window.location.assign(`/app/auth/?next=${encodeURIComponent(target.pathname + target.search)}`);
    return;
  }
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
    state.platformDownloads = downloads;
    document.querySelectorAll("[data-serial-service-install]").forEach(configureSerialServiceInstallLink);
    target.innerHTML = downloads.map((item) => `
      <a class="button-link ${item.platform === platform ? "primary" : ""} ${item.available ? "" : "disabled"}"
        ${item.available ? `href="${escapeAttribute(item.url)}" download` : 'aria-disabled="true"'}>
        ${escapeHtml(item.label)}
        <small>${escapeHtml(item.available ? `${item.detail}${item.version ? ` · Version ${item.version}` : ""}` : "Noch nicht bereit")}</small>
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

function renderShopConfiguration() {
  const form = document.querySelector("#flashboxConfigForm");
  const target = document.querySelector("#flashboxConfigSummary");
  if (!form || !target) return;
  const data = new FormData(form);
  const variant = data.get("variant") === "lab"
    ? "Lab-Variante fuer mehrere Boardtypen"
    : "Starter-Variante fuer einzelne Boards";
  const connection = data.get("connection") === "wifi"
    ? "WLAN-Hotspot fuer die Ersteinrichtung"
    : "BLE gefuehrte Einrichtung mit Handy oder Tablet";
  const extras = [
    data.get("usb_cable") ? "USB-C-Kabel" : "",
    data.get("esp32_adapter") ? "ESP32-Adapterset" : "",
  ].filter(Boolean);
  target.innerHTML = `
    <p class="eyebrow">Konfiguration</p>
    <dl class="meta-list compact">
      ${meta("Variante", variant)}
      ${meta("Verbindung", connection)}
      ${meta("Zubehoer", extras.length ? extras.join(", ") : "ohne Zusatzpaket")}
    </dl>
    <p class="helper-text">Mock: Diese Auswahl wird noch nicht gespeichert und erzeugt keine Bestellung.</p>
  `;
}

async function createFlashboxMockOrder() {
  const target = document.querySelector("#flashboxMockOrderResult");
  if (!target) return;
  target.classList.remove("hidden");
  target.innerHTML = `<p class="helper-text">Mock-Kauf wird angelegt...</p>`;
  try {
    const result = await postJson("/api/user-ide/hardware-shop/orders", {
      offer_id: "offer.gernetix_flashbox_s3_usb_helper",
      quantity: 1,
    });
    state.flashboxMockOrder = result;
    const unit = result.purchase_context?.claimable_hardware_units?.[0] || null;
    if (unit?.claim_code) {
      const claimInput = document.querySelector("#flashboxClaimCode");
      if (claimInput) claimInput.value = unit.claim_code;
    }
    target.innerHTML = unit ? `
      <p class="eyebrow">Mock-Bestellung angelegt</p>
      <dl class="meta-list compact">
        ${meta("Bestellung", result.order?.order_id || "")}
        ${meta("Flashbox", unit.serial_number)}
        ${meta("Claim-Code", unit.claim_code)}
      </dl>
      <p class="helper-text">Der Code ist nur fuer diesen Account vorgesehen. Im echten Shop wuerde er ueber Bestellung/E-Mail bereitgestellt und serverseitig nur gehasht gespeichert.</p>
      <button type="button" data-open-route="/app/device-management/inventory/">Jetzt im Inventar uebernehmen</button>
    ` : `<p class="helper-text">Mock-Bestellung wurde angelegt, aber es wurde keine claimbare Flashbox erzeugt.</p>`;
  } catch (error) {
    target.innerHTML = `<p class="helper-text error-text">${escapeHtml(error.message || "Mock-Kauf konnte nicht angelegt werden.")}</p>`;
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
