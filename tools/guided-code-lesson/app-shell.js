"use strict";

function initProjectSelector() {
  projectSelector.innerHTML = lessons
    .map((item) => `<option value="${item.slug}">${item.title}</option>`)
    .join("");
  projectSelector.addEventListener("change", () => selectLesson(projectSelector.value, true));
  editModeButton.addEventListener("click", toggleEditMode);
  publishToServerButton?.addEventListener("click", publishLessonToServerPreview);
}

function selectInitialLesson() {
  const params = new URLSearchParams(window.location.search);
  selectLesson(params.get("project") || lessons[0].slug, false);
}

function selectLesson(slug, updateUrl) {
  lesson = lessons.find((item) => item.slug === slug) || lessons[0];
  projectSelector.value = lesson.slug;
  currentStepIndex = 0;
  navigationHistory = [];
  isComplete = false;
  isWelcomeVisible = true;
  resetLessonRuntimeState(lesson);
  applyStoredRuntimeEdits(lesson);
  codeLines = lesson.source.replace(/\n$/, "").split("\n");

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("project", lesson.slug);
    window.history.replaceState({}, "", url);
  }

  render();
}

function resetLessonRuntimeState(lessonItem) {
  lessonItem.learnerProfile = {
    ...(lessonItem.learnerProfile || {}),
    ...(lessonItem.runtimeDefaults || {}),
  };
}

function currentStep() {
  return lesson.steps[currentStepIndex];
}

function render() {
  lessonShell.classList.toggle("welcome-mode", isWelcomeVisible);

  if (isWelcomeVisible) {
    renderWelcome();
    return;
  }

  fileName.textContent = lesson.file;
  renderEditor();
  renderPanel();
}

function renderWelcome() {
  const welcome = lesson.welcome || createDefaultWelcome(lesson);
  sidePanel.innerHTML = `
    <div class="welcome-panel">
      <p class="step-kicker">${escapeHtml(welcome.eyebrow || "Projektstart")}</p>
      <h2>${escapeHtml(welcome.title || lesson.title)}</h2>
      <p class="welcome-text">${escapeHtml(welcome.text || "Hier beginnt das Lernprojekt.")}</p>
      ${renderWelcomeTopics(welcome.topics)}
      <label class="welcome-project-select">Projektidee
        <select data-action="select-welcome-project">
          ${lessons.map((item) => `<option value="${escapeAttribute(item.slug)}" ${item.slug === lesson.slug ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}
        </select>
      </label>
      <div class="panel-spacer"></div>
      <div class="actions single-action">
        <button type="button" class="primary" data-action="start-lesson">${escapeHtml(welcome.startLabel || "Lektion starten")}</button>
      </div>
    </div>
  `;
  wirePanelButtons();
}

function renderWelcomeTopics(topics) {
  if (!topics?.length) return "";
  return `
    <section class="welcome-topics" aria-label="Lerninhalte">
      <h3>Was wir lernen werden</h3>
      <ul>${topics.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")}</ul>
    </section>
  `;
}
