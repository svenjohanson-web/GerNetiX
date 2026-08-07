const LearningProjectView = (() => {
  function render({ target, project, showRating = false, escapeHtml, learningText = (_key, fallback) => fallback }) {
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
      ${showRating ? `<section class="learning-rating" data-learning-rating-section aria-labelledby="learningRatingTitle">
        <div>
          <p class="eyebrow">Deine Rückmeldung</p>
          <h3 id="learningRatingTitle">Wie war dieses Lernprojekt?</h3>
          <p class="helper-text">Bewerte vier Punkte von 1 bis 5. Bei Schwierigkeit bedeutet 1 sehr leicht und 5 sehr schwierig.</p>
        </div>
        <form data-learning-rating-form>
          <div class="learning-rating-grid">
            ${ratingScale("clarity", "Verständlichkeit", "unklar", "sehr verständlich")}
            ${ratingScale("fun", "Spaß", "wenig Spaß", "sehr viel Spaß")}
            ${ratingScale("difficulty", "Schwierigkeit", "sehr leicht", "sehr schwierig")}
            ${ratingScale("completeness", "Vollständigkeit", "lückenhaft", "vollständig")}
          </div>
          <label class="learning-rating-comment">Kommentar (optional)<textarea name="message" rows="3" maxlength="2000" placeholder="Was war gut, was können wir verbessern?"></textarea></label>
          <div class="learning-rating-actions"><button class="primary" type="submit">Bewertung senden</button><span data-learning-rating-status aria-live="polite"></span></div>
        </form>
      </section>` : ""}
    `;
    return true;
  }

  function ratingScale(name, label, lowLabel, highLabel) {
    return `<fieldset class="learning-rating-scale"><legend>${label}</legend><div class="learning-rating-options">${[1, 2, 3, 4, 5].map((value) => `<label><input type="radio" name="${name}" value="${value}" required><span>${value}</span></label>`).join("")}</div><div class="learning-rating-range"><small>${lowLabel}</small><small>${highLabel}</small></div></fieldset>`;
  }

  return { render };
})();
