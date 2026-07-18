const LearningProjectView = (() => {
  function render({ target, project, escapeHtml }) {
    if (!target) return false;
    target.classList.toggle("hidden", !project);
    if (!project) {
      target.innerHTML = "";
      return false;
    }
    target.innerHTML = `
      <div class="section-head">
        <div><p class="eyebrow">Geführtes Lernprojekt</p><h2>${escapeHtml(project.name)}</h2><p class="helper-text">${escapeHtml(project.description || "")}</p></div>
        <a class="back-to-dashboard" href="/app/learn/">← Alle Lernprojekte</a>
      </div>
      <p class="flash-status hidden" data-learning-project-status aria-live="polite"></p>
      <section id="learningProjectArtifact" class="learning-project-artifact" aria-live="polite"></section>
    `;
    return true;
  }

  return { render };
})();
