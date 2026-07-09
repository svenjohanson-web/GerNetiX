const state = {
  llm: null,
  localModels: [],
  modelError: "",
  overview: null,
  aiUsage: null,
  aiContext: null,
  currentView: "statistics",
};

const API_PRESETS = {
  "openai-responses": {
    label: "OpenAI Responses API",
    baseUrl: "https://api.openai.com/v1",
    modelGroups: [
      { label: "Low", detail: "guenstig / schnell", models: ["gpt-5.4-nano", "gpt-5-nano", "gpt-4.1-nano", "gpt-4o-mini"] },
      { label: "Medium", detail: "Standard fuer Chat", models: ["gpt-5.5", "gpt-5.4-mini", "gpt-5-mini", "gpt-4.1-mini", "gpt-4o"] },
      { label: "High", detail: "maximale Qualitaet", models: ["gpt-5.5-pro", "gpt-5.4-pro", "gpt-5-pro", "gpt-4.1"] },
    ],
  },
  "openai-compatible": {
    label: "OpenAI-kompatibel",
    baseUrl: "https://api.openai.com/v1",
    modelGroups: [
      { label: "Low", detail: "guenstig / schnell", models: ["gpt-4.1-nano", "gpt-4o-mini"] },
      { label: "Medium", detail: "Standard", models: ["gpt-4.1-mini", "gpt-4o"] },
      { label: "High", detail: "staerker", models: ["gpt-4.1", "gpt-4-turbo"] },
    ],
  },
  anthropic: {
    label: "Claude / Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    modelGroups: [
      { label: "Low", detail: "guenstiger", models: ["claude-3-5-haiku-latest"] },
      { label: "Medium", detail: "Standard", models: ["claude-sonnet-4.5", "claude-sonnet-4"] },
      { label: "High", detail: "staerker", models: ["claude-opus-4.1", "claude-3-7-sonnet-latest"] },
    ],
  },
};

document.querySelector("#adminLlmForm").addEventListener("submit", saveLlmConfig);
document.querySelector("#adminLlmProvider").addEventListener("change", renderProviderFields);
document.querySelector("#adminApiProvider").addEventListener("change", applyApiProviderPreset);
document.querySelector("#adminLlmTestButton").addEventListener("click", testLlmConfig);
document.querySelector("#refreshLocalLlmModelsButton").addEventListener("click", loadLocalModels);
document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.adminView));
});

bootstrap();

async function bootstrap() {
  await loadOverview();
  await loadAiUsage();
  await loadAiContext();
  await loadConfig();
  await loadLocalModels();
  render();
}

async function loadOverview() {
  state.overview = await getJson("/api/admin/overview");
}

async function loadAiUsage() {
  const result = await getJson("/api/admin/ai-usage/summary");
  state.aiUsage = result.summary || null;
}

async function loadAiContext() {
  const result = await getJson("/api/admin/ai-context/summary");
  state.aiContext = result.summary || null;
}

async function loadConfig() {
  const result = await getJson("/api/admin/llm-config");
  state.llm = result.config || null;
}

async function loadLocalModels() {
  const result = await getJson("/api/admin/llm-models");
  state.localModels = result.items || [];
  state.modelError = result.error || "";
  render();
}

function render() {
  renderNavigation();
  renderStatistics();
  renderAiUsage();
  renderAiContext();
  renderForm();
  renderStatus();
  renderProviderFields();
}

function setView(view) {
  state.currentView = view || "statistics";
  renderNavigation();
}

function renderNavigation() {
  document.querySelectorAll(".admin-view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== viewId(state.currentView));
  });
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.classList.toggle("active-method", button.dataset.adminView === state.currentView);
  });
}

function viewId(view) {
  return {
    statistics: "statisticsView",
    "ai-usage": "aiUsageView",
    "ai-context": "aiContextView",
    "llm-config": "llmConfigView",
  }[view] || "statisticsView";
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
  document.querySelector("#aiUsageMetrics").innerHTML = [
    metricCard("LLM-Anfragen", formatNumber(summary.total_events), `${formatNumber(summary.successful)} erfolgreich`),
    metricCard("Lokale LLM", formatNumber(local.total_events), `${formatNumber(local.tokens)} Tokens`),
    metricCard("Oeffentliche LLM", formatNumber(external.total_events), `${formatCurrency(external.estimated_provider_cost)} Kosten`),
    metricCard("Abgelehnt", formatNumber(summary.rejected), "Credits, Limits oder Policy"),
  ].join("");
  document.querySelector("#aiProviderRows").innerHTML = renderProviderRows(summary.provider_breakdown || []);
  document.querySelector("#aiModelRows").innerHTML = renderModelRows(summary.model_breakdown || []);
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
  const target = document.querySelector("#adminApiModelOptions");
  const apiProvider = value("#adminApiProvider") || "openai-compatible";
  const preset = API_PRESETS[apiProvider] || API_PRESETS["openai-compatible"];
  target.innerHTML = modelGroups(preset).map((group) => `
    <section class="model-tier">
      <div class="model-tier-head">
        <strong>${escapeHtml(group.label)}</strong>
        <span>${escapeHtml(group.detail || "")}</span>
      </div>
      <div class="model-tier-options">
        ${group.models.map((model) => `
          <button type="button" data-api-llm-model="${escapeHtml(model)}">${escapeHtml(model)}</button>
        `).join("")}
      </div>
    </section>
  `).join("");
  target.querySelectorAll("[data-api-llm-model]").forEach((button) => {
    button.classList.toggle("active-method", button.dataset.apiLlmModel === currentModel);
    button.addEventListener("click", () => {
      setValue("#adminApiModel", button.dataset.apiLlmModel);
      renderApiModelOptions(button.dataset.apiLlmModel);
    });
  });
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
  ].map(meta).join("");
}

function renderProviderFields() {
  const provider = document.querySelector("#adminLlmProvider").value || "ollama";
  document.querySelector("#adminOllamaFields").classList.toggle("hidden", provider !== "ollama");
  document.querySelector("#adminApiFields").classList.toggle("hidden", provider !== "api");
}

function applyApiProviderPreset() {
  const apiProvider = value("#adminApiProvider") || "openai-compatible";
  const preset = API_PRESETS[apiProvider] || API_PRESETS["openai-compatible"];
  setValue("#adminApiBaseUrl", preset.baseUrl);
  const models = flatPresetModels(preset);
  if (!value("#adminApiModel") || !models.includes(value("#adminApiModel"))) {
    setValue("#adminApiModel", models[0]);
  }
  renderApiModelOptions(value("#adminApiModel"));
}

async function saveLlmConfig(event) {
  event.preventDefault();
  setStatus("running", "LLM-Konfiguration wird gespeichert...");
  const payload = {
    provider: value("#adminLlmProvider"),
    apiProvider: value("#adminApiProvider"),
    ollamaBaseUrl: value("#adminOllamaBaseUrl"),
    ollamaModel: value("#adminOllamaModel"),
    apiBaseUrl: value("#adminApiBaseUrl"),
    apiModel: value("#adminApiModel"),
    routes: {
      general_chat: { provider: value("#adminRouteGeneralChat"), reason: "Interaktiver Chat." },
      architecture_discovery: { provider: value("#adminRouteArchitectureDiscovery"), reason: "Architektur-Discovery im Entwicklungsprojekt." },
      artifact_generation: { provider: value("#adminRouteArtifactGeneration"), reason: "PlantUML, Pseudocode und andere ableitbare Artefakte." },
      code_generation: { provider: value("#adminRouteCodeGeneration"), reason: "Quellcode- und Pseudocode-Generierung." },
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

function renderProviderRows(items) {
  if (!items.length) return `<tr><td colspan="7" class="empty-cell">Keine KI-Nutzung vorhanden.</td></tr>`;
  return items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.provider_name || "-")}</strong><span>${providerLabel(item.provider_type)}</span></td>
      <td>${formatNumber(item.total_events)}</td>
      <td>${formatNumber(item.tokens)}</td>
      <td>${formatNumber(item.credits)}</td>
      <td>${item.provider_type === "external" ? formatCurrency(item.estimated_provider_cost) : "-"}</td>
      <td>${formatDuration(item.average_latency_ms)}</td>
      <td>${item.provider_type === "local" ? formatMetric(item.average_eval_tokens_per_second) : "-"}</td>
    </tr>
  `).join("");
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

function modelGroups(preset) {
  if (Array.isArray(preset.modelGroups)) return preset.modelGroups;
  return [{ label: "Modelle", detail: "", models: preset.models || [] }];
}

function flatPresetModels(preset) {
  return modelGroups(preset).flatMap((group) => group.models || []);
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

function meta([label, value]) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function setValue(selector, value) {
  const input = document.querySelector(selector);
  if (input) input.value = value || "";
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
