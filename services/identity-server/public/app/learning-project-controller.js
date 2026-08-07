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
      const rendered = LearningProjectView.render({
        target,
        project: localizedProject,
        showRating: learningProjectCompleted(project) && project.learningFeedbackSubmitted !== true,
        escapeHtml,
        learningText,
      });
      if (!target || !project || !rendered) return;
      renderGuidedProject(localizedProject);
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
      navigate(`/app/learning-project/?project=${encodeURIComponent(project.id)}`);
      render();
      void saveStep(project, currentStep, progress.completedSteps || [], false)
        .catch((error) => showError(error));
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
      render();
      void saveStep(project, 0, [], false).catch((error) => showError(error));
    }

    async function saveStep(project, currentStep, completedSteps, shouldRender = true) {
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
      });
      state.progress = state.progress.filter((item) => item.projectId !== project.id).concat(progress);
      state.workspace = { ...state.workspace, lastProjectId: project.id, lastMode: "learn", lastRoute: `/app/learning-project/?project=${encodeURIComponent(project.id)}` };
      if (shouldRender) { render(); renderDashboard(); }
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
  return { create };
})();
