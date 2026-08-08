const LearningProjectController = (() => {
  function create(deps) {
    const {
      state,
      postJson,
      navigate,
      renderLearn,
      renderDashboard,
      renderGuidedProject,
      projectById,
      loadProjectDetail,
      progressFor,
      escapeHtml,
      localizeProject = (project) => project,
      learningText = (_key, fallback) => fallback,
    } = deps;
    const entryDecisions = new Set();

    window.addEventListener("learning-progress-updated", (event) => {
      if (event.detail?.projectId === activeProject()?.id) render();
    });

    function activeProject() {
      const projectId = new URLSearchParams(window.location.search).get("project");
      const project = projectId ? projectById(projectId) : null;
      return isLearningProject(project) ? project : null;
    }

    function isLearningProject(project) {
      return Boolean(project && project.projectOrigin === "account_project" && Array.isArray(project.steps) && project.steps.length);
    }

    function render() {
      const target = document.querySelector("#learningProjectWorkspace");
      const project = activeProject();
      const localizedProject = project ? localizeProject(project) : null;
      const progress = project ? progressFor(project.id) : {};
      const showStartChoice = project ? hasSavedProgress(progress) && !entryDecisions.has(project.id) : false;
      const viewCount = project?.viewManifest?.views?.length || 0;
      if (viewCount) state.activeIdeStep = Math.max(0, Math.min(Number(progress.currentStep || 0), viewCount - 1));
      const rendered = LearningProjectView.render({
        target,
        project: localizedProject,
        progress,
        activeStep: state.activeIdeStep,
        showStartChoice,
        showRating: learningProjectCompleted(project) && project.learningFeedbackSubmitted !== true,
        escapeHtml,
        learningText,
      });
      if (!target || !project || !rendered) return;
      if (showStartChoice) bindStartChoice(target, project, progress);
      if (typeof GuidedProjectView === "undefined") {
        const status = target.querySelector("[data-learning-project-status]");
        if (status) {
          status.className = "flash-status";
          status.textContent = "Die geführte Lernansicht wird noch geladen. Bitte kurz warten.";
        }
        return;
      }
      try {
        renderGuidedProject(localizedProject);
      } catch (error) {
        const status = target.querySelector("[data-learning-project-status]");
        if (status) {
          status.className = "flash-status error";
          const reason = error?.message ? ` (${error.message})` : "";
          status.textContent = `Die Lernansicht konnte nicht geladen werden${reason}. Bitte die Seite neu laden.`;
        }
        console.error("Guided learning project rendering failed", error);
        return;
      }
      target.querySelector("[data-learning-rating-form]")?.addEventListener("submit", (event) => submitRating(event, project));
    }

    async function materialize(projectId) {
      const selectedProject = projectById(projectId);
      let project = selectedProject;
      if (selectedProject?.projectOrigin === "catalog") {
        const response = await postJson(`/api/platform/learning-projects/${encodeURIComponent(selectedProject.id)}/start`, {});
        project = response.project;
        state.projects = state.projects.filter((item) => item.id !== project.id).concat(project);
        if (response.learning_progress) {
          state.progress = state.progress.filter((item) => item.projectId !== project.id).concat(response.learning_progress);
        }
        project.learningFeedbackSubmitted = response.learning_feedback_submitted === true;
      } else if (selectedProject && !selectedProject.detailsLoaded) {
        project = await loadProjectDetail(projectId);
      }
      return project;
    }

    async function open(projectId, options = {}) {
      const project = await materialize(projectId);
      if (!isLearningProject(project)) return;
      const progress = progressFor(project.id);
      const requestedStep = options.startViewId
        ? project.viewManifest?.views?.findIndex((view) => view.id === options.startViewId)
        : -1;
      const currentStep = requestedStep >= 0 ? requestedStep : Number(progress.currentStep || 0);
      if (requestedStep >= 0 || !hasSavedProgress(progress)) entryDecisions.add(project.id);
      else entryDecisions.delete(project.id);
      state.activeIdeStep = Math.max(0, currentStep);
      navigate(`/app/learning-project/?project=${encodeURIComponent(project.id)}`);
      if (requestedStep >= 0 || !hasSavedProgress(progress)) {
        void saveStep(project, currentStep, progress.completedSteps || [], false)
          .catch((error) => showError(error));
      }
    }

    async function openDevelopment(projectId) {
      const project = await materialize(projectId);
      if (!project?.id) return;
      state.workspace = { ...state.workspace, lastProjectId: project.id, lastMode: "ide", lastRoute: `/app/ide/?project=${encodeURIComponent(project.id)}` };
      navigate(`/app/ide/?project=${encodeURIComponent(project.id)}`);
    }

    async function openLesson(projectId, lessonId) {
      const selectedProject = projectById(projectId);
      if (selectedProject?.projectOrigin !== "catalog") return;
      const response = await postJson(
        `/api/platform/learning-projects/${encodeURIComponent(selectedProject.id)}/lessons/${encodeURIComponent(lessonId)}/start`,
        {},
      );
      const project = response.project;
      state.projects = state.projects.filter((item) => item.id !== project.id).concat(project);
      navigate(`/app/learning-project/?project=${encodeURIComponent(project.id)}`);
      void saveStep(project, 0, [], false).catch((error) => showError(error));
    }

    async function saveStep(project, currentStep, completedSteps, shouldRender = true, options = {}) {
      const currentView = project.viewManifest?.views?.[currentStep] || {};
      const progress = await postJson("/api/platform/learning-progress", {
        projectId: project.id,
        courseId: project.courseId,
        lessonId: currentView.lesson_id || project.lessonId,
        currentLessonId: currentView.lesson_id || project.currentLessonId || project.lessonId,
        currentStep,
        currentStepId: currentView.id || "",
        completedSteps,
        completedStepIds: completedSteps.map((index) => project.viewManifest?.views?.[index]?.id).filter(Boolean),
        resetProgress: options.resetProgress === true,
      });
      state.progress = state.progress.filter((item) => item.projectId !== project.id).concat(progress);
      state.workspace = { ...state.workspace, lastProjectId: project.id, lastMode: "learn", lastRoute: `/app/learning-project/?project=${encodeURIComponent(project.id)}` };
      if (shouldRender) { render(); renderDashboard(); }
    }

    function bindStartChoice(target, project, progress) {
      const dialog = target.querySelector("[data-learning-start-choice]");
      if (!dialog) return;
      const buttons = Array.from(dialog.querySelectorAll("button"));
      const status = dialog.querySelector("[data-learning-start-choice-status]");
      dialog.addEventListener("cancel", (event) => event.preventDefault());
      dialog.querySelector("[data-learning-start-continue]")?.addEventListener("click", () => {
        entryDecisions.add(project.id);
        state.activeIdeStep = Math.max(0, Number(progress.currentStep || 0));
        dialog.close();
      });
      dialog.querySelector("[data-learning-start-new]")?.addEventListener("click", async () => {
        buttons.forEach((button) => { button.disabled = true; });
        status.className = "flash-status";
        status.textContent = learningText("resettingProgress", "Fortschritt wird zurückgesetzt …");
        try {
          entryDecisions.add(project.id);
          state.activeIdeStep = 0;
          await saveStep(project, 0, [], true, { resetProgress: true });
        } catch (error) {
          entryDecisions.delete(project.id);
          status.className = "flash-status error";
          status.textContent = error?.message || learningText("resetProgressFailed", "Der Lernfortschritt konnte nicht zurückgesetzt werden.");
          buttons.forEach((button) => { button.disabled = false; });
        }
      });
      dialog.showModal();
    }

    async function submitRating(event, project) {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("button[type=submit]");
      const status = form.querySelector("[data-learning-rating-status]");
      const values = new FormData(form);
      button.disabled = true;
      status.textContent = "Wird gesendet …";
      try {
        await postJson("/api/platform/learning-feedback", {
          projectId: project.id,
          ratings: Object.fromEntries(["clarity", "fun", "difficulty", "completeness"].map((key) => [key, Number(values.get(key))])),
          message: String(values.get("message") || ""),
        });
        project.learningFeedbackSubmitted = true;
        form.closest("[data-learning-rating-section]").innerHTML = "<p class=\"eyebrow\">Danke für deine Rückmeldung</p><p>Deine einmalige Projektbewertung wurde gespeichert.</p>";
      } catch (error) {
        status.textContent = error?.message || "Die Bewertung konnte nicht gespeichert werden.";
      } finally {
        button.disabled = false;
      }
    }

    function learningProjectCompleted(project) {
      const views = project.viewManifest?.views || [];
      const progress = progressFor(project.id);
      if (!views.length) return false;
      if (progress.status === "completed") return true;
      const completedIndexes = new Set(progress.completedSteps || []);
      const completedIds = new Set(progress.completedStepIds || []);
      return views.every((view, index) => completedIndexes.has(index) || completedIds.has(view.id));
    }

    function showError(error) {
      const status = document.querySelector("[data-learning-project-status]");
      if (!status) return;
      status.className = "flash-status error";
      status.textContent = error?.message || "Der Lernfortschritt konnte nicht gespeichert werden. Bitte erneut versuchen.";
    }

    return { render, open, openDevelopment, openLesson };
  }
  function hasSavedProgress(progress = {}) {
    return Boolean(
      progress.updatedAt
      || progress.startedAt
      || Number(progress.currentStep || 0) > 0
      || (progress.completedSteps || []).length
      || (progress.completedStepIds || []).length
      || ["active", "completed", "paused"].includes(progress.status),
    );
  }
  return { create, hasSavedProgress };
})();
