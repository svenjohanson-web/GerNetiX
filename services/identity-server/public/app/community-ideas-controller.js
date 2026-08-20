import { formatNumber } from "@app/app-billing-controller.js";
import { escapeAttribute, escapeHtml, getJson, postJson } from "@app/app-runtime-utils.js";
import { state } from "@app/platform-state.js";

async function loadProjectIdeas(force = false) {
  if (state.projectIdeas.loading || (state.projectIdeas.loaded && !force)) return;
  state.projectIdeas.loading = true;
  renderProjectIdeas();
  try {
    const payload = await getJson("/api/community/ideas");
    state.projectIdeas.items = payload.items || [];
    state.projectIdeas.loaded = true;
    state.projectIdeas.error = "";
  } catch (error) {
    state.projectIdeas.items = [];
    state.projectIdeas.error = error.message || "Die Ideenwerkstatt ist gerade nicht erreichbar.";
  } finally {
    state.projectIdeas.loading = false;
    renderProjectIdeas();
  }
}

function renderProjectIdeas() {
  const target = document.querySelector("#projectIdeaList");
  if (!target) return;
  const ideas = state.projectIdeas.items || [];
  target.innerHTML = state.projectIdeas.loading ? `<p class="helper-text">Projektideen werden geladen …</p>`
    : ideas.length ? ideas.map((idea) => `<button type="button" class="project-idea-card" data-project-idea="${escapeAttribute(idea.idea_id)}"><span>${escapeHtml(projectIdeaStageLabel(idea.stage))}</span><strong>${escapeHtml(idea.title)}</strong><p>${escapeHtml(idea.pitch)}</p><small>${escapeHtml(idea.author_label || "Community-Mitglied")} · ${formatNumber(idea.comment_count || 0)} Beiträge</small></button>`).join("")
      : `<p class="empty">${escapeHtml(state.projectIdeas.error || "Noch keine Ideen vorgestellt. Du kannst die erste sein.")}</p>`;
}

async function submitProjectIdea(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const status = document.querySelector("#projectIdeaStatus");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  status.textContent = "Idee wird veröffentlicht …";
  try {
    const idea = await postJson("/api/community/ideas", {
      title: data.get("title"), pitch: data.get("pitch"), description: data.get("description"), motivation: data.get("motivation"), stage: data.get("stage"),
      looking_for: data.getAll("looking_for"), tags: String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    form.reset();
    state.projectIdeas.loaded = false;
    status.textContent = "Deine Projektidee ist jetzt in der Ideenwerkstatt sichtbar.";
    await loadProjectIdeas(true);
    await openProjectIdea(idea.idea_id);
  } catch (error) {
    status.textContent = error.message || "Die Idee konnte nicht veröffentlicht werden.";
  } finally { button.disabled = false; }
}

async function openProjectIdea(ideaId) {
  try {
    const idea = await getJson(`/api/community/ideas/${encodeURIComponent(ideaId)}`);
    document.querySelector("#projectIdeaDetail")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "projectIdeaDetail";
    overlay.className = "runtime-modal";
    overlay.innerHTML = `<section class="runtime-dialog project-idea-detail" role="dialog" aria-modal="true"><header class="runtime-dialog-header"><div><p class="eyebrow">${escapeHtml(projectIdeaStageLabel(idea.stage))}</p><h2>${escapeHtml(idea.title)}</h2></div><button type="button" data-close-project-idea>Schließen</button></header><p class="project-idea-pitch">${escapeHtml(idea.pitch)}</p><div class="project-idea-copy"><h3>Die Idee</h3><p>${escapeHtml(idea.description)}</p>${idea.motivation ? `<h3>Motivation</h3><p>${escapeHtml(idea.motivation)}</p>` : ""}</div><p><strong>Gesucht:</strong> ${escapeHtml((idea.looking_for || []).map(projectIdeaLookingForLabel).join(", ") || "Offener Austausch")}</p><ul class="learning-tag-list">${(idea.tags || []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul><section class="project-idea-discussion"><h3>Diskussion</h3><div data-project-idea-comments>${(idea.comments || []).map(renderProjectIdeaComment).join("") || `<p class="helper-text">Noch keine Rückmeldung. Starte die Diskussion.</p>`}</div><form data-project-idea-comment-form><label>Feedback, Frage oder Angebot zur Mitarbeit<textarea name="body" required maxlength="2500" rows="3"></textarea></label><div class="button-row"><button class="primary" type="submit">Beitrag senden</button><span data-project-idea-comment-status aria-live="polite"></span></div></form></section></section>`;
    overlay.querySelector("[data-close-project-idea]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    overlay.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const status = form.querySelector("[data-project-idea-comment-status]");
      const body = new FormData(form).get("body");
      try {
        await postJson(`/api/community/ideas/${encodeURIComponent(idea.idea_id)}/comments`, { body });
        state.projectIdeas.loaded = false;
        await loadProjectIdeas(true);
        await openProjectIdea(idea.idea_id);
      } catch (error) { status.textContent = error.message || "Der Beitrag konnte nicht gesendet werden."; }
    });
    document.body.append(overlay);
  } catch (error) { window.alert(error.message || "Die Projektidee konnte nicht geöffnet werden."); }
}

function renderProjectIdeaComment(comment) {
  return `<article class="project-idea-comment"><header><strong>${escapeHtml(comment.author_label || "Community-Mitglied")}</strong><time>${escapeHtml(new Date(comment.created_at).toLocaleString("de-DE"))}</time></header><p>${escapeHtml(comment.body)}</p></article>`;
}

function projectIdeaStageLabel(value) {
  return ({ rough_idea: "Erste Idee", concept: "Konzept", prototype: "Prototyp", seeking_collaborators: "Sucht Mitstreiter" })[value] || "Idee";
}

function projectIdeaLookingForLabel(value) {
  return ({ feedback: "Feedback", collaborators: "Mitstreiter", hardware: "Hardwarewissen", software: "Softwarewissen", testing: "Tester" })[value] || value;
}
let communityIdeaEventsBound = false;

function bindCommunityIdeaEvents() {
  if (communityIdeaEventsBound) return;
  communityIdeaEventsBound = true;
  document.querySelector("#projectIdeaForm")?.addEventListener("submit", submitProjectIdea);
  document.querySelector("#projectIdeaRefreshButton")?.addEventListener("click", () => loadProjectIdeas(true));
  document.querySelector("#projectIdeaList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-project-idea]");
    if (button) openProjectIdea(button.dataset.projectIdea);
  });
}

export {
  bindCommunityIdeaEvents,
  openProjectIdea,
  renderProjectIdeas,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: app-shell-controller.js, community-portal-controller.js.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  bindCommunityIdeaEvents,
  openProjectIdea,
  renderProjectIdeas,
});
/* ---- /Uebergangsbruecke ---- */
