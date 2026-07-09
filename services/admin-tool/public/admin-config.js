const state = {
  llm: null,
  localModels: [],
  modelError: "",
};

document.querySelector("#adminLlmForm").addEventListener("submit", saveLlmConfig);
document.querySelector("#adminLlmProvider").addEventListener("change", renderProviderFields);
document.querySelector("#adminLlmTestButton").addEventListener("click", testLlmConfig);
document.querySelector("#refreshLocalLlmModelsButton").addEventListener("click", loadLocalModels);

bootstrap();

async function bootstrap() {
  await loadConfig();
  await loadLocalModels();
  render();
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
  renderForm();
  renderStatus();
  renderProviderFields();
}

function renderForm() {
  const config = state.llm || {};
  setValue("#adminLlmProvider", config.provider || "ollama");
  setValue("#adminOllamaBaseUrl", config.ollamaBaseUrl || "http://127.0.0.1:11434");
  setValue("#adminOllamaModel", config.ollamaModel || config.model || "llama3.2:3b");
  setValue("#adminApiBaseUrl", config.apiBaseUrl || "https://api.openai.com/v1");
  setValue("#adminApiModel", config.apiModel || "gpt-4.1-mini");
  setValue("#adminApiKey", "");
  renderLocalModelOptions(config.ollamaModel || config.model || "");
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

function renderStatus() {
  const config = state.llm || {};
  document.querySelector("#adminLlmStatus").innerHTML = [
    ["Provider", config.provider === "api" ? "API / OpenAI-kompatibel" : "Lokales Ollama"],
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

async function saveLlmConfig(event) {
  event.preventDefault();
  setStatus("running", "LLM-Konfiguration wird gespeichert...");
  const payload = {
    provider: value("#adminLlmProvider"),
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
