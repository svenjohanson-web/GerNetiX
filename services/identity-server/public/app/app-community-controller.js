// GerNetiX platform module extracted from app.js.
let communityCoreEventsBound = false;
let communityMessageEventsBound = false;

function bindCommunityCoreEvents() {
  if (communityCoreEventsBound) return;
  communityCoreEventsBound = true;
  document.querySelector("#communityRefreshButton")?.addEventListener("click", loadCommunity);
  document.querySelector("#communityRequestForm")?.addEventListener("submit", submitCommunityRequest);
  document.querySelector("#communityQuestionList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-community-question]");
    if (button) openCommunityQuestion(button.dataset.communityQuestion);
  });
  document.querySelector("#communityThread")?.addEventListener("submit", submitCommunityAnswer);
  document.querySelector("#communityThread")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy-community-link]");
    if (button) copyCommunityQuestionLink(button.dataset.copyCommunityLink);
  });
}

function bindCommunityMessageEvents() {
  if (communityMessageEventsBound) return;
  communityMessageEventsBound = true;
  document.querySelector("#messageFolders")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-message-folder]");
    if (!button) return;
    state.messages.folder = button.dataset.messageFolder;
    state.messages.activeThreadId = "";
    document.querySelector("#messageReadingPane").innerHTML = `<div class="message-empty-state"><strong>Wähle eine Nachricht</strong><p>Die Unterhaltung wird hier geöffnet.</p></div>`;
    loadMessages();
  });
  document.querySelector("#messageThreadList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-message-thread]");
    if (button) openMessageThread(button.dataset.messageThread);
  });
  document.querySelector("#messageReadingPane")?.addEventListener("submit", submitMessageReply);
  document.querySelector("#messageReadingPane")?.addEventListener("click", (event) => { if (event.target.closest("[data-message-archive]")) toggleMessageArchive(); });
  document.querySelector("#messageRefreshButton")?.addEventListener("click", loadMessages);
  document.querySelector("#messageComposeButton")?.addEventListener("click", () => document.querySelector("#messageComposeDialog").showModal());
  document.querySelector("#messageComposeForm")?.addEventListener("submit", submitNewMessage);
  document.querySelector("#messageComposeDialog")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget || event.target.closest("[data-close-message-compose]")) event.currentTarget.close();
  });
}

async function loadCommunity() {
  const target = document.querySelector("#communityQuestionList");
  if (!target) return;
  target.innerHTML = `<p class="helper-text">Anfragen werden geladen ...</p>`;
  configureSupportRequestMode();
  try {
    const response = await getJson("/api/community/questions");
    state.community.questions = response.items || [];
    renderCommunity();
  } catch (error) { target.innerHTML = `<p class="helper-text error-text">Die Community ist gerade nicht erreichbar. Bitte später erneut versuchen.</p>`; }
}

function renderCommunity() {
  const select = document.querySelector("#communityProjectSelect");
  if (select) select.innerHTML = `<option value="">Keinem Projekt zuordnen</option>${state.projects.map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.name)}</option>`).join("")}`;
  const target = document.querySelector("#communityQuestionList");
  target.innerHTML = state.community.questions.length ? state.community.questions.map((question) => `<button class="community-question-card ${question.question_id === state.community.activeQuestionId ? "active" : ""}" type="button" data-community-question="${escapeAttribute(question.question_id)}"><span>${question.visibility === "private" ? "Privat" : "Öffentlich"} · ${escapeHtml(question.status)}</span><strong>${escapeHtml(question.title)}</strong><small>${question.answer_count || 0} Antworten</small></button>`).join("") : `<p class="helper-text">Noch keine Anfragen. Starte gern mit deiner Projektidee.</p>`;
}

const messageFolderLabels = {
  inbox: "Posteingang", outbox: "Postausgang", sent: "Gesendet", support: "Support", archive: "Archiv",
};

async function loadMessages() {
  const list = document.querySelector("#messageThreadList");
  if (!list) return;
  list.innerHTML = `<p class="helper-text">Nachrichten werden geladen …</p>`;
  const archived = state.messages.folder === "archive";
  try {
    const payload = await getJson(`/api/community/message-threads${archived ? "?folder=archived" : ""}`);
    const currentUserId = state.account?.user_id || state.account?.id || "";
    let threads = payload.items || [];
    if (state.messages.folder === "inbox") threads = threads.filter((item) => item.mailbox_kind !== "support" && (item.state === "unread" || item.latest_message?.author_user_id !== currentUserId));
    if (state.messages.folder === "sent") threads = threads.filter((item) => item.latest_message?.author_user_id === currentUserId);
    if (state.messages.folder === "support") threads = threads.filter((item) => item.mailbox_kind === "support");
    if (state.messages.folder === "outbox") threads = [];
    state.messages.threads = threads;
    document.querySelector("#messageUnreadCount").textContent = String(payload.unread_count || 0);
    renderMessageList();
  } catch (error) {
    list.innerHTML = `<p class="helper-text error-text">${escapeHtml(error.message || "Nachrichten konnten nicht geladen werden.")}</p>`;
  }
}

function renderMessageList() {
  document.querySelector("#messageFolderTitle").textContent = messageFolderLabels[state.messages.folder];
  document.querySelectorAll("[data-message-folder]").forEach((button) => button.classList.toggle("active", button.dataset.messageFolder === state.messages.folder));
  const list = document.querySelector("#messageThreadList");
  if (!state.messages.threads.length) {
    const text = state.messages.folder === "outbox"
      ? "Keine wartenden Nachrichten. Nachrichten werden derzeit sofort zugestellt."
      : "Dieser Ordner ist leer.";
    list.innerHTML = `<div class="message-list-empty"><strong>Keine Nachrichten</strong><p>${text}</p></div>`;
    return;
  }
  list.innerHTML = state.messages.threads.map((thread) => `
    <button class="message-thread-row ${thread.state === "unread" ? "unread" : ""} ${thread.thread_id === state.messages.activeThreadId ? "active" : ""}" type="button" data-message-thread="${escapeAttribute(thread.thread_id)}">
      <span class="message-thread-avatar">${thread.mailbox_kind === "support" ? "S" : "N"}</span>
      <span class="message-thread-copy"><strong>${escapeHtml(thread.subject || "Ohne Betreff")}</strong><small>${escapeHtml(thread.latest_message?.author_label || "GerNetiX Mitglied")}</small><span>${escapeHtml((thread.latest_message?.body || "").slice(0, 90))}</span></span>
      <time>${formatMessageDate(thread.updated_at)}</time>
    </button>
  `).join("");
}

async function openMessageThread(threadId) {
  const pane = document.querySelector("#messageReadingPane");
  pane.innerHTML = `<p class="helper-text">Unterhaltung wird geladen …</p>`;
  try {
    const thread = await getJson(`/api/community/message-threads/${encodeURIComponent(threadId)}`);
    state.messages.activeThreadId = threadId;
    state.messages.activeThread = thread;
    await postJson(`/api/community/message-threads/${encodeURIComponent(threadId)}/read`, {});
    renderMessageList();
    pane.innerHTML = `
      <header class="message-reading-header"><div><p class="eyebrow">${thread.mailbox_kind === "support" ? "Support" : "Unterhaltung"}</p><h2>${escapeHtml(thread.subject || "Ohne Betreff")}</h2></div>
        <button type="button" data-message-archive>${state.messages.folder === "archive" ? "Wiederherstellen" : "Archivieren"}</button></header>
      <div class="message-conversation">${(thread.messages || []).map((message) => `
        <article class="message-bubble ${message.author_user_id === (state.account?.user_id || state.account?.id) ? "own" : ""}">
          <header><strong>${escapeHtml(message.author_label || "Mitglied")}</strong><time>${formatMessageDate(message.created_at)}</time></header>
          <p>${escapeHtml(message.body)}</p>
        </article>`).join("")}</div>
      <form id="messageReplyForm" class="message-reply-form"><label>Antwort<textarea name="body" required maxlength="8000" rows="4" placeholder="Antwort schreiben …"></textarea></label><div><span id="messageReplyStatus" class="helper-text"></span><button class="primary" type="submit">Senden</button></div></form>`;
  } catch (error) {
    pane.innerHTML = `<p class="helper-text error-text">${escapeHtml(error.message || "Unterhaltung konnte nicht geöffnet werden.")}</p>`;
  }
}

async function submitMessageReply(event) {
  if (!event.target.matches("#messageReplyForm")) return;
  event.preventDefault();
  const status = document.querySelector("#messageReplyStatus");
  try {
    const body = new FormData(event.target).get("body");
    await postJson(`/api/community/message-threads/${encodeURIComponent(state.messages.activeThreadId)}/messages`, { body });
    await openMessageThread(state.messages.activeThreadId);
    await loadMessages();
  } catch (error) { status.textContent = error.message || "Antwort konnte nicht gesendet werden."; }
}

async function submitNewMessage(event) {
  event.preventDefault();
  const status = document.querySelector("#messageComposeStatus");
  status.textContent = "Nachricht wird gesendet …";
  try {
    const data = Object.fromEntries(new FormData(event.target).entries());
    const thread = await postJson("/api/community/message-threads", data);
    event.target.reset();
    document.querySelector("#messageComposeDialog").close();
    state.messages.folder = "sent";
    await loadMessages();
    await openMessageThread(thread.thread_id);
  } catch (error) { status.textContent = error.message || "Nachricht konnte nicht gesendet werden."; }
}

async function toggleMessageArchive() {
  const threadId = state.messages.activeThreadId;
  if (!threadId) return;
  if (state.messages.folder === "archive") await deleteJson(`/api/community/message-threads/${encodeURIComponent(threadId)}/archive`);
  else await postJson(`/api/community/message-threads/${encodeURIComponent(threadId)}/archive`, {});
  state.messages.activeThreadId = "";
  state.messages.activeThread = null;
  document.querySelector("#messageReadingPane").innerHTML = `<div class="message-empty-state"><strong>Wähle eine Nachricht</strong><p>Die Unterhaltung wird hier geöffnet.</p></div>`;
  await loadMessages();
}

function formatMessageDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function submitCommunityRequest(event) {
  event.preventDefault(); const form = event.currentTarget; const status = document.querySelector("#communityRequestStatus");
  status.textContent = "Anfrage wird gesendet ...";
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    if (isSupportRequestMode()) {
      await postJson("/api/community/support-requests", { subject: data.title, body: data.body });
      form.reset();
      status.textContent = "Deine private Supportanfrage wurde an das Support-Postfach gesendet.";
      return;
    }
    if (data.attach_project_snapshot === "true" && !data.project_id) throw new Error("Wähle zuerst das Projekt aus, dessen Stand du anhängen möchtest.");
    const question = await postJson("/api/community/questions", data);
    form.reset(); status.textContent = "Anfrage wurde gesendet. Den Link kannst du jetzt in der Anfrage kopieren.";
    await loadCommunity(); await openCommunityQuestion(question.question_id);
  } catch (error) { status.textContent = error.message || "Anfrage konnte nicht gesendet werden."; }
}

function isSupportRequestMode() {
  return new URLSearchParams(window.location.search).get("support") === "1";
}

function configureSupportRequestMode() {
  if (!isSupportRequestMode()) return;
  const form = document.querySelector("#communityRequestForm");
  if (!form) return;
  form.querySelector("h2").textContent = "Neue Supportanfrage";
  form.querySelector("h2 + p").textContent = "Deine Anfrage wird privat an das GerNetiX-Support-Postfach gesendet.";
  form.querySelector('select[name="tags"]')?.closest("label")?.classList.add("hidden");
  form.querySelector("#communityProjectSelect")?.closest("label")?.classList.add("hidden");
  form.querySelector("#communityAttachProjectSnapshot")?.closest("label")?.classList.add("hidden");
  form.querySelector("fieldset")?.classList.add("hidden");
  const button = form.querySelector('button[type="submit"]');
  if (button) button.textContent = "Privat an Support senden";
}

async function openCommunityQuestion(questionId) {
  try {
    const [question, answers] = await Promise.all([getJson(`/api/community/questions/${encodeURIComponent(questionId)}`), getJson(`/api/community/questions/${encodeURIComponent(questionId)}/answers`)]);
    state.community.activeQuestionId = questionId; state.community.answers = answers.items || []; renderCommunity();
    const target = document.querySelector("#communityThread"); target.classList.remove("hidden");
    target.innerHTML = `<header><div><p class="eyebrow">${question.visibility === "private" ? "Private Begleitung" : "Öffentliche Community-Anfrage"}</p><h2>${escapeHtml(question.title)}</h2></div><span>${escapeHtml(question.status)}</span></header><p class="community-question-body">${escapeHtml(question.body)}</p><p><button type="button" data-copy-community-link="${escapeAttribute(question.question_id)}">Link zur Anfrage kopieren</button></p>${renderCommunityProjectSnapshot(question.project_snapshot)}<div class="community-answers">${state.community.answers.map((answer) => `<article><strong>${escapeHtml(answer.author_label)}</strong><p>${escapeHtml(answer.body)}</p></article>`).join("") || `<p class="helper-text">Noch keine Antwort. GerNetiX meldet sich hier.</p>`}</div><form class="community-answer-form"><label>Ergänzung oder Rückfrage<textarea name="body" required rows="3"></textarea></label><input type="hidden" name="question_id" value="${escapeAttribute(question.question_id)}" /><button type="submit">Antwort senden</button></form>`;
  } catch (error) { window.alert(error.message || "Anfrage konnte nicht geöffnet werden."); }
}

function renderCommunityProjectSnapshot(snapshot) {
  if (!snapshot) return "";
  const sources = snapshot.sources || [];
  return `<details class="community-project-snapshot"><summary>Projektkopie: ${escapeHtml(snapshot.project_title)} · ${sources.length} Dateien</summary><p class="helper-text">Schreibgeschützter Stand vom ${escapeHtml(new Date(snapshot.captured_at).toLocaleString())}. Er enthält keine Binärdateien.</p>${sources.map((source) => `<details><summary><code>${escapeHtml(source.path)}</code></summary><pre><code>${escapeHtml(source.content)}</code></pre></details>`).join("")}</details>`;
}

async function copyCommunityQuestionLink(questionId) {
  const link = `${window.location.origin}/community/questions/${encodeURIComponent(questionId)}/`;
  try { await navigator.clipboard.writeText(link); window.alert("Der Link zur Community-Anfrage wurde kopiert."); }
  catch { window.prompt("Kopiere diesen Link:", link); }
}

async function submitCommunityAnswer(event) {
  if (!event.target.matches(".community-answer-form")) return;
  event.preventDefault(); const form = event.target; const data = new FormData(form); const questionId = data.get("question_id");
  try { await postJson(`/api/community/questions/${encodeURIComponent(questionId)}/answers`, { body: data.get("body") }); await openCommunityQuestion(questionId); } catch (error) { window.alert(error.message || "Antwort konnte nicht gesendet werden."); }
}
