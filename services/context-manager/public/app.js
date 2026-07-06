const apiPrefix = "/api/context";
const defaults = {
  account_id: "default-account",
  project_id: "default-project",
  title: "GerNetiX Projektkontext",
};

let currentContext = null;

const dom = {
  accountId: document.querySelector("#accountId"),
  projectId: document.querySelector("#projectId"),
  scopeTitle: document.querySelector("#scopeTitle"),
  scopeDescription: document.querySelector("#scopeDescription"),
  scopeStatus: document.querySelector("#scopeStatus"),
  refreshButton: document.querySelector("#refreshButton"),
  saveScopeButton: document.querySelector("#saveScopeButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  architectureButton: document.querySelector("#architectureButton"),
  createPackButton: document.querySelector("#createPackButton"),
  sliceForm: document.querySelector("#sliceForm"),
  decisionForm: document.querySelector("#decisionForm"),
  runtimeForm: document.querySelector("#runtimeForm"),
  eventForm: document.querySelector("#eventForm"),
  packForm: document.querySelector("#packForm"),
  sliceList: document.querySelector("#sliceList"),
  suggestionList: document.querySelector("#suggestionList"),
  analysisSummary: document.querySelector("#analysisSummary"),
  decisionList: document.querySelector("#decisionList"),
  runtimeList: document.querySelector("#runtimeList"),
  eventList: document.querySelector("#eventList"),
  contextPreview: document.querySelector("#contextPreview"),
  packId: document.querySelector("#packId"),
  toast: document.querySelector("#toast"),
};

init();

function init() {
  dom.accountId.value = localStorage.getItem("context.account_id") || defaults.account_id;
  dom.projectId.value = localStorage.getItem("context.project_id") || defaults.project_id;
  dom.scopeTitle.value = defaults.title;
  bindEvents();
  refreshContext();
}

function bindEvents() {
  dom.refreshButton.addEventListener("click", refreshContext);
  dom.saveScopeButton.addEventListener("click", saveScope);
  dom.analyzeButton.addEventListener("click", analyzeProject);
  dom.architectureButton.addEventListener("click", () => activateTab("architecture"));
  dom.createPackButton.addEventListener("click", createPack);

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  dom.sliceForm.addEventListener("submit", submitSlice);
  dom.decisionForm.addEventListener("submit", submitDecision);
  dom.runtimeForm.addEventListener("submit", submitRuntime);
  dom.eventForm.addEventListener("submit", submitEvent);

  [dom.accountId, dom.projectId].forEach((input) => {
    input.addEventListener("change", () => {
      localStorage.setItem(`context.${input.name}`, input.value.trim());
      refreshContext();
    });
  });
}

async function refreshContext() {
  await runAction(async () => {
    const query = new URLSearchParams({
      account_id: dom.accountId.value.trim() || defaults.account_id,
      project_id: dom.projectId.value.trim() || defaults.project_id,
    });
    currentContext = await requestJson(`${apiPrefix}/current?${query.toString()}`);
    renderContext(currentContext);
    setStatus("geladen");
  });
}

async function saveScope() {
  await runAction(async () => {
    const scope = await requestJson(`${apiPrefix}/current`, {
      method: "PUT",
      body: {
        scope_id: currentContext?.scope?.scope_id,
        account_id: dom.accountId.value.trim(),
        project_id: dom.projectId.value.trim(),
        title: dom.scopeTitle.value.trim(),
        description: dom.scopeDescription.value,
      },
    });
    currentContext = { ...currentContext, scope };
    renderContext(currentContext);
    showToast("Scope gespeichert");
  });
}

async function submitSlice(event) {
  event.preventDefault();
  const form = new FormData(dom.sliceForm);
  await runAction(async () => {
    await requestJson(`${apiPrefix}/requirement-slices`, {
      method: "POST",
      body: {
        scope_id: currentContext.scope.scope_id,
        title: text(form, "title"),
        requirement_id: text(form, "requirement_id"),
        slice_key: text(form, "slice_key"),
        status: text(form, "status"),
        summary: text(form, "summary"),
        implemented_by: csv(form, "implemented_by"),
        evidence: csv(form, "evidence"),
      },
    });
    dom.sliceForm.reset();
    await refreshContext();
    showToast("Slice gespeichert");
  });
}

async function submitDecision(event) {
  event.preventDefault();
  const form = new FormData(dom.decisionForm);
  await runAction(async () => {
    await requestJson(`${apiPrefix}/decisions`, {
      method: "POST",
      body: {
        scope_id: currentContext.scope.scope_id,
        title: text(form, "title"),
        status: text(form, "status"),
        rationale: text(form, "rationale"),
      },
    });
    dom.decisionForm.reset();
    await refreshContext();
    showToast("Entscheidung gespeichert");
  });
}

async function submitRuntime(event) {
  event.preventDefault();
  const form = new FormData(dom.runtimeForm);
  await runAction(async () => {
    await requestJson(`${apiPrefix}/runtime-references`, {
      method: "POST",
      body: {
        scope_id: currentContext.scope.scope_id,
        title: text(form, "title"),
        reference_type: text(form, "reference_type"),
        reference_id: text(form, "reference_id"),
        source_service: text(form, "source_service"),
        payload: parseJson(text(form, "payload"), "Payload JSON"),
      },
    });
    dom.runtimeForm.reset();
    dom.runtimeForm.elements.payload.value = "{}";
    await refreshContext();
    showToast("Runtime-Referenz gespeichert");
  });
}

async function submitEvent(event) {
  event.preventDefault();
  const form = new FormData(dom.eventForm);
  await runAction(async () => {
    await requestJson(`${apiPrefix}/events`, {
      method: "POST",
      body: {
        scope_id: currentContext.scope.scope_id,
        event_type: text(form, "event_type") || "context.updated",
        actor_id: text(form, "actor_id") || "codex",
        payload: parseJson(text(form, "payload"), "Payload JSON"),
      },
    });
    dom.eventForm.reset();
    dom.eventForm.elements.event_type.value = "context.updated";
    dom.eventForm.elements.actor_id.value = "codex";
    dom.eventForm.elements.payload.value = "{}";
    await refreshContext();
    showToast("Event gespeichert");
  });
}

async function createPack() {
  await runAction(async () => {
    const form = new FormData(dom.packForm);
    const sections = form.getAll("sections");
    const pack = await requestJson(`${apiPrefix}/packs`, {
      method: "POST",
      body: {
        scope_id: currentContext.scope.scope_id,
        purpose: text(form, "purpose") || "codex_context",
        include_sections: sections,
      },
    });
    dom.packId.textContent = pack.pack_id;
    dom.contextPreview.textContent = JSON.stringify(pack.payload, null, 2);
    showToast("Context Pack erzeugt");
  });
}

async function analyzeProject() {
  await runAction(async () => {
    const result = await requestJson(`${apiPrefix}/analyze`, {
      method: "POST",
      body: {
        scope_id: currentContext?.scope?.scope_id,
        account_id: dom.accountId.value.trim(),
        project_id: dom.projectId.value.trim(),
      },
    });
    dom.analysisSummary.textContent = analysisText(result);
    await refreshContext();
    activateTab("suggestion");
    showToast(dom.analysisSummary.textContent);
  });
}

async function acceptSuggestion(id, patch = null) {
  await runAction(async () => {
    await requestJson(`${apiPrefix}/suggestions/${encodeURIComponent(id)}/accept`, {
      method: "POST",
      body: patch || {},
    });
    await refreshContext();
    activateTab("suggestion");
    showToast("Vorschlag uebernommen");
  });
}

async function rejectSuggestion(id) {
  await runAction(async () => {
    await requestJson(`${apiPrefix}/suggestions/${encodeURIComponent(id)}/reject`, { method: "POST", body: {} });
    await refreshContext();
    activateTab("suggestion");
    showToast("Vorschlag verworfen");
  });
}

async function updateSuggestion(id, patch) {
  await runAction(async () => {
    await requestJson(`${apiPrefix}/suggestions/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
    await refreshContext();
    activateTab("suggestion");
    showToast("Vorschlag aktualisiert");
  });
}

function renderContext(context) {
  const scope = context.scope || {};
  dom.accountId.value = scope.account_id || dom.accountId.value;
  dom.projectId.value = scope.project_id || dom.projectId.value;
  dom.scopeTitle.value = scope.title || "";
  dom.scopeDescription.value = scope.description || "";
  dom.packId.textContent = context.latest_context_pack?.pack_id || "kein Pack";
  dom.contextPreview.textContent = JSON.stringify(context, null, 2);

  renderList(dom.sliceList, context.requirement_slices, (entry) => ({
    title: entry.title,
    badge: entry.status,
    meta: [entry.requirement_id, entry.slice_key, entry.implemented_by?.join(", ")].filter(Boolean).join(" | "),
    body: entry.summary,
  }));
  renderSuggestions(context.pending_suggestions || []);
  renderList(dom.decisionList, context.decisions, (entry) => ({
    title: entry.title,
    badge: entry.status,
    meta: entry.related_slice_ids?.join(", "),
    body: entry.rationale,
  }));
  renderList(dom.runtimeList, context.runtime_references, (entry) => ({
    title: entry.title,
    badge: entry.reference_type,
    meta: [entry.source_service, entry.reference_id_value].filter(Boolean).join(" | "),
    body: JSON.stringify(entry.payload),
  }));
  renderList(dom.eventList, context.recent_events, (entry) => ({
    title: entry.event_type,
    badge: entry.actor_id,
    meta: entry.created_at,
    body: JSON.stringify(entry.payload),
  }));
}

function renderSuggestions(suggestions) {
  dom.suggestionList.replaceChildren();
  if (!suggestions.length) {
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = '<div class="item-meta">Keine offenen Vorschlaege</div>';
    dom.suggestionList.append(empty);
    return;
  }

  suggestions.forEach((suggestion) => {
    const item = document.createElement("article");
    item.className = "item suggestion-item";
    item.innerHTML = `
      <div class="item-title">
        <span></span>
        <span class="status-pill"></span>
      </div>
      <div class="item-meta source"></div>
      <div class="item-meta summary"></div>
      <details class="suggestion-why">
        <summary>Warum vorgeschlagen?</summary>
        <div class="why-content"></div>
      </details>
      <div class="review-questions">
        <label><input type="checkbox"> korrekt</label>
        <label><input type="checkbox"> vollstaendig</label>
        <label><input type="checkbox"> verstaendlich</label>
        <label><input type="checkbox"> dauerhaft relevant</label>
        <label><input type="checkbox"> kein Duplikat</label>
      </div>
      <div class="suggestion-actions">
        <button type="button" data-action="accept">Als Kontextbaustein uebernehmen</button>
        <button type="button" data-action="unclear">Offen lassen</button>
        <button type="button" data-action="reject">Verwerfen</button>
        <button type="button" data-action="edit">Bearbeiten</button>
      </div>
      <form class="suggestion-editor" hidden>
        <label>
          Titel
          <input name="title">
        </label>
        <label>
          Summary
          <textarea name="summary" rows="3"></textarea>
        </label>
        <label>
          Payload JSON
          <textarea name="payload" rows="7"></textarea>
        </label>
        <div class="suggestion-actions">
          <button type="submit" class="primary">Speichern</button>
          <button type="button" data-action="accept-edited">Speichern und als Kontextbaustein uebernehmen</button>
        </div>
      </form>
    `;
    item.querySelector(".item-title span:first-child").textContent = suggestion.title;
    item.querySelector(".status-pill").textContent = `${displayType(suggestion.type)} ${displayStatus(suggestion.status)} ${Math.round(Number(suggestion.confidence || 0) * 100)}%`;
    item.querySelector(".source").textContent = suggestion.source || "";
    item.querySelector(".summary").textContent = suggestion.summary || "";
    item.querySelector(".why-content").textContent = suggestionWhyText(suggestion);
    item.querySelector('[name="title"]').value = suggestion.title || "";
    item.querySelector('[name="summary"]').value = suggestion.summary || "";
    item.querySelector('[name="payload"]').value = JSON.stringify(suggestion.payload || {}, null, 2);
    item.querySelector('[data-action="accept"]').addEventListener("click", () => acceptSuggestion(suggestion.id));
    item.querySelector('[data-action="unclear"]').addEventListener("click", () => showToast("Bleibt offen. Nichts wurde in den Projektkontext uebernommen."));
    item.querySelector('[data-action="reject"]').addEventListener("click", () => rejectSuggestion(suggestion.id));
    item.querySelector('[data-action="edit"]').addEventListener("click", () => {
      const editor = item.querySelector(".suggestion-editor");
      editor.hidden = !editor.hidden;
    });
    item.querySelector('[data-action="accept-edited"]').addEventListener("click", () => acceptSuggestion(suggestion.id, suggestionPatch(item)));
    item.querySelector(".suggestion-editor").addEventListener("submit", (event) => {
      event.preventDefault();
      updateSuggestion(suggestion.id, suggestionPatch(item));
    });
    dom.suggestionList.append(item);
  });
}

function renderList(target, entries = [], mapEntry) {
  target.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "item";
    empty.innerHTML = '<div class="item-meta">Keine Eintraege</div>';
    target.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const view = mapEntry(entry);
    const item = document.createElement("article");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">
        <span></span>
        <span class="status-pill"></span>
      </div>
      <div class="item-meta"></div>
      <div class="item-meta"></div>
    `;
    item.querySelector(".item-title span:first-child").textContent = view.title || "Ohne Titel";
    item.querySelector(".status-pill").textContent = view.badge || "offen";
    item.querySelectorAll(".item-meta")[0].textContent = view.meta || "";
    item.querySelectorAll(".item-meta")[1].textContent = view.body || "";
    target.append(item);
  });
}

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `${name}Tab`));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function runAction(action) {
  try {
    setStatus("arbeitet");
    await action();
    if (dom.scopeStatus.textContent === "arbeitet") setStatus("bereit");
  } catch (error) {
    setStatus("fehler");
    showToast(error.message, true);
  }
}

function setStatus(value) {
  dom.scopeStatus.textContent = value;
}

function showToast(message, isError = false) {
  dom.toast.textContent = message;
  dom.toast.classList.toggle("error", isError);
  dom.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    dom.toast.hidden = true;
  }, 3600);
}

function text(form, name) {
  return String(form.get(name) || "").trim();
}

function csv(form, name) {
  return text(form, name).split(",").map((entry) => entry.trim()).filter(Boolean);
}

function parseJson(value, label) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    throw new Error(`${label} ist kein gueltiges JSON`);
  }
}

function suggestionPatch(item) {
  return {
    title: item.querySelector('[name="title"]').value.trim(),
    summary: item.querySelector('[name="summary"]').value.trim(),
    payload: parseJson(item.querySelector('[name="payload"]').value, "Payload JSON"),
  };
}

function analysisText(result) {
  const summary = result.summary || {};
  return `${result.created_count} neue Vorschlaege gefunden: ${summary.requirement || 0} Requirements, ${summary.decision || 0} Entscheidungen, ${summary.artifact || 0} Artefakte, ${summary.runtime || 0} Runtime-Komponenten, ${summary.event || 0} Events`;
}

function suggestionWhyText(suggestion) {
  const payload = suggestion.payload || {};
  const hints = [
    `Quelle: ${suggestion.source || "unbekannt"}`,
    `Typ: ${displayType(suggestion.type)}`,
    `Sicherheit: ${Math.round(Number(suggestion.confidence || 0) * 100)}%`,
  ];
  if (payload.path) hints.push(`Pfad: ${payload.path}`);
  if (payload.requirement_id) hints.push(`Requirement: ${payload.requirement_id}`);
  if (payload.reference_id || payload.reference_id_value) hints.push(`Komponente: ${payload.reference_id || payload.reference_id_value}`);
  return hints.join(" | ");
}

function displayType(type) {
  return {
    requirement: "Requirement",
    decision: "Entscheidung",
    artifact: "Artefakt",
    runtime: "Runtime",
    event: "Event",
  }[type] || type;
}

function displayStatus(status) {
  return {
    pending: "offen",
    accepted: "uebernommen",
    rejected: "verworfen",
  }[status] || status || "offen";
}
