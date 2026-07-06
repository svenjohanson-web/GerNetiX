const state = {
  projects: [],
  devices: [],
  builds: [],
  hardwareShop: { offers: [], recommendations: [] },
  aiUsage: { credits: {}, usage_events: {}, model_summary: [] },
  account: null,
  activeProject: null,
  activeStep: 0,
  selectedDeviceId: "",
};

const projectList = document.querySelector("#projectList");
const deviceList = document.querySelector("#deviceList");
const hardwareRecommendations = document.querySelector("#hardwareRecommendations");
const hardwareOffers = document.querySelector("#hardwareOffers");
const aiUsageSummary = document.querySelector("#aiUsageSummary");
const aiDemoButton = document.querySelector("#aiDemoButton");
const buildList = document.querySelector("#buildList");
const accountSummary = document.querySelector("#accountSummary");
const lessonView = document.querySelector("#lessonView");
const stepRail = document.querySelector("#stepRail");
const lessonTitle = document.querySelector("#lessonTitle");
const lessonEyebrow = document.querySelector("#lessonEyebrow");
const stepCounter = document.querySelector("#stepCounter");
const stepTitle = document.querySelector("#stepTitle");
const stepText = document.querySelector("#stepText");
const stepInsight = document.querySelector("#stepInsight");
const selectedDeviceLabel = document.querySelector("#selectedDeviceLabel");
const prevButton = document.querySelector("#prevButton");
const nextButton = document.querySelector("#nextButton");
const buildButton = document.querySelector("#buildButton");

bootstrap();

document.querySelector("#backButton").addEventListener("click", showProjectList);
document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => activateView(button.dataset.view));
});

prevButton.addEventListener("click", () => selectStep(Math.max(0, state.activeStep - 1)));
nextButton.addEventListener("click", () => {
  if (state.activeStep >= state.activeProject.steps.length - 1) showProjectList();
  else selectStep(state.activeStep + 1);
});
buildButton.addEventListener("click", startBuild);
aiDemoButton.addEventListener("click", runAiDemo);

async function bootstrap() {
  const summary = await getJson("/api/user-ide/summary");
  state.projects = summary.projects;
  state.devices = summary.devices;
  state.builds = summary.builds;
  state.hardwareShop = summary.hardware_shop;
  state.aiUsage = summary.ai_usage;
  state.account = summary.account;
  state.selectedDeviceId = state.devices.find((device) => device.ota_status === "ready")?.device_id || state.devices[0]?.device_id || "";

  renderProjectList();
  renderDevices();
  renderHardwareShop();
  renderAiUsage();
  renderBuilds();
  renderAccount();
}

function renderProjectList() {
  projectList.innerHTML = state.projects.map((item) => `
    <article class="project-card">
      <p class="eyebrow">${escapeHtml(item.area)}</p>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.summary)}</p>
      <dl class="meta-list">
        <div><dt>Status</dt><dd>${escapeHtml(item.status)}</dd></div>
        <div><dt>Build</dt><dd>${escapeHtml(item.last_build_status || "noch keiner")}</dd></div>
        <div><dt>Quellen</dt><dd>${escapeHtml(item.source_count || 0)}</dd></div>
      </dl>
      <div class="card-actions">
        <button type="button" data-project="${escapeHtml(item.slug)}">Oeffnen</button>
        <button class="secondary" type="button" data-build-project="${escapeHtml(item.slug)}">Build</button>
      </div>
    </article>
  `).join("");

  projectList.querySelectorAll("[data-project]").forEach((button) => {
    button.addEventListener("click", () => startProject(button.dataset.project));
  });
  projectList.querySelectorAll("[data-build-project]").forEach((button) => {
    button.addEventListener("click", () => startBuildForProject(button.dataset.buildProject));
  });
}

function renderDevices() {
  deviceList.innerHTML = state.devices.map((device) => `
    <article class="device-row ${device.device_id === state.selectedDeviceId ? "selected" : ""}">
      <div>
        <h3>${escapeHtml(device.display_name)}</h3>
        <p>${escapeHtml(device.hardware_profile_id)}</p>
      </div>
      <dl class="meta-list compact">
        <div><dt>Echtheit</dt><dd>${escapeHtml(device.authenticity_status)}</dd></div>
        <div><dt>Online</dt><dd>${escapeHtml(device.connectivity_status)}</dd></div>
        <div><dt>OTA</dt><dd>${escapeHtml(device.ota_status)}</dd></div>
      </dl>
      <button type="button" data-device="${escapeHtml(device.device_id)}">${device.device_id === state.selectedDeviceId ? "Ausgewaehlt" : "Waehlen"}</button>
    </article>
  `).join("");

  deviceList.querySelectorAll("[data-device]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDeviceId = button.dataset.device;
      renderDevices();
      renderStep();
    });
  });
}

function renderHardwareShop() {
  hardwareRecommendations.innerHTML = state.hardwareShop.recommendations.map((recommendation) => {
    const best = recommendation.matches[0];
    return `
      <article class="hardware-row">
        <div>
          <p class="eyebrow">${escapeHtml(recommendation.project_title)}</p>
          <h3>${best ? escapeHtml(best.offer.title) : "Kein Angebot"}</h3>
          <p>${escapeHtml(recommendation.required_capability_ids.join(", "))}</p>
        </div>
        ${best ? renderMatchMeta(best) : ""}
        ${best ? `<button type="button" data-buy-offer="${escapeHtml(best.offer.offer_id)}">Kaufen</button>` : ""}
      </article>
    `;
  }).join("");

  hardwareOffers.innerHTML = state.hardwareShop.offers.map((offer) => `
    <article class="hardware-card">
      <p class="eyebrow">${escapeHtml(offer.offer_type)}</p>
      <h3>${escapeHtml(offer.title)}</h3>
      <p>${escapeHtml(offer.summary)}</p>
      <dl class="meta-list">
        <div><dt>Preis</dt><dd>${formatPrice(offer.price)}</dd></div>
        <div><dt>Bestand</dt><dd>${escapeHtml(offer.stock_state)}</dd></div>
        <div><dt>Support</dt><dd>${escapeHtml(offer.support_basis)}</dd></div>
      </dl>
      <div class="capability-list">${offer.capability_ids.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}</div>
      <div class="card-actions">
        <button type="button" data-buy-offer="${escapeHtml(offer.offer_id)}">Kaufen</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-buy-offer]").forEach((button) => {
    button.addEventListener("click", () => buyHardwareOffer(button.dataset.buyOffer));
  });
}

function renderAiUsage() {
  const credits = state.aiUsage.credits || {};
  const usage = state.aiUsage.usage_events || {};
  const sections = [
    ["Verfuegbar", `${credits.available_credits ?? 0}`],
    ["Verbraucht", `${credits.consumed_credits ?? 0}`],
    ["Gebucht", `${credits.total_granted_credits ?? 0}`],
    ["Events", `${usage.total_events ?? 0}`],
    ["Erfolgreich", `${usage.successful ?? 0}`],
    ["Abgelehnt", `${usage.rejected ?? 0}`],
    ["AI Usage", state.account.ai_usage],
  ];
  aiUsageSummary.innerHTML = sections.map(([title, value]) => `
    <article class="summary-card">
      <p class="eyebrow">${escapeHtml(title)}</p>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");
}

function renderMatchMeta(match) {
  return `
    <dl class="meta-list compact">
      <div><dt>Match</dt><dd>${Math.round(match.match_score * 100)}%</dd></div>
      <div><dt>Status</dt><dd>${match.selectable ? "passend" : "unvollstaendig"}</dd></div>
      <div><dt>Fehlt</dt><dd>${escapeHtml(match.missing_capability_ids.join(", ") || "nichts")}</dd></div>
    </dl>
  `;
}

function renderBuilds() {
  buildList.innerHTML = state.builds.length ? state.builds.map((build) => `
    <article class="build-row">
      <div>
        <h3>${escapeHtml(build.project_title)}</h3>
        <p>${escapeHtml(build.device_label)} · ${escapeHtml(build.mode)}</p>
      </div>
      <dl class="meta-list compact">
        <div><dt>Status</dt><dd>${escapeHtml(build.status)}</dd></div>
        <div><dt>Zeit</dt><dd>${escapeHtml(new Date(build.created_at).toLocaleTimeString("de-DE"))}</dd></div>
        <div><dt>Artifact</dt><dd>${build.artifact_url ? `<a href="${escapeHtml(build.artifact_url)}">firmware.bin</a>` : "offen"}</dd></div>
      </dl>
    </article>
  `).join("") : `<p class="empty">Noch keine Builds gestartet.</p>`;
}

function renderAccount() {
  const sections = [
    ["Identitaet", state.account.username],
    ["Plan", state.account.plan],
    ["Capabilities", state.account.capabilities.join(", ")],
    ["Devices", `${state.devices.length}`],
    ["KI-Credits", `${state.account.ai_credits}`],
    ["Consents", state.account.consent_summary],
    ["Project Server", state.account.project_server],
    ["Build Deploy", state.account.build_deploy_server],
    ["Hardware Shop", state.account.hardware_shop],
    ["Device Mgmt", state.account.device_management],
    ["AI Usage", state.account.ai_usage],
  ];
  accountSummary.innerHTML = sections.map(([title, value]) => `
    <article class="summary-card">
      <p class="eyebrow">${escapeHtml(title)}</p>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");
}

function startProject(slug) {
  state.activeProject = state.projects.find((item) => item.slug === slug);
  state.activeStep = 0;
  document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
  lessonView.classList.remove("hidden");
  lessonTitle.textContent = state.activeProject.title;
  lessonEyebrow.textContent = state.activeProject.area;
  renderRail();
  renderStep();
}

function showProjectList() {
  lessonView.classList.add("hidden");
  activateView("projectsView");
}

function activateView(viewId) {
  lessonView.classList.add("hidden");
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== viewId);
    view.classList.toggle("active-view", view.id === viewId);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewId);
  });
}

function selectStep(index) {
  state.activeStep = index;
  renderRail();
  renderStep();
}

function renderRail() {
  stepRail.innerHTML = state.activeProject.steps.map((item, index) => `
    <button class="step-item ${index === state.activeStep ? "active" : ""}" type="button" data-step="${index}">
      ${index + 1}. ${escapeHtml(item.title)}
    </button>
  `).join("");
  stepRail.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => selectStep(Number(button.dataset.step)));
  });
}

function renderStep() {
  if (!state.activeProject) return;
  const item = state.activeProject.steps[state.activeStep];
  const selectedDevice = state.devices.find((device) => device.device_id === state.selectedDeviceId);
  stepCounter.textContent = `Schritt ${state.activeStep + 1} von ${state.activeProject.steps.length}`;
  stepTitle.textContent = item.title;
  stepText.textContent = item.text;
  stepInsight.textContent = item.insight;
  selectedDeviceLabel.textContent = selectedDevice
    ? `${selectedDevice.display_name} · ${selectedDevice.ota_status}`
    : "Kein Device ausgewaehlt";
  prevButton.disabled = state.activeStep === 0;
  nextButton.textContent = state.activeStep >= state.activeProject.steps.length - 1 ? "Projektwahl" : "Weiter";
  buildButton.disabled = !selectedDevice || selectedDevice.ota_status !== "ready";
}

async function startBuild() {
  if (!state.activeProject) return;
  await startBuildForProject(state.activeProject.slug);
}

async function startBuildForProject(slug) {
  const response = await fetch("/api/user-ide/build-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_slug: slug,
      device_id: state.selectedDeviceId,
      mode: "build_and_flash",
    }),
  });
  const build = await response.json();
  if (!response.ok) {
    alert(build.message || "Build konnte nicht gestartet werden.");
    return;
  }
  state.builds.unshift(build);
  state.projects = state.projects.map((project) => (
    project.slug === slug ? { ...project, last_build_status: build.status } : project
  ));
  renderProjectList();
  renderBuilds();
  activateView("buildsView");
}

async function buyHardwareOffer(offerId) {
  const response = await fetch("/api/user-ide/hardware-shop/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offer_id: offerId, quantity: 1 }),
  });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.message || "Hardware-Kauf konnte nicht erstellt werden.");
    return;
  }
  alert(`Demo-Bestellung ${payload.order.order_id} erstellt. Device Management kennt den Purchase Context ${payload.device_management_purchase_context.purchase_context_id}.`);
}

async function runAiDemo() {
  const response = await fetch("/api/user-ide/ai-demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: state.activeProject?.project_server_id || state.projects[0]?.project_server_id || "",
      estimated_input_tokens: 600,
      estimated_output_tokens: 300,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    alert(payload.rejection_reason || payload.message || "KI-Preflight wurde abgelehnt.");
    return;
  }
  state.aiUsage = await getJson("/api/user-ide/ai-usage");
  state.account.ai_credits = state.aiUsage.credits.available_credits;
  renderAiUsage();
  renderAccount();
  alert(`KI-Demo gebucht: ${payload.completed.calculated_credits} Credits.`);
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function formatPrice(price) {
  if (!price) return "";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: price.currency || "EUR" })
    .format(Number(price.amount_cents || 0) / 100);
}
