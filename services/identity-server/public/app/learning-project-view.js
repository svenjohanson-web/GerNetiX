const LearningProjectView = (() => {
  function render({ target, project, progress = {}, activeStep = 0, showRating = false, showStartChoice = false, escapeHtml, learningText = (_key, fallback) => fallback }) {
    if (!target) return false;
    target.classList.toggle("hidden", !project);
    if (!project) {
      target.innerHTML = "";
      return false;
    }
    const standaloneLesson = project.entryMode === "standalone_lesson";
    const eyebrow = standaloneLesson
      ? learningText("standalone", "Entwicklungslesson · einzeln gestartet")
      : project.projectStory && project.developmentLessons?.length
        ? learningText("story", "Entwicklungsprojekt · Projektstory")
        : learningText("guided", "Geführtes Lernprojekt");
    const lesson = standaloneLesson
      ? project.developmentLessons?.find((item) => item.id === project.currentLessonId)
      : null;
    const structure = lessonStructure(project, progress, activeStep);
    target.innerHTML = `
      <div class="section-head">
        <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(project.name)}</h2>${lesson ? `<p class="learning-entry-context">${escapeHtml(learningText("prepared", "Vorbereiteter Einzelstart"))} · Snapshot ${escapeHtml(lesson.standalone_start?.snapshot_id || "")}</p>` : ""}</div>
        <div class="learning-project-header-actions">
          ${renderProgressMap(structure, escapeHtml, learningText)}
          <a class="back-to-dashboard" href="/app/learn/">← ${escapeHtml(learningText("allProjects", "Alle Lernprojekte"))}</a>
        </div>
      </div>
      <p class="flash-status hidden" data-learning-project-status aria-live="polite"></p>
      <div class="learning-project-body">
        <section id="learningProjectArtifact" class="learning-project-artifact" aria-live="polite"></section>
      </div>
      ${showStartChoice ? renderStartChoice(project, progress, escapeHtml, learningText) : ""}
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

  function renderStartChoice(project, progress, escapeHtml, learningText) {
    const views = project.viewManifest?.views || [];
    const currentStep = Math.max(0, Math.min(Number(progress.currentStep || 0), Math.max(0, views.length - 1)));
    const currentView = views[currentStep] || {};
    const lesson = (project.developmentLessons || []).find((item) => item.id === currentView.lesson_id);
    const position = `${escapeHtml(learningText("step", "Schritt"))} ${currentStep + 1} / ${views.length}`;
    return `<dialog class="learning-project-start-choice" data-learning-start-choice aria-labelledby="learningStartChoiceTitle">
      <form>
        <p class="eyebrow">${escapeHtml(learningText("welcomeBack", "Willkommen zurück"))}</p>
        <h3 id="learningStartChoiceTitle">${escapeHtml(learningText("startChoiceTitle", "Wie möchtest du beginnen?"))}</h3>
        <p>${escapeHtml(learningText("startChoiceText", "Für dieses Lernprojekt ist bereits ein Fortschritt gespeichert."))}</p>
        <div class="learning-project-resume-position">
          <span>${escapeHtml(learningText("lastPosition", "Dein letzter Stand"))}</span>
          ${lesson?.title ? `<strong>${escapeHtml(lesson.title)}</strong>` : ""}
          <small>${position}${currentView.title ? ` · ${escapeHtml(currentView.title)}` : ""}</small>
        </div>
        <div class="learning-project-start-choice-actions">
          <button type="button" data-learning-start-new>${escapeHtml(learningText("startNew", "Neu beginnen"))}</button>
          <button class="primary" type="button" data-learning-start-continue autofocus>${escapeHtml(learningText("continueLast", "Am letzten Stand fortsetzen"))}</button>
        </div>
        <p class="flash-status hidden" data-learning-start-choice-status aria-live="polite"></p>
      </form>
    </dialog>`;
  }

  function renderProgressMap(structure, escapeHtml, learningText) {
    const lessonLabel = learningText("lessons", "Lessons");
    const stepLabel = learningText("steps", "Schritte");
    const completedLabel = learningText("completed", "erledigt");
    const percent = structure.totalSteps ? Math.round((structure.completedSteps / structure.totalSteps) * 100) : 0;
    return `<details class="learning-project-progress-map" aria-label="${escapeHtml(learningText("projectProgress", "Projektfortschritt"))}">
      <summary title="${escapeHtml(learningText("showProgressDetails", "Lessons und Schritte anzeigen"))}">
        <header>
          <div><p class="eyebrow">${escapeHtml(learningText("progress", "Fortschritt"))}</p><strong>${structure.lessons.length} ${escapeHtml(lessonLabel)} · ${structure.totalSteps} ${escapeHtml(stepLabel)}</strong></div>
          <span title="${structure.completedSteps} von ${structure.totalSteps} Schritten erledigt">${structure.completedSteps}/${structure.totalSteps} ${escapeHtml(completedLabel)}</span>
        </header>
        <div class="learning-project-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${structure.totalSteps}" aria-valuenow="${structure.completedSteps}" aria-label="${structure.completedSteps} von ${structure.totalSteps} ${escapeHtml(completedLabel)}"><span style="width:${percent}%"></span></div>
      </summary>
      <ol class="learning-project-progress-lessons">
        ${structure.lessons.map((lesson, lessonIndex) => `<li class="is-${lesson.status}">
          <div class="learning-project-progress-lesson-head">
            <span>${lesson.status === "completed" ? "✓" : lessonIndex + 1}</span>
            <div><strong>${escapeHtml(lesson.title)}</strong><small>${lesson.completedSteps}/${lesson.stepCount} ${escapeHtml(completedLabel)}</small></div>
          </div>
          <ol>${lesson.steps.map((step, stepIndex) => `<li class="${step.done ? "is-done" : step.active ? "is-active" : "is-upcoming"}" ${step.active ? 'aria-current="step"' : ""}><span>${step.done ? "✓" : stepIndex + 1}</span><p>${escapeHtml(step.title)}</p></li>`).join("")}</ol>
        </li>`).join("")}
      </ol>
    </details>`;
  }

  function lessonStructure(project, progress = {}, activeStep = 0) {
    const views = Array.isArray(project?.viewManifest?.views) ? project.viewManifest.views : [];
    const allDeclaredLessons = Array.isArray(project?.developmentLessons) ? project.developmentLessons : [];
    const declaredLessons = project?.entryMode === "standalone_lesson" && project?.currentLessonId
      ? allDeclaredLessons.filter((lesson) => String(lesson.id || lesson.lesson_id || "") === String(project.currentLessonId))
      : allDeclaredLessons;
    const completedIndexes = new Set((progress.completedSteps || []).map(Number));
    const completedIds = new Set(progress.completedStepIds || []);
    const lessonById = new Map(declaredLessons.map((lesson) => [String(lesson.id || lesson.lesson_id || ""), lesson]));
    const orderedLessonIds = declaredLessons.map((lesson) => String(lesson.id || lesson.lesson_id || "")).filter(Boolean);
    views.forEach((view) => {
      const lessonId = String(view.lesson_id || project?.lessonId || "project");
      if (!orderedLessonIds.includes(lessonId)) orderedLessonIds.push(lessonId);
    });
    if (!orderedLessonIds.length && views.length) orderedLessonIds.push("project");
    const lessons = orderedLessonIds.map((lessonId, lessonIndex) => {
      const definition = lessonById.get(lessonId) || {};
      const steps = views.map((view, globalIndex) => ({ view, globalIndex }))
        .filter(({ view }) => String(view.lesson_id || project?.lessonId || "project") === lessonId)
        .map(({ view, globalIndex }) => ({
          id: String(view.id || ""),
          title: String(view.title || `Schritt ${globalIndex + 1}`),
          globalIndex,
          done: completedIndexes.has(globalIndex) || completedIds.has(view.id),
          active: globalIndex === Number(activeStep || 0),
        }));
      const completedSteps = steps.filter((step) => step.done).length;
      const active = steps.some((step) => step.active);
      return {
        id: lessonId,
        title: String(definition.title || (orderedLessonIds.length === 1 ? project?.name || "Lernweg" : `Lesson ${lessonIndex + 1}`)),
        summary: String(definition.summary || ""),
        hardwareRequired: definition.standalone_start?.hardware_required === true,
        steps,
        stepCount: steps.length,
        completedSteps,
        status: steps.length && completedSteps === steps.length ? "completed" : active || completedSteps ? "active" : "not-started",
      };
    }).filter((lesson) => lesson.stepCount || declaredLessons.length);
    return {
      lessons,
      totalSteps: views.length,
      completedSteps: views.filter((view, index) => completedIndexes.has(index) || completedIds.has(view.id)).length,
    };
  }

  function ratingScale(name, label, lowLabel, highLabel) {
    return `<fieldset class="learning-rating-scale"><legend>${label}</legend><div class="learning-rating-options">${[1, 2, 3, 4, 5].map((value) => `<label><input type="radio" name="${name}" value="${value}" required><span>${value}</span></label>`).join("")}</div><div class="learning-rating-range"><small>${lowLabel}</small><small>${highLabel}</small></div></fieldset>`;
  }

  return { lessonStructure, render };
})();
