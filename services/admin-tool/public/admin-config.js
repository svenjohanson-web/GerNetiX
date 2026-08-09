const state = {
  llm: null,
  localModels: [],
  apiModels: [],
  modelError: "",
  apiModelError: "",
  overview: null,
  learningFeedback: null,
  learningFeedbackLoading: false,
  accounts: [],
  aiUsage: null,
  aiContext: null,
  aiClarifications: null,
  aiClarificationsLoading: false,
  aiHelpKnowledge: null,
  aiHelpKnowledgeLoading: false,
  emailConfig: null,
  monitoring: null,
  monitoringLoading: false,
  syntheticChecks: null,
  syntheticChecksLoading: false,
  systemEvents: null,
  systemEventsLoading: false,
  userActions: null,
  userActionsLoading: false,
  userActionFilter: "",
  userActionIncidents: null,
  userActionIncidentsLoading: false,
  userActionAlerts: null,
  userActionAlertsLoading: false,
  linkIntegrity: null,
  linkIntegrityLoading: false,
  resources: null,
  sourceRepositories: null,
  sourceRepositoriesLoading: false,
  componentMetamodel: null,
  adminSession: null,
  community: null,
  communityLoading: false,
  selectedSupportThread: null,
  selectedSupportThreadLoading: false,
  selectedCommunityQuestion: null,
  selectedCommunityQuestionLoading: false,
  currentView: "statistics",
};

const API_PRESETS = {
  "openai-responses": {
    label: "OpenAI Responses API",
    baseUrl: "https://api.openai.com/v1",
  },
  "openai-compatible": {
    label: "OpenAI-kompatibel",
    baseUrl: "",
  },
  anthropic: {
    label: "Claude / Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
  },
};

document.querySelector("#adminLlmForm").addEventListener("submit", saveLlmConfig);
document.querySelector("#aiCostLimitForm").addEventListener("submit", saveAiCostLimits);
document.querySelector("#adminLlmProvider").addEventListener("change", renderProviderFields);
document.querySelector("#adminApiProvider").addEventListener("change", applyApiProviderPreset);
document.querySelector("#adminLlmTestButton").addEventListener("click", testLlmConfig);
document.querySelector("#refreshLocalLlmModelsButton").addEventListener("click", loadLocalModels);
document.querySelector("#refreshApiLlmModelsButton").addEventListener("click", loadApiModels);
document.querySelector("#refreshMonitoringButton").addEventListener("click", () => loadMonitoring(true));
document.querySelector("#refreshSyntheticChecksButton").addEventListener("click", () => loadSyntheticChecks(true));
document.querySelector("#runSyntheticChecksButton").addEventListener("click", runSyntheticChecks);
document.querySelector("#refreshSystemEventsButton").addEventListener("click", () => loadSystemEvents(true));
document.querySelector("#refreshUserActionsButton").addEventListener("click", () => loadUserActions(true));
document.querySelector("#userActionSearchForm").addEventListener("submit", searchUserAction);
document.querySelector("#clearUserActionSearchButton").addEventListener("click", clearUserActionSearch);
document.querySelector("#userActionAttemptRows").addEventListener("click", inspectUserAction);
document.querySelector("#copyUserActionIdButton").addEventListener("click", copyUserActionId);
document.querySelector("#createUserActionIncidentButton").addEventListener("click", openUserActionIncidentForm);
document.querySelector("#cancelUserActionIncidentButton").addEventListener("click", closeUserActionIncidentForm);
document.querySelector("#userActionIncidentCreateForm").addEventListener("submit", createUserActionIncident);
document.querySelector("#userActionIncidentRows").addEventListener("submit", updateUserActionIncident);
document.querySelector("#refreshUserActionIncidentsButton").addEventListener("click", () => loadUserActionIncidents(true));
document.querySelector("#refreshUserActionAlertsButton").addEventListener("click", () => loadUserActionAlerts(true));
document.querySelector("#evaluateUserActionAlertsButton").addEventListener("click", evaluateUserActionAlerts);
document.querySelector("#userActionHours").addEventListener("change", () => { if (!state.userActionFilter) void loadUserActions(true); });
document.querySelector("#refreshLinkIntegrityButton").addEventListener("click", () => loadLinkIntegrity(true));
document.querySelector("#syncLinkIntegrityButton").addEventListener("click", synchronizeLinkIntegrity);
document.querySelector("#refreshResourcesButton").addEventListener("click", () => loadResources(true));
document.querySelector("#refreshSourceRepositoriesButton")?.addEventListener("click", () => loadSourceRepositories(true));
document.querySelector("#resourcePolicyRows").addEventListener("click", saveResourcePolicy);
document.querySelector("#refreshAiClarificationsButton").addEventListener("click", () => loadAiClarifications(true));
document.querySelector("#aiClarificationStatusFilter").addEventListener("change", () => loadAiClarifications(true));
document.querySelector("#aiClarificationPriorityFilter").addEventListener("change", () => loadAiClarifications(true));
document.querySelector("#aiClarificationRows").addEventListener("click", handleAiClarificationAction);
document.querySelector("#aiHelpKnowledgeForm").addEventListener("submit", saveAiHelpKnowledge);
document.querySelector("#aiHelpKnowledgeRows").addEventListener("click", editAiHelpKnowledge);
document.querySelector("#adminEmailConfigForm").addEventListener("submit", saveEmailConfig);
document.querySelector("#adminEmailTestButton").addEventListener("click", testEmailConfig);
document.querySelector("#refreshCommunityButton")?.addEventListener("click", () => loadCommunity(true));
document.querySelector("#refreshLearningFeedbackButton")?.addEventListener("click", () => loadLearningFeedback(true));
document.querySelector("#learningFeedbackProjectFilter")?.addEventListener("change", renderLearningFeedback);
document.querySelector("#communitySupportRows")?.addEventListener("click", handleCommunitySupportSelection);
document.querySelector("#communityQuestionRows")?.addEventListener("click", handleCommunityQuestionSelection);
document.querySelector("#communitySupportDetail")?.addEventListener("submit", handleCommunitySupportAction);
document.querySelector("#communityQuestionDetail")?.addEventListener("submit", handleCommunityQuestionAction);
document.querySelector("#communityReportRows")?.addEventListener("click", handleCommunityReportAction);
document.querySelector("#adminLogoutButton")?.addEventListener("click", async () => {
  await fetch("/api/admin-access/logout", { method: "POST" });
  location.assign("/admin/");
});
document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.adminView));
});
document.querySelectorAll("[data-admin-sub-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.adminSubView));
});

bootstrap();

async function bootstrap() {
  await loadAdminSession();
  if (!canAccessView(state.currentView)) state.currentView = "community";
  if (!isFullAdministrator()) {
    await loadCommunity(false);
    render();
    return;
  }
  await loadOverview();
  await loadAccounts();
  await loadResources(false);
  await loadComponentMetamodel();
  await loadAiUsage();
  await loadAiContext();
  await loadAiClarifications(false);
  await loadAiHelpKnowledge(false);
  await loadEmailConfig();
  await loadConfig();
  await loadLocalModels();
  await loadApiModels();
  await loadCommunity(false);
  render();
}

async function loadAdminSession() {
  try {
    state.adminSession = await getJson("/api/admin-access/session");
  } catch {
    state.adminSession = null;
  }
}

function isFullAdministrator() {
  return state.adminSession?.admin?.role === "administrator";
}

function canUseCommunity(capability) {
  const capabilities = new Set(state.adminSession?.admin?.capabilities || []);
  return capabilities.has(capability);
}

function canAccessView(view) {
  if (isFullAdministrator()) return true;
  if (view !== "community") return false;
  return canUseCommunity("admin_community_support") || canUseCommunity("admin_community_moderation");
}

async function loadOverview() {
  state.overview = await getJson("/api/admin/overview");
}

async function loadAiUsage() {
  const result = await getJson("/api/admin/ai-usage/summary");
  state.aiUsage = result.summary || null;
}

async function loadAccounts() {
  const result = await getJson("/api/admin/accounts");
  state.accounts = result.accounts || [];
}

async function loadAiContext() {
  const result = await getJson("/api/admin/ai-context/summary");
  state.aiContext = result.summary || null;
}

async function loadAiClarifications(force) {
  if (state.aiClarificationsLoading || (state.aiClarifications && !force)) return;
  state.aiClarificationsLoading = true;
  renderAiClarifications();
  const status = value("#aiClarificationStatusFilter");
  const priority = value("#aiClarificationPriorityFilter");
  try {
    state.aiClarifications = await getJson(`/api/admin/ai-clarification-cases?status=${encodeURIComponent(status)}&priority=${encodeURIComponent(priority)}`);
  } catch (error) {
    state.aiClarifications = {summary:{total:0,open:0,urgent:0,resolved:0},items:[],error:error.message};
  } finally {
    state.aiClarificationsLoading = false;
    renderAiClarifications();
  }
}

async function loadAiHelpKnowledge(force) {
  if (state.aiHelpKnowledgeLoading || (state.aiHelpKnowledge && !force)) return;
  state.aiHelpKnowledgeLoading = true;
  try {
    state.aiHelpKnowledge = await getJson("/api/admin/ai-help-articles");
  } catch (error) {
    state.aiHelpKnowledge = { items: [], error: error.message };
  } finally {
    state.aiHelpKnowledgeLoading = false;
    renderAiHelpKnowledge();
  }
}

async function loadEmailConfig() {
  try {
    const result = await getJson("/api/admin/email-config");
    state.emailConfig = result.config || null;
  } catch (error) {
    state.emailConfig = { error: error.message };
  }
}

async function loadConfig() {
  const result = await getJson("/api/admin/llm-config");
  state.llm = result.config || null;
}

async function loadLocalModels() {
  const result = await getJson("/api/admin/llm-models?provider=ollama");
  state.localModels = result.items || [];
  state.modelError = result.error || "";
  render();
}

async function loadApiModels() {
  const apiProvider = value("#adminApiProvider") || state.llm?.apiProvider || "openai-responses";
  const apiBaseUrl = value("#adminApiBaseUrl") || state.llm?.apiBaseUrl || "";
  const currentModel = value("#adminApiModel") || state.llm?.apiModel || "";
  if (!state.llm?.hasApiKey) {
    state.apiModels = [];
    state.apiModelError = "Kein API-Key gespeichert. Bitte zuerst den API-Key eingeben und die LLM-Konfiguration speichern.";
    renderApiModelOptions(currentModel);
    return;
  }
  document.querySelector("#adminApiModelStatus").textContent = "API-Modelle werden geladen...";
  document.querySelector("#refreshApiLlmModelsButton").disabled = true;
  try {
    const result = await getJson(`/api/admin/llm-models?provider=api&api_provider=${encodeURIComponent(apiProvider)}&base_url=${encodeURIComponent(apiBaseUrl)}`);
    if (result.provider === "ollama") throw new Error("Der Admin-Backendprozess ist noch nicht auf dem neuen Stand. Bitte Admin Tool neu starten.");
    state.apiModels = result.items || [];
    state.apiModelError = result.error || "";
  } catch (error) {
    state.apiModels = [];
    state.apiModelError = error.message || String(error);
  } finally {
    renderApiModelOptions(currentModel);
    document.querySelector("#refreshApiLlmModelsButton").disabled = false;
  }
}

function render() {
  renderNavigation();
  renderStatistics();
  renderLearningFeedback();
  renderMonitoring();
  renderSystemEvents();
  renderLinkIntegrity();
  renderAccounts();
  renderResources();
  renderSourceRepositories();
  renderComponentMetamodel();
  renderAiUsage();
  renderAiContext();
  renderAiClarifications();
  renderAiHelpKnowledge();
  renderEmailConfig();
  renderCommunity();
  renderForm();
  renderStatus();
  renderProviderFields();
}

function setView(view) {
  state.currentView = view || "statistics";
  renderNavigation();
  if (state.currentView === "monitoring") { loadMonitoring(false); loadSyntheticChecks(false); }
  if (state.currentView === "system-events") loadSystemEvents(false);
  if (state.currentView === "user-actions") { loadUserActions(false); loadUserActionIncidents(false); loadUserActionAlerts(false); }
  if (state.currentView === "link-integrity") loadLinkIntegrity(false);
  if (state.currentView === "source-repositories") loadSourceRepositories(false);
  if (state.currentView === "ai-clarifications") loadAiClarifications(false);
  if (state.currentView === "ai-help-knowledge") loadAiHelpKnowledge(false);
  if (state.currentView === "email-config") loadEmailConfig().then(renderEmailConfig);
  if (state.currentView === "community") loadCommunity(false);
  if (state.currentView === "learning-feedback") loadLearningFeedback(false);
}

function renderNavigation() {
  const aiView = isAiView(state.currentView);
  document.querySelector("#aiSubNav")?.classList.toggle("hidden", !aiView);
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.classList.toggle("hidden", !canAccessView(button.dataset.adminView));
  });
  document.querySelectorAll(".admin-view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== viewId(state.currentView));
  });
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    const group = button.dataset.adminGroup || "";
    const active = group === "ai" ? aiView : button.dataset.adminView === state.currentView;
    button.classList.toggle("active-method", active);
    button.classList.toggle("is-active", active);
  });
  document.querySelectorAll("[data-admin-sub-view]").forEach((button) => {
    const active = button.dataset.adminSubView === state.currentView;
    button.classList.toggle("active-method", active);
    button.classList.toggle("is-active", active);
  });
}

function isAiView(view) {
  return ["ai-usage", "ai-context", "ai-help-knowledge", "ai-clarifications", "llm-config"].includes(view);
}

function viewId(view) {
  return {
    statistics: "statisticsView",
    "learning-feedback": "learningFeedbackView",
    monitoring: "monitoringView",
    "system-events": "systemEventsView",
    "user-actions": "userActionsView",
    "link-integrity": "linkIntegrityView",
    accounts: "accountsView",
    resources: "resourcesView",
    "source-repositories": "sourceRepositoriesView",
    community: "communityView",
    "component-metamodel": "componentMetamodelView",
    "ai-usage": "aiUsageView",
    "ai-context": "aiContextView",
    "ai-clarifications": "aiClarificationsView",
    "ai-help-knowledge": "aiHelpKnowledgeView",
    "email-config": "emailConfigView",
    "llm-config": "llmConfigView",
  }[view] || "statisticsView";
}

async function loadLearningFeedback(force) {
  if (state.learningFeedbackLoading || (state.learningFeedback && !force)) return;
  state.learningFeedbackLoading = true;
  renderLearningFeedback();
  try {
    const result = await getJson("/api/admin/learning-feedback?purpose=feedback_review");
    state.learningFeedback = { items: result.items || [] };
  } catch (error) {
    state.learningFeedback = { items: [], error: error.message || String(error) };
  } finally {
    state.learningFeedbackLoading = false;
    renderLearningFeedback();
  }
}

function renderLearningFeedback() {
  const metrics = document.querySelector("#learningFeedbackMetrics");
  const summaryRows = document.querySelector("#learningFeedbackSummaryRows");
  const rows = document.querySelector("#learningFeedbackRows");
  const filter = document.querySelector("#learningFeedbackProjectFilter");
  if (!metrics || !summaryRows || !rows || !filter) return;
  const entries = (state.learningFeedback?.items || [])
    .map((item) => item.feedback || item);
  const subjectId = (item) => item.learning_project_id || item.template_id || item.subject_id || item.project_id || "";
  const subjects = Array.from(new Set(entries.map(subjectId).filter(Boolean))).sort();
  const selectedProject = filter.value;
  filter.innerHTML = `<option value="">Alle</option>${subjects.map((id) => `<option value="${escapeHtml(id)}"${id === selectedProject ? " selected" : ""}>${escapeHtml(id)}</option>`).join("")}`;
  const visible = selectedProject ? entries.filter((item) => subjectId(item) === selectedProject) : entries;
  const rated = visible.filter((item) => item.ratings && ["clarity", "fun", "difficulty", "completeness"].every((key) => Number.isFinite(Number(item.ratings[key]))));
  const labels = { clarity: "Verständlichkeit", fun: "Spaß", difficulty: "Schwierigkeit", completeness: "Vollständigkeit" };
  metrics.innerHTML = state.learningFeedbackLoading
    ? metricCard("Bewertungen", "…", "werden geladen")
    : Object.entries(labels).map(([key, label]) => metricCard(label, averageRating(rated, key), `${formatNumber(rated.length)} Bewertungen`)).join("");
  const learningRatings = entries.filter((item) => item.category === "learning_experience_rating"
    && item.ratings && Object.keys(labels).every((key) => Number.isFinite(Number(item.ratings[key]))));
  const projectGroups = new Map();
  for (const item of learningRatings) {
    const id = subjectId(item);
    if (!id) continue;
    if (!projectGroups.has(id)) projectGroups.set(id, []);
    projectGroups.get(id).push(item);
  }
  summaryRows.innerHTML = projectGroups.size
    ? Array.from(projectGroups.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([id, items]) => `<tr>
      <td><strong>${escapeHtml(items[0].project_title || id)}</strong><br><small>${escapeHtml(id)}</small></td>
      <td>${formatNumber(items.length)}</td>
      ${Object.keys(labels).map((key) => `<td>${averageRating(items, key)}</td>`).join("")}
      <td>${ratingDistribution(items, Object.keys(labels))}</td>
    </tr>`).join("")
    : `<tr><td colspan="7" class="empty-cell">Noch keine abgeschlossenen Lernprojektbewertungen vorhanden.</td></tr>`;
  rows.innerHTML = visible.length ? visible
    .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
    .map((item) => `<tr>
      <td>${escapeHtml(formatDateTime(item.created_at))}</td>
      <td><strong>${escapeHtml(subjectId(item) || "-")}</strong><br><small>${escapeHtml(item.category || item.learning_step_id || "Feedback")}</small></td>
      ${["clarity", "fun", "difficulty", "completeness"].map((key) => `<td>${ratingValue(item.ratings?.[key])}</td>`).join("")}
      <td>${escapeHtml(item.message || "-")}</td>
    </tr>`).join("")
    : `<tr><td colspan="7" class="empty-cell">${escapeHtml(state.learningFeedback?.error || "Noch keine Bewertungen vorhanden.")}</td></tr>`;
}

function ratingDistribution(items, keys) {
  const counts = new Map([1, 2, 3, 4, 5].map((value) => [value, 0]));
  for (const item of items) for (const key of keys) {
    const value = Number(item.ratings?.[key]);
    if (counts.has(value)) counts.set(value, counts.get(value) + 1);
  }
  const maximum = Math.max(...counts.values(), 1);
  return `<div class="rating-distribution" aria-label="Verteilung aller vier Bewertungskriterien">${Array.from(counts, ([value, count]) => `<span><b>${value}</b><i style="--share:${count / maximum}" aria-hidden="true"></i><small>${formatNumber(count)}</small></span>`).join("")}</div>`;
}

function averageRating(items, key) {
  if (!items.length) return "–";
  const average = items.reduce((sum, item) => sum + Number(item.ratings[key]), 0) / items.length;
  return `${average.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`;
}

function ratingValue(value) {
  if (!Number.isFinite(Number(value))) return "–";
  const number = Math.max(1, Math.min(5, Number(value) || 1));
  return `<span class="rating-value"><strong>${number}</strong><i style="--rating:${number}" aria-hidden="true"></i></span>`;
}

async function loadCommunity(force) {
  if (state.communityLoading || (state.community && !force)) return;
  state.communityLoading = true;
  renderCommunity();
  const loadPart = async (path, fallback) => {
    try { return await getJson(path); } catch (error) { return { ...fallback, error: error.message }; }
  };
  try {
    const canSupport = isFullAdministrator() || canUseCommunity("admin_community_support");
    const canModerate = isFullAdministrator() || canUseCommunity("admin_community_moderation");
    const unavailable = { items: [], unavailable: true };
    const [overview, support, questions, reports] = await Promise.all([
      isFullAdministrator() ? loadPart("/api/admin/community/overview", { summary: {} }) : Promise.resolve({ summary: {} }),
      canSupport ? loadPart("/api/admin/community/support-threads", { items: [] }) : Promise.resolve(unavailable),
      canModerate ? loadPart("/api/admin/community/questions", { items: [] }) : Promise.resolve(unavailable),
      canModerate ? loadPart("/api/admin/community/message-reports?status=open", { items: [] }) : Promise.resolve(unavailable),
    ]);
    state.community = { overview, support, questions, reports };
  } finally {
    state.communityLoading = false;
    renderCommunity();
  }
}

function renderCommunity() {
  const metrics = document.querySelector("#communityMetrics");
  const supportRows = document.querySelector("#communitySupportRows");
  const questionRows = document.querySelector("#communityQuestionRows");
  const reportRows = document.querySelector("#communityReportRows");
  if (!metrics || !supportRows || !questionRows || !reportRows) return;
  const data = state.community || {};
  document.querySelectorAll("[data-community-capability]").forEach((element) => {
    const capability = element.dataset.communityCapability;
    element.classList.toggle("hidden", !isFullAdministrator() && !canUseCommunity(capability));
  });
  const summary = data.overview?.summary || {};
  const questionSummary = summary.questions || {};
  metrics.innerHTML = [
    metricCard("Support offen", formatNumber(summary.support?.open || 0), "private Anfragen"),
    metricCard("Neue Fragen", formatNumber(questionSummary.awaiting_triage || 0), `${formatNumber(questionSummary.overdue || 0)} über SLA`),
    metricCard("Private Fragen", formatNumber(questionSummary.private || 0), `${formatNumber(questionSummary.public || 0)} öffentlich`),
    metricCard("Meldungen offen", formatNumber(summary.reports?.open || 0), "Moderation erforderlich"),
  ].join("");
  if (state.communityLoading) {
    supportRows.innerHTML = questionRows.innerHTML = reportRows.innerHTML = `<tr><td colspan="5" class="empty-cell">Kommunikation wird geladen …</td></tr>`;
    return;
  }
  const support = data.support?.items || [];
  const questions = data.questions?.items || [];
  const reports = data.reports?.items || [];
  supportRows.innerHTML = data.support?.unavailable
    ? `<tr><td colspan="4" class="empty-cell">Deine Rolle besitzt keinen Support-Zugriff.</td></tr>`
    : data.support?.error
    ? `<tr><td colspan="4" class="empty-cell">${escapeHtml(data.support.error)}</td></tr>`
    : support.length ? support.map((thread) => `<tr>
      <td><strong>${escapeHtml(thread.subject || "Support-Anfrage")}</strong><span>${formatNumber(thread.message_count || 0)} Nachrichten</span></td>
      <td>${escapeHtml(thread.customer_user_id || "-")}</td>
      <td>${escapeHtml(truncate(thread.latest_message?.body || "", 110))}<span>${escapeHtml(formatDateTime(thread.updated_at))}</span></td>
      <td><button type="button" data-community-open-support="${escapeHtml(thread.thread_id)}">Öffnen</button></td>
    </tr>`).join("") : `<tr><td colspan="4" class="empty-cell">Keine offenen Support-Anfragen.</td></tr>`;
  questionRows.innerHTML = data.questions?.unavailable
    ? `<tr><td colspan="5" class="empty-cell">Deine Rolle besitzt keine Moderationsberechtigung.</td></tr>`
    : data.questions?.error
    ? `<tr><td colspan="5" class="empty-cell">${escapeHtml(data.questions.error)}</td></tr>`
    : questions.length ? questions.map((question) => `<tr>
      <td><strong>${escapeHtml(question.title)}</strong><span>${escapeHtml(truncate(question.body, 110))}</span></td>
      <td>${escapeHtml(question.visibility === "private" ? "privat" : "öffentlich")}</td>
      <td><strong>${escapeHtml(triageLabel(question.triage_status))}</strong><span>${escapeHtml(priorityLabel(question.priority))}</span></td>
      <td>${formatNumber(question.answer_count || 0)}</td>
      <td><button type="button" data-community-open-question="${escapeHtml(question.question_id)}">Bearbeiten</button></td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-cell">Keine Community-Anfragen.</td></tr>`;
  reportRows.innerHTML = data.reports?.unavailable
    ? `<tr><td colspan="5" class="empty-cell">Deine Rolle besitzt keine Moderationsberechtigung.</td></tr>`
    : data.reports?.error
    ? `<tr><td colspan="4" class="empty-cell">${escapeHtml(data.reports.error)}</td></tr>`
    : reports.length ? reports.map((report) => `<tr data-community-report="${escapeHtml(report.report_id)}">
      <td><strong>${escapeHtml(report.thread?.subject || "Unterhaltung")}</strong><span>${escapeHtml(formatDateTime(report.created_at))}</span></td>
      <td>${escapeHtml(truncate(report.reported_message?.body || "Nachricht nicht verfügbar", 170))}<span>${escapeHtml(report.reported_message?.author_label || "-")}</span></td>
      <td>${escapeHtml(report.reason || "-")}</td>
      <td class="community-report-action"><select aria-label="Entscheidung"><option value="resolved">Erledigt</option><option value="dismissed">Verwerfen</option></select><input type="text" maxlength="1000" placeholder="Notiz (optional)" aria-label="Moderationsnotiz" /><button type="button" data-community-resolve-report>Speichern</button></td>
    </tr>`).join("") : `<tr><td colspan="4" class="empty-cell">Keine offenen Meldungen.</td></tr>`;
  renderCommunitySupportDetail();
  renderCommunityQuestionDetail();
}

async function handleCommunitySupportSelection(event) {
  const button = event.target.closest("[data-community-open-support]");
  if (!button) return;
  const threadId = button.dataset.communityOpenSupport;
  state.selectedSupportThread = { thread_id: threadId };
  state.selectedSupportThreadLoading = true;
  renderCommunitySupportDetail();
  try {
    const result = await getJson(`/api/admin/community/support-threads/${encodeURIComponent(threadId)}`);
    state.selectedSupportThread = result.thread || null;
  } catch (error) {
    state.selectedSupportThread = { error: error.message };
  } finally {
    state.selectedSupportThreadLoading = false;
    renderCommunitySupportDetail();
  }
}

function renderCommunitySupportDetail() {
  const target = document.querySelector("#communitySupportDetail");
  if (!target) return;
  const thread = state.selectedSupportThread;
  if (state.selectedSupportThreadLoading) { target.className = "community-detail"; target.innerHTML = "Unterhaltung wird geladen …"; return; }
  if (!thread) { target.className = "community-detail empty"; target.textContent = "Wähle eine Support-Anfrage aus."; return; }
  if (thread.error) { target.className = "community-detail error"; target.textContent = thread.error; return; }
  target.className = "community-detail";
  target.innerHTML = `<h3>${escapeHtml(thread.subject || "Support-Anfrage")}</h3>
    <p class="community-meta">Konto: ${escapeHtml(thread.created_by_user_id || "-")} · ${formatDateTime(thread.created_at)}</p>
    <div class="community-message-list">${(thread.messages || []).map((message) => `<article class="community-message"><strong>${escapeHtml(message.author_label || "Mitglied")}</strong><span>${escapeHtml(formatDateTime(message.created_at))}</span><p>${escapeHtml(message.body || "")}</p></article>`).join("") || "<p class=\"empty\">Keine Nachrichten.</p>"}</div>
    <form class="community-action-form" data-community-action="reply-support" data-thread-id="${escapeHtml(thread.thread_id)}"><label>Antwort<textarea name="body" rows="5" maxlength="8000" required placeholder="Antwort als GerNetiX Support"></textarea></label><button class="primary" type="submit">Antwort senden</button><p class="flash-status hidden" role="status"></p></form>`;
}

async function handleCommunitySupportAction(event) {
  event.preventDefault();
  const form = event.target.closest("[data-community-action='reply-support']");
  if (!form) return;
  const button = form.querySelector("button"); const status = form.querySelector(".flash-status");
  button.disabled = true;
  try {
    await postJson(`/api/admin/community/support-threads/${encodeURIComponent(form.dataset.threadId)}/messages`, { body: form.elements.body.value });
    status.className = "flash-status ok"; status.textContent = "Antwort gesendet.";
    const result = await getJson(`/api/admin/community/support-threads/${encodeURIComponent(form.dataset.threadId)}`);
    state.selectedSupportThread = result.thread || null;
    state.community = null;
    await loadCommunity(true);
  } catch (error) {
    status.className = "flash-status error"; status.textContent = error.message;
  } finally { button.disabled = false; }
}

async function handleCommunityQuestionSelection(event) {
  const button = event.target.closest("[data-community-open-question]");
  if (!button) return;
  const questionId = button.dataset.communityOpenQuestion;
  state.selectedCommunityQuestion = { question_id: questionId };
  state.selectedCommunityQuestionLoading = true;
  renderCommunityQuestionDetail();
  try {
    const result = await getJson(`/api/admin/community/questions/${encodeURIComponent(questionId)}`);
    state.selectedCommunityQuestion = result.question || null;
  } catch (error) {
    state.selectedCommunityQuestion = { error: error.message };
  } finally {
    state.selectedCommunityQuestionLoading = false;
    renderCommunityQuestionDetail();
  }
}

function renderCommunityQuestionDetail() {
  const target = document.querySelector("#communityQuestionDetail");
  if (!target) return;
  const question = state.selectedCommunityQuestion;
  if (state.selectedCommunityQuestionLoading) { target.className = "community-detail"; target.innerHTML = "Frage wird geladen …"; return; }
  if (!question) { target.className = "community-detail empty"; target.textContent = "Wähle eine Community-Anfrage aus."; return; }
  if (question.error) { target.className = "community-detail error"; target.textContent = question.error; return; }
  const allowVerification = canUseCommunity("admin_community_moderation");
  target.className = "community-detail";
  target.innerHTML = `<h3>${escapeHtml(question.title)}</h3><p class="community-meta">${escapeHtml(question.visibility === "private" ? "Private Anfrage" : "Öffentliche Anfrage")} · ${escapeHtml(question.author_label || "-")} · ${formatDateTime(question.created_at)}</p><p class="community-question-body">${escapeHtml(question.body || "")}</p>
    <form class="community-action-form" data-community-action="triage-question" data-question-id="${escapeHtml(question.question_id)}"><label>Triage<select name="triage_status"><option value="triaged" ${question.triage_status === "triaged" ? "selected" : ""}>Triage abgeschlossen</option><option value="new" ${question.triage_status === "new" ? "selected" : ""}>Neu</option><option value="deferred" ${question.triage_status === "deferred" ? "selected" : ""}>Zurückgestellt</option></select></label><label>Priorität<select name="priority">${["low", "normal", "high", "urgent"].map((priority) => `<option value="${priority}" ${question.priority === priority ? "selected" : ""}>${priorityLabel(priority)}</option>`).join("")}</select></label><label>Interne Notiz<textarea name="moderation_note" rows="3" maxlength="1000">${escapeHtml(question.moderation_note || "")}</textarea></label><button type="submit">Triage speichern</button><p class="flash-status hidden" role="status"></p></form>
    <form class="community-action-form" data-community-action="answer-question" data-question-id="${escapeHtml(question.question_id)}"><label>Antwort<textarea name="body" rows="5" maxlength="8000" required placeholder="Antwort als GerNetiX"></textarea></label>${allowVerification ? "<label class=\"community-check\"><input type=\"checkbox\" name=\"verify\" checked /> Als geprüfte Antwort freigeben</label>" : ""}<button class="primary" type="submit">Antwort speichern</button><p class="flash-status hidden" role="status"></p></form>`;
}

async function handleCommunityQuestionAction(event) {
  event.preventDefault();
  const form = event.target.closest("[data-community-action]");
  if (!form || !["triage-question", "answer-question"].includes(form.dataset.communityAction)) return;
  const button = form.querySelector("button"); const status = form.querySelector(".flash-status"); const questionId = form.dataset.questionId;
  button.disabled = true;
  try {
    if (form.dataset.communityAction === "triage-question") {
      await postJson(`/api/admin/community/questions/${encodeURIComponent(questionId)}/triage`, {
        triage_status: form.elements.triage_status.value,
        priority: form.elements.priority.value,
        moderation_note: form.elements.moderation_note.value,
      });
      status.className = "flash-status ok"; status.textContent = "Triage gespeichert.";
    } else {
      const result = await postJson(`/api/admin/community/questions/${encodeURIComponent(questionId)}/answers`, { body: form.elements.body.value });
      if (form.elements.verify?.checked) await postJson(`/api/admin/community/answers/${encodeURIComponent(result.answer.answer_id)}/verify`, { verification_state: "verified", accept: true });
      status.className = "flash-status ok"; status.textContent = form.elements.verify?.checked ? "Antwort gespeichert und freigegeben." : "Antwort gespeichert.";
      form.reset();
    }
    const detail = await getJson(`/api/admin/community/questions/${encodeURIComponent(questionId)}`);
    state.selectedCommunityQuestion = detail.question || null;
    state.community = null;
    await loadCommunity(true);
  } catch (error) {
    status.className = "flash-status error"; status.textContent = error.message;
  } finally { button.disabled = false; }
}

async function handleCommunityReportAction(event) {
  const button = event.target.closest("[data-community-resolve-report]");
  if (!button) return;
  const row = button.closest("tr"); const reportId = row?.dataset.communityReport;
  if (!reportId) return;
  button.disabled = true;
  try {
    await postJson(`/api/admin/community/message-reports/${encodeURIComponent(reportId)}/resolve`, {
      status: row.querySelector("select").value,
      resolution_note: row.querySelector("input").value,
    });
    state.community = null;
    await loadCommunity(true);
  } catch (error) { alert(error.message); } finally { button.disabled = false; }
}

function triageLabel(value) { return ({ new: "neu", triaged: "triagiert", deferred: "zurückgestellt" })[value] || value || "-"; }
function priorityLabel(value) { return ({ low: "niedrig", normal: "normal", high: "hoch", urgent: "dringend" })[value] || value || "-"; }
function truncate(value, length) { const text = String(value || "").replace(/\s+/g, " ").trim(); return text.length > length ? `${text.slice(0, Math.max(0, length - 1))}…` : text; }

async function loadLinkIntegrity(force) {
  if (state.linkIntegrityLoading || (state.linkIntegrity && !force)) return;
  state.linkIntegrityLoading = true;
  renderLinkIntegrity();
  try {
    state.linkIntegrity = await getJson("/api/admin/link-integrity");
  } catch (error) {
    state.linkIntegrity = { summary: {}, items: [], error: error.message };
  } finally {
    state.linkIntegrityLoading = false;
    renderLinkIntegrity();
  }
}

async function synchronizeLinkIntegrity() {
  const button = document.querySelector("#syncLinkIntegrityButton");
  const status = document.querySelector("#linkIntegrityStatus");
  button.disabled = true;
  status.className = "flash-status running";
  status.textContent = "Identity-Inventar wird synchronisiert …";
  try {
    const result = await postJson("/api/admin/link-integrity/sync", {});
    state.linkIntegrity = null;
    await loadLinkIntegrity(true);
    status.className = "flash-status ok";
    status.textContent = `${formatNumber(result.targets)} Ziele und ${formatNumber(result.occurrences)} Fundstellen synchronisiert.`;
  } catch (error) {
    status.className = "flash-status error";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function renderLinkIntegrity() {
  const summary = state.linkIntegrity?.summary || {};
  const items = state.linkIntegrity?.items || [];
  const metrics = document.querySelector("#linkIntegrityMetrics");
  const rows = document.querySelector("#linkIntegrityRows");
  if (!metrics || !rows) return;
  metrics.innerHTML = [
    metricCard("Aktive Ziele", formatNumber(summary.total_targets || 0), `${formatNumber(summary.internal || 0)} intern · ${formatNumber(summary.external || 0)} extern`),
    metricCard("Angemeldet", formatNumber(summary.authenticated || 0), "mit technischem Testkonto"),
    metricCard("Fehler", formatNumber((summary.broken || 0) + (summary.unreachable || 0)), `${formatNumber(summary.redirected || 0)} Weiterleitungen`),
    metricCard("Noch ungeprüft", formatNumber(summary.not_checked || 0), "Inventar vorhanden, Lauf ausstehend"),
  ].join("");
  if (state.linkIntegrityLoading) {
    rows.innerHTML = `<tr><td colspan="5" class="empty-cell">Linkregister wird geladen …</td></tr>`;
    return;
  }
  if (state.linkIntegrity?.error) {
    rows.innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(state.linkIntegrity.error)}</td></tr>`;
    return;
  }
  rows.innerHTML = items.length ? items.map((item) => {
    const check = item.latest_check;
    const status = check?.status || "not_checked";
    return `<tr>
      <td><strong>${escapeHtml(item.target_url)}</strong><span>${escapeHtml(item.reference_id)}</span></td>
      <td><strong>${escapeHtml(item.link_type)}</strong><span>${escapeHtml(item.access_scope)}</span></td>
      <td>${escapeHtml(item.owner_domain || "-")}</td>
      <td>${formatNumber(item.occurrence_count || 0)}</td>
      <td><strong class="link-status ${escapeHtml(status)}">${escapeHtml(linkStatusLabel(status))}</strong><span>${check ? `${escapeHtml(formatDateTime(check.checked_at))}${check.http_status ? ` · HTTP ${formatNumber(check.http_status)}` : ""}` : "kein Prüflauf"}</span></td>
    </tr>`;
  }).join("") : `<tr><td colspan="5" class="empty-cell">Noch kein Linkinventar synchronisiert.</td></tr>`;
}

function linkStatusLabel(status) {
  return ({
    healthy: "in Ordnung",
    redirected: "weitergeleitet",
    restricted: "Zugriff beschränkt",
    broken: "defekt",
    unreachable: "nicht erreichbar",
    not_checked: "ungeprüft",
  })[status] || status;
}

function renderComponentMetamodel() {
  const model = state.componentMetamodel || { component_types: [], relationship_rules: [] };
  const types = model.component_types || [];
  const rules = model.relationship_rules || [];
  const diagram = document.querySelector("#componentMetamodelDiagram");
  const associationDiagram = document.querySelector("#componentMetamodelAssociationDiagram");
  const typeTarget = document.querySelector("#componentMetamodelTypes");
  const relationTarget = document.querySelector("#componentMetamodelRelationRows");
  if (!diagram || !associationDiagram || !typeTarget || !relationTarget) return;
  if (model.error) {
    diagram.innerHTML = `<p class="empty">${escapeHtml(model.error)}</p>`;
    associationDiagram.innerHTML = "";
    typeTarget.innerHTML = "";
    relationTarget.innerHTML = `<tr><td colspan="4" class="empty-cell">Metamodell konnte nicht geladen werden.</td></tr>`;
    return;
  }
  diagram.innerHTML = metamodelClassDiagramSvg(types.length, rules.length);
  associationDiagram.innerHTML = metamodelAssociationDiagramSvg(rules, types);
  typeTarget.innerHTML = types.map((type) => `<article class="metamodel-type-card"><strong>${escapeHtml(type.label)}</strong><span>${escapeHtml(type.id)}</span><small>${type.allocation === "iot_device" ? "IoT-Steuereinheit erforderlich" : type.allocation === "board" ? "Board-Zuordnung" : "keine Hardware-Zuordnung"}</small></article>`).join("");
  relationTarget.innerHTML = rules.map((rule) => `<tr><td>${escapeHtml(metamodelTypeLabel(rule.source_type, types))}</td><td><strong>${escapeHtml(rule.label)}</strong></td><td>${escapeHtml(metamodelTypeLabel(rule.target_type, types))}</td><td>${escapeHtml(rule.source_cardinality || "0..*")} → ${escapeHtml(rule.target_cardinality || "0..*")}</td><td><code>${escapeHtml(rule.id)}</code></td></tr>`).join("") || `<tr><td colspan="5" class="empty-cell">Keine Beziehungsregeln vorhanden.</td></tr>`;
}

function metamodelTypeLabel(id, types) {
  return types.find((type) => type.id === id)?.label || id;
}

function metamodelClassDiagramSvg(typeCount, ruleCount) {
  return `<svg viewBox="0 0 1120 470" role="img" aria-label="UML-Klassendiagramm mit ComponentType, ProjectComponent, AllowedRelationship und ProjectRelationship">
    <defs><marker id="metamodelArrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 Z" fill="#0f766e" /></marker></defs>
    <g class="uml-class" transform="translate(35 45)"><rect width="235" height="164"/><text x="118" y="28" class="uml-stereotype">«enumeration»</text><text x="118" y="52" class="uml-title">ComponentType</text><line x1="0" y1="66" x2="235" y2="66"/><text x="14" y="91">id: String</text><text x="14" y="116">label: String</text><text x="14" y="141">allocation: AllocationKind</text></g>
    <g class="uml-class" transform="translate(340 45)"><rect width="260" height="164"/><text x="130" y="28" class="uml-stereotype">«class»</text><text x="130" y="52" class="uml-title">ProjectComponent</text><line x1="0" y1="66" x2="260" y2="66"/><text x="14" y="91">component_id: String</text><text x="14" y="116">label: String</text><text x="14" y="141">abstract_type: ComponentType</text></g>
    <g class="uml-class" transform="translate(695 35)"><rect width="300" height="185"/><text x="150" y="28" class="uml-stereotype">«class»</text><text x="150" y="52" class="uml-title">AllowedRelationship</text><line x1="0" y1="66" x2="300" y2="66"/><text x="14" y="91">id: String</text><text x="14" y="116">label: String</text><text x="14" y="141">source_type: ComponentType</text><text x="14" y="166">target_type: ComponentType</text></g>
    <g class="uml-class" transform="translate(390 290)"><rect width="290" height="140"/><text x="145" y="28" class="uml-stereotype">«class»</text><text x="145" y="52" class="uml-title">ProjectRelationship</text><line x1="0" y1="66" x2="290" y2="66"/><text x="14" y="91">source: ProjectComponent</text><text x="14" y="116">target: ProjectComponent</text></g>
    <path class="uml-link" d="M270 127 H340" marker-end="url(#metamodelArrow)"/><text class="uml-link-label" x="281" y="114">type</text>
    <path class="uml-link" d="M600 127 H695" marker-end="url(#metamodelArrow)"/><text class="uml-link-label" x="614" y="114">source / target</text>
    <path class="uml-link" d="M470 209 V290" marker-end="url(#metamodelArrow)"/><text class="uml-link-label" x="480" y="250">source</text>
    <path class="uml-link" d="M570 290 V209" marker-end="url(#metamodelArrow)"/><text class="uml-link-label" x="580" y="250">target</text>
    <path class="uml-link dashed" d="M680 360 H845 V220" marker-end="url(#metamodelArrow)"/><text class="uml-link-label" x="704" y="348">conforms to</text>
    <g class="uml-note" transform="translate(35 285)"><rect width="270" height="105"/><text x="14" y="28">Regelbestand</text><text x="14" y="53">${typeCount} Komponententypen</text><text x="14" y="78">${ruleCount} erlaubte Beziehungen</text></g>
  </svg>`;
}

function metamodelAssociationDiagramSvg(rules, types) {
  const rowHeight = 82;
  const height = Math.max(160, rules.length * rowHeight + 48);
  return `<svg viewBox="0 0 1320 ${height}" role="img" aria-label="UML-Assoziationen der erlaubten Komponentenbeziehungen">
    <defs><marker id="metamodelAssociationArrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 Z" fill="#0f766e" /></marker></defs>
    ${rules.map((rule, index) => {
      const y = 28 + index * rowHeight;
      const source = escapeHtml(metamodelTypeLabel(rule.source_type, types));
      const target = escapeHtml(metamodelTypeLabel(rule.target_type, types));
      const label = escapeHtml(rule.label);
      const sourceCardinality = escapeHtml(rule.source_cardinality || "0..*");
      const targetCardinality = escapeHtml(rule.target_cardinality || "0..*");
      return `<g class="uml-association" transform="translate(0 ${y})">
        <rect class="uml-association-class" x="25" y="0" width="255" height="46" rx="4"/><text x="152" y="29" class="uml-association-title">${source}</text>
        <path d="M280 23 H1040" marker-end="url(#metamodelAssociationArrow)"/>
        <text x="300" y="16" class="uml-cardinality">${sourceCardinality}</text><text x="1014" y="16" class="uml-cardinality">${targetCardinality}</text>
        <text x="660" y="17" class="uml-association-label">${label}</text>
        <rect class="uml-association-class" x="1040" y="0" width="255" height="46" rx="4"/><text x="1167" y="29" class="uml-association-title">${target}</text>
      </g>`;
    }).join("")}
  </svg>`;
}

async function loadResources(force) {
  if (state.resources && !force) return;
  try { state.resources = await getJson("/api/admin/resources"); }
  catch (error) { state.resources = { policies: [], accounts: [], error: error.message }; }
  renderResources();
}

async function loadSourceRepositories(force) {
  if (state.sourceRepositoriesLoading || (state.sourceRepositories && !force)) return;
  state.sourceRepositoriesLoading = true;
  renderSourceRepositories();
  try {
    state.sourceRepositories = await getJson("/api/admin/source-repositories");
  } catch (error) {
    state.sourceRepositories = { summary: {}, system_repositories: [], project_repositories: [], builds: [], artifacts: [], error: error.message };
  } finally {
    state.sourceRepositoriesLoading = false;
    renderSourceRepositories();
  }
}

function renderSourceRepositories() {
  const data = state.sourceRepositories || {};
  const summary = data.summary || {};
  const systemRepositories = data.system_repositories || [];
  const projectRepositories = data.project_repositories || [];
  const builds = data.builds || [];
  const metricRoot = document.querySelector("#sourceRepositoryMetrics");
  if (!metricRoot) return;
  metricRoot.innerHTML = [
    metricCard("Systemquellen", formatNumber(summary.system_repositories || 0), `${formatNumber(summary.system_repositories_ready || 0)} freigegeben`),
    metricCard("Projekt-Repositories", formatNumber(summary.project_repositories || 0), `${formatNumber(summary.projects_without_repository || 0)} ohne Forgejo`),
    metricCard("Builds", formatNumber(summary.builds || 0), "commitgebunden"),
    metricCard("Artefakte", formatNumber(summary.artifacts || 0), "im Artifact Store"),
  ].join("");
  document.querySelector("#systemRepositoryRows").innerHTML = systemRepositories.length
    ? systemRepositories.map((item) => {
      const ready = item.exists && item.commit_sha;
      const repository = `${item.organization || "-"}/${item.repository_name || "-"}`;
      return `<tr><td><strong>${escapeHtml(item.title || item.source_id)}</strong><small>${escapeHtml(item.source_id || "")}</small></td><td>${escapeHtml(item.kind === "basissoftware" ? "Basissoftware" : "Produkt")}</td><td>${escapeHtml(repository)}</td><td><code>${escapeHtml(shortSha(item.commit_sha))}</code></td><td><span class="status-pill ${ready ? "ok" : "warning"}">${ready ? "bereit" : item.exists ? "Commit fehlt" : "Repository fehlt"}</span></td></tr>`;
    }).join("")
    : `<tr><td colspan="5" class="empty-cell">${escapeHtml(state.sourceRepositoriesLoading ? "Quellen werden geladen ..." : data.error || "Keine Systemquellen konfiguriert.")}</td></tr>`;
  document.querySelector("#projectRepositoryRows").innerHTML = projectRepositories.length
    ? projectRepositories.map((item) => {
      const reference = item.basissoftware_references?.[0];
      return `<tr><td><strong>${escapeHtml(item.title || item.project_id)}</strong><small>${escapeHtml(item.project_id || "")}</small></td><td>${escapeHtml(item.user_id || "-")}</td><td>${escapeHtml(item.repository ? `${item.repository.organization}/${item.repository.repository_name}` : "-")}<small>${escapeHtml(shortSha(item.repository?.head_sha))}</small></td><td>${reference ? `${escapeHtml(reference.repository_name)}<small>${escapeHtml(shortSha(reference.commit_sha))}</small>` : "-"}</td><td>${formatNumber(item.build_count || 0)}</td><td>${formatNumber(item.artifact_count || 0)}</td><td><span class="status-pill ${item.repository?.state === "active" ? "ok" : "warning"}">${item.repository?.state === "active" ? "Forgejo aktiv" : "Migration offen"}</span></td></tr>`;
    }).join("")
    : `<tr><td colspan="7" class="empty-cell">Keine Projekte vorhanden.</td></tr>`;
  document.querySelector("#repositoryBuildRows").innerHTML = builds.length
    ? builds.map((item) => `<tr><td>${escapeHtml(formatDateTime(item.finished_at || item.created_at))}</td><td><strong>${escapeHtml(item.project_id || "-")}</strong><small>${escapeHtml(item.build_job_id || "")}</small></td><td><code>${escapeHtml(shortSha(item.commit_sha))}</code></td><td><code>${escapeHtml(shortSha(item.package_sha256, 12))}</code></td><td>${formatNumber(item.artifact_count || 0)}</td><td><span class="status-pill ${item.status === "succeeded" ? "ok" : item.status === "failed" ? "error" : "warning"}">${escapeHtml(item.status || "-")}</span></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-cell">Noch keine Builds vorhanden.</td></tr>`;
}

function shortSha(value, length = 10) {
  const normalized = String(value || "");
  return normalized ? normalized.slice(0, length) : "-";
}

async function loadComponentMetamodel() {
  try { state.componentMetamodel = await getJson("/api/admin/component-metamodel"); }
  catch (error) { state.componentMetamodel = { component_types: [], relationship_rules: [], error: error.message }; }
}

function renderResources() {
  const data = state.resources || { policies: [], accounts: [] };
  const policies = data.policies || [];
  const accounts = data.accounts || [];
  document.querySelector("#resourceMetrics").innerHTML = [
    metricCard("Profile", formatNumber(policies.length), "zentral geregelt"),
    metricCard("Accounts", formatNumber(accounts.length), "mit Entwicklungsprojekten"),
    metricCard("Free-Projekte", formatNumber(policies.find((item) => item.plan_id === "free")?.max_projects || 0), "harte Obergrenze"),
    metricCard("Free-Speicher", formatBytes(policies.find((item) => item.plan_id === "free")?.max_storage_bytes || 0), "pro Account"),
  ].join("");
  document.querySelector("#resourcePolicyRows").innerHTML = policies.length ? policies.map((policy) => `<tr data-plan="${escapeHtml(policy.plan_id)}"><td><strong>${escapeHtml(policy.plan_id)}</strong><small>Version ${escapeHtml(policy.policy_version || 1)}</small></td><td><input data-field="max_projects" type="number" min="1" value="${policy.max_projects ?? ""}" placeholder="unbegrenzt" aria-label="Maximale Anzahl Projekte fuer ${escapeHtml(policy.plan_id)}" /></td><td><div class="resource-limit-input"><input data-field="max_storage_bytes" data-display-unit="mib" type="number" min="0" step="any" value="${bytesToMebibytes(policy.max_storage_bytes)}" aria-label="Speicherlimit in MiB fuer ${escapeHtml(policy.plan_id)}" /><span>MiB</span></div></td><td><input data-field="storage_warning_threshold_percent" type="number" min="1" max="100" step="1" value="${escapeHtml(policy.storage_warning_threshold_percent || 80)}" aria-label="Speicherwarnschwelle in Prozent fuer ${escapeHtml(policy.plan_id)}" /></td><td><div class="resource-limit-input"><input data-field="max_monthly_traffic_bytes" data-display-unit="mib" type="number" min="0" step="any" value="${bytesToMebibytes(policy.max_monthly_traffic_bytes)}" aria-label="Monatlicher Traffic in MiB fuer ${escapeHtml(policy.plan_id)}" /><span>MiB</span></div></td><td><input data-field="debug_session_idle_hours" type="number" min="1" step="1" value="${escapeHtml(policy.debug_session_idle_hours || 48)}" aria-label="Debug-Inaktivitätsfrist in Stunden fuer ${escapeHtml(policy.plan_id)}" /></td><td><input data-field="change_reason" type="text" required maxlength="300" placeholder="Warum wird die Policy geaendert?" aria-label="Aenderungsgrund fuer ${escapeHtml(policy.plan_id)}" /></td><td><button type="button">Speichern</button></td></tr>`).join("") : `<tr><td colspan="8" class="empty-cell">${escapeHtml(data.error || "Keine Ressourcenregeln.")}</td></tr>`;
  document.querySelector("#resourceAccountRows").innerHTML = accounts.length ? accounts.map((account) => renderResourceAccountRow(account, policies)).join("") : `<tr><td colspan="7" class="empty-cell">Keine gespeicherten Projekte.</td></tr>`;
  const buildPolicy = data.build_policy || {};
  document.querySelector("#buildResourcePolicy").innerHTML = buildPolicy.available === false
    ? `<p class="empty">Build-Policy nicht verfügbar${buildPolicy.error ? `: ${escapeHtml(buildPolicy.error)}` : "."}</p>`
    : `<p class="resource-limit-help">Quelle: ${escapeHtml(buildPolicy.source || "server_runtime_configuration")} · Cache-TTL: ${formatDuration(buildPolicy.incremental_cache?.ttl_ms)}</p><div class="table-wrap"><table><thead><tr><th>Artefakt</th><th>Klasse</th><th>Aufbewahrung</th><th>Standardbuild</th></tr></thead><tbody>${(buildPolicy.artifacts || []).map((artifact) => `<tr><td>${escapeHtml(artifact.file_name)}</td><td>${escapeHtml(artifact.artifact_class)}</td><td>${formatNumber(artifact.retention_days)} Tage</td><td>${artifact.standard_build ? "ja" : "nur Debug"}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderResourceAccountRow(account, policies) {
  const policy = policies.find((item) => item.plan_id === account.plan_id) || {};
  const limit = policy.max_storage_bytes;
  const used = Math.max(0, Number(account.storage_bytes || 0));
  const threshold = Math.max(1, Math.min(100, Number(policy.storage_warning_threshold_percent || 80)));
  const percent = limit === null || limit === undefined ? null : (used / Math.max(1, Number(limit))) * 100;
  const status = percent === null ? "unbegrenzt" : (percent > 100 ? "über Kontingent" : (percent >= 100 ? "Limit erreicht" : (percent >= threshold ? "Warnung" : "ok")));
  const severity = status === "ok" || status === "unbegrenzt" ? "info" : (status === "Warnung" ? "warning" : "error");
  return `<tr><td>${escapeHtml(account.account_id)}</td><td><strong>${escapeHtml(account.plan_id || "free")}</strong><small>Version ${escapeHtml(policy.policy_version || 1)}</small></td><td>${formatNumber(account.projects)}</td><td>${formatBytes(used)}</td><td>${limit === null || limit === undefined ? "unbegrenzt" : formatBytes(limit)}</td><td>${percent === null ? "–" : `${formatMetric(percent)} %${usageBar(percent)}`}</td><td><span class="severity ${severity}">${escapeHtml(status)}</span></td></tr>`;
}

function formatDuration(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value <= 0) return "nicht verfügbar";
  const days = value / (24 * 60 * 60 * 1000);
  return `${days.toLocaleString("de-DE", { maximumFractionDigits: 2 })} Tage`;
}

async function saveResourcePolicy(event) {
  const button = event.target.closest("button"); if (!button) return;
  const row = button.closest("tr"); const plan = row.dataset.plan; if (!plan) return;
  const reason = row.querySelector('[data-field="change_reason"]')?.value.trim();
  if (!reason) { alert("Bitte begruende die Policy-Aenderung."); return; }
  button.disabled = true;
  try {
    const body = Object.fromEntries([...row.querySelectorAll("input")].map((input) => {
      if (input.dataset.field === "change_reason") return [input.dataset.field, input.value.trim()];
      if (input.dataset.displayUnit === "mib") return [input.dataset.field, mebibytesToBytes(input.value)];
      return [input.dataset.field, input.value === "" ? null : Number(input.value)];
    }));
    await putJson(`/api/admin/resources/policies/${encodeURIComponent(plan)}`, body);
    await loadResources(true);
  } catch (error) { alert(error.message); } finally { button.disabled = false; }
}

function bytesToMebibytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Number((bytes / (1024 * 1024)).toFixed(6));
}

function mebibytesToBytes(value) {
  const mebibytes = Number(value);
  if (!Number.isFinite(mebibytes) || mebibytes <= 0) return null;
  return Math.round(mebibytes * 1024 * 1024);
}

async function loadSystemEvents(force) {
  if (state.systemEventsLoading) return;
  if (state.systemEvents && !force) {
    renderSystemEvents();
    return;
  }
  state.systemEventsLoading = true;
  renderSystemEvents();
  try {
    state.systemEvents = await getJson("/api/admin/system-events?limit=100");
  } catch (error) {
    state.systemEvents = {
      summary: { total: 0, critical: 0, errors: 0, warnings: 0 },
      items: [],
      error: error.message,
    };
  } finally {
    state.systemEventsLoading = false;
    renderSystemEvents();
  }
}

function renderSystemEvents() {
  const metrics = document.querySelector("#systemEventMetrics");
  const rows = document.querySelector("#systemEventRows");
  if (!metrics || !rows) return;
  if (state.systemEventsLoading) {
    metrics.innerHTML = [
      metricCard("Status", "lade", "Ereignisse werden geladen"),
      metricCard("Fehler", "-", "noch offen"),
      metricCard("Warnungen", "-", "noch offen"),
      metricCard("Gesamt", "-", "noch offen"),
    ].join("");
    rows.innerHTML = `<tr><td colspan="5" class="empty-cell">Ereignisse werden geladen.</td></tr>`;
    return;
  }
  if (!state.systemEvents) {
    metrics.innerHTML = [
      metricCard("Status", "offen", "noch nicht geladen"),
      metricCard("Fehler", "-", "keine Daten"),
      metricCard("Warnungen", "-", "keine Daten"),
      metricCard("Gesamt", "-", "keine Daten"),
    ].join("");
    rows.innerHTML = `<tr><td colspan="5" class="empty-cell">Noch keine Ereignisse geladen.</td></tr>`;
    return;
  }
  if (state.systemEvents.error) {
    metrics.innerHTML = [
      metricCard("Status", "Fehler", state.systemEvents.error),
      metricCard("Fehler", "0", "keine Daten"),
      metricCard("Warnungen", "0", "keine Daten"),
      metricCard("Gesamt", "0", "keine Daten"),
    ].join("");
    rows.innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(state.systemEvents.error)}</td></tr>`;
    return;
  }
  const summary = state.systemEvents.summary || {};
  metrics.innerHTML = [
    metricCard("Critical", formatNumber(summary.critical), "sofort pruefen"),
    metricCard("Fehler", formatNumber(summary.errors), "blockierend moeglich"),
    metricCard("Warnungen", formatNumber(summary.warnings), "auffaellig"),
    metricCard("Gesamt", formatNumber(summary.total), "letzte 100 geladen"),
  ].join("");
  rows.innerHTML = renderSystemEventRows(state.systemEvents.items || []);
}

function renderSystemEventRows(items) {
  if (!items.length) return `<tr><td colspan="5" class="empty-cell">Keine Auffaelligkeiten geloggt.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td>${escapeHtml(formatDateTime(item.occurred_at))}</td>
      <td><strong class="severity ${escapeHtml(item.severity || "info")}">${escapeHtml(severityLabel(item.severity))}</strong></td>
      <td><strong>${escapeHtml(item.source_service || "-")}</strong><span>${escapeHtml(item.target_service ? `-> ${item.target_service}` : item.category || "-")}</span></td>
      <td><strong>${escapeHtml(item.message || "-")}</strong><span>${escapeHtml(item.event_type || "-")}</span></td>
      <td><strong>${escapeHtml(item.impact || "-")}</strong>${systemEventContext(item) ? `<span>${escapeHtml(systemEventContext(item))}</span>` : ""}</td>
    </tr>
  `).join("");
}

function systemEventContext(item) {
  const details = item.details || {};
  return [
    details.stage ? `Phase: ${details.stage}` : "",
    details.error_code ? `Fehlercode: ${details.error_code}` : "",
    item.account_id ? `Konto: ${item.account_id}` : "",
    item.correlation_id ? `Korrelation: ${item.correlation_id}` : "",
  ].filter(Boolean).join(" · ");
}

async function loadUserActions(force) {
  if (state.userActionsLoading || (state.userActions && !force)) { renderUserActions(); return; }
  state.userActionsLoading = true;
  renderUserActions();
  try {
    const query = new URLSearchParams({ limit: state.userActionFilter ? "1000" : "500", hours: document.querySelector("#userActionHours")?.value || "24" });
    if (state.userActionFilter) query.set("action_id", state.userActionFilter);
    state.userActions = await getJson(`/api/admin/user-action-events?${query}`);
  } catch (error) {
    state.userActions = { summary: {}, items: [], error: error.message };
  } finally {
    state.userActionsLoading = false;
    renderUserActions();
  }
}

function renderUserActions() {
  const metrics = document.querySelector("#userActionMetrics");
  const typeRows = document.querySelector("#userActionTypeRows");
  const attemptRows = document.querySelector("#userActionAttemptRows");
  if (!metrics || !typeRows || !attemptRows) return;
  if (state.userActionsLoading) {
    metrics.innerHTML = metricCard("Status", "lade", "Wirkketten werden geladen");
    typeRows.innerHTML = `<tr><td colspan="5" class="empty-cell">Nutzeraktionen werden geladen.</td></tr>`;
    attemptRows.innerHTML = `<tr><td colspan="6" class="empty-cell">Nutzeraktionen werden geladen.</td></tr>`;
    return;
  }
  if (!state.userActions || state.userActions.error) {
    const message = state.userActions?.error || "Noch keine Daten geladen.";
    metrics.innerHTML = metricCard("Status", "offen", message);
    typeRows.innerHTML = `<tr><td colspan="5" class="empty-cell">${escapeHtml(message)}</td></tr>`;
    attemptRows.innerHTML = `<tr><td colspan="6" class="empty-cell">${escapeHtml(message)}</td></tr>`;
    renderUserActionTrace();
    return;
  }
  const summary = state.userActions.summary || {};
  metrics.innerHTML = [
    metricCard("Versuche", formatNumber(summary.attempts), "eindeutige Action-IDs"),
    metricCard("Erfolgreich", formatNumber(summary.succeeded), "fachlich abgeschlossen"),
    metricCard("Fehler", formatNumber(summary.failed), "fehlgeschlagen oder Timeout"),
    metricCard("Hängend", formatNumber(summary.hanging), "Zeitbudget überschritten"),
    metricCard("Fehlerquote", `${formatNumber(summary.failure_rate_percent)} %`, `letzte ${formatNumber(summary.hours || 24)} Stunden`),
  ].join("");
  const byType = summary.by_action_type || [];
  typeRows.innerHTML = byType.length ? byType.map((item) => `<tr>
    <td><strong>${escapeHtml(item.action_type)}</strong></td><td>${formatNumber(item.attempts)}</td>
    <td>${formatNumber(item.succeeded)}</td><td>${formatNumber(item.failed)}</td>
    <td>${formatNumber(item.failure_rate_percent)} %</td></tr>`).join("")
    : `<tr><td colspan="5" class="empty-cell">Noch keine instrumentierten Nutzeraktionen.</td></tr>`;
  const attempts = summary.recent_actions || [];
  attemptRows.innerHTML = attempts.length ? attempts.map((item) => `<tr>
    <td>${escapeHtml(formatDateTime(item.last_seen_at))}</td>
    <td><code title="${escapeHtml(item.action_id || "")}">${escapeHtml(shortActionId(item.action_id))}</code></td>
    <td><strong>${escapeHtml(item.action_type)}</strong><span>${escapeHtml(item.release_id || "-")}</span></td>
    <td><strong class="severity ${escapeHtml(item.hanging ? "warning" : actionPhaseClass(item.phase))}">${escapeHtml(item.hanging ? "Hängend" : actionPhaseLabel(item.phase))}</strong>${item.reason_code ? `<span>${escapeHtml(item.reason_code)}</span>` : ""}</td>
    <td>${formatNumber(item.event_count)}<span>${formatNumber(item.span_count)} Spans</span></td>
    <td><button type="button" data-user-action-id="${escapeHtml(item.action_id)}">Öffnen</button></td>
  </tr>`).join("") : `<tr><td colspan="6" class="empty-cell">Keine Wirkketten im gewählten Ausschnitt.</td></tr>`;
  renderUserActionOperations(summary);
  renderUserActionTrace();
}

function renderUserActionOperations(summary) {
  const releases = document.querySelector("#userActionReleaseComparison");
  const reasons = document.querySelector("#userActionReasonCodes");
  if (!releases || !reasons) return;
  const comparisons = summary.release_regressions || [];
  releases.innerHTML = comparisons.length ? comparisons.map((item) => `<article class="action-operation-card ${item.regression ? "error" : ""}">
    <strong>${escapeHtml(item.action_type)}</strong><span>${escapeHtml(item.previous_release_id)} → ${escapeHtml(item.release_id)}</span>
    <p>${formatNumber(item.previous_failure_rate_percent)} % → ${formatNumber(item.failure_rate_percent)} % (${item.delta_percentage_points >= 0 ? "+" : ""}${formatNumber(item.delta_percentage_points)} Prozentpunkte)</p>
  </article>`).join("") : `<p class="empty">Noch keine zwei Releases derselben Aktion im Zeitraum.</p>`;
  const topReasons = (summary.top_reason_codes || []).slice(0, 8);
  reasons.innerHTML = topReasons.length ? topReasons.map((item) => `<article class="action-operation-card">
    <strong>${escapeHtml(item.reason_code || "unknown_client_failure")}</strong><span>${escapeHtml(item.action_type)} · ${escapeHtml(item.release_id || "ohne Release")}</span>
    <p>${formatNumber(item.failures)} fehlgeschlagene Versuche</p>
  </article>`).join("") : `<p class="empty">Keine Fehlergründe im Zeitraum.</p>`;
}

async function loadUserActionIncidents(force) {
  if (state.userActionIncidentsLoading || (state.userActionIncidents && !force)) { renderUserActionIncidents(); return; }
  state.userActionIncidentsLoading = true;
  renderUserActionIncidents();
  try {
    state.userActionIncidents = await getJson("/api/admin/user-action-incidents");
  } catch (error) {
    state.userActionIncidents = { items: [], error: error.message };
  } finally {
    state.userActionIncidentsLoading = false;
    renderUserActionIncidents();
  }
}

function openUserActionIncidentForm() {
  const action = (state.userActions?.summary?.recent_actions || []).find((item) => item.action_id === state.userActionFilter);
  if (!action) return setUserActionIncidentMessage("Bitte zuerst eine konkrete Wirkkette öffnen.", true);
  const form = document.querySelector("#userActionIncidentCreateForm");
  for (const [name, value] of [["action_id", action.action_id], ["action_type", action.action_type], ["reason_code", action.reason_code || "unknown_client_failure"], ["release_id", action.release_id || ""]]) form.elements[name].value = value;
  document.querySelector("#userActionIncidentCreateContext").textContent = `${action.action_type} · ${action.action_id} · ${action.reason_code || "ohne Fehlergrund"}`;
  form.classList.remove("hidden");
  form.elements.owner.focus();
}

function closeUserActionIncidentForm() {
  const form = document.querySelector("#userActionIncidentCreateForm");
  form.reset();
  form.classList.add("hidden");
}

async function createUserActionIncident(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const body = Object.fromEntries(data.entries());
  try {
    await postJson("/api/admin/user-action-incidents", body);
    closeUserActionIncidentForm();
    setUserActionIncidentMessage("Incident wurde angelegt und auditiert.");
    await loadUserActionIncidents(true);
  } catch (error) {
    setUserActionIncidentMessage(error.message, true);
  }
}

async function updateUserActionIncident(event) {
  const form = event.target.closest("form[data-user-action-incident]");
  if (!form) return;
  event.preventDefault();
  const incidentId = form.dataset.userActionIncident;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    await putJson(`/api/admin/user-action-incidents/${encodeURIComponent(incidentId)}`, body);
    setUserActionIncidentMessage("Incident wurde aktualisiert und auditiert.");
    await loadUserActionIncidents(true);
  } catch (error) {
    setUserActionIncidentMessage(error.message, true);
  }
}

function renderUserActionIncidents() {
  const target = document.querySelector("#userActionIncidentRows");
  if (!target) return;
  if (state.userActionIncidentsLoading) { target.innerHTML = `<p class="empty">Incidents werden geladen.</p>`; return; }
  if (state.userActionIncidents?.error) { target.innerHTML = `<p class="error-text">${escapeHtml(state.userActionIncidents.error)}</p>`; return; }
  const items = state.userActionIncidents?.items || [];
  target.innerHTML = items.length ? items.map((item) => `<form class="action-incident-card" data-user-action-incident="${escapeHtml(item.incident_id)}">
    <header><div><strong>${escapeHtml(item.action_type)}</strong><span>${escapeHtml(item.reason_code)} · ${escapeHtml(item.release_id || "ohne Release")}</span></div><code>${escapeHtml(shortActionId(item.action_id))}</code></header>
    <div class="action-incident-fields">
      <label>Status<select name="status">${incidentStatusOptions(item.status)}</select></label>
      <label>Verantwortlich<input name="owner" maxlength="100" value="${escapeHtml(item.owner || "")}" /></label>
      <label>Runbook<input name="runbook_url" maxlength="500" value="${escapeHtml(item.runbook_url || "")}" /></label>
      <label>Behoben in Version<input name="fix_release_id" maxlength="80" value="${escapeHtml(item.fix_release_id || "")}" /></label>
      <label class="wide">Notiz<textarea name="note" maxlength="500" rows="2">${escapeHtml(item.note || "")}</textarea></label>
      <label class="wide">Änderungsgrund<input name="change_reason" maxlength="300" required placeholder="Warum wird der Incident geändert?" /></label>
    </div>
    <footer><span>Aktualisiert ${escapeHtml(formatDateTime(item.updated_at))}</span><button class="primary" type="submit">Änderung speichern</button></footer>
  </form>`).join("") : `<p class="empty">Noch keine Operations-Incidents.</p>`;
}

function incidentStatusOptions(selected) {
  return [["new", "Neu"], ["investigating", "Untersucht"], ["resolved", "Behoben"], ["ignored", "Ignoriert"]]
    .map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
}

function setUserActionIncidentMessage(message, isError = false) {
  const target = document.querySelector("#userActionIncidentMessage");
  target.textContent = message || "";
  target.classList.toggle("error-text", isError);
}

async function loadUserActionAlerts(force) {
  if (state.userActionAlertsLoading || (state.userActionAlerts && !force)) { renderUserActionAlerts(); return; }
  state.userActionAlertsLoading = true;
  renderUserActionAlerts();
  try {
    state.userActionAlerts = await getJson("/api/admin/user-action-alerts");
  } catch (error) {
    state.userActionAlerts = { mode: "observe_only", items: [], error: error.message };
  } finally {
    state.userActionAlertsLoading = false;
    renderUserActionAlerts();
  }
}

async function evaluateUserActionAlerts() {
  const button = document.querySelector("#evaluateUserActionAlertsButton");
  button.disabled = true;
  try {
    const hours = Number(document.querySelector("#userActionHours")?.value || 24);
    const result = await postJson("/api/admin/user-action-alerts/evaluate", { hours });
    setUserActionAlertMessage(`${formatNumber(result.candidates?.length || 0)} Kandidaten im Beobachtungsmodus ausgewertet.`);
    await loadUserActionAlerts(true);
  } catch (error) {
    setUserActionAlertMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function renderUserActionAlerts() {
  const target = document.querySelector("#userActionAlertRows");
  if (!target) return;
  if (state.userActionAlertsLoading) { target.innerHTML = `<p class="empty">Alarmkandidaten werden geladen.</p>`; return; }
  if (state.userActionAlerts?.error) { target.innerHTML = `<p class="error-text">${escapeHtml(state.userActionAlerts.error)}</p>`; return; }
  const items = state.userActionAlerts?.items || [];
  target.innerHTML = items.length ? items.map((item) => `<article class="action-alert-card ${escapeHtml(item.severity)}">
    <header><strong>${escapeHtml(alertKindLabel(item.alert_kind))}</strong><span>${escapeHtml(String(item.severity || "warning").toUpperCase())}</span></header>
    <h3>${escapeHtml(item.action_type)}</h3>
    <p>${escapeHtml(item.reason_code)} · Release ${escapeHtml(item.release_id || "unbekannt")}</p>
    <dl><div><dt>Versuche</dt><dd>${formatNumber(item.attempts)}</dd></div><div><dt>Fehler</dt><dd>${formatNumber(item.failures)}</dd></div><div><dt>Fehlerquote</dt><dd>${formatNumber(item.failure_rate_percent)} %</dd></div><div><dt>Hängend</dt><dd>${formatNumber(item.hanging)}</dd></div></dl>
    <small>${formatNumber(item.window_hours)} h · zuletzt ${escapeHtml(formatDateTime(item.last_seen_at))} · ${item.notification_state === "observe_only" ? "kein Versand" : escapeHtml(item.notification_state)}</small>
  </article>`).join("") : `<p class="empty">Keine persistenten Alarmkandidaten.</p>`;
}

function alertKindLabel(kind) {
  return { failure_rate: "Erhöhte Fehlerquote", hanging: "Hängende Aktionen", release_regression: "Release-Regression" }[kind] || kind || "Auffälligkeit";
}

function setUserActionAlertMessage(message, isError = false) {
  const target = document.querySelector("#userActionAlertMessage");
  target.textContent = message || "";
  target.classList.toggle("error-text", isError);
}

function searchUserAction(event) {
  event.preventDefault();
  const input = document.querySelector("#userActionIdSearch");
  const actionId = String(input?.value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actionId)) {
    setUserActionSearchMessage("Bitte eine vollständige gültige Action-ID eingeben.", true);
    return;
  }
  state.userActionFilter = actionId;
  setUserActionSearchMessage(`Wirkkette ${actionId} wird geladen.`);
  void loadUserActions(true);
}

function clearUserActionSearch() {
  state.userActionFilter = "";
  document.querySelector("#userActionIdSearch").value = "";
  setUserActionSearchMessage("Alle zuletzt erfassten Wirkketten werden angezeigt.");
  void loadUserActions(true);
}

function inspectUserAction(event) {
  const button = event.target.closest("[data-user-action-id]");
  if (!button) return;
  const actionId = button.dataset.userActionId || "";
  state.userActionFilter = actionId;
  document.querySelector("#userActionIdSearch").value = actionId;
  setUserActionSearchMessage(`Wirkkette ${actionId} wird geladen.`);
  void loadUserActions(true);
}

async function copyUserActionId() {
  if (!state.userActionFilter) return;
  try {
    await navigator.clipboard.writeText(state.userActionFilter);
    setUserActionSearchMessage("Action-ID wurde kopiert.");
  } catch {
    setUserActionSearchMessage("Action-ID konnte nicht kopiert werden; sie steht vollständig im Suchfeld.", true);
  }
}

function renderUserActionTrace() {
  const panel = document.querySelector("#userActionTracePanel");
  const metaTarget = document.querySelector("#userActionTraceMeta");
  const timeline = document.querySelector("#userActionTimeline");
  if (!panel || !metaTarget || !timeline) return;
  const summary = state.userActions?.summary || {};
  const action = state.userActionFilter ? (summary.recent_actions || []).find((item) => item.action_id === state.userActionFilter) : null;
  if (!action) {
    panel.classList.add("hidden");
    if (state.userActionFilter && state.userActions && !state.userActions.error && !state.userActionsLoading) {
      setUserActionSearchMessage("Zu dieser Action-ID wurde keine Wirkkette gefunden.", true);
    }
    return;
  }
  panel.classList.remove("hidden");
  const interfaceCalls = state.userActions.interface_calls || [];
  setUserActionSearchMessage(`${formatNumber(action.event_count)} Action-Ereignisse und ${formatNumber(interfaceCalls.length)} korrelierte Schnittstellenaufrufe gefunden.`);
  metaTarget.innerHTML = [
    ["Action-ID", action.action_id], ["Aktion", action.action_type],
    ["Status", actionPhaseLabel(action.phase)], ["Release", action.release_id || "-"],
    ["Route", action.route_id || "-"], ["Fehlergrund", action.reason_code || "-"],
    ["Beginn", formatTraceTime(action.started_at)], ["Letztes Ereignis", formatTraceTime(action.last_seen_at)],
  ].map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  const events = [
    ...(state.userActions.items || []).map((item) => ({ ...item, timeline_kind: "action" })),
    ...interfaceCalls.map((item) => ({ ...item, timeline_kind: "interface" })),
  ].sort((left, right) => String(left.occurred_at).localeCompare(String(right.occurred_at)));
  timeline.innerHTML = events.map((item) => item.timeline_kind === "interface"
    ? `<li class="${item.succeeded ? "ok" : "error"}">
      <div class="action-timeline-head"><time>${escapeHtml(formatTraceTime(item.occurred_at))}</time><strong>Schnittstelle ${item.succeeded ? "erfolgreich" : "fehlgeschlagen"}</strong></div>
      <code>${escapeHtml(item.source_service || "-")} → ${escapeHtml(item.target_service || "-")}</code>
      <p>${escapeHtml(String(item.method || "GET").toUpperCase())} ${escapeHtml(item.route || "/")} · HTTP ${escapeHtml(item.status_code || 0)}</p>
      <small>${formatNumber(item.duration_ms)} ms · ${escapeHtml(item.action_type || action.action_type)}</small>
    </li>`
    : `<li class="${escapeHtml(actionPhaseClass(item.phase))}">
      <div class="action-timeline-head"><time>${escapeHtml(formatTraceTime(item.occurred_at))}</time><strong>${escapeHtml(actionPhaseLabel(item.phase))}</strong></div>
      <code>${escapeHtml(item.span_type || "action")}</code>
      <p>${escapeHtml(item.reason_code || "Kein Fehlergrund")}</p>
      <small>Span ${escapeHtml(shortActionId(item.span_id))}${item.parent_span_id ? ` · Parent ${escapeHtml(shortActionId(item.parent_span_id))}` : ""}${item.duration_bucket ? ` · ${escapeHtml(item.duration_bucket)}` : ""}</small>
    </li>`).join("");
}

function setUserActionSearchMessage(message, isError = false) {
  const target = document.querySelector("#userActionSearchMessage");
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("error-text", isError);
}

function shortActionId(value) {
  const text = String(value || "");
  return text.length > 13 ? `${text.slice(0, 13)}…` : text || "-";
}

function actionPhaseLabel(phase) {
  return { triggered: "Ausgelöst", started: "Gestartet", succeeded: "Erfolgreich", failed: "Fehlgeschlagen", timed_out: "Timeout", unhandled: "Ohne Handler" }[phase] || phase || "Offen";
}

function actionPhaseClass(phase) {
  if (phase === "succeeded") return "ok";
  if (["failed", "unhandled"].includes(phase)) return "error";
  if (phase === "timed_out") return "warning";
  return "info";
}

function formatTraceTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium" });
}

function severityLabel(value) {
  return {
    critical: "Critical",
    error: "Fehler",
    warning: "Warnung",
    info: "Info",
    debug: "Debug",
  }[value] || value || "Info";
}

async function loadMonitoring(force) {
  if (state.monitoringLoading) return;
  if (state.monitoring && !force) {
    renderMonitoring();
    return;
  }
  state.monitoringLoading = true;
  renderMonitoring();
  try {
    const result = await getJson("/api/admin/monitoring");
    state.monitoring = result || null;
  } catch (error) {
    state.monitoring = {
      summary: { total: 0, online: 0, offline: 0 },
      services: [],
      error: error.message,
    };
  } finally {
    state.monitoringLoading = false;
    renderMonitoring();
  }
}

async function loadSyntheticChecks(force) {
  if (state.syntheticChecksLoading) return;
  if (state.syntheticChecks && !force) {
    renderSyntheticChecks();
    return;
  }
  state.syntheticChecksLoading = true;
  renderSyntheticChecks();
  try {
    state.syntheticChecks = await getJson("/api/admin/synthetic-checks?limit=200");
  } catch (error) {
    state.syntheticChecks = { summary: { total: 0, passed: 0, failed: 0, skipped: 0 }, items: [], error: error.message };
  } finally {
    state.syntheticChecksLoading = false;
    renderSyntheticChecks();
  }
}

async function runSyntheticChecks() {
  if (state.syntheticChecksLoading) return;
  state.syntheticChecksLoading = true;
  renderSyntheticChecks("Die vier read-only Vorpruefungen laufen …");
  try {
    state.syntheticChecks = await postJson("/api/admin/synthetic-checks/run", {});
    const summary = state.syntheticChecks.summary || {};
    renderSyntheticChecks(`${formatNumber(summary.passed)}/${formatNumber(summary.total)} Pruefungen bestanden.`);
  } catch (error) {
    renderSyntheticChecks(error.message || "Synthetische Pruefung fehlgeschlagen.");
  } finally {
    state.syntheticChecksLoading = false;
    renderSyntheticChecks();
  }
}

function renderSyntheticChecks(message = "") {
  const list = document.querySelector("#syntheticCheckList");
  const status = document.querySelector("#syntheticChecksStatus");
  const runButton = document.querySelector("#runSyntheticChecksButton");
  if (!list || !status || !runButton) return;
  runButton.disabled = state.syntheticChecksLoading;
  if (message) status.textContent = message;
  else if (state.syntheticChecks?.error) status.textContent = state.syntheticChecks.error;
  else if (state.syntheticChecks?.latest_run_id) status.textContent = `Letzter Lauf ${formatDateTime(state.syntheticChecks.items?.[0]?.checked_at)}.`;
  else status.textContent = "Noch kein synthetischer Lauf gespeichert.";
  if (state.syntheticChecksLoading && !state.syntheticChecks) {
    list.innerHTML = `<p class="empty">Vorpruefungen werden geladen.</p>`;
    return;
  }
  const items = state.syntheticChecks?.items || [];
  list.innerHTML = items.length ? items.map(syntheticCheckCard).join("") : `<p class="empty">Noch keine Pruefergebnisse.</p>`;
}

function syntheticCheckCard(item) {
  const statusClass = item.status === "passed" ? "ok" : item.status === "skipped" ? "warning" : "error";
  const statusText = item.status === "passed" ? "bestanden" : item.status === "skipped" ? "uebersprungen" : "fehlgeschlagen";
  return `
    <article class="monitoring-card ${statusClass}">
      <div class="monitoring-card-head">
        <div><p class="eyebrow">${escapeHtml(item.check_id)}</p><h2>${escapeHtml(item.title || item.check_id)}</h2></div>
        <span class="status-pill ${statusClass}">${statusText}</span>
      </div>
      <dl class="meta-list">
        ${meta(["Zieldienst", item.target_service || "-"])}
        ${meta(["Route", item.route || "-"])}
        ${meta(["HTTP", item.http_status ?? "-"])}
        ${meta(["Antwortzeit", `${formatNumber(item.response_ms || 0)} ms`])}
        ${meta(["Ergebnis", item.reason_code || "-"])}
      </dl>
    </article>
  `;
}

function renderMonitoring() {
  const metrics = document.querySelector("#monitoringMetrics");
  const list = document.querySelector("#monitoringServiceList");
  if (!metrics || !list) return;
  if (state.monitoringLoading) {
    metrics.innerHTML = [
      metricCard("Status", "pruefe", "Healthchecks laufen"),
      metricCard("Online", "-", "noch offen"),
      metricCard("Offline", "-", "noch offen"),
      metricCard("Dienste", "-", "konfiguriert"),
    ].join("");
    list.innerHTML = `<p class="empty">Status wird abgefragt.</p>`;
    return;
  }
  if (!state.monitoring) {
    metrics.innerHTML = [
      metricCard("Status", "offen", "noch nicht geprueft"),
      metricCard("Online", "-", "keine Daten"),
      metricCard("Offline", "-", "keine Daten"),
      metricCard("Dienste", "-", "keine Daten"),
    ].join("");
    list.innerHTML = `<p class="empty">Oeffne Monitoring oder klicke auf Status aktualisieren.</p>`;
    return;
  }
  if (state.monitoring.error) {
    metrics.innerHTML = [
      metricCard("Status", "Fehler", state.monitoring.error),
      metricCard("Online", "0", "keine Daten"),
      metricCard("Offline", "0", "keine Daten"),
      metricCard("Dienste", "0", "keine Daten"),
    ].join("");
    list.innerHTML = `<p class="empty">${escapeHtml(state.monitoring.error)}</p>`;
    return;
  }
  const summary = state.monitoring.summary || {};
  metrics.innerHTML = [
    metricCard("Status", `${formatNumber(summary.online)}/${formatNumber(summary.total)}`, "Dienste online"),
    metricCard("Online", formatNumber(summary.online), "erreichbar"),
    metricCard("Offline", formatNumber(summary.offline), "nicht erreichbar"),
    metricCard("Letzte Pruefung", formatDateTime(state.monitoring.checked_at), "Healthcheck"),
  ].join("");
  const services = state.monitoring.services || [];
  list.innerHTML = services.length ? services.map(monitoringCard).join("") : `<p class="empty">Keine Dienste konfiguriert.</p>`;
}

function monitoringCard(service) {
  const statusClass = service.ok ? "ok" : "error";
  const statusText = service.ok ? "online" : "offline";
  const responseTime = Number.isFinite(service.response_ms) ? `${service.response_ms} ms` : "-";
  const operations = service.operations || null;
  const communityMetrics = service.service_id === "community_platform" && operations ? `
    <div class="monitoring-detail-grid" aria-label="Community-Speicherstatus">
      ${monitoringDetail("Fragen", operations.questions?.total)}
      ${monitoringDetail("Öffentlich", operations.questions?.public)}
      ${monitoringDetail("Privat", operations.questions?.private)}
      ${monitoringDetail("Offen", operations.questions?.open)}
      ${monitoringDetail("Antworten", operations.answers?.total)}
      ${monitoringDetail("Wissensdokumente", operations.knowledge_documents?.total)}
    </div>
  ` : "";
  return `
    <article class="monitoring-card ${statusClass}">
      <div class="monitoring-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(service.service_id)}</p>
          <h2>${escapeHtml(service.title || service.service_id)}</h2>
        </div>
        <span class="status-pill ${statusClass}">${statusText}</span>
      </div>
      <dl class="meta-list">
        ${meta(["Basis-URL", service.base_url || "-"])}
        ${meta(["Health", service.health_url || "-"])}
        ${meta(["Antwortzeit", responseTime])}
        ${meta(["Status", service.message || statusText])}
        ${operations ? meta(["Persistenz", operations.persistence_backend || "-"]) : ""}
      </dl>
      ${communityMetrics}
      ${service.operations_error ? `<p class="monitoring-detail-error">${escapeHtml(service.operations_error)}</p>` : ""}
    </article>
  `;
}

function monitoringDetail(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${formatNumber(value || 0)}</strong></div>`;
}

function renderAccounts() {
  const accounts = state.accounts || [];
  const limited = accounts.flatMap((account) => account.ai_rating?.sources || []).filter((source) => !source.unlimited);
  const maxUsage = limited.length ? Math.max(...limited.map((source) => Number(source.used_percent || 0))) : 0;
  const blocked = accounts.filter((account) => account.blocked).length;
  document.querySelector("#accountMetrics").innerHTML = [
    metricCard("Accounts", formatNumber(accounts.length), `${formatNumber(blocked)} blockiert`),
    metricCard("Max. KI Nutzung", `${formatMetric(maxUsage)} %`, "hoechstes Quellenlimit"),
    metricCard("GPT Limit", "100.000", "Tokens pro Monat"),
    metricCard("Lokale LLM", "unbegrenzt", "keine externen Providerkosten"),
  ].join("");
  document.querySelector("#accountRows").innerHTML = renderAccountRows(accounts);
}

function renderStatistics() {
  const overview = state.overview || {};
  const devices = overview.devices || {};
  const feedback = overview.feedback || {};
  const auditEvents = overview.audit_events || {};
  const aiUsage = overview.ai_usage || {};
  document.querySelector("#statisticsMetrics").innerHTML = [
    metricCard("Devices", formatNumber(devices.total), `${formatNumber(devices.online)} online`),
    metricCard("GerNetiX Verified", formatNumber(devices.gernetix_verified), `${formatNumber(devices.community_unverified)} Community`),
    metricCard("Feedback", formatNumber(feedback.total), `${formatNumber(feedback.new)} neu`),
    metricCard("Audit Events", formatNumber(auditEvents.total), "Admin-/Support-Zugriffe"),
  ].join("");
  document.querySelector("#serviceStatistics").innerHTML = [
    summaryItem("Device Management", `${formatNumber(devices.total)} Devices, ${formatNumber(devices.online)} online`),
    summaryItem("Learning Feedback", `${formatNumber(feedback.total)} Eintraege, ${formatNumber(feedback.new)} neu`),
    summaryItem("Customer Data Access", `${formatNumber(auditEvents.total)} Audit Events`),
  ].join("");
  document.querySelector("#statisticsAiUsage").innerHTML = [
    summaryItem("Anfragen", `${formatNumber(aiUsage.total_events)} gesamt, ${formatNumber(aiUsage.rejected)} abgelehnt`),
    summaryItem("Tokens", formatNumber(aiUsage.tokens)),
    summaryItem("Credits", formatNumber(aiUsage.credits)),
    summaryItem("Externe Kosten", formatCurrency(aiUsage.estimated_provider_cost)),
  ].join("");
}

function renderAiUsage() {
  const summary = state.aiUsage || {};
  const local = summary.local || {};
  const external = summary.external || {};
  const policy = summary.cost_control || {};
  document.querySelector("#aiUsageMetrics").innerHTML = [
    metricCard("LLM-Anfragen", formatNumber(summary.total_events), `${formatNumber(summary.successful)} erfolgreich`),
    metricCard("Lokale LLM", formatNumber(local.total_events), `${formatNumber(local.tokens)} Tokens`),
    metricCard("Oeffentliche LLM", formatNumber(external.total_events), `${formatCurrency(external.estimated_provider_cost)} Kosten`),
    metricCard("Abgelehnt", formatNumber(summary.rejected), "Credits, Limits oder Policy"),
  ].join("");
  renderAiCostByDayChart(summary.cost_by_day || []);
  renderAiCostControlPolicy(policy);
  document.querySelector("#aiCostControlRuleRows").innerHTML = renderAiCostControlRuleRows(policy.rules || [], summary.rejection_breakdown || []);
  document.querySelector("#aiRejectionReasonRows").innerHTML = renderAiRejectionReasonRows(summary.rejection_breakdown || []);
  document.querySelector("#aiRecentRejectionRows").innerHTML = renderAiRecentRejectionRows(summary.recent_rejections || []);
  document.querySelector("#aiSourceLimitRows").innerHTML = renderAiSourceLimitRows(policy.source_ratings || []);
  document.querySelector("#aiModelPolicyRows").innerHTML = renderAiModelPolicyRows(policy.model_pricing || []);
  document.querySelector("#aiProviderRows").innerHTML = renderProviderRows(summary.provider_breakdown || []);
  document.querySelector("#aiModelRows").innerHTML = renderModelRows(summary.model_breakdown || []);
}

function renderAiCostControlPolicy(policy) {
  setValue("#aiDailyTokenCreditLimit", policy.daily_token_limit ?? policy.daily_credit_limit ?? "");
  setValue("#aiMonthlyTokenCreditLimit", policy.monthly_token_limit ?? policy.monthly_credit_limit ?? "");
  document.querySelector("#aiCostControlPolicy").innerHTML = [
    ["Kill-Switch", policy.global_kill_switch ? "an" : "aus"],
    ["Bewertung", "1 Credit = 1 Token"],
    ["Tageslimit", formatLimit(policy.daily_token_limit ?? policy.daily_credit_limit, "Tokens/Credits")],
    ["Monatslimit", formatLimit(policy.monthly_token_limit ?? policy.monthly_credit_limit, "Tokens/Credits")],
    ["Prompt-Limit", formatLimit(policy.max_prompt_tokens, "Tokens")],
    ["Antwort-Limit", formatLimit(policy.max_response_tokens, "Tokens")],
    ["Warnschwelle", formatLimit(policy.budget_warning_threshold_percent, "%")],
    ["Erlaubte Modelle", formatNumber((policy.allowed_models || []).length)],
    ["Premium-Modelle", formatNumber((policy.premium_models || []).length)],
  ].map(meta).join("");
}

function renderAiCostByDayChart(items) {
  const target = document.querySelector("#aiCostByDayChart");
  if (!target) return;
  const days = normalizeCostDays(items).slice(-14);
  const maxCost = Math.max(...days.map((item) => Number(item.estimated_provider_cost || 0)), 0);
  const totalCost = days.reduce((sum, item) => sum + Number(item.estimated_provider_cost || 0), 0);
  if (!days.length || maxCost <= 0) {
    target.innerHTML = `<div class="chart-empty">Keine externen KI-Kosten im Zeitraum.</div>`;
    return;
  }
  target.innerHTML = `
    <div class="bar-chart-plot">
      ${days.map((item) => {
        const cost = Number(item.estimated_provider_cost || 0);
        const height = Math.max(4, Math.round((cost / maxCost) * 100));
        return `
          <div class="bar-chart-item" title="${escapeHtml(`${formatChartDay(item.day)}: ${formatCurrency(cost)} bei ${formatNumber(item.total_events)} Aufrufen`)}">
            <span class="bar-value">${escapeHtml(formatCurrency(cost))}</span>
            <i style="height:${height}%"></i>
            <span class="bar-label">${escapeHtml(formatShortDay(item.day))}</span>
          </div>
        `;
      }).join("")}
    </div>
    <div class="chart-summary">
      <strong>${escapeHtml(formatCurrency(totalCost))}</strong>
      <span>${escapeHtml(`${formatNumber(days.reduce((sum, item) => sum + Number(item.total_events || 0), 0))} Aufrufe im angezeigten Zeitraum`)}</span>
    </div>
  `;
}

function renderAiContext() {
  const summary = state.aiContext || {};
  const audit = summary.audit_summary || {};
  document.querySelector("#aiContextMetrics").innerHTML = [
    metricCard("Aktive Grants", formatNumber(summary.active_grants), `${formatNumber(summary.total_grants)} gesamt`),
    metricCard("Externe Freigaben", formatNumber(summary.external_grants), summary.customer_data_external_blocked ? "Kundendaten blockiert" : "Kundendaten extern erlaubt"),
    metricCard("Audit Entscheide", formatNumber(audit.total_events), `${formatNumber(audit.denied)} abgelehnt`),
    metricCard("Service", summary.service_available ? "aktiv" : "offline", "AI Context Server"),
  ].join("");
  renderAiContextStatus(summary);
  renderAiContextPolicy(summary.policy || {});
  document.querySelector("#aiContextSourceRows").innerHTML = renderAiContextSourceRows(summary.source_breakdown || []);
  document.querySelector("#aiContextGrantRows").innerHTML = renderAiContextGrantRows(summary.grants || []);
  document.querySelector("#aiContextAuditRows").innerHTML = renderAiContextAuditRows(summary.recent_audit_events || []);
  document.querySelector("#aiContextRegistryRows").innerHTML = renderAiContextRegistryRows(summary.source_registry || []);
  document.querySelector("#aiPromptFoundationRows").innerHTML = renderAiPromptFoundationRows(summary.prompt_foundations || []);
  renderAiContextSqlite(summary.sqlite || {});
  renderAiContextContentSources(summary.content_sources || {});
}

function renderAiClarifications() {
  const result = state.aiClarifications || {};
  const summary = result.summary || {};
  const rows = document.querySelector("#aiClarificationRows");
  if (!rows) return;
  document.querySelector("#aiClarificationMetrics").innerHTML = [
    metricCard("Offen", formatNumber(summary.open), `${formatNumber(summary.total)} gesamt`),
    metricCard("Dringend", formatNumber(summary.urgent), "sofort pruefen"),
    metricCard("Geklaert", formatNumber(summary.resolved), "als Beispiele nutzbar"),
    metricCard("Angezeigt", formatNumber((result.items || []).length), "nach Filter"),
  ].join("");
  const status = document.querySelector("#aiClarificationStatus");
  if (state.aiClarificationsLoading) {
    status.className = "flash-status running";
    status.textContent = "Klaerfaelle werden geladen.";
  } else if (result.error) {
    status.className = "flash-status error";
    status.textContent = result.error;
  } else {
    status.className = "flash-status hidden";
    status.textContent = "";
  }
  rows.innerHTML = (result.items || []).length
    ? result.items.map(renderAiClarificationRow).join("")
    : `<tr><td colspan="5" class="empty-cell">Keine Klaerfaelle fuer diesen Filter.</td></tr>`;
}

function renderAiHelpKnowledge() {
  const result = state.aiHelpKnowledge || {};
  const rows = document.querySelector("#aiHelpKnowledgeRows");
  const status = document.querySelector("#aiHelpKnowledgeStatus");
  if (!rows || !status) return;
  if (state.aiHelpKnowledgeLoading) {
    status.className = "flash-status running";
    status.textContent = "Help-Wissen wird geladen.";
  } else if (result.error) {
    status.className = "flash-status error";
    status.textContent = result.error;
  } else {
    status.className = "flash-status hidden";
    status.textContent = "";
  }
  rows.innerHTML = (result.items || []).length
    ? result.items.map((item) => `<tr><td><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.article_id)}</span></td><td>${escapeHtml(item.help_topic_id)}</td><td>${escapeHtml(item.status)}</td><td><button type="button" data-edit-help-article="${escapeHtml(item.article_id)}">Bearbeiten</button></td></tr>`).join("")
    : '<tr><td colspan="4" class="empty-cell">Noch kein kuratiertes Help-Wissen vorhanden.</td></tr>';
}

function renderEmailConfig() {
  const config = state.emailConfig || {};
  setValue("#adminEmailHost", config.host || "smtp.ionos.de");
  setValue("#adminEmailPort", config.port || 465);
  setValue("#adminEmailUsername", config.username || "");
  setValue("#adminEmailFromAddress", config.from_address || "");
  setValue("#adminEmailReplyTo", config.reply_to || "");
  setValue("#adminSecurityAlertRecipient", config.security_alert_recipient || "");
  document.querySelector("#adminEmailSecure").checked = config.secure !== false;
  document.querySelector("#adminEmailConfigSummary").innerHTML = [
    ["Verschluesselung", config.encryption_ready ? "bereit" : "Server-Schluessel fehlt"],
    ["SMTP-Zugang", config.configured ? "konfiguriert" : "nicht konfiguriert"],
    ["Absender", config.from_address || "nicht gesetzt"],
    ["Letzte Aenderung", config.updated_at ? formatDateTime(config.updated_at) : "-"],
  ].map(meta).join("");
  if (config.error) setEmailConfigStatus("error", config.error);
}

async function saveEmailConfig(event) {
  event.preventDefault();
  const password = value("#adminEmailPassword");
  const payload = {
    host: value("#adminEmailHost").trim(),
    port: Number(value("#adminEmailPort")),
    username: value("#adminEmailUsername").trim(),
    from_address: value("#adminEmailFromAddress").trim(),
    reply_to: value("#adminEmailReplyTo").trim(),
    security_alert_recipient: value("#adminSecurityAlertRecipient").trim(),
    secure: document.querySelector("#adminEmailSecure").checked,
  };
  if (password) payload.password = password;
  setEmailConfigStatus("running", "SMTP-Konfiguration wird verschluesselt gespeichert...");
  try {
    const result = await putJson("/api/admin/email-config", payload);
    state.emailConfig = result.config;
    document.querySelector("#adminEmailPassword").value = "";
    renderEmailConfig();
    setEmailConfigStatus("ok", "SMTP-Konfiguration gespeichert. Bitte anschliessend die Verbindung testen.");
  } catch (error) {
    setEmailConfigStatus("error", error.message);
  }
}

async function testEmailConfig() {
  setEmailConfigStatus("running", "IONOS SMTP-Verbindung wird getestet...");
  try {
    const result = await postJson("/api/admin/email-config/test", {});
    state.emailConfig = result.config || state.emailConfig;
    renderEmailConfig();
    setEmailConfigStatus("ok", "Verbindung zu IONOS SMTP erfolgreich.");
  } catch (error) {
    setEmailConfigStatus("error", error.message);
  }
}

function setEmailConfigStatus(kind, text) {
  const status = document.querySelector("#adminEmailConfigStatus");
  status.className = `flash-status ${kind}`;
  status.textContent = text;
}

function editAiHelpKnowledge(event) {
  const articleId = event.target.closest("[data-edit-help-article]")?.dataset.editHelpArticle;
  if (!articleId) return;
  const item = (state.aiHelpKnowledge?.items || []).find((article) => article.article_id === articleId);
  if (!item) return;
  document.querySelector("#aiHelpArticleId").value = item.article_id || "";
  document.querySelector("#aiHelpTopicId").value = item.help_topic_id || "";
  document.querySelector("#aiHelpArticleTitle").value = item.title || "";
  document.querySelector("#aiHelpArticleSummary").value = item.summary || "";
  document.querySelector("#aiHelpArticleContent").value = item.content || "";
  document.querySelector("#aiHelpArticleStatus").value = item.status || "active";
  document.querySelector("#aiHelpArticleTitle").focus();
}

async function saveAiHelpKnowledge(event) {
  event.preventDefault();
  const status = document.querySelector("#aiHelpKnowledgeStatus");
  status.className = "flash-status running";
  status.textContent = "Help-Wissen wird gespeichert und für die OpenAI-Suche eingebettet.";
  try {
    await postJson("/api/admin/ai-help-articles", {
      article_id: value("#aiHelpArticleId").trim(),
      help_topic_id: value("#aiHelpTopicId").trim(),
      title: value("#aiHelpArticleTitle").trim(),
      summary: value("#aiHelpArticleSummary").trim(),
      content: value("#aiHelpArticleContent").trim(),
      status: value("#aiHelpArticleStatus"),
    });
    state.aiHelpKnowledge = null;
    await loadAiHelpKnowledge(true);
    status.className = "flash-status ok";
    status.textContent = "Help-Wissen gespeichert.";
  } catch (error) {
    status.className = "flash-status error";
    status.textContent = error.message;
  }
}

function renderAiClarificationRow(item) {
  const resolved = item.status === "resolved";
  return `
    <tr data-clarification-case-id="${escapeHtml(item.case_id)}">
      <td><strong class="severity ${escapeHtml(clarificationPrioritySeverity(item.priority))}">${escapeHtml(clarificationPriorityLabel(item.priority))}</strong><span>Score ${formatNumber(item.priority_score)}</span></td>
      <td><strong>${escapeHtml(item.utterance || "-")}</strong><span>${escapeHtml(item.ambiguity_reason || "-")} · zuletzt ${escapeHtml(formatDateTime(item.last_seen_at))}</span></td>
      <td>
        <input class="clarification-intent-input" value="${escapeHtml(item.resolution?.intent || item.suggested_intent || "")}" aria-label="Intent">
        <input class="clarification-entity-input" value="${escapeHtml(item.resolution?.entity || item.suggested_entity || "")}" aria-label="Ziel">
      </td>
      <td><strong>${escapeHtml(`${Math.round(Number(item.semantic_score || 0) * 100)} % Konfidenz`)}</strong><span>${formatNumber(item.occurrence_count)} Vorkommen · ${formatNumber(item.correction_count)} Korrekturen</span></td>
      <td>
        <div class="clarification-actions">
          <select class="clarification-action-select" aria-label="Entscheidung">
            ${resolved ? `<option value="reopen">Wieder oeffnen</option>` : `
              <option value="confirm">Bestaetigen</option>
              <option value="correct">Korrigieren</option>
              <option value="defer">Zurueckstellen</option>
              <option value="ignore">Ignorieren</option>
              <option value="prioritize">Prioritaet setzen</option>`}
          </select>
          <select class="clarification-scope-select" aria-label="Gueltigkeitsbereich" ${resolved ? "disabled" : ""}>
            <option value="global">Allgemein</option>
            <option value="account">Nur Account</option>
          </select>
          <select class="clarification-priority-select" aria-label="Prioritaet" ${resolved ? "disabled" : ""}>
            ${["urgent","high","normal","low"].map((priority) => `<option value="${priority}" ${item.priority===priority?"selected":""}>${clarificationPriorityLabel(priority)}</option>`).join("")}
          </select>
          <button type="button" class="primary" data-apply-clarification>Anwenden</button>
        </div>
      </td>
    </tr>`;
}

async function handleAiClarificationAction(event) {
  const button = event.target.closest("[data-apply-clarification]");
  if (!button) return;
  const row = button.closest("[data-clarification-case-id]");
  const caseId = row?.dataset.clarificationCaseId;
  if (!caseId) return;
  button.disabled = true;
  try {
    await postJson(`/api/admin/ai-clarification-cases/${encodeURIComponent(caseId)}/actions`, {
      action: row.querySelector(".clarification-action-select").value,
      intent: row.querySelector(".clarification-intent-input").value.trim(),
      entity: row.querySelector(".clarification-entity-input").value.trim(),
      scope: row.querySelector(".clarification-scope-select").value,
      priority: row.querySelector(".clarification-priority-select").value,
      promote: true,
    });
    state.aiClarifications = null;
    await loadAiClarifications(true);
  } catch (error) {
    const status = document.querySelector("#aiClarificationStatus");
    status.className = "flash-status error";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function clarificationPrioritySeverity(priority) { return priority === "urgent" ? "error" : priority === "high" ? "warning" : "info"; }
function clarificationPriorityLabel(priority) { return ({urgent:"Dringend",high:"Hoch",normal:"Normal",low:"Niedrig"})[priority] || priority || "-"; }

function renderAiContextStatus(summary) {
  const target = document.querySelector("#aiContextStatus");
  if (!summary.service_available) {
    target.className = "flash-status error";
    target.textContent = `AI Context Server nicht erreichbar: ${summary.error || "keine Verbindung"}`;
    return;
  }
  target.className = "flash-status ok";
  target.textContent = "Kontext-Policy und Grants werden aus dem AI Context Server gelesen.";
}

function renderAiContextPolicy(policy) {
  document.querySelector("#aiContextPolicy").innerHTML = [
    ["Deny-by-default", policy.deny_without_grant ? "aktiv" : "aus"],
    ["Expliziter Scope", policy.require_explicit_source_scope ? "erforderlich" : "optional"],
    ["Kundendaten extern", policy.allow_external_provider_customer_data ? "erlaubt" : "blockiert"],
    ["Default-Kontext", formatNumber(policy.default_max_context_items)],
    ["Geschuetzte Quellen", (policy.protected_source_types || []).join(", ") || "-"],
  ].map(meta).join("");
}

function renderAiContextSqlite(sqlite) {
  document.querySelector("#aiContextSqliteMeta").innerHTML = [
    ["Status", sqlite.available ? "verbunden" : "nicht verfuegbar"],
    ["Datei", sqlite.db_path || "-"],
    ["Service", sqlite.service_key || "-"],
    ["Schema", formatNumber(sqlite.schema_version)],
    ["Collections", formatNumber((sqlite.service_documents || []).length)],
  ].map(meta).join("");
  document.querySelector("#aiContextSqliteRows").innerHTML = renderAiContextSqliteRows(sqlite.tables || []);
  document.querySelector("#aiContextSqliteContentRows").innerHTML = renderAiContextSqliteContentRows(sqlite.tables || []);
}

function renderAiContextContentSources(content) {
  const source = (content.sources || [])[0] || {};
  document.querySelector("#aiContextContentMeta").innerHTML = [
    ["Status", content.available ? "verbunden" : "nicht verfuegbar"],
    ["Quelle", source.title || "Hardware Catalog"],
    ["ProcessorBoards", formatNumber(source.total_processor_boards)],
    ["ESP32 Boards", formatNumber(source.esp32_processor_boards)],
    ["Capabilities", formatNumber(source.total_capabilities)],
  ].map(meta).join("");
  document.querySelector("#aiContextBoardRows").innerHTML = renderAiContextBoardRows(content.esp32_boards || []);
}

function renderForm() {
  const config = state.llm || {};
  setValue("#adminLlmProvider", config.provider || "api");
  setValue("#adminOllamaBaseUrl", config.ollamaBaseUrl || "http://127.0.0.1:11434");
  setValue("#adminOllamaModel", config.ollamaModel || config.model || "llama3.2:3b");
  setValue("#adminApiProvider", config.apiProvider || "openai-responses");
  setValue("#adminApiBaseUrl", config.apiBaseUrl || "https://api.openai.com/v1");
  setValue("#adminApiModel", config.apiModel || "gpt-5-nano");
  setValue("#adminApiKey", "");
  setValue("#adminRouteGeneralChat", routeProvider(config, "general_chat", "default"));
  setValue("#adminRouteArchitectureDiscovery", routeProvider(config, "architecture_discovery", "default"));
  setValue("#adminRouteHardwareLab", routeProvider(config, "hardware_lab_analysis", "api"));
  setValue("#adminRouteArtifactGeneration", routeProvider(config, "artifact_generation", "api"));
  setValue("#adminRouteCodeGeneration", routeProvider(config, "code_generation", "api"));
  setValue("#adminRouteHelpChat", routeProvider(config, "help_chat", "api"));
  renderLocalModelOptions(config.ollamaModel || config.model || "");
  renderApiModelOptions(config.apiModel || "");
}

function renderLocalModelOptions(currentModel) {
  const target = document.querySelector("#adminLocalModelOptions");
  target.innerHTML = state.localModels.length ? state.localModels.map((model) => `
    <button type="button" data-local-llm-model="${escapeHtml(model.name)}">${escapeHtml(model.name)}</button>
  `).join("") : `<p class="empty">${escapeHtml(state.modelError || "Keine lokalen Modelle gefunden.")}</p>`;
  target.querySelectorAll("[data-local-llm-model]").forEach((button) => {
    button.classList.toggle("active-method", button.dataset.localLlmModel === currentModel);
    button.addEventListener("click", () => {
      setValue("#adminOllamaModel", button.dataset.localLlmModel);
      renderLocalModelOptions(button.dataset.localLlmModel);
    });
  });
}

function renderApiModelOptions(currentModel) {
  const select = document.querySelector("#adminApiModel");
  const discovered = state.apiModels.map((item) => item.model || item.name).filter(Boolean);
  const models = [...new Set([currentModel, ...discovered].filter(Boolean))];
  select.innerHTML = models.length
    ? models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("")
    : `<option value="">Keine API-Modelle verfügbar</option>`;
  select.value = models.includes(currentModel) ? currentModel : (models[0] || "");
  document.querySelector("#adminApiModelStatus").textContent = state.apiModelError || (discovered.length ? `${discovered.length} Modelle vom Provider geladen.` : "Keine Modelle geladen. API-Konfiguration zuerst speichern.");
}

function renderStatus() {
  const config = state.llm || {};
  document.querySelector("#adminLlmStatus").innerHTML = [
    ["Provider", activeProviderLabel(config)],
    ["Aktives Modell", config.model || config.ollamaModel || config.apiModel || "nicht gesetzt"],
    ["Endpoint", config.baseUrl || config.ollamaBaseUrl || config.apiBaseUrl || "nicht gesetzt"],
    ["API Key", config.hasApiKey ? "gesetzt" : "nicht gesetzt"],
    ["Chat-Route", routeLabel(routeProvider(config, "general_chat", "default"))],
    ["Architektur-Route", routeLabel(routeProvider(config, "architecture_discovery", "default"))],
    ["Artefakt-Route", routeLabel(routeProvider(config, "artifact_generation", "api"))],
    ["Code-Route", routeLabel(routeProvider(config, "code_generation", "api"))],
    ["Help-Route", "OpenAI API mit Usage-Preflight"],
  ].map(meta).join("");
}

function renderProviderFields() {
  const provider = document.querySelector("#adminLlmProvider").value || "api";
  document.querySelector("#adminOllamaFields").classList.toggle("hidden", provider !== "ollama");
  document.querySelector("#adminApiFields").classList.toggle("hidden", provider !== "api");
  const apiProvider = value("#adminApiProvider") || "openai-responses";
  const baseUrlInput = document.querySelector("#adminApiBaseUrl");
  baseUrlInput.readOnly = apiProvider !== "openai-compatible";
  baseUrlInput.placeholder = apiProvider === "openai-compatible" ? "https://dein-provider.example/v1" : "";
}

async function applyApiProviderPreset() {
  const apiProvider = value("#adminApiProvider") || "openai-compatible";
  const preset = API_PRESETS[apiProvider] || API_PRESETS["openai-compatible"];
  setValue("#adminApiBaseUrl", preset.baseUrl);
  renderProviderFields();
  state.apiModels = [];
  state.apiModelError = "";
  await loadApiModels();
}

async function saveLlmConfig(event) {
  event.preventDefault();
  setStatus("running", "LLM-Konfiguration wird gespeichert...");
  const selectedApiProvider = value("#adminApiProvider") || "openai-responses";
  const selectedPreset = API_PRESETS[selectedApiProvider] || API_PRESETS["openai-compatible"];
  const payload = {
    provider: value("#adminLlmProvider"),
    apiProvider: selectedApiProvider,
    ollamaBaseUrl: value("#adminOllamaBaseUrl"),
    ollamaModel: value("#adminOllamaModel"),
    apiBaseUrl: selectedApiProvider === "openai-compatible" ? value("#adminApiBaseUrl") : selectedPreset.baseUrl,
    apiModel: value("#adminApiModel"),
    routes: {
      general_chat: { provider: value("#adminRouteGeneralChat"), reason: "Interaktiver Chat." },
      architecture_discovery: { provider: value("#adminRouteArchitectureDiscovery"), reason: "Architektur-Discovery im Entwicklungsprojekt." },
      hardware_lab_analysis: { provider: "api", reason: "Herstellerquellen im KI-gefuehrten Hardware-Labor ueber OpenAI Responses nach AI-Usage-Preflight." },
      artifact_generation: { provider: value("#adminRouteArtifactGeneration"), reason: "PlantUML, Pseudocode und andere ableitbare Artefakte." },
      code_generation: { provider: value("#adminRouteCodeGeneration"), reason: "Quellcode- und Pseudocode-Generierung." },
      help_chat: { provider: "api", reason: "GerNetiX Help verwendet OpenAI nur mit kuratierten Hilfeartikeln und Usage-Preflight." },
    },
  };
  const apiKey = value("#adminApiKey");
  if (apiKey) payload.apiKey = apiKey;
  try {
    const result = await putJson("/api/admin/llm-config", payload);
    state.llm = result.config;
    render();
    setStatus("ok", "LLM-Konfiguration gespeichert. Neue Chat-Anfragen nutzen diese Einstellung.");
  } catch (error) {
    setStatus("error", error.message);
  }
}

async function saveAiCostLimits(event) {
  event.preventDefault();
  setAiCostLimitStatus("running", "KI-Limits werden gespeichert...");
  const dailyLimit = Number(value("#aiDailyTokenCreditLimit"));
  const monthlyLimit = Number(value("#aiMonthlyTokenCreditLimit"));
  if (!Number.isFinite(dailyLimit) || dailyLimit < 0 || !Number.isFinite(monthlyLimit) || monthlyLimit < 0) {
    setAiCostLimitStatus("error", "Limits muessen Zahlen ab 0 sein.");
    return;
  }
  try {
    await postJson("/api/admin/ai-cost-controls/actions", {
      action_type: "update_policy",
      reason: "admin_updated_unified_token_credit_limits",
      payload: {
        daily_token_limit: dailyLimit,
        daily_credit_limit: dailyLimit,
        monthly_token_limit: monthlyLimit,
        monthly_credit_limit: monthlyLimit,
      },
    });
    await loadAiUsage();
    renderAiUsage();
    setAiCostLimitStatus("ok", "Limits gespeichert: Credits und Tokens sind gekoppelt.");
  } catch (error) {
    setAiCostLimitStatus("error", error.message);
  }
}

async function testLlmConfig() {
  setStatus("running", "LLM-Konfiguration wird getestet...");
  try {
    const result = await postJson("/api/admin/llm-config/test", {});
    state.llm = result.config || state.llm;
    render();
    if (!result.ok) {
      setStatus("error", result.error || "LLM-Test fehlgeschlagen.");
      return;
    }
    const usage = result.usage || {};
    setStatus("ok", `Test erfolgreich: ${result.content || "OK"} (${formatDuration(result.durationMs)}, ${usage.totalTokens ?? "-"} Tokens).`);
  } catch (error) {
    setStatus("error", error.message);
  }
}

function setStatus(kind, text) {
  const status = document.querySelector("#adminLlmSaveStatus");
  status.className = `flash-status ${kind}`;
  status.textContent = text;
}

function setAiCostLimitStatus(kind, text) {
  const status = document.querySelector("#aiCostLimitStatus");
  status.className = `flash-status ${kind}`;
  status.textContent = text;
}

function renderProviderRows(items) {
  if (!items.length) return `<tr><td colspan="7" class="empty-cell">Keine KI-Nutzung vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.provider_name || "-")}</strong><span>${providerLabel(item.provider_type)}</span>${providerStatusLink(item)}</td>
      <td>${formatNumber(item.total_events)}</td>
      <td>${formatNumber(item.tokens)}</td>
      <td>${formatNumber(item.credits)}</td>
      <td>${item.provider_type === "external" ? formatCurrency(item.estimated_provider_cost) : "-"}</td>
      <td>${formatDuration(item.average_latency_ms)}</td>
      <td>${item.provider_type === "local" ? formatMetric(item.average_eval_tokens_per_second) : "-"}</td>
    </tr>
  `).join("");
}

function providerStatusLink(item) {
  const url = String(item.provider_status_url || "").trim();
  if (!url) return "";
  const label = item.provider_type === "local" ? "Lokalen Endpoint oeffnen" : "Provider-Status oeffnen";
  return `<a class="provider-status-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderModelRows(items) {
  if (!items.length) return `<tr><td colspan="5" class="empty-cell">Keine Modell-Metriken vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.model || "-")}</strong><span>${escapeHtml(item.provider_name || "-")}</span></td>
      <td>${providerLabel(item.provider_type)}</td>
      <td>${formatNumber(item.successful)} ok / ${formatNumber(item.rejected)} abgelehnt</td>
      <td>${formatNumber(item.tokens)}</td>
      <td>${item.provider_type === "external" ? formatCurrency(item.estimated_provider_cost) : "-"}</td>
    </tr>
  `).join("");
}

function renderAiCostControlRuleRows(rules, rejections) {
  if (!rules.length) return `<tr><td colspan="4" class="empty-cell">Keine Cost-Control-Policy verfuegbar.</td></tr>`;
  const rejectionByReason = new Map((rejections || []).map((item) => [item.reason, item]));
  return rules.map((rule) => {
    const rejection = rejectionByReason.get(rule.rule_id);
    return `
      <tr>
        <td><strong>${escapeHtml(rule.title || costControlReasonLabel(rule.rule_id))}</strong><span>${escapeHtml(rule.rule_id || "-")}</span></td>
        <td>${escapeHtml(rule.status || "-")}</td>
        <td>${escapeHtml(rule.value || "-")}</td>
        <td><strong>${formatNumber(rejection?.count || 0)}</strong><span>${escapeHtml(rejection ? `zuletzt ${formatDateTime(rejection.latest_at)}` : "nicht ausgeloest")}</span></td>
      </tr>
    `;
  }).join("");
}

function renderAiRejectionReasonRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine blockierten KI-Aufrufe vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(costControlReasonLabel(item.reason))}</strong><span>${escapeHtml(item.reason || "-")}</span></td>
      <td>${formatNumber(item.count)}</td>
      <td>${formatNumber(item.tokens)}</td>
      <td><strong>${escapeHtml((item.models || []).join(", ") || "-")}</strong><span>${escapeHtml((item.accounts || []).join(", ") || "-")}</span></td>
    </tr>
  `).join("");
}

function renderAiRecentRejectionRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine letzten Blockaden vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(formatDateTime(item.created_at))}</strong><span>${escapeHtml(item.model || "-")}</span></td>
      <td>${escapeHtml(item.account_id || "-")}</td>
      <td><strong>${escapeHtml(featureLabel(item.feature))}</strong><span>${formatNumber(Number(item.input_tokens || 0) + Number(item.output_tokens || 0))} Tokens</span></td>
      <td><strong>${escapeHtml(costControlReasonLabel(item.rejection_reason))}</strong><span>${escapeHtml(item.protection_action || "-")}</span></td>
    </tr>
  `).join("");
}

function renderAiSourceLimitRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine Quellenlimits verfuegbar.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.title || item.source_id || "-")}</strong><span>${escapeHtml(item.source_id || "-")}</span></td>
      <td>${providerLabel(item.provider_type)}</td>
      <td>${escapeHtml(billingScopeLabel(item.billing_scope))}</td>
      <td>${item.token_limit === null || item.token_limit === undefined ? "unbegrenzt" : `${formatNumber(item.token_limit)} Tokens`}</td>
    </tr>
  `).join("");
}

function renderAiModelPolicyRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine Modellpreise verfuegbar.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.model || "-")}</strong></td>
      <td><strong>${item.allowed ? "erlaubt" : "blockiert"}</strong><span>${item.premium ? "Premium-Capability erforderlich" : "Standard"}</span></td>
      <td><strong>1:1</strong><span>${formatNumber(item.credits_per_1k_input_tokens)} Credits je 1k Tokens</span></td>
      <td><strong>${formatCurrency(item.provider_input_cost_per_1k_tokens)} Input</strong><span>${formatCurrency(item.provider_output_cost_per_1k_tokens)} Output / 1k Tokens</span></td>
    </tr>
  `).join("");
}

function renderAccountRows(items) {
  if (!items.length) return `<tr><td colspan="5" class="empty-cell">Keine Accountdaten vorhanden.</td></tr>`;
  return items.map((account) => `
    <tr>
      <td><strong>${escapeHtml(account.account_id || "-")}</strong><span>Account Blatt</span></td>
      <td><strong>${account.blocked ? "blockiert" : "aktiv"}</strong><span>${formatNumber(account.rejected_events)} abgelehnte Aufrufe</span></td>
      <td><strong>${account.available_credits === null || account.available_credits === undefined ? "-" : formatNumber(account.available_credits)}</strong><span>${formatNumber(account.month_credits)} Credits im Monat</span></td>
      <td>
        <strong>${formatMetric(account.ai_rating?.used_percent || 0)} %</strong>
        ${usageBar(account.ai_rating?.used_percent || 0)}
      </td>
      <td>${renderSourceRatingList(account.ai_rating?.sources || [])}</td>
    </tr>
  `).join("");
}

function renderSourceRatingList(sources) {
  if (!sources.length) return `<span>-</span>`;
  return `<div class="source-rating-list">${sources.map((source) => `
    <div>
      <strong>${escapeHtml(source.title || source.source_id)}</strong>
      <span>${source.unlimited
        ? `${formatNumber(source.month_tokens)} Tokens, unbegrenzt`
        : `${formatNumber(source.month_tokens)} / ${formatNumber(source.token_limit)} Tokens (${formatMetric(source.used_percent)} %)`}</span>
      ${source.unlimited ? "" : usageBar(source.used_percent)}
    </div>
  `).join("")}</div>`;
}

function usageBar(value) {
  const percent = Math.max(0, Math.min(100, Number(value || 0)));
  return `<span class="usage-bar" aria-label="${formatMetric(percent)} Prozent verbraucht"><i style="width:${percent}%"></i></span>`;
}

function renderAiContextSourceRows(items) {
  if (!items.length) return `<tr><td colspan="5" class="empty-cell">Keine aktiven LLM-Datenfreigaben vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(sourceTypeLabel(item.source_type))}</strong><span>${escapeHtml(item.source_type || "-")}</span></td>
      <td>${formatNumber(item.active_grants)}</td>
      <td>${formatNumber(item.external_grants)}</td>
      <td>${escapeHtml((item.redaction_levels || []).map(redactionLabel).join(", ") || "-")}</td>
      <td>${escapeHtml((item.purposes || []).map(purposeLabel).join(", ") || "-")}</td>
    </tr>
  `).join("");
}

function renderAiContextGrantRows(items) {
  if (!items.length) return `<tr><td colspan="5" class="empty-cell">Keine Grants vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(grantStateLabel(item.state))}</strong><span>${escapeHtml(item.account_id || "-")}</span></td>
      <td><strong>${escapeHtml(sourceTypeLabel(item.source_type))}</strong><span>${escapeHtml(item.source_scope || "-")}</span></td>
      <td>${escapeHtml(purposeLabel(item.purpose))}</td>
      <td><strong>${escapeHtml(providerScopeLabel(item.allowed_provider_scope))}</strong><span>${escapeHtml(redactionLabel(item.redaction_level))}</span></td>
      <td>${escapeHtml(formatDateTime(item.valid_until))}</td>
    </tr>
  `).join("");
}

function renderAiContextAuditRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine Audit-Entscheidungen vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(accessDecisionLabel(item.access_decision))}</strong><span>${escapeHtml(formatDateTime(item.occurred_at))}</span></td>
      <td>${escapeHtml(sourceTypeLabel(item.source_type))}</td>
      <td>${escapeHtml(purposeLabel(item.purpose))}</td>
      <td>${escapeHtml(item.rejection_reason || item.grant_id || "-")}</td>
    </tr>
  `).join("");
}

function renderAiContextRegistryRows(items) {
  if (!items.length) return `<tr><td colspan="5" class="empty-cell">Keine KI-Kontextquellen registriert.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.title || sourceTypeLabel(item.source_type))}</strong><span>${escapeHtml(item.source_id || "-")}</span></td>
      <td><strong>${escapeHtml(sourceTypeLabel(item.source_type))}</strong><span>${escapeHtml(item.source_scope || "-")}</span></td>
      <td><strong>${escapeHtml(item.backing_service || "-")}</strong><span>${escapeHtml(item.endpoint || "-")}</span></td>
      <td>${escapeHtml((item.contains || []).join(", ") || "-")}</td>
      <td><strong>${escapeHtml(providerScopeLabel(item.default_provider_scope))}</strong><span>${escapeHtml(redactionLabel(item.default_redaction_level))}</span></td>
    </tr>
  `).join("");
}

function renderAiPromptFoundationRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine Prompt-Grundlagen verfuegbar.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.title || item.foundation_id || "-")}</strong><span>${escapeHtml(item.source_scope || item.foundation_id || "-")}</span></td>
      <td><strong>${escapeHtml(routeTaskLabel(item.route_task))}</strong><span>${escapeHtml(item.content_kind || "-")}</span></td>
      <td>
        <strong>Erlaubt</strong><span>${escapeHtml((item.allowed_sources || []).map(sourceTypeLabel).join(", ") || "-")}</span>
        <strong class="subline">Blockiert</strong><span>${escapeHtml((item.blocked_sources || []).map(sourceTypeLabel).join(", ") || "-")}</span>
      </td>
      <td><pre class="prompt-foundation-content">${escapeHtml(item.content || "")}</pre></td>
    </tr>
  `).join("");
}

function renderAiContextSqliteRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine AI-SQLite-Tabellen verfuegbar.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(sqliteTableLabel(item.table_name))}</strong><span>${escapeHtml(item.table_name || "-")}</span></td>
      <td>${formatNumber(item.row_count)}</td>
      <td>${formatNumber((item.columns || []).length)}</td>
      <td>${escapeHtml(sqlitePreview(item.preview_rows || []))}</td>
    </tr>
  `).join("");
}

function renderAiContextSqliteContentRows(items) {
  const rows = [];
  for (const table of items) {
    for (const row of table.preview_rows || []) {
      rows.push({ table, row });
    }
  }
  if (!rows.length) return `<tr><td colspan="3" class="empty-cell">Keine AI-SQLite-Inhalte verfuegbar.</td></tr>`;
  return rows.map(({ table, row }) => `
    <tr>
      <td><strong>${escapeHtml(sqliteTableLabel(table.table_name))}</strong><span>${escapeHtml(table.table_name || "-")}</span></td>
      <td>${escapeHtml(sqliteRowId(row))}</td>
      <td><dl class="inline-data-list">${renderSqliteFields(row)}</dl></td>
    </tr>
  `).join("");
}

function renderAiContextBoardRows(items) {
  if (!items.length) return `<tr><td colspan="4" class="empty-cell">Keine ESP32-Board-Inhalte aus dem Hardware Catalog verfuegbar.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.title || item.hardware_item_id || "-")}</strong><span>${escapeHtml(item.hardware_item_id || "-")}</span></td>
      <td><strong>${escapeHtml(item.mcu_variant || "-")}</strong><span>${escapeHtml(item.module_name || item.vendor || "-")}</span></td>
      <td>${escapeHtml((item.capabilities || []).map((capability) => capability.title || capability.capability_id).join(", ") || "-")}</td>
      <td><strong>${escapeHtml(item.basissoftware_profile_id || "-")}</strong><span>${escapeHtml(item.min_basissoftware_version ? `ab ${item.min_basissoftware_version}` : item.provisioning_profile_id || "-")}</span></td>
    </tr>
  `).join("");
}

function metricCard(label, value, detail) {
  return `
    <article class="metric-card">
      <p>${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(detail || "")}</span>
    </article>
  `;
}

function summaryItem(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function providerLabel(type) {
  return type === "external" ? "Oeffentlich" : "Lokal";
}

function billingScopeLabel(scope) {
  return {
    unlimited: "unbegrenzt",
    monthly: "monatlich",
    daily: "taeglich",
    per_call: "pro Aufruf",
  }[scope] || scope || "-";
}

function featureLabel(feature) {
  return {
    architecture_discovery: "Architektur-Discovery",
    hardware_lab_analysis: "Hardware-Labor",
    general_chat: "Chat",
    artifact_generation: "Artefakte",
    code_generation: "Codegenerierung",
    help_assistance: "GerNetiX Help",
    ai_assistant: "KI-Assistent",
  }[feature] || feature || "-";
}

function costControlReasonLabel(reason) {
  return {
    global_kill_switch: "Globaler Kill-Switch",
    account_blocked: "Account gesperrt",
    model_not_allowed: "Modell nicht freigegeben",
    premium_model_not_allowed: "Premium-Modell ohne Capability",
    prompt_too_large: "Prompt zu gross",
    response_too_large: "Antwortlimit ueberschritten",
    insufficient_credits: "Nicht genug Credits",
    source_token_limit_exceeded: "Quellenlimit erreicht",
    daily_limit_exceeded: "Tageslimit erreicht",
    monthly_limit_exceeded: "Monatslimit erreicht",
    insufficient_credits_at_completion: "Credits beim Abschluss nicht ausreichend",
    unknown: "Unbekannter Grund",
  }[reason] || reason || "-";
}

function sourceTypeLabel(type) {
  return {
    current_chat: "Aktueller Chat",
    architecture_prompt: "Architektur-Prompt",
    project_files: "Projektdateien",
    graph_database: "Graphdatenbank",
    device_data: "Device-Daten",
    customer_data: "Kundendaten",
    admin_statistics: "Admin-Statistiken",
    hardware_catalog: "Hardware-Katalog",
    ai_prompt: "KI-Prompt",
    external_web: "Externes Web",
  }[type] || type || "-";
}

function purposeLabel(purpose) {
  return {
    architecture_assistance: "Architekturhilfe",
    debugging: "Debugging",
    support_case: "Supportfall",
    usage_analysis: "Nutzungsanalyse",
    general_chat: "Allgemeiner Chat",
  }[purpose] || purpose || "-";
}

function providerScopeLabel(scope) {
  return {
    local_only: "Nur lokal",
    external_allowed: "Extern erlaubt",
    external_redacted_only: "Extern nur redigiert",
  }[scope] || scope || "-";
}

function redactionLabel(level) {
  return {
    none: "voll",
    metadata_only: "nur Metadaten",
    summary_only: "nur Zusammenfassung",
    masked: "maskiert",
  }[level] || level || "-";
}

function grantStateLabel(state) {
  return {
    active: "aktiv",
    scheduled: "geplant",
    expired: "abgelaufen",
    revoked: "widerrufen",
  }[state] || state || "-";
}

function accessDecisionLabel(decision) {
  return decision === "allowed" ? "erlaubt" : "abgelehnt";
}

function sqliteTableLabel(tableName) {
  return {
    ai_context_policy: "Policy",
    ai_context_grants: "Grants",
    ai_context_audit_events: "Audit Events",
  }[tableName] || tableName || "-";
}

function sqlitePreview(rows) {
  if (!rows.length) return "-";
  return rows.slice(0, 3).map((row) => {
    const id = row.grant_id || row.audit_event_id || row.policy_id || "row";
    const detail = row.source_scope || row.access_decision || row.updated_at || "";
    return detail ? `${id}: ${detail}` : id;
  }).join(" | ");
}

function sqliteRowId(row) {
  return row.grant_id || row.audit_event_id || row.policy_id || "-";
}

function renderSqliteFields(row) {
  const entries = Object.entries(row).filter(([key]) => key !== "raw_json");
  if (!entries.length) return `<div><dt>-</dt><dd>-</dd></div>`;
  return entries.map(([key, value]) => `
    <div>
      <dt>${escapeHtml(sqliteFieldLabel(key))}</dt>
      <dd>${escapeHtml(sqliteFieldValue(value))}</dd>
    </div>
  `).join("");
}

function sqliteFieldLabel(key) {
  return {
    grant_id: "Grant",
    audit_event_id: "Audit Event",
    policy_id: "Policy",
    account_id: "Account",
    project_id: "Projekt",
    granted_by_account_id: "Freigegeben von",
    actor_id: "Akteur",
    actor_role: "Rolle",
    source_type: "Quelle",
    source_scope: "Scope",
    purpose: "Zweck",
    allowed_provider_scope: "Provider-Scope",
    redaction_level: "Redaktion",
    max_context_items: "Max. Kontext",
    provider: "Provider",
    model: "Modell",
    grant_id: "Grant",
    access_decision: "Entscheidung",
    rejection_reason: "Ablehnungsgrund",
    valid_from: "Gueltig ab",
    valid_until: "Gueltig bis",
    revoked_at: "Widerrufen",
    created_at: "Erstellt",
    occurred_at: "Zeitpunkt",
    deny_without_grant: "Deny ohne Grant",
    require_explicit_source_scope: "Expliziter Scope",
    allow_external_provider_customer_data: "Kundendaten extern",
    default_max_context_items: "Default-Kontext",
    protected_source_types_json: "Geschuetzte Quellen",
    updated_at: "Aktualisiert",
  }[key] || key;
}

function sqliteFieldValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (value === 0 || value === 1) return String(value);
  return String(value);
}

function activeProviderLabel(config) {
  if (config.provider !== "api") return "Lokales Ollama";
  const preset = API_PRESETS[config.apiProvider || "openai-compatible"];
  return preset?.label || "API";
}

function routeProvider(config, task, fallback) {
  return config.routes?.[task]?.provider || fallback;
}

function routeLabel(provider) {
  return {
    default: "Standard",
    ollama: "Lokal",
    api: "API",
  }[provider] || provider || "-";
}

function routeTaskLabel(task) {
  return {
    general_chat: "Chat",
    architecture_discovery: "Architektur-Discovery",
    hardware_lab_analysis: "Hardware-Labor",
    artifact_generation: "Artefakte",
    code_generation: "Codegenerierung",
  }[task] || task || "-";
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

function formatMetric(value) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  });
}

function formatLimit(value, unit) {
  if (value === null || value === undefined || value === "") return "-";
  return `${formatNumber(value)} ${unit}`;
}

function formatDuration(value) {
  if (!Number.isFinite(value)) return "-";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function normalizeCostDays(items) {
  return (items || [])
    .filter((item) => item && item.day)
    .map((item) => ({
      day: String(item.day),
      total_events: Number(item.total_events || 0),
      tokens: Number(item.tokens || 0),
      credits: Number(item.credits || 0),
      estimated_provider_cost: Number(item.estimated_provider_cost || 0),
    }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

function formatShortDay(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function formatChartDay(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("de-DE", { dateStyle: "medium" });
}

function meta([label, value]) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function setValue(selector, value) {
  const input = document.querySelector(selector);
  if (input) input.value = value === null || value === undefined ? "" : value;
}

function value(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

async function getJson(url) {
  const response = await fetch(url);
  return readJsonResponse(response);
}

async function putJson(url, body) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonResponse(response);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonResponse(response);
}

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
