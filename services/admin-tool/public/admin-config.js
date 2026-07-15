const state = {
  llm: null,
  localModels: [],
  apiModels: [],
  modelError: "",
  apiModelError: "",
  overview: null,
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
  systemEvents: null,
  systemEventsLoading: false,
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
document.querySelector("#refreshSystemEventsButton").addEventListener("click", () => loadSystemEvents(true));
document.querySelector("#refreshAiClarificationsButton").addEventListener("click", () => loadAiClarifications(true));
document.querySelector("#aiClarificationStatusFilter").addEventListener("change", () => loadAiClarifications(true));
document.querySelector("#aiClarificationPriorityFilter").addEventListener("change", () => loadAiClarifications(true));
document.querySelector("#aiClarificationRows").addEventListener("click", handleAiClarificationAction);
document.querySelector("#aiHelpKnowledgeForm").addEventListener("submit", saveAiHelpKnowledge);
document.querySelector("#aiHelpKnowledgeRows").addEventListener("click", editAiHelpKnowledge);
document.querySelector("#adminEmailConfigForm").addEventListener("submit", saveEmailConfig);
document.querySelector("#adminEmailTestButton").addEventListener("click", testEmailConfig);
document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.adminView));
});
document.querySelectorAll("[data-admin-sub-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.adminSubView));
});

bootstrap();

async function bootstrap() {
  await loadOverview();
  await loadAccounts();
  await loadAiUsage();
  await loadAiContext();
  await loadAiClarifications(false);
  await loadAiHelpKnowledge(false);
  await loadEmailConfig();
  await loadConfig();
  await loadLocalModels();
  await loadApiModels();
  render();
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
  renderMonitoring();
  renderSystemEvents();
  renderAccounts();
  renderAiUsage();
  renderAiContext();
  renderAiClarifications();
  renderAiHelpKnowledge();
  renderEmailConfig();
  renderForm();
  renderStatus();
  renderProviderFields();
}

function setView(view) {
  state.currentView = view || "statistics";
  renderNavigation();
  if (state.currentView === "monitoring") loadMonitoring(false);
  if (state.currentView === "system-events") loadSystemEvents(false);
  if (state.currentView === "ai-clarifications") loadAiClarifications(false);
  if (state.currentView === "ai-help-knowledge") loadAiHelpKnowledge(false);
  if (state.currentView === "email-config") loadEmailConfig().then(renderEmailConfig);
}

function renderNavigation() {
  const aiView = isAiView(state.currentView);
  document.querySelector("#aiSubNav")?.classList.toggle("hidden", !aiView);
  document.querySelectorAll(".admin-view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== viewId(state.currentView));
  });
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    const group = button.dataset.adminGroup || "";
    const active = group === "ai" ? aiView : button.dataset.adminView === state.currentView;
    button.classList.toggle("active-method", active);
  });
  document.querySelectorAll("[data-admin-sub-view]").forEach((button) => {
    button.classList.toggle("active-method", button.dataset.adminSubView === state.currentView);
  });
}

function isAiView(view) {
  return ["ai-usage", "ai-context", "ai-help-knowledge", "ai-clarifications", "llm-config"].includes(view);
}

function viewId(view) {
  return {
    statistics: "statisticsView",
    monitoring: "monitoringView",
    "system-events": "systemEventsView",
    accounts: "accountsView",
    "ai-usage": "aiUsageView",
    "ai-context": "aiContextView",
    "ai-clarifications": "aiClarificationsView",
    "ai-help-knowledge": "aiHelpKnowledgeView",
    "email-config": "emailConfigView",
    "llm-config": "llmConfigView",
  }[view] || "statisticsView";
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
      <td>${escapeHtml(item.impact || "-")}</td>
    </tr>
  `).join("");
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
      </dl>
    </article>
  `;
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
    : '<tr><td colspan="4" class="empty-cell">Noch kein lokales Help-Wissen vorhanden.</td></tr>';
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
  status.textContent = "Help-Wissen wird gespeichert und lokal eingebettet.";
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
  setValue("#adminLlmProvider", config.provider || "ollama");
  setValue("#adminOllamaBaseUrl", config.ollamaBaseUrl || "http://127.0.0.1:11434");
  setValue("#adminOllamaModel", config.ollamaModel || config.model || "llama3.2:3b");
  setValue("#adminApiProvider", config.apiProvider || "openai-responses");
  setValue("#adminApiBaseUrl", config.apiBaseUrl || "https://api.openai.com/v1");
  setValue("#adminApiModel", config.apiModel || "gpt-5.5");
  setValue("#adminApiKey", "");
  setValue("#adminRouteGeneralChat", routeProvider(config, "general_chat", "default"));
  setValue("#adminRouteArchitectureDiscovery", routeProvider(config, "architecture_discovery", "default"));
  setValue("#adminRouteArtifactGeneration", routeProvider(config, "artifact_generation", "ollama"));
  setValue("#adminRouteCodeGeneration", routeProvider(config, "code_generation", "ollama"));
  setValue("#adminRouteHelpChat", routeProvider(config, "help_chat", "ollama"));
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
    ["Artefakt-Route", routeLabel(routeProvider(config, "artifact_generation", "ollama"))],
    ["Code-Route", routeLabel(routeProvider(config, "code_generation", "ollama"))],
    ["Help-Route", "Nur lokal (Ollama)"],
  ].map(meta).join("");
}

function renderProviderFields() {
  const provider = document.querySelector("#adminLlmProvider").value || "ollama";
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
      artifact_generation: { provider: value("#adminRouteArtifactGeneration"), reason: "PlantUML, Pseudocode und andere ableitbare Artefakte." },
      code_generation: { provider: value("#adminRouteCodeGeneration"), reason: "Quellcode- und Pseudocode-Generierung." },
      help_chat: { provider: "ollama", reason: "GerNetiX Help bleibt ausschliesslich lokal." },
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
    general_chat: "Chat",
    artifact_generation: "Artefakte",
    code_generation: "Codegenerierung",
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
    artifact_generation: "Artefakte",
    code_generation: "Codegenerierung",
  }[task] || task || "-";
}

function formatNumber(value) {
  const number = Number(value || 0);
  return number.toLocaleString("de-DE", { maximumFractionDigits: 2 });
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
