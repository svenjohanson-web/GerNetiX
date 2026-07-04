const state = {
  mode: "metamodel",
  metamodelTypes: [],
  selectedMetamodelType: null,
  types: [],
  selectedType: null,
  artifacts: [],
  selectedArtifactId: null
};

const els = {
  dbInfo: document.querySelector("#dbInfo"),
  reloadButton: document.querySelector("#reloadButton"),
  metamodelModeButton: document.querySelector("#metamodelModeButton"),
  instanceModeButton: document.querySelector("#instanceModeButton"),
  metamodelWorkspace: document.querySelector("#metamodelWorkspace"),
  instanceWorkspace: document.querySelector("#instanceWorkspace"),
  metamodelTypeSearch: document.querySelector("#metamodelTypeSearch"),
  metamodelTypeList: document.querySelector("#metamodelTypeList"),
  metamodelRuleList: document.querySelector("#metamodelRuleList"),
  metamodelTitle: document.querySelector("#metamodelTitle"),
  metamodelId: document.querySelector("#metamodelId"),
  metamodelDetails: document.querySelector("#metamodelDetails"),
  metamodelGraphSvg: document.querySelector("#metamodelGraphSvg"),
  metamodelReferencesList: document.querySelector("#metamodelReferencesList"),
  metamodelReferencedByList: document.querySelector("#metamodelReferencedByList"),
  metamodelInstancesList: document.querySelector("#metamodelInstancesList"),
  typeSearch: document.querySelector("#typeSearch"),
  typeList: document.querySelector("#typeList"),
  artifactSearch: document.querySelector("#artifactSearch"),
  artifactList: document.querySelector("#artifactList"),
  instanceTitle: document.querySelector("#instanceTitle"),
  selectedType: document.querySelector("#selectedType"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedId: document.querySelector("#selectedId"),
  artifactDetails: document.querySelector("#artifactDetails"),
  incomingList: document.querySelector("#incomingList"),
  outgoingList: document.querySelector("#outgoingList"),
  graphSvg: document.querySelector("#graphSvg")
};

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function text(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function makeButton(className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function setMode(mode) {
  state.mode = mode;
  els.metamodelWorkspace.classList.toggle("hidden", mode !== "metamodel");
  els.instanceWorkspace.classList.toggle("hidden", mode !== "instances");
  els.metamodelModeButton.classList.toggle("active", mode === "metamodel");
  els.instanceModeButton.classList.toggle("active", mode === "instances");
}

function renderMetamodelTypes() {
  const filter = els.metamodelTypeSearch.value.trim().toLowerCase();
  clear(els.metamodelTypeList);
  const types = state.metamodelTypes.filter((type) => {
    return !filter || type.id.toLowerCase().includes(filter) || type.name.toLowerCase().includes(filter);
  });

  for (const type of types) {
    const button = makeButton(
      `list-button${state.selectedMetamodelType === type.id ? " active" : ""}`,
      () => selectMetamodelType(type.id)
    );
    button.innerHTML = `
      <span class="list-title">${escapeHtml(type.id)}</span>
      <span class="list-meta">${escapeHtml(type.name)} | Metamodelltyp</span>
    `;
    els.metamodelTypeList.appendChild(button);
  }
}

function renderMetamodelType(payload) {
  const type = payload.type;
  state.selectedMetamodelType = type.id;
  els.metamodelTitle.textContent = type.name || type.id;
  els.metamodelId.textContent = type.id;

  clear(els.metamodelDetails);
  const entries = [
    ["Typ-ID", type.id],
    ["Name", type.name],
    ["Beschreibung", type.description],
    ["Quelle", type.source],
    ["Erlaubt", type.is_allowed ? "ja" : "nein"],
    ["Instanzen", `${type.instance_count} aktuelle Instanzen`]
  ];
  for (const [label, value] of entries) appendDetail(els.metamodelDetails, label, value);

  renderMetamodelRules(els.metamodelReferencesList, payload.references, "references");
  renderMetamodelRules(els.metamodelReferencedByList, payload.referencedBy, "referencedBy");
  renderMetamodelRuleSummary(payload);
  renderMetamodelInstances(payload.instances);
  renderMetamodelGraph(payload);
  renderMetamodelTypes();
}

function renderMetamodelRuleSummary(payload) {
  clear(els.metamodelRuleList);
  const groups = [
    ["Darf referenzieren", payload.references],
    ["Darf referenziert werden von", payload.referencedBy]
  ];
  for (const [title, rules] of groups) {
    const heading = document.createElement("div");
    heading.className = "list-section-heading";
    heading.textContent = title;
    els.metamodelRuleList.appendChild(heading);
    if (!rules.length) {
      const empty = document.createElement("p");
      empty.className = "empty compact";
      empty.textContent = "Keine Regel definiert.";
      els.metamodelRuleList.appendChild(empty);
      continue;
    }
    for (const rule of rules) {
      const item = document.createElement("div");
      item.className = "rule-row";
      item.innerHTML = `
        <span class="list-title">${escapeHtml(rule.relationship_type)}</span>
        <span class="list-meta">${escapeHtml(rule.related_type)}</span>
      `;
      els.metamodelRuleList.appendChild(item);
    }
  }
}

function renderMetamodelRules(container, rules, kind) {
  clear(container);
  if (!rules.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Keine Regel definiert.";
    container.appendChild(empty);
    return;
  }

  for (const rule of rules) {
    const item = document.createElement("div");
    item.className = "relation-item neutral";
    const meta = document.createElement("div");
    meta.className = "relation-type";
    meta.textContent = `${rule.relationship_type} | ${rule.source}`;
    const button = makeButton("relation-target", () => selectMetamodelType(rule.related_type));
    button.textContent = kind === "references"
      ? `Referenzziel: ${rule.related_type}`
      : `Referenzquelle: ${rule.related_type}`;
    item.append(meta, button);
    container.appendChild(item);
  }
}

function renderMetamodelInstances(instances) {
  clear(els.metamodelInstancesList);
  if (!instances.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Keine Instanzen vorhanden. Der Entitaetstyp bleibt dennoch Teil des Metamodells.";
    els.metamodelInstancesList.appendChild(empty);
    return;
  }
  for (const instance of instances) {
    const item = document.createElement("div");
    item.className = "relation-item neutral";
    const meta = document.createElement("div");
    meta.className = "relation-type";
    meta.textContent = instance.status || "kein Status";
    const button = makeButton("relation-target", () => {
      setMode("instances");
      selectType(state.selectedMetamodelType).then(() => selectArtifact(instance.id));
    });
    button.textContent = `${instance.title} (${instance.id})`;
    item.append(meta, button);
    els.metamodelInstancesList.appendChild(item);
  }
}

function renderMetamodelGraph(payload) {
  clear(els.metamodelGraphSvg);
  const width = els.metamodelGraphSvg.clientWidth || 720;
  const height = 380;
  els.metamodelGraphSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const selectedId = payload.type.id;
  const related = new Map();
  for (const rule of payload.references) related.set(rule.related_type, { id: rule.related_type, kind: "target" });
  for (const rule of payload.referencedBy) {
    if (!related.has(rule.related_type)) related.set(rule.related_type, { id: rule.related_type, kind: "source" });
  }
  const nodes = Array.from(related.values()).slice(0, 34);
  const positions = new Map([[selectedId, { x: width / 2, y: height / 2 }]]);
  const radiusX = Math.max(170, Math.min(width / 2 - 95, 360));
  const radiusY = 135;
  nodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1) - Math.PI / 2;
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * radiusX,
      y: height / 2 + Math.sin(angle) * radiusY
    });
  });

  for (const rule of [...payload.references, ...payload.referencedBy]) {
    if (!positions.has(rule.related_type)) continue;
    const source = positions.get(selectedId);
    const target = positions.get(rule.related_type);
    const line = svg("line", {
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      stroke: "#8a96a8",
      "stroke-width": "1.5"
    });
    els.metamodelGraphSvg.appendChild(line);
    const label = svg("text", {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2 - 4,
      "text-anchor": "middle",
      "font-size": "10",
      fill: "#5f6d7e"
    });
    label.textContent = rule.relationship_type;
    els.metamodelGraphSvg.appendChild(label);
  }

  drawTypeNode(els.metamodelGraphSvg, positions.get(selectedId), selectedId, "Entitaetstyp", true);
  for (const node of nodes) drawTypeNode(els.metamodelGraphSvg, positions.get(node.id), node.id, node.kind, false);
}

function drawTypeNode(root, pos, title, meta, selected) {
  const group = svg("g", { role: "button", tabindex: "0" });
  group.style.cursor = "pointer";
  group.addEventListener("click", () => selectMetamodelType(title));
  const rect = svg("rect", {
    x: pos.x - (selected ? 92 : 78),
    y: pos.y - 28,
    width: selected ? 184 : 156,
    height: 56,
    rx: "7",
    fill: selected ? "#0f766e" : "#ffffff",
    stroke: selected ? "#0f766e" : "#aeb8c8",
    "stroke-width": selected ? "2" : "1.2"
  });
  const label = svg("text", {
    x: pos.x,
    y: pos.y - 5,
    "text-anchor": "middle",
    "font-size": selected ? "12" : "11",
    "font-weight": "700",
    fill: selected ? "#ffffff" : "#162033"
  });
  label.textContent = shortLabel(title, selected ? 28 : 22);
  const sub = svg("text", {
    x: pos.x,
    y: pos.y + 13,
    "text-anchor": "middle",
    "font-size": "10",
    fill: selected ? "#dff5f1" : "#5f6d7e"
  });
  sub.textContent = meta;
  group.append(rect, label, sub);
  root.appendChild(group);
}

async function selectMetamodelType(typeId) {
  const payload = await getJson(`/api/metamodel/types/${encodeURIComponent(typeId)}`);
  renderMetamodelType(payload);
}

function renderTypes() {
  const filter = els.typeSearch.value.trim().toLowerCase();
  clear(els.typeList);
  const types = state.types.filter((type) => {
    return !filter || type.id.toLowerCase().includes(filter) || type.name.toLowerCase().includes(filter);
  });

  for (const type of types) {
    const button = makeButton(`list-button${state.selectedType === type.id ? " active" : ""}`, () => selectType(type.id));
    button.innerHTML = `
      <span class="list-title">${escapeHtml(type.id)}</span>
      <span class="list-meta">${escapeHtml(type.name)} | ${type.artifact_count} Instanzen</span>
    `;
    els.typeList.appendChild(button);
  }
}

function renderArtifacts() {
  clear(els.artifactList);
  for (const artifact of state.artifacts) {
    const button = makeButton(`list-button${state.selectedArtifactId === artifact.id ? " active" : ""}`, () => selectArtifact(artifact.id));
    button.innerHTML = `
      <span class="list-title">${escapeHtml(artifact.title || artifact.id)}</span>
      <span class="list-meta">${escapeHtml(artifact.id)} | ${escapeHtml(artifact.status || "kein Status")} | ${artifact.relationship_count} Beziehungen</span>
    `;
    els.artifactList.appendChild(button);
  }

  if (!state.artifacts.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Keine Instanzen gefunden.";
    els.artifactList.appendChild(empty);
  }
}

function renderDetails(payload) {
  const artifact = payload.artifact;
  state.selectedArtifactId = artifact.id;
  els.selectedType.textContent = artifact.type;
  els.selectedTitle.textContent = artifact.title || artifact.id;
  els.selectedId.textContent = artifact.id;

  clear(els.artifactDetails);
  const entries = [
    ["Typ", artifact.type],
    ["Status", artifact.status],
    ["Domain", artifact.owner_domain],
    ["Quelle", artifact.source_file ? `${artifact.source_file}:${artifact.source_line}` : null],
    ["Summary", artifact.summary]
  ];
  for (const [label, value] of entries) appendDetail(els.artifactDetails, label, value);

  renderRelationships(els.incomingList, payload.incoming, "incoming");
  renderRelationships(els.outgoingList, payload.outgoing, "outgoing");
  renderArtifacts();
  loadNeighborhood(artifact.id);
}

function renderRelationships(container, relationships, direction) {
  clear(container);
  if (!relationships.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Keine Beziehungen.";
    container.appendChild(empty);
    return;
  }

  for (const rel of relationships) {
    const relatedId = direction === "incoming" ? rel.source_id : rel.target_id;
    const relatedTitle = direction === "incoming" ? rel.source_title : rel.target_title;
    const relatedType = direction === "incoming" ? rel.source_type : rel.target_type;
    const item = document.createElement("div");
    item.className = `relation-item ${direction}`;
    const type = document.createElement("div");
    type.className = "relation-type";
    type.textContent = direction === "incoming"
      ? `${rel.type} | Quelle: ${relatedType}`
      : `${rel.type} | Ziel: ${relatedType}`;
    const button = makeButton("relation-target", () => selectArtifact(relatedId));
    button.textContent = `${relatedTitle} (${relatedId})`;
    item.append(type, button);
    container.appendChild(item);
  }
}

function renderGraph(payload) {
  clear(els.graphSvg);
  const width = els.graphSvg.clientWidth || 720;
  const height = 380;
  els.graphSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const selectedId = payload.selectedId;
  const neighbors = payload.nodes.filter((node) => node.id !== selectedId).slice(0, 34);
  const positions = new Map([[selectedId, { x: width / 2, y: height / 2 }]]);
  const radiusX = Math.max(170, Math.min(width / 2 - 95, 360));
  const radiusY = 135;
  neighbors.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(neighbors.length, 1) - Math.PI / 2;
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * radiusX,
      y: height / 2 + Math.sin(angle) * radiusY
    });
  });

  for (const rel of payload.relationships) {
    if (!positions.has(rel.source_id) || !positions.has(rel.target_id)) continue;
    const source = positions.get(rel.source_id);
    const target = positions.get(rel.target_id);
    const outgoing = rel.source_id === selectedId;
    const line = svg("line", {
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      stroke: outgoing ? "#b45309" : "#2563eb",
      "stroke-width": "1.7"
    });
    els.graphSvg.appendChild(line);

    const label = svg("text", {
      x: (source.x + target.x) / 2,
      y: (source.y + target.y) / 2 - 4,
      "text-anchor": "middle",
      "font-size": "10",
      fill: "#5f6d7e"
    });
    label.textContent = rel.type;
    els.graphSvg.appendChild(label);
  }

  for (const node of payload.nodes.filter((node) => positions.has(node.id))) {
    drawArtifactNode(els.graphSvg, positions.get(node.id), node, node.id === selectedId);
  }
}

function drawArtifactNode(root, pos, node, selected) {
  const group = svg("g", { role: "button", tabindex: "0" });
  group.style.cursor = "pointer";
  group.addEventListener("click", () => selectArtifact(node.id));
  const rect = svg("rect", {
    x: pos.x - (selected ? 92 : 78),
    y: pos.y - 28,
    width: selected ? 184 : 156,
    height: 56,
    rx: "7",
    fill: selected ? "#0f766e" : "#ffffff",
    stroke: selected ? "#0f766e" : "#aeb8c8",
    "stroke-width": selected ? "2" : "1.2"
  });
  const title = svg("text", {
    x: pos.x,
    y: pos.y - 5,
    "text-anchor": "middle",
    "font-size": selected ? "12" : "11",
    "font-weight": "700",
    fill: selected ? "#ffffff" : "#162033"
  });
  title.textContent = shortLabel(node.title || node.id, selected ? 28 : 22);
  const meta = svg("text", {
    x: pos.x,
    y: pos.y + 13,
    "text-anchor": "middle",
    "font-size": "10",
    fill: selected ? "#dff5f1" : "#5f6d7e"
  });
  meta.textContent = shortLabel(node.type, selected ? 30 : 24);
  group.append(rect, title, meta);
  root.appendChild(group);
}

async function loadNeighborhood(id) {
  const payload = await getJson(`/api/neighborhood/${encodeURIComponent(id)}`);
  renderGraph(payload);
}

async function selectType(typeId) {
  state.selectedType = typeId;
  state.selectedArtifactId = null;
  els.instanceTitle.textContent = `Instanzen: ${typeId}`;
  renderTypes();
  await loadArtifacts();
}

async function loadArtifacts() {
  const params = new URLSearchParams();
  if (state.selectedType) params.set("type", state.selectedType);
  const q = els.artifactSearch.value.trim();
  if (q) params.set("q", q);
  state.artifacts = await getJson(`/api/artifacts?${params.toString()}`);
  renderArtifacts();
}

async function selectArtifact(id) {
  const payload = await getJson(`/api/artifacts/${encodeURIComponent(id)}`);
  renderDetails(payload);
}

async function load() {
  const meta = await getJson("/api/meta");
  els.dbInfo.textContent = `${meta.counts.artifact_types} Metamodelltypen, ${meta.counts.artifacts} Instanzen, ${meta.counts.relationships} Beziehungen | ${meta.dbPath}`;
  state.metamodelTypes = await getJson("/api/metamodel/types");
  state.types = await getJson("/api/types");
  renderMetamodelTypes();
  renderTypes();

  if (!state.selectedMetamodelType && state.metamodelTypes.length) {
    const preferredMeta = state.metamodelTypes.find((type) => type.id === "vision") || state.metamodelTypes[0];
    await selectMetamodelType(preferredMeta.id);
  }

  if (!state.selectedType && state.types.length) {
    const preferred = state.types.find((type) => type.id === "vision") || state.types[0];
    await selectType(preferred.id);
  } else {
    await loadArtifacts();
  }
}

function appendDetail(container, label, value) {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = text(value);
  container.append(dt, dd);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortLabel(value, max) {
  const clean = String(value ?? "");
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function svg(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

els.metamodelModeButton.addEventListener("click", () => setMode("metamodel"));
els.instanceModeButton.addEventListener("click", () => setMode("instances"));
els.metamodelTypeSearch.addEventListener("input", renderMetamodelTypes);
els.typeSearch.addEventListener("input", renderTypes);
els.artifactSearch.addEventListener("input", () => {
  window.clearTimeout(els.artifactSearch._timer);
  els.artifactSearch._timer = window.setTimeout(loadArtifacts, 180);
});
els.reloadButton.addEventListener("click", load);

setMode("metamodel");
load().catch((error) => {
  els.dbInfo.textContent = `Fehler: ${error.message}`;
});
