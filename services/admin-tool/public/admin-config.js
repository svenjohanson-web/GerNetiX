const state = {
  llm: null,
  localModels: [],
  modelError: "",
  overview: null,
  aiUsage: null,
  currentView: "statistics",
};

const API_PRESETS = {
  "openai-compatible": {
    label: "OpenAI-kompatibel",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-5.5", "gpt-5.1", "gpt-5", "gpt-4.1", "gpt-4.1-mini"],
  },
  anthropic: {
    label: "Claude / Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-opus-4.1", "claude-sonnet-4.5", "claude-sonnet-4", "claude-3-7-sonnet-latest"],
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

function renderForm() {
  const config = state.llm || {};
  setValue("#adminLlmProvider", config.provider || "ollama");
  setValue("#adminOllamaBaseUrl", config.ollamaBaseUrl || "http://127.0.0.1:11434");
  setValue("#adminOllamaModel", config.ollamaModel || config.model || "llama3.2:3b");
  setValue("#adminApiProvider", config.apiProvider || "openai-compatible");
  setValue("#adminApiBaseUrl", config.apiBaseUrl || "https://api.openai.com/v1");
  setValue("#adminApiModel", config.apiModel || "gpt-4.1-mini");
  setValue("#adminApiKey", "");
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
  target.innerHTML = preset.models.map((model) => `
    <button type="button" data-api-llm-model="${escapeHtml(model)}">${escapeHtml(model)}</button>
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
  if (!value("#adminApiModel") || !preset.models.includes(value("#adminApiModel"))) {
    setValue("#adminApiModel", preset.models[0]);
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

function activeProviderLabel(config) {
  if (config.provider !== "api") return "Lokales Ollama";
  const preset = API_PRESETS[config.apiProvider || "openai-compatible"];
  return preset?.label || "API";
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
