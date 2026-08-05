let communityPortalEventsBound = false;

function bindCommunityPortalEvents() {
  if (communityPortalEventsBound) return;
  communityPortalEventsBound = true;
  document.querySelector("#communityPortalSearch")?.addEventListener("input", renderCommunityPortal);
  document.querySelector("#communityActivityList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-community-activity]");
    if (!button) return;
    if (button.dataset.communityActivity === "idea") openProjectIdea(button.dataset.communityActivityId);
    if (button.dataset.communityActivity === "showcase") openProjectShowcase(button.dataset.communityActivityId);
    if (button.dataset.communityActivity === "question") openCommunityQuestion(button.dataset.communityActivityId);
  });
  document.querySelector("#communityPortalNav")?.addEventListener("click", scrollToCommunityTarget);
  document.querySelector(".community-challenge")?.addEventListener("click", scrollToCommunityTarget);
  document.querySelector("#projectShowcaseForm")?.addEventListener("submit", submitProjectShowcase);
  document.querySelector("#projectShowcaseRefreshButton")?.addEventListener("click", () => loadCommunityPortal(true));
  document.querySelector("#projectShowcaseList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-project-showcase]");
    if (button) openProjectShowcase(button.dataset.projectShowcase);
  });
}

function scrollToCommunityTarget(event) {
  const button = event.target.closest("[data-community-target]");
  if (button) document.querySelector(`#${button.dataset.communityTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadCommunityPortal(force = false) {
  if (state.projectShowcases.loading || (state.projectShowcases.loaded && !force)) return;
  state.projectShowcases.loading = true;
  try {
    const [questions, ideas, showcases, marketplace, messages] = await Promise.all([
      getJson("/api/community/questions"), getJson("/api/community/ideas"), getJson("/api/community/showcases"),
      getJson("/api/community/marketplace/listings"), getJson("/api/community/message-threads"),
    ]);
    state.community.questions = questions.items || [];
    state.projectIdeas.items = ideas.items || [];
    state.projectIdeas.loaded = true;
    state.projectShowcases.items = showcases.items || [];
    state.projectShowcases.loaded = true;
    state.marketplace.items = marketplace.items || [];
    state.marketplace.loaded = true;
    state.messages.unreadCount = messages.unread_count || 0;
    state.projectShowcases.error = "";
  } catch (error) {
    state.projectShowcases.error = error.message || "Die Community-Übersicht ist gerade nicht erreichbar.";
  } finally {
    state.projectShowcases.loading = false;
    configureSupportRequestMode();
    renderCommunity();
    renderProjectIdeas();
    renderProjectShowcases();
    renderCommunityPortal();
  }
}

function renderCommunityPortal() {
  const term = String(document.querySelector("#communityPortalSearch")?.value || "").trim().toLowerCase();
  const collections = {
    forum: state.community.questions || [], ideas: state.projectIdeas.items || [],
    showcases: state.projectShowcases.items || [], marketplace: state.marketplace.items || [],
  };
  Object.entries(collections).forEach(([key, items]) => {
    const count = document.querySelector(`[data-community-count="${key}"]`);
    if (count) count.textContent = `${formatNumber(items.length)} ${items.length === 1 ? "Beitrag" : "Beiträge"}`;
  });
  document.querySelectorAll(".community-portal-card").forEach((card) => {
    card.hidden = Boolean(term && !card.textContent.toLowerCase().includes(term));
  });
  const activity = [
    ...collections.ideas.map((item) => ({ kind: "Idee", type: "idea", id: item.idea_id, title: item.title, text: item.pitch, at: item.updated_at })),
    ...collections.showcases.map((item) => ({ kind: "Projekt", type: "showcase", id: item.showcase_id, title: item.title, text: item.summary, at: item.updated_at })),
    ...collections.forum.map((item) => ({ kind: "Forum", type: "question", id: item.question_id, title: item.title, text: `${item.answer_count || 0} Antworten`, at: item.updated_at })),
  ].filter((item) => !term || `${item.kind} ${item.title} ${item.text}`.toLowerCase().includes(term))
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 6);
  const target = document.querySelector("#communityActivityList");
  if (target) target.innerHTML = activity.length ? activity.map((item) => `<button type="button" data-community-activity="${escapeAttribute(item.type)}" data-community-activity-id="${escapeAttribute(item.id)}"><span>${escapeHtml(item.kind)}</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.text)}</small></button>`).join("") : `<p class="empty">${escapeHtml(state.projectShowcases.error || "Keine passenden Community-Beiträge gefunden.")}</p>`;
  const personal = document.querySelector("#communityPersonalOverview");
  if (personal) personal.innerHTML = `<div><strong>${formatNumber(collections.ideas.filter((item) => item.is_owner).length)}</strong><span>eigene Ideen</span></div><div><strong>${formatNumber(collections.showcases.filter((item) => item.is_owner).length)}</strong><span>gezeigte Projekte</span></div><div><strong>${formatNumber(state.communitySummary?.total || 0)}</strong><span>eigene Anfragen</span></div><div><strong>${formatNumber(state.messages.unreadCount || 0)}</strong><span>ungelesene Nachrichten</span></div>`;
}

function renderProjectShowcases() {
  const select = document.querySelector("#projectShowcaseProjectSelect");
  if (select) select.innerHTML = `<option value="">Entwicklungsprojekt wählen</option>${accountDevelopmentProjects().map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`).join("")}`;
  const target = document.querySelector("#projectShowcaseList");
  if (!target) return;
  const items = state.projectShowcases.items || [];
  target.innerHTML = state.projectShowcases.loading ? `<p class="helper-text">Projekte werden geladen …</p>` : items.length ? items.map((item) => `<button class="project-showcase-card" type="button" data-project-showcase="${escapeAttribute(item.showcase_id)}"><span>Community-Projekt · ${item.verification_state === "community_unverified" ? "ungeprüft" : "verifiziert"}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.summary)}</p><small>${escapeHtml(item.author_label || "Community-Mitglied")} · ${formatNumber(item.source_count || 0)} Dateien</small></button>`).join("") : `<p class="empty">Noch keine Projekte präsentiert.</p>`;
}

async function submitProjectShowcase(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const status = document.querySelector("#projectShowcaseStatus");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  status.textContent = "Sichere Projektkopie wird erstellt …";
  try {
    const showcase = await postJson("/api/community/showcases", {
      project_id: data.get("project_id"), title: data.get("title"), summary: data.get("summary"), story: data.get("story"),
      hardware_items: String(data.get("hardware_items") || "").split("\n").map((item) => item.trim()).filter(Boolean),
      tags: String(data.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean),
    });
    form.reset();
    status.textContent = "Dein Projekt ist jetzt im Community-Showcase sichtbar.";
    await loadCommunityPortal(true);
    await openProjectShowcase(showcase.showcase_id);
  } catch (error) { status.textContent = error.message || "Das Projekt konnte nicht veröffentlicht werden."; }
  finally { button.disabled = false; }
}

async function openProjectShowcase(showcaseId) {
  try {
    const item = await getJson(`/api/community/showcases/${encodeURIComponent(showcaseId)}`);
    document.querySelector("#projectShowcaseDetail")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "projectShowcaseDetail";
    overlay.className = "runtime-modal";
    const sources = item.project_snapshot?.sources || [];
    overlay.innerHTML = `<section class="runtime-dialog project-showcase-detail" role="dialog" aria-modal="true"><header class="runtime-dialog-header"><div><p class="eyebrow">Community-Projekt · ungeprüft</p><h2>${escapeHtml(item.title)}</h2></div><button type="button">Schließen</button></header><p class="project-showcase-summary">${escapeHtml(item.summary)}</p><div class="project-showcase-story"><h3>Projektgeschichte</h3><p>${escapeHtml(item.story)}</p></div><h3>Verwendete Hardware</h3><ul>${(item.hardware_items || []).map((part) => `<li>${escapeHtml(part)}</li>`).join("") || "<li>Keine Hardwareliste angegeben</li>"}</ul><details><summary>Schreibgeschützte Projektkopie · ${formatNumber(sources.length)} Dateien</summary><ul>${sources.map((source) => `<li><code>${escapeHtml(source.path)}</code></li>`).join("")}</ul></details><p class="community-marketplace-warning">Community-Inhalt: vor Verwendung selbst prüfen. Das Projekt ist nicht von GerNetiX verifiziert.</p></section>`;
    overlay.querySelector("button").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.append(overlay);
  } catch (error) { window.alert(error.message || "Das Community-Projekt konnte nicht geöffnet werden."); }
}
