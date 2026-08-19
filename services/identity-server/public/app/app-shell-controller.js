// GerNetiX platform module extracted from app.js.
async function bootstrap() {
  if (isPublicInformationPage) {
    const informationAssetsPromise = isPublicKnowledgePage ? loadKnowledgeContentAssets() : Promise.resolve();
    try {
      const publicSummarySections = isPublicKnowledgePage
        ? "account,knowledge,subscription"
        : "account,subscription";
      const summary = await getJson(`/api/platform/summary?include=${publicSummarySections}`);
      state.account = summary.account;
      state.billing = summary.billing;
      state.knowledgeUpdates = summary.knowledge_updates || [];
      state.knowledgeHistory = summary.knowledge_history || [];
    } catch {
      state.account = null;
      state.billing = null;
    }
    await informationAssetsPromise;
    document.body.classList.toggle("public-information-anonymous", !state.account);
    await initializePlatformI18n();
    document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : (isPublicKnowledgePage ? "Wissensportal" : "Öffentliche Hilfe");
    document.querySelector("#logoutButton").textContent = state.account ? "Abmelden" : "Anmelden";
    renderRoute();
    GerNetiXWelcomeGuide.maybeOpen(state.account);
    return;
  }
  renderInitialRoute();
  const initialRoute = routeName();

  /*
   * Der oeffentliche Zweig oben faengt einen Fehlschlag seit jeher ab. Hier
   * fehlte das: schlug /api/platform/bootstrap fehl, brach bootstrap() an
   * dieser Stelle ab. Uebersetzungen, Rendern und Willkommensdialog liefen
   * dann nie, die Ablehnung blieb unbehandelt, und der Nutzer sah eine
   * statische Huelle ohne jeden Hinweis darauf, dass etwas fehlt.
   */
  let startFehler = null;
  await Promise.all([
    refreshBootstrap(initialRoute).catch((fehler) => { startFehler = fehler; }),
    loadRouteAssets(initialRoute),
  ]);

  if (startFehler) {
    // state traegt seine Vorgaben (account: null, projects: []), deshalb ist
    // renderRoute gefahrlos. renderAll bleibt aussen vor: es rechnet mit
    // geladenen Daten.
    await initializePlatformI18n();
    renderRoute();
    meldeStartFehler(startFehler);
    return;
  }

  await loadRouteProjectDetail(initialRoute);
  await loadRouteAssets(initialRoute);
  await initializePlatformI18n();
  renderAll();
  renderRoute({ contentRendered: true });
  GerNetiXWelcomeGuide.maybeOpen(state.account);
  void hydratePlatformState(initialRoute).then((changed) => {
    if (changed && routeName() === initialRoute) renderAll();
  });
}

// Sichtbar melden statt still schlucken: ein verschwiegener Fehlschlag sieht
// aus wie eine leere Plattform und verschleiert echte Ausfaelle.
function meldeStartFehler(fehler) {
  const shell = document.querySelector(".app-shell");
  if (!shell || document.querySelector("#platformStartError")) return;
  const meldung = document.createElement("div");
  meldung.id = "platformStartError";
  meldung.className = "platform-start-error";
  meldung.setAttribute("role", "alert");
  // payload.error traegt nur den allgemeinen Sammelcode ("internal_server_error"),
  // die sprechende Ursache steht in payload.message.
  const grund = fehler?.payload?.message || fehler?.message || fehler?.payload?.error || fehler?.code || "unbekannt";
  meldung.innerHTML = `<strong>Die Plattformdaten konnten nicht geladen werden.</strong>
    <span>Angemeldet bist du weiterhin. Grund: ${escapeHtml(String(grund))}</span>`;
  const neuLaden = document.createElement("button");
  neuLaden.type = "button";
  neuLaden.textContent = "Erneut versuchen";
  neuLaden.addEventListener("click", () => window.location.reload());
  meldung.append(neuLaden);
  shell.querySelector(".topbar")?.after(meldung) || shell.prepend(meldung);
}

function loadPlatformScript(src) {
  const existing = document.querySelector(`script[data-lazy-src="${CSS.escape(src)}"]`);
  if (existing) return existing.dataset.loaded === "true"
    ? Promise.resolve()
    : new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.dataset.lazySrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", (error) => {
      script.remove();
      reject(error);
    }, { once: true });
    document.head.append(script);
  });
}

function loadPlatformStyle(href) {
  const existing = document.querySelector(`link[data-lazy-href="${CSS.escape(href)}"]`);
  if (existing) return existing.dataset.loaded === "true"
    ? Promise.resolve()
    : new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.lazyHref = href;
    link.addEventListener("load", () => {
      link.dataset.loaded = "true";
      resolve();
    }, { once: true });
    link.addEventListener("error", (error) => {
      link.remove();
      reject(error);
    }, { once: true });
    document.head.append(link);
  });
}

const routeFragmentLoads = new Map();

function loadRouteFragment(id, src) {
  if (document.querySelector(`#${CSS.escape(id)}`)) return Promise.resolve();
  if (routeFragmentLoads.has(id)) return routeFragmentLoads.get(id);
  const load = fetch(src, { credentials: "same-origin" })
    .then((response) => {
      if (!response.ok) throw new Error(`Route fragment could not be loaded: ${response.status}`);
      return response.text();
    })
    .then((html) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      if (parsed.querySelector("script")) throw new Error("Route fragment must not contain scripts.");
      const roots = Array.from(parsed.body.children);
      if (roots.length !== 1 || roots[0].id !== id) throw new Error(`Route fragment root must be #${id}.`);
      const footer = document.querySelector(".platform-footer");
      if (!footer) throw new Error("Platform footer is missing.");
      footer.before(document.importNode(roots[0], true));
    })
    .catch((error) => {
      routeFragmentLoads.delete(id);
      throw error;
    });
  routeFragmentLoads.set(id, load);
  return load;
}

async function loadKnowledgeContentAssets() {
  const urls = knowledgeContentAssetUrls();
  await Promise.all(urls.slice(0, -1).map(loadPlatformScript));
  await loadPlatformScript(urls.at(-1));
}

function knowledgeContentAssetUrls() {
  const version = "20260812-knowledge-library-3";
  return ["knowledge-chapter-index.js", "knowledge-content.js"].map((file) => `/app/${file}?v=${version}`);
}

function knowledgePrefetchAssetUrls() {
  return knowledgeContentAssetUrls();
}

function scheduleKnowledgeContentPrefetch() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData || ["slow-2g", "2g"].includes(connection?.effectiveType)) return;
  const prefetch = () => knowledgePrefetchAssetUrls().forEach((href) => {
    if (document.querySelector(`link[rel="prefetch"][href="${CSS.escape(href)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "script";
    link.href = href;
    document.head.append(link);
  });
  if (typeof requestIdleCallback === "function") requestIdleCallback(prefetch, { timeout: 5_000 });
  else setTimeout(prefetch, 2_500);
}

async function loadQuizAssets() {
  await Promise.all([
    loadPlatformScript("/app/quiz-data.js?v=20260805-route-lazy-2"),
    loadPlatformScript("/app/quiz.js?v=20260805-route-lazy-2"),
  ]);
}

async function loadProjectAppAssets() {
  await Promise.all([
    loadPlatformScript("/app/project-app-renderer.js?v=20260819-umd-root-fix-1"),
    loadPlatformScript("/app/project-app-controller.js?v=20260819-umd-root-fix-1"),
  ]);
}

const lazyAssetVersions = {
  boardConfiguration: "20260731-board-source-groups-1",
  build: "20260807-action-observability-1",
  flashDialog: "20260807-helper-progress-1",
  flashExecutor: "20260804-unified-flash-2",
  flashProgress: "20260802-flash-progress",
  guidedProject: "20260808-guided-sequence-17",
  onboarding: "20260719-04",
  onboardingModel: "20260803-performance-1",
  usbDisconnect: "20260801-shared-1",
  usbTarget: "20260801-partial-usb-flash",
  wifiSetup: "20260801-shared-port-identification",
};

async function loadBuildWorkbenchAssets() {
  await Promise.all([
    loadPlatformScript(`/app/flash-progress.js?v=${lazyAssetVersions.flashProgress}`),
    loadPlatformScript(`/app/unified-flash-dialog.js?v=${lazyAssetVersions.flashDialog}`),
    loadPlatformScript(`/app/usb-port-disconnect-detector.js?v=${lazyAssetVersions.usbDisconnect}`),
    loadPlatformScript(`/app/usb-flash-target-model.js?v=${lazyAssetVersions.usbTarget}`),
  ]);
  await loadPlatformScript(`/app/app-device-build-controller.js?v=${lazyAssetVersions.build}`);
}

async function loadGuidedProjectAssets() {
  await Promise.all([
    loadPlatformScript(`/app/board-configuration-plugin.js?v=${lazyAssetVersions.boardConfiguration}`),
    loadPlatformScript(`/app/unified-flash-dialog.js?v=${lazyAssetVersions.flashDialog}`),
  ]);
  await loadGuidedProjectCoreAssets();
}

async function loadGuidedProjectCoreAssets() {
  await loadPlatformScript(`/app/guided-project-view.js?v=${lazyAssetVersions.guidedProject}`);
}

function activeLearningProjectNeedsHardwareWorkbench() {
  const projectId = new URLSearchParams(window.location.search).get("project") || "";
  const project = projectById(projectId);
  return Boolean(project && !String(project.targetRuntime || "").startsWith("runtime.browser_"));
}

async function loadIdeWorkbenchAssets() {
  await Promise.all([loadBuildWorkbenchAssets(), loadGuidedProjectAssets()]);
  await loadPlatformScript(`/app/app-ide-controller.js?v=${lazyAssetVersions.build}`);
  initializeIdeWorkspaceResize();
  await loadPlatformScript(`/app/device-debug-controller.js?v=${lazyAssetVersions.build}`);
}

async function loadDeviceOnboardingAssets() {
  await Promise.all([
    loadPlatformScript(`/app/device-onboarding-model.js?v=${lazyAssetVersions.onboardingModel}`),
    loadPlatformScript(`/app/board-configuration-plugin.js?v=${lazyAssetVersions.boardConfiguration}`),
    loadPlatformScript(`/app/flash-progress.js?v=${lazyAssetVersions.flashProgress}`),
    loadPlatformScript(`/app/unified-flash-dialog.js?v=${lazyAssetVersions.flashDialog}`),
    loadPlatformScript(`/app/unified-flash-executor.js?v=${lazyAssetVersions.flashExecutor}`),
    loadPlatformScript(`/app/usb-port-disconnect-detector.js?v=${lazyAssetVersions.usbDisconnect}`),
  ]);
  await loadPlatformScript(`/app/device-onboarding-controller.js?v=${lazyAssetVersions.onboarding}`);
}

async function loadDeviceWifiSetupAssets() {
  await loadPlatformScript(`/app/usb-port-disconnect-detector.js?v=${lazyAssetVersions.usbDisconnect}`);
  await loadPlatformScript(`/app/device-wifi-setup-dialog.js?v=${lazyAssetVersions.wifiSetup}`);
  GerNetiXDeviceWifiSetup.bind();
}

function routeAssetsMissing(route) {
  if (["development-platform", "development-hardware"].includes(route)) {
    return typeof DevelopmentPlatform === "undefined"
      || typeof DevelopmentHardwareModel === "undefined"
      || typeof DevelopmentComponentMetamodel === "undefined"
      || typeof ProjectFeedbackUI === "undefined"
      || typeof ProjectRepositoryCard === "undefined";
  }
  if (route === "hardware-lab") return !document.querySelector("#hardwareLabView")
    || !document.querySelector('link[data-lazy-href*="/hardware-lab-route.css"][data-loaded="true"]')
    || typeof GerNetiXHardwareLab === "undefined";
  if (route === "nachschlagewerke") return !document.querySelector("#referenceLibraryView")
    || !document.querySelector('link[data-lazy-href*="/reference-library-route.css"][data-loaded="true"]')
    || typeof GerNetiXReferenceLibrary === "undefined";
  if (route === "community") return !document.querySelector('link[data-lazy-href*="/community-routes.css"][data-loaded="true"]')
    || typeof loadCommunityPortal === "undefined";
  if (route === "messages") return !document.querySelector("#messagesView")
    || !document.querySelector('link[data-lazy-href*="/community-routes.css"][data-loaded="true"]')
    || typeof loadMessages === "undefined";
  if (route === "shop") return !document.querySelector('link[data-lazy-href*="/community-routes.css"][data-loaded="true"]')
    || typeof loadCommunityMarketplace === "undefined";
  if (["ide", "debug"].includes(route)) return typeof renderIdeShell === "undefined"
    || typeof GerNetiXDeviceDebug === "undefined"
    || typeof GuidedProjectView === "undefined"
    || typeof startBuild === "undefined";
  if (route === "learning-project") return typeof GuidedProjectView === "undefined"
    || (activeLearningProjectNeedsHardwareWorkbench() && typeof startBuild === "undefined");
  if (["device-inventory", "device-recovery"].includes(route)) return typeof startBuild === "undefined";
  if (route === "device-provisioning") return typeof startBuild === "undefined"
    || typeof DeviceOnboardingController === "undefined";
  return false;
}

async function loadRouteAssets(route) {
  const version = "20260819-app-theme-toggle-3";
  if (["development-platform", "development-hardware"].includes(route)) {
    await Promise.all([
      loadPlatformScript("/app/development-hardware-model.js?v=20260731-profile-inheritance-1"),
      loadPlatformScript("/app/development-component-metamodel.js?v=20260801-hardware-connection-types"),
      loadPlatformScript("/app/project-feedback-ui.js?v=20260802-project-feedback"),
      loadPlatformScript("/app/project-repository-card.js?v=20260803-forgejo-contract-v1"),
    ]);
    await loadPlatformScript("/app/development-platform.js?v=20260806-project-summary-lazy-1");
    developmentPlatform().init();
    applyDevelopmentSummary();
    return;
  }
  if (["ide", "debug"].includes(route)) {
    await loadIdeWorkbenchAssets();
    return;
  }
  if (route === "learning-project") {
    if (activeLearningProjectNeedsHardwareWorkbench()) {
      await Promise.all([loadBuildWorkbenchAssets(), loadGuidedProjectAssets()]);
    } else {
      await loadGuidedProjectCoreAssets();
    }
    return;
  }
  if (["device-inventory", "device-recovery"].includes(route)) {
    await loadBuildWorkbenchAssets();
    return;
  }
  if (route === "device-provisioning") {
    await Promise.all([loadBuildWorkbenchAssets(), loadDeviceOnboardingAssets()]);
    return;
  }
  if (route === "hardware-lab") {
    await Promise.all([
      loadRouteFragment("hardwareLabView", `/app/fragments/hardware-lab.html?v=${version}`),
      loadPlatformStyle(`/app/hardware-lab-route.css?v=${version}`),
      loadPlatformScript(`/app/hardware-lab-controller.js?v=${version}`),
    ]);
    GerNetiXHardwareLab.bind();
    return;
  }
  if (route === "nachschlagewerke") {
    await Promise.all([
      loadRouteFragment("referenceLibraryView", `/app/fragments/reference-library.html?v=${version}`),
      loadPlatformStyle(`/app/reference-library-route.css?v=${version}`),
      loadPlatformScript(`/app/reference-library-controller.js?v=${version}`),
    ]);
    GerNetiXReferenceLibrary.bind();
    return;
  }
  if (route === "community") {
    await Promise.all([
      loadPlatformStyle(`/app/community-routes.css?v=${version}`),
      loadPlatformScript(`/app/app-community-controller.js?v=${version}`),
      loadPlatformScript(`/app/community-ideas-controller.js?v=${version}`),
      loadPlatformScript(`/app/community-portal-controller.js?v=${version}`),
    ]);
    bindCommunityCoreEvents();
    bindCommunityIdeaEvents();
    bindCommunityPortalEvents();
    return;
  }
  if (route === "messages") {
    await Promise.all([
      loadRouteFragment("messagesView", `/app/fragments/messages.html?v=${version}`),
      loadPlatformStyle(`/app/community-routes.css?v=${version}`),
      loadPlatformScript(`/app/app-community-controller.js?v=${version}`),
    ]);
    bindCommunityMessageEvents();
    return;
  }
  if (route === "shop") {
    await Promise.all([
      loadPlatformStyle(`/app/community-routes.css?v=${version}`),
      loadPlatformScript(`/app/community-marketplace-controller.js?v=${version}`),
    ]);
    bindCommunityMarketplaceEvents();
  }
}

function applyDevelopmentSummary(summary = null) {
  if (summary && Object.hasOwn(summary, "development_assistant")) {
    state.developmentAssistantConfig = summary.development_assistant;
  }
  if (summary && Object.hasOwn(summary, "development_project_templates")) {
    state.developmentProjectTemplates = summary.development_project_templates;
    state.developmentProjectTemplatePreviews = summary.development_project_template_previews || [];
  }
  if (typeof DevelopmentPlatform === "undefined") return;
  const controller = developmentPlatform();
  if (Object.hasOwn(state, "developmentAssistantConfig")) {
    controller.setAssistantConfig(state.developmentAssistantConfig, state.billing);
  }
  if (Object.hasOwn(state, "developmentProjectTemplates")) {
    controller.setProjectTemplates(
      state.developmentProjectTemplates,
      state.developmentProjectTemplatePreviews || [],
    );
  }
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

async function showSerialServiceChoiceDialog() {
  if (!state.platformDownloads.length) await loadPlatformDownloads();
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

function platformSummarySectionsForRoute(route) {
  if (route === "dashboard") return ["devices", "builds", "ai", "community", "knowledge", "billing", "progress"];
  if (route === "applications") return ["devices"];
  if (["development-platform", "development-hardware", "ide", "debug", "project-app"].includes(route)) return ["devices", "builds", "progress"];
  if (route === "learn") return ["progress"];
  if (route === "learning-project") return ["devices", "progress"];
  if (["device-management", "device-provisioning", "device-inventory", "device-recovery"].includes(route)) return ["devices", "builds"];
  if (route === "billing") return ["ai", "billing"];
  return [];
}

const loadedPlatformBootstrapSections = new Set();
const projectDetailLoads = new Map();

function platformBootstrapSectionsForRoute(route) {
  const sections = [];
  if ([
    "dashboard", "applications", "development-platform", "development-hardware", "ide", "debug", "project-app",
    "learn", "learning-project-overview", "learning-project", "device-management", "device-provisioning",
    "device-inventory", "device-recovery", "billing", "community", "messages",
  ].includes(route)) sections.push("projects");
  if (["development-platform", "development-hardware"].includes(route)) sections.push("development");
  return sections;
}

async function refresh(sections = platformSummarySectionsForRoute(routeName())) {
  if (!sections.length) return;
  const summary = await getJson(`/api/platform/summary?include=${encodeURIComponent(sections.join(","))}`);
  if (summary.account) state.account = summary.account;
  if (summary.projects) state.projects = summary.projects;
  if (summary.devices) state.devices = summary.devices;
  if (summary.builds) state.builds = summary.builds;
  if (summary.community_summary) state.communitySummary = summary.community_summary;
  if (summary.knowledge_updates) state.knowledgeUpdates = summary.knowledge_updates;
  if (summary.knowledge_history) state.knowledgeHistory = summary.knowledge_history;
  if (summary.billing) state.billing = summary.billing;
  if (summary.ai_usage) state.aiUsage = summary.ai_usage;
  if (summary.learning_progress) state.progress = summary.learning_progress;
  state.workspace = summary.workspace_state;
  state.serviceStatus = summary.service_status || {};
  applyDevelopmentSummary(summary);
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
  state.activeDeviceId = state.devices.find((device) => device.usb_flash_supported)?.device_id || state.devices[0]?.device_id || "";
  state.activeRecoveryDeviceId = state.activeRecoveryDeviceId || state.activeDeviceId;
}

async function refreshBootstrap(route = routeName()) {
  const sections = platformBootstrapSectionsForRoute(route);
  const include = sections.length ? sections.join(",") : "none";
  const summary = await getJson(`/api/platform/bootstrap?include=${include}`);
  state.account = summary.account;
  state.projects = summary.projects || [];
  state.workspace = summary.workspace_state || {};
  state.billing = summary.billing || null;
  state.devices = [];
  state.builds = [];
  state.progress = [];
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
  applyDevelopmentSummary(summary);
  sections.forEach((section) => loadedPlatformBootstrapSections.add(section));
}

async function hydratePlatformBootstrap(route = routeName()) {
  const missing = platformBootstrapSectionsForRoute(route).filter((section) => !loadedPlatformBootstrapSections.has(section));
  if (!missing.length) return false;
  const summary = await getJson(`/api/platform/bootstrap?include=${encodeURIComponent(missing.join(","))}`);
  if (summary.account) state.account = summary.account;
  if (summary.workspace_state) state.workspace = summary.workspace_state;
  if (summary.billing) state.billing = summary.billing;
  if (Object.hasOwn(summary, "projects")) state.projects = summary.projects;
  applyDevelopmentSummary(summary);
  missing.forEach((section) => loadedPlatformBootstrapSections.add(section));
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
  return true;
}

async function hydratePlatformState(route = routeName()) {
  const sections = platformSummarySectionsForRoute(route);
  if (!sections.length) return false;
  try {
    await refresh(sections);
    if (route === "dashboard") scheduleKnowledgeContentPrefetch();
    return true;
  } catch {
    return false;
  }
}

async function loadProjectDetail(projectId) {
  const current = projectById(projectId);
  if (current?.detailsLoaded) return current;
  if (!projectDetailLoads.has(projectId)) {
    const load = getJson(`/api/platform/projects/${encodeURIComponent(projectId)}`)
      .then((response) => {
        const project = response.project;
        state.projects = state.projects.filter((item) => item.id !== project.id).concat(project);
        if (response.learning_progress) {
          state.progress = state.progress.filter((item) => item.projectId !== project.id).concat(response.learning_progress);
        }
        if (Object.hasOwn(response, "learning_feedback_submitted")) {
          project.learningFeedbackSubmitted = response.learning_feedback_submitted === true;
        }
        return project;
      })
      .finally(() => projectDetailLoads.delete(projectId));
    projectDetailLoads.set(projectId, load);
  }
  return projectDetailLoads.get(projectId);
}

function routeProjectDetailId(route = routeName()) {
  if (!["learning-project-overview", "learning-project", "ide", "debug", "development-hardware"].includes(route)) return "";
  return new URLSearchParams(window.location.search).get("project") || "";
}

async function loadRouteProjectDetail(route = routeName()) {
  const projectId = routeProjectDetailId(route);
  if (!projectId || projectById(projectId)?.detailsLoaded) return false;
  await loadProjectDetail(projectId);
  return true;
}

function renderAll() {
  document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : "";
  const route = routeName();
  if (route === "dashboard") renderDashboard();
  if (route === "applications") renderApplications();
  if (route === "account-setup") renderAccountSetup();
  if (route === "development-platform" && lastRenderedRoute === "development-platform") developmentPlatform().render();
  if (route === "development-hardware") developmentPlatform().renderHardwareConfiguration();
  if (route === "learn") {
    renderProjects();
    renderLearn();
  }
  if (route === "learning-project-overview") renderLearningProjectOverview();
  if (route === "learning-project") learningProject().render();
  if (route === "ide") renderIdeShell();
  if (route === "device-recovery") renderDeviceRecovery();
  if (route === "device-inventory") {
    renderDevices();
  }
  if (route === "shop") renderShopConfiguration();
  if (route === "billing") renderBilling();
  if (route === "hardware-lab") GerNetiXHardwareLab.render();
  if (route === "nachschlagewerke") GerNetiXReferenceLibrary.render();
}

function renderRoute({ contentRendered = false } = {}) {
  const route = routeName();
  document.body.classList.remove("route-assets-loading");
  if (lastRenderedRoute === "debug" && route !== "debug") stopIdeDeviceDebugPolling();
  const enteringDevelopmentPlatform = route === "development-platform" && lastRenderedRoute !== "development-platform";
  const routeQuery = new URLSearchParams(window.location.search);
  const requestedArchitectureProjectId = routeQuery.get("view") === "architecture" ? routeQuery.get("project") || "" : "";
  document.body.classList.toggle("ide-workspace-active", route === "ide");
  document.body.classList.toggle("debug-workspace-active", route === "debug");
  document.body.classList.toggle("development-workspace-active", route === "development-platform");
  document.body.classList.toggle("development-hardware-active", route === "development-hardware");
  document.body.classList.toggle("hardware-lab-active", route === "hardware-lab");
  document.body.classList.toggle("reference-library-active", route === "nachschlagewerke");
  renderBreadcrumb(route);
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== routeMap[route]));
  document.querySelectorAll(".tabs a").forEach((link) => link.classList.toggle("active", link.dataset.route === topLevelRouteName(route)));
  document.querySelectorAll("#mainMenu .app-menu-group").forEach((group) => {
    group.open = Boolean(group.querySelector("a.active"));
  });
  document.documentElement.classList.remove("initial-hardware-lab-route");
  document.querySelectorAll("[data-device-management-route]").forEach((button) => {
    button.classList.toggle("active", deviceManagementRouteFor(route) === button.dataset.deviceManagementRoute);
  });
  if (route === "development-platform" && requestedArchitectureProjectId) developmentPlatform().openArchitecture(requestedArchitectureProjectId);
  else if (enteringDevelopmentPlatform) developmentPlatform().enterProjectStart();
  else if (route === "development-platform" && !contentRendered) developmentPlatform().render();
  if (route === "development-platform") {
    loadProcessorBoardCatalog();
    loadBoardFeatureCatalog();
  }
  if (route === "development-hardware") {
    loadProcessorBoardCatalog();
    loadBoardFeatureCatalog();
    loadSensorCatalog();
    if (!contentRendered) developmentPlatform().renderHardwareConfiguration();
  }
  if (route === "ide") loadIdeProject();
  if (route === "debug") loadDeviceDebugWorkspace();
  if (route === "learn") {
    loadProcessorBoardCatalog();
    if (!contentRendered) {
      renderProjects();
      renderLearn();
    }
  }
  if (route === "learning-project-overview" && !contentRendered) renderLearningProjectOverview();
  if (route === "learning-project" && !contentRendered) learningProject().render();
  if (route === "applications" && !contentRendered) renderApplications();
  if (route === "project-app") void loadProjectAppAssets().then(() => projectApp().render(new URLSearchParams(window.location.search).get("project") || ""));
  if (route === "quiz") void loadQuizAssets().then(() => quiz().render());
  if (route === "device-recovery") {
    if (!contentRendered) renderDeviceRecovery();
    refreshUsbPorts(false);
  }
  if (route === "device-provisioning") loadDevicePageTools();
  if (route === "hardware-lab") {
    if (!contentRendered) GerNetiXHardwareLab.render();
    GerNetiXHardwareLab.enter();
  }
  if (route === "nachschlagewerke") GerNetiXReferenceLibrary.enter();
  if (route === "downloads") renderDownloads();
  if (route === "shop") loadCommunityMarketplace();
  if (route === "community") loadCommunityPortal();
  if (route === "messages") loadMessages();
  if (["help", "knowledge"].includes(route)) renderInformationTopic();
  lastRenderedRoute = route;
}

function renderInitialRoute() {
  const route = routeName();
  document.body.classList.toggle("route-assets-loading", routeAssetsMissing(route));
  document.body.classList.toggle("hardware-lab-active", route === "hardware-lab");
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== routeMap[route]));
  document.querySelectorAll(".tabs a").forEach((link) => link.classList.toggle("active", link.dataset.route === topLevelRouteName(route)));
  renderBreadcrumb(route);
  if (route !== "hardware-lab" || document.querySelector("#hardwareLabView")) {
    document.documentElement.classList.remove("initial-hardware-lab-route");
  }
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
      loadProjectDetail,
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
    entitlements: state.billing?.entitlements || [],
    newChapterIds: state.knowledgeUpdates.map((update) => update.chapter_id),
    knowledgeHistory: state.knowledgeHistory,
    showKnowledgeHistory: new URLSearchParams(window.location.search).get("ansicht") === "historie",
    onKnowledgeChapterOpen: markKnowledgeChapterRead,
    surface: routeName() === "knowledge" ? "knowledge" : "help",
  });
}

window.addEventListener("gernetix-help-content-ready", () => {
  if (routeName() === "help") renderInformationTopic();
});

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
    "hardware-lab": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "KI-Hardware-Assistent", route: "" },
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
    "project-app": [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Meine Anwendungen", route: "/app/applications/" },
      { label: project?.name || "Anwendung", route: "" },
    ],
    applications: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Meine Anwendungen", route: "" },
    ],
    nexi: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Nexi", route: "" },
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
    nachschlagewerke: [
      { label: "Plattform", route: "/app/dashboard/" },
      { label: "Nachschlagewerke", route: "" },
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
  if (route === "nexi") return "applications";
  if (route === "project-app") return "applications";
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
  activateCurrentRoute();
}

function activateCurrentRoute() {
  const activeRoute = routeName();
  const waitingForAssets = routeAssetsMissing(activeRoute);
  const projectId = routeProjectDetailId(activeRoute);
  const waitingForProject = Boolean(projectId && !projectById(projectId)?.detailsLoaded);
  if (waitingForAssets || waitingForProject) renderInitialRoute();
  else renderRoute();
  void hydrateRouteAfterNavigation(activeRoute, { enterAfterHydration: waitingForAssets || waitingForProject });
}

async function hydrateRouteAfterNavigation(activeRoute = routeName(), { enterAfterHydration = false } = {}) {
  const assetsChanged = routeAssetsMissing(activeRoute);
  const [, bootstrapChanged, stateChanged] = await Promise.all([
    loadRouteAssets(activeRoute),
    hydratePlatformBootstrap(activeRoute).catch(() => false),
    hydratePlatformState(activeRoute),
  ]);
  const projectChanged = await loadRouteProjectDetail(activeRoute).catch(() => false);
  if (routeName() !== activeRoute) return false;
  const contentRendered = assetsChanged || bootstrapChanged || stateChanged || projectChanged;
  if (contentRendered) renderAll();
  if (enterAfterHydration) renderRoute({ contentRendered });
  return contentRendered;
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

async function claimFlashboxFromCode(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const claimCode = String(new FormData(form).get("claim_code") || "").trim();
  if (!claimCode) return setFlashboxClaimStatus("error", "Bitte gib den Claim-Code der Flashbox ein.");
  setFlashboxClaimStatus("running", "Flashbox wird deinem Account zugeordnet...");
  try {
    const result = await postJson("/api/platform/flashbox/claim", { claim_code: claimCode });
    state.devices = state.devices.filter((item) => item.account_device_id !== result.device.account_device_id).concat(result.device);
    state.activeDeviceId ||= result.device.device_id;
    renderDashboard();
    form.reset();
    setFlashboxClaimStatus("ok", `${result.device.display_name} ist jetzt im Inventar.`);
  } catch (error) {
    setFlashboxClaimStatus("error", error.message || "Flashbox konnte nicht uebernommen werden.");
  }
}

function setFlashboxClaimStatus(kind, text) {
  const status = document.querySelector("#flashboxClaimStatus");
  if (!status) return;
  status.className = `flash-status ${kind}`;
  status.textContent = text;
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
