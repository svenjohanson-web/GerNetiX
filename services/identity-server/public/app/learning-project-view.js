const LearningProjectView = (() => {
  function render({ target, project, escapeHtml, learningText = (_key, fallback) => fallback }) {
    if (!target) return false;
    target.classList.toggle("hidden", !project);
    if (!project) {
      target.innerHTML = "";
      return false;
    }
    const standaloneLesson = project.entryMode === "standalone_lesson";
    const eyebrow = standaloneLesson
      ? learningText("standalone", "Entwicklungslesson · einzeln gestartet")
      : project.developmentLessons?.length
        ? learningText("story", "Entwicklungsprojekt · Projektstory")
        : learningText("guided", "Geführtes Lernprojekt");
    const lesson = standaloneLesson
      ? project.developmentLessons?.find((item) => item.id === project.currentLessonId)
      : null;
    target.innerHTML = `
      <div class="section-head">
        <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(project.name)}</h2><p class="helper-text">${escapeHtml(project.description || "")}</p>${lesson ? `<p class="learning-entry-context">${escapeHtml(learningText("prepared", "Vorbereiteter Einzelstart"))} · Snapshot ${escapeHtml(lesson.standalone_start?.snapshot_id || "")}</p>` : ""}</div>
        <a class="back-to-dashboard" href="/app/learn/">← ${escapeHtml(learningText("allProjects", "Alle Lernprojekte"))}</a>
      </div>
      <p class="flash-status hidden" data-learning-project-status aria-live="polite"></p>
      <section id="learningProjectArtifact" class="learning-project-artifact" aria-live="polite"></section>
    `;
    return true;
  }

  return { render };
})();
