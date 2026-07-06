const state = {
  account: null,
  projects: [],
  devices: [],
  builds: [],
  billing: null,
  progress: [],
  workspace: null,
  activeProjectId: "",
  activeStep: 0,
  sourcePath: "src/main.cpp",
};

const routeMap = {
  dashboard: "dashboardView",
  learn: "learnView",
  ide: "ideView",
  projects: "projectsView",
  devices: "devicesView",
  builds: "buildsView",
  billing: "billingView",
  auth: "dashboardView",
};

bootstrap();

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/app/auth/";
});

document.querySelectorAll("[data-open-route]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.openRoute));
});
document.querySelector("#continueButton").addEventListener("click", continueLastProject);
document.querySelector("#lessonBackButton").addEventListener("click", () => navigate("/app/learn/"));
document.querySelector("#lessonNextButton").addEventListener("click", nextLessonStep);
document.querySelector("#openIdeButton").addEventListener("click", () => openProjectInIde(state.activeProjectId));
document.querySelector("#ideProjectSelect").addEventListener("change", () => openProjectInIde(document.querySelector("#ideProjectSelect").value));
document.querySelector("#saveSourceButton").addEventListener("click", saveSource);
document.querySelector("#buildButton").addEventListener("click", startBuild);
window.addEventListener("popstate", renderRoute);

async function bootstrap() {
  await refresh();
  renderAll();
  renderRoute();
}

async function refresh() {
  const summary = await getJson("/api/platform/summary");
  state.account = summary.account;
  state.projects = summary.projects;
  state.devices = summary.devices;
  state.builds = summary.builds;
  state.billing = summary.billing;
  state.progress = summary.learning_progress;
  state.workspace = summary.workspace_state;
  state.activeProjectId = new URLSearchParams(window.location.search).get("project") || state.workspace.lastProjectId || state.projects[0]?.id || "";
}

function renderAll() {
  document.querySelector("#accountBadge").textContent = state.account ? `${state.account.username} · ${state.account.plan}` : "";
  renderDashboard();
  renderProjects();
  renderLearn();
  renderIdeShell();
  renderDevices();
  renderBuilds();
  renderBilling();
}

function renderRoute() {
  const route = routeName();
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("hidden", view.id !== routeMap[route]));
  document.querySelectorAll(".tabs a").forEach((link) => link.classList.toggle("active", link.dataset.route === route));
  const projectId = new URLSearchParams(window.location.search).get("project");
  if (route === "learn" && projectId) {
    state.activeProjectId = projectId;
    renderLesson(projectById(projectId));
  }
  if (route === "ide") loadIdeProject();
}

function routeName() {
  const match = window.location.pathname.match(/^\/app\/([^/]+)/);
  return match ? match[1] : "dashboard";
}

function navigate(route) {
  history.pushState({}, "", route);
  renderRoute();
}

function renderDashboard() {
  const last = state.projects.find((project) => project.id === state.workspace.lastProjectId);
  document.querySelector("#continueText").textContent = last
    ? `${last.name} im ${state.workspace.lastMode === "ide" ? "IDE-Modus" : "Lernmodus"}`
    : "Noch kein Projekt geöffnet";
  document.querySelector("#dashboardSummary").innerHTML = [
    ["Account", state.account.username],
    ["Projekte", state.projects.length],
    ["Geräte", state.devices.length],
    ["Builds", state.builds.length],
    ["Letzter Modus", state.workspace.lastMode || "kein Eintrag"],
  ].map(summaryItem).join("");
}

function renderProjects() {
  document.querySelector("#projectList").innerHTML = state.projects.map((project) => `
    <article class="project-card">
      <p class="eyebrow">${escapeHtml(project.type)}</p>
      <h2>${escapeHtml(project.name)}</h2>
      <p>${escapeHtml(project.description)}</p>
      <dl class="meta-list">
        ${meta("Project.id", project.id)}
        ${meta("ownerUserId", project.ownerUserId)}
        ${meta("targetRuntime", project.targetRuntime)}
        ${meta("linkedDeviceId", project.linkedDeviceId || "kein Device")}
      </dl>
      <div class="card-actions">
        <button type="button" data-learn-project="${escapeHtml(project.id)}">Lernen</button>
        <button type="button" data-ide-project="${escapeHtml(project.id)}">In IDE öffnen</button>
      </div>
    </article>
  `).join("");
  document.querySelectorAll("[data-learn-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInLearn(button.dataset.learnProject));
  });
  document.querySelectorAll("[data-ide-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInIde(button.dataset.ideProject));
  });
}

function renderLearn() {
  document.querySelector("#learnProjectList").innerHTML = state.projects.map((project) => {
    const progress = progressFor(project.id);
    return `
      <article class="project-card">
        <p class="eyebrow">${escapeHtml(project.courseId)}</p>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.description)}</p>
        <dl class="meta-list">
          ${meta("Lektion", project.lessonId)}
          ${meta("Fortschritt", `${progress.completedSteps.length}/${project.steps.length}`)}
          ${meta("Projektdateien", project.sourceFiles.map((file) => file.path).join(", "))}
        </dl>
        <div class="card-actions">
          <button type="button" data-learn-project="${escapeHtml(project.id)}">Lernen starten</button>
          <button type="button" data-ide-project="${escapeHtml(project.id)}">In IDE öffnen</button>
        </div>
      </article>
    `;
  }).join("");
  document.querySelectorAll("[data-learn-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInLearn(button.dataset.learnProject));
  });
  document.querySelectorAll("[data-ide-project]").forEach((button) => {
    button.addEventListener("click", () => openProjectInIde(button.dataset.ideProject));
  });
}

function renderLesson(project) {
  const progress = progressFor(project.id);
  state.activeStep = Math.min(progress.currentStep || 0, project.steps.length - 1);
  document.querySelector("#lessonPanel").classList.remove("hidden");
  document.querySelector("#lessonSteps").innerHTML = project.steps.map((step, index) => `
    <button class="${index === state.activeStep ? "active" : ""}" type="button" data-step="${index}">
      ${index + 1}. ${escapeHtml(step.title)}
    </button>
  `).join("");
  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => setLessonStep(Number(button.dataset.step)));
  });
  renderCurrentStep();
}

function renderCurrentStep() {
  const project = projectById(state.activeProjectId);
  if (!project) return;
  const step = project.steps[state.activeStep];
  document.querySelector("#lessonCounter").textContent = `Schritt ${state.activeStep + 1} von ${project.steps.length}`;
  document.querySelector("#lessonTitle").textContent = step.title;
  document.querySelector("#lessonText").textContent = step.text;
  document.querySelector("#lessonInsight").textContent = step.insight;
}

async function setLessonStep(index) {
  const project = projectById(state.activeProjectId);
  state.activeStep = index;
  const completed = new Set(progressFor(project.id).completedSteps);
  for (let step = 0; step < index; step += 1) completed.add(step);
  await saveLearningProgress(project, index, Array.from(completed));
  renderLesson(project);
}

async function nextLessonStep() {
  const project = projectById(state.activeProjectId);
  const completed = new Set(progressFor(project.id).completedSteps);
  completed.add(state.activeStep);
  const next = Math.min(state.activeStep + 1, project.steps.length - 1);
  await saveLearningProgress(project, next, Array.from(completed));
  renderLesson(project);
}

async function saveLearningProgress(project, currentStep, completedSteps) {
  const progress = await postJson("/api/platform/learning-progress", {
    courseId: project.courseId,
    lessonId: project.lessonId,
    projectId: project.id,
    currentStep,
    completedSteps,
  });
  state.progress = state.progress.filter((item) => item.id !== progress.id).concat(progress);
  state.workspace = await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "learn",
    lastRoute: `/app/learn/?project=${encodeURIComponent(project.id)}`,
  });
}

function renderIdeShell() {
  document.querySelector("#ideProjectSelect").innerHTML = state.projects.map((project) => `
    <option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>
  `).join("");
}

async function loadIdeProject() {
  const projectId = new URLSearchParams(window.location.search).get("project") || state.activeProjectId || state.projects[0]?.id;
  if (!projectId) return;
  state.activeProjectId = projectId;
  const project = projectById(projectId);
  document.querySelector("#ideProjectSelect").value = projectId;
  document.querySelector("#ideProjectTitle").textContent = project.name;
  document.querySelector("#ideProjectMeta").innerHTML = [
    ["id", project.id],
    ["ownerUserId", project.ownerUserId],
    ["lastOpenedMode", "ide"],
    ["targetRuntime", project.targetRuntime],
    ["linkedDeviceId", project.linkedDeviceId || "kein Device"],
  ].map(([key, value]) => meta(key, value)).join("");
  const source = await getJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(state.sourcePath)}`);
  document.querySelector("#sourceEditor").value = source.content || "";
  state.workspace = await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(project.id)}`,
  });
}

async function saveSource() {
  const project = projectById(state.activeProjectId);
  await putJson(`/api/platform/projects/${encodeURIComponent(project.id)}/sources/${encodeURIComponent(state.sourcePath)}`, {
    content: document.querySelector("#sourceEditor").value,
  });
  await refresh();
  renderAll();
}

async function startBuild() {
  const project = projectById(state.activeProjectId);
  const device = state.devices.find((item) => item.ota_status === "ready") || state.devices[0];
  if (!device) return;
  const build = await postJson("/api/user-ide/build-jobs", {
    project_slug: project.slug,
    device_id: device.device_id,
    mode: "build_and_flash",
  });
  state.builds.unshift(build);
  navigate("/app/builds/");
  renderBuilds();
}

async function openProjectInLearn(projectId) {
  state.activeProjectId = projectId;
  const project = projectById(projectId);
  await postJson("/api/platform/workspace-state", {
    lastProjectId: project.id,
    lastMode: "learn",
    lastRoute: `/app/learn/?project=${encodeURIComponent(project.id)}`,
  });
  navigate(`/app/learn/?project=${encodeURIComponent(project.id)}`);
  renderLesson(project);
}

async function openProjectInIde(projectId) {
  state.activeProjectId = projectId;
  await postJson("/api/platform/workspace-state", {
    lastProjectId: projectId,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(projectId)}`,
  });
  navigate(`/app/ide/?project=${encodeURIComponent(projectId)}`);
  await loadIdeProject();
}

function continueLastProject() {
  if (!state.workspace.lastProjectId) {
    navigate("/app/learn/");
    return;
  }
  navigate(state.workspace.lastRoute || `/app/${state.workspace.lastMode}/?project=${encodeURIComponent(state.workspace.lastProjectId)}`);
}

function renderDevices() {
  document.querySelector("#deviceList").innerHTML = state.devices.map((device) => `
    <article class="device-row">
      <div>
        <h3>${escapeHtml(device.display_name)}</h3>
        <p>${escapeHtml(device.hardware_profile_id)}</p>
      </div>
      <dl class="meta-list">
        ${meta("authenticity_status", device.authenticity_status)}
        ${meta("connectivity_status", device.connectivity_status)}
        ${meta("ota_status", device.ota_status)}
      </dl>
    </article>
  `).join("");
}

function renderBuilds() {
  document.querySelector("#buildList").innerHTML = state.builds.length ? state.builds.map((build) => `
    <article class="build-row">
      <div>
        <h3>${escapeHtml(build.project_title)}</h3>
        <p>${escapeHtml(build.device_label)} · ${escapeHtml(build.mode)}</p>
      </div>
      <dl class="meta-list">
        ${meta("Status", build.status)}
        ${meta("BuildJob", build.build_job_id)}
      </dl>
    </article>
  `).join("") : `<p class="empty">Noch keine Builds gestartet.</p>`;
}

function renderBilling() {
  document.querySelector("#billingSummary").innerHTML = [
    ["Plan", state.billing.plan],
    ["Entitlements", state.billing.entitlements.join(", ")],
    ["KI-Credits", state.billing.ai_credits.available_credits ?? 0],
    ["Verbrauchte Credits", state.billing.ai_credits.consumed_credits ?? 0],
  ].map(summaryItem).join("");
}

function progressFor(projectId) {
  return state.progress.find((item) => item.projectId === projectId) || { currentStep: 0, completedSteps: [] };
}

function projectById(projectId) {
  return state.projects.find((project) => project.id === projectId) || state.projects[0];
}

function summaryItem([label, value]) {
  return `<article class="summary-item"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong></article>`;
}

function meta(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

async function postJson(url, body) {
  return writeJson("POST", url, body);
}

async function putJson(url, body) {
  return writeJson("PUT", url, body);
}

async function writeJson(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
