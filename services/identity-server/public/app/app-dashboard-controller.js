// GerNetiX platform module extracted from app.js.
async function loadDevicePageTools() {
  await loadProcessorBoardCatalog();
  await loadBoardFeatureCatalog();
  await refreshUsbPorts(false);
}

async function loadBoardFeatureCatalog({ force = false } = {}) {
  if (state.boardFeatureCatalogStatus.state === "loading" && boardFeatureCatalogLoadPromise) {
    return boardFeatureCatalogLoadPromise;
  }
  if (!force && state.boardFeatureCatalogStatus.state === "ready") return;
  state.boardFeatureCatalogStatus = { state: "loading", message: "Boardausstattung wird geladen." };
  boardFeatureCatalogLoadPromise = getJson("/api/platform/hardware/board-feature-options")
    .then((result) => {
      state.boardFeatureCatalog = result.items || [];
      state.boardFeatureCatalogStatus = {
        state: "ready",
        message: state.boardFeatureCatalog.length ? "" : "Der Hardware Catalog enthält keine Ausstattungsoptionen.",
      };
      if (routeName() === "device-provisioning" && typeof renderNetworkDiscovery === "function") renderNetworkDiscovery();
      if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
      if (routeName() === "development-platform") developmentPlatform().render();
    })
    .catch((error) => {
      state.boardFeatureCatalog = [];
      state.boardFeatureCatalogStatus = {
        state: "error",
        message: error.message || "Hardware-Katalog nicht erreichbar.",
      };
      if (routeName() === "device-provisioning" && typeof renderNetworkDiscovery === "function") renderNetworkDiscovery();
      if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
      if (routeName() === "development-platform") developmentPlatform().render();
    })
    .finally(() => {
      boardFeatureCatalogLoadPromise = null;
    });
  return boardFeatureCatalogLoadPromise;
}

async function loadProcessorBoardCatalog({ force = false } = {}) {
  if (state.processorBoardCatalogStatus.state === "loading" && processorBoardCatalogLoadPromise) {
    return processorBoardCatalogLoadPromise;
  }
  if (!force && state.processorBoardCatalogStatus.state === "ready") return;
  state.processorBoardCatalogStatus = { state: "loading", message: "Hardware-Katalog wird geladen." };
  processorBoardCatalogLoadPromise = getJson("/api/platform/hardware/processor-boards")
    .then((boards) => {
      state.processorBoards = boards.items || [];
      state.processorBoardCatalogStatus = {
        state: "ready",
        message: state.processorBoards.length ? "" : "Der Hardware-Katalog enthält keine provisionierbaren Boards.",
      };
      if (routeName() === "device-provisioning" && typeof renderNetworkDiscovery === "function") renderNetworkDiscovery();
      if (routeName() === "development-platform") developmentPlatform().render();
      if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
      if (["learn", "learning-project"].includes(routeName())) {
        renderLearn();
        if (routeName() === "learning-project") learningProject().render();
      }
    })
    .catch((error) => {
      state.processorBoards = [];
      state.processorBoardCatalogStatus = {
        state: "error",
        message: error.message || "Hardware-Katalog nicht erreichbar.",
      };
      if (routeName() === "device-provisioning" && typeof renderNetworkDiscovery === "function") renderNetworkDiscovery();
      if (routeName() === "device-inventory" && typeof setInventoryStatus === "function") setInventoryStatus("error", state.processorBoardCatalogStatus.message);
    })
    .finally(() => {
      processorBoardCatalogLoadPromise = null;
    });
  return processorBoardCatalogLoadPromise;
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
  const applications = personalApplications();
  const applicationsText = document.querySelector("#dashboardApplicationsText");
  if (applicationsText) {
    applicationsText.textContent = platformI18n?.t(
      applications.length === 0 ? "dashboard.applications.zero" : applications.length === 1 ? "dashboard.applications.one" : "dashboard.applications.count",
      { count: applications.length },
      applications.length === 0 ? "Noch keine persönliche Anwendung eingerichtet." : applications.length === 1 ? "1 persönliche Anwendung öffnen." : `${applications.length} persönliche Anwendungen öffnen.`,
    ) || `${applications.length} persönliche Anwendungen öffnen.`;
  }
  const pushProjectSelect = document.querySelector("#pushProjectSelect");
  if (pushProjectSelect) {
    pushProjectSelect.innerHTML = developmentProjects.length
      ? developmentProjects.map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`).join("")
      : `<option value="">Kein Projekt vorhanden</option>`;
    pushProjectSelect.value = developmentProjects.some((project) => project.id === state.activeProjectId) ? state.activeProjectId : developmentProjects[0]?.id || "";
  }
  document.querySelector("#dashboardSummary").innerHTML = [
    // Ohne geladene Plattformdaten bleibt account leer. Seit die Oberflaeche
    // einen Fehlstart ueberlebt, wird hier auch dann gerendert.
    ["Account", state.account?.username || "—"],
    ["Entwicklungsprojekte", developmentProjects.length],
    ["Anwendungen", applications.length],
    ["Geräte", state.devices.length],
    ["Builds", state.builds.length],
    ["Letzter Modus", state.workspace.lastMode || "kein Eintrag"],
  ].map(summaryItem).join("");
  renderDashboardCommunitySummary();
  renderKnowledgeUpdates();
  renderAiRating("#dashboardAiUsage");
}

function renderKnowledgeUpdates() {
  const menuBadge = document.querySelector("#knowledgeUpdateMenuBadge");
  const updates = state.knowledgeUpdates || [];
  if (menuBadge) {
    menuBadge.hidden = updates.length === 0;
    const badgeKey = updates.length === 1 ? "platform.nav.new" : "platform.nav.new_count";
    const badgeFallback = updates.length === 1 ? "Neu" : `Neu · ${updates.length}`;
    menuBadge.textContent = updates.length
      ? (platformI18n?.t(badgeKey, { count: updates.length }, badgeFallback) || badgeFallback)
      : "";
  }
  renderDashboardNews();
}

function dashboardNewsItems() {
  const translate = (key, variables, fallback) => platformI18n?.t(key, variables, fallback) || fallback;
  return (state.knowledgeUpdates || []).map((update) => ({
    id: `knowledge:${update.chapter_id}:${update.version}`,
    category: translate("dashboard.news.knowledge.category", {}, "Wissensspeicher"),
    title: update.title,
    text: translate("dashboard.news.knowledge.version", { version: update.version }, `Neue Version ${update.version} wurde veröffentlicht.`),
    href: "/wissen/?ansicht=historie",
    action: translate("dashboard.news.knowledge.action", {}, "Historie des Wissensspeichers öffnen →"),
  }));
}

function renderDashboardNews() {
  const target = document.querySelector("#dashboardNewsList");
  if (!target) return;
  const emptyText = platformI18n?.t(
    "dashboard.news.empty",
    {},
    "Aktuell gibt es keine ungelesenen Neuigkeiten. Neue Veröffentlichungen erscheinen künftig an dieser Stelle.",
  ) || "Aktuell gibt es keine ungelesenen Neuigkeiten. Neue Veröffentlichungen erscheinen künftig an dieser Stelle.";
  const items = dashboardNewsItems().slice(0, 6);
  target.innerHTML = items.length ? items.map((item) => `
    <a class="dashboard-news-card" href="${escapeAttribute(item.href)}" data-news-id="${escapeAttribute(item.id)}">
      <span>${escapeHtml(item.category)}</span>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.text)}</p>
      <small>${escapeHtml(item.action)}</small>
    </a>
  `).join("") : `<p class="dashboard-news-empty">${escapeHtml(emptyText)}</p>`;
}

function renderDashboardCommunitySummary() {
  const target = document.querySelector("#dashboardCommunitySummary");
  if (!target) return;
  const summary = state.communitySummary;
  const openRequests = summary?.available
    ? Number(summary.public?.open || 0) + Number(summary.private?.open || 0)
    : null;
  const areas = [
    {
      label: "Forum & Hilfe",
      title: "Fragen stellen und Erfahrungen austauschen",
      text: "Öffentlich diskutieren oder ein Projekt privat mit GerNetiX begleiten.",
      meta: openRequests === null ? "Anfragestatus gerade nicht verfügbar" : `${openRequests} ${openRequests === 1 ? "offene eigene Anfrage" : "offene eigene Anfragen"}`,
      route: "/app/community/",
      target: "communityForumSection",
    },
    {
      label: "Ideenwerkstatt",
      title: "Projektideen vorstellen und weiterentwickeln",
      text: "Feedback einholen, Fragen klären und Mitstreiter für eine Idee finden.",
      meta: "Ideen werden vorgestellt, nicht verkauft",
      route: "/app/community/",
      target: "projectIdeasWorkshop",
    },
    {
      label: "Projekt-Showcase",
      title: "Fertige Projekte teilen und entdecken",
      text: "Zeige, was du gebaut hast, und gib anderen einen sicheren Einblick.",
      meta: "Mit schreibgeschützter Projektkopie",
      route: "/app/community/",
      target: "projectShowcase",
    },
    {
      label: "Elektronik-Marktplatz",
      title: "Gebrauchte Hardware weitergeben",
      text: "Boards, Sensoren, Displays, Bauteile und Werkzeug privat anbieten oder finden.",
      meta: "Kleinanzeigen · keine Zahlungsabwicklung",
      route: "/app/shop/",
      target: "communityMarketplace",
    },
  ];
  target.innerHTML = areas.map((area) => `
    <button class="dashboard-community-card" type="button" data-dashboard-community-route="${escapeAttribute(area.route)}" data-dashboard-community-target="${escapeAttribute(area.target)}">
      <span>${escapeHtml(area.label)}</span>
      <strong>${escapeHtml(area.title)}</strong>
      <p>${escapeHtml(area.text)}</p>
      <small>${escapeHtml(area.meta)} →</small>
    </button>
  `).join("") + renderDashboardMessageOverview(summary);
}

function renderDashboardMessageOverview(summary) {
  const available = Boolean(summary?.available);
  const unread = available ? Number(summary.messages?.unread || 0) : null;
  const threads = available ? Number(summary.messages?.threads || 0) : null;
  const open = available
    ? Number(summary.public?.open || 0) + Number(summary.private?.open || 0)
    : null;
  return `
    <section class="dashboard-community-personal" aria-label="Persönliche Community-Übersicht">
      <div class="dashboard-community-personal-copy">
        <span>Nachrichtensystem</span>
        <h3>Dein Community-Postfach</h3>
        <p>Private Unterhaltungen, Antworten und Support-Nachrichten an einem Ort.</p>
      </div>
      <div class="dashboard-community-personal-stats">
        <div><strong>${unread === null ? "–" : unread}</strong><span>ungelesen</span></div>
        <div><strong>${threads === null ? "–" : threads}</strong><span>Unterhaltungen</span></div>
        <div><strong>${open === null ? "–" : open}</strong><span>offene Anfragen</span></div>
      </div>
      <button type="button" data-dashboard-community-route="/app/messages/">Nachrichten öffnen →</button>
    </section>`;
}

// Gegenstueck zur Meldung aus dem Build-Controller.
window.addEventListener(DASHBOARD_STALE_EVENT, () => renderDashboard());
