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
      renderNetworkDiscovery();
      if (routeName() === "development-hardware") developmentPlatform().renderHardwareConfiguration();
      if (routeName() === "development-platform") developmentPlatform().render();
    })
    .catch((error) => {
      state.boardFeatureCatalog = [];
      state.boardFeatureCatalogStatus = {
        state: "error",
        message: error.message || "Hardware-Katalog nicht erreichbar.",
      };
      renderNetworkDiscovery();
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
      renderNetworkDiscovery();
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
      renderNetworkDiscovery();
      setInventoryStatus("error", state.processorBoardCatalogStatus.message);
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
  if (!summary?.available) {
    target.innerHTML = `<p class="helper-text error-text">Die Community ist gerade nicht erreichbar. Anfragen können erst wieder geladen oder gesendet werden, sobald der Dienst läuft.</p>`;
    return;
  }
  target.innerHTML = [
    ["Öffentlich", "Für alle lesbare Community-Anfragen", summary.public],
    ["Privat", "Nur für dich und GerNetiX sichtbar", summary.private],
  ].map(([label, description, counts]) => `
    <section class="dashboard-community-group">
      <header><div><h3>${escapeHtml(label)}</h3><p>${escapeHtml(description)}</p></div><strong>${Number(counts.open || 0) + Number(counts.closed || 0)}</strong></header>
      <div class="dashboard-community-counts">
        <a href="/app/community/"><span>Offen</span><strong>${Number(counts.open || 0)}</strong></a>
        <a href="/app/community/"><span>Geschlossen</span><strong>${Number(counts.closed || 0)}</strong></a>
      </div>
    </section>
  `).join("");
}
