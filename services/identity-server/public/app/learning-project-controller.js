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
      progressFor,
      escapeHtml,
      localizeProject = (project) => project,
      learningText = (_key, fallback) => fallback,
    } = deps;

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
      const rendered = LearningProjectView.render({ target, project: localizedProject, escapeHtml, learningText });
      if (!target || !project || !rendered) return;
      renderGuidedProject(localizedProject);
      target.querySelector("[data-learning-rating-form]")?.addEventListener("submit", (event) => submitRating(event, project));
    }

    async function open(projectId) {
      const selectedProject = projectById(projectId);
      let project = selectedProject;
      if (selectedProject?.projectOrigin === "catalog") {
        const response = await postJson(`/api/platform/learning-projects/${encodeURIComponent(selectedProject.id)}/start`, {});
        project = response.project;
        state.projects = state.projects.filter((item) => item.id !== project.id).concat(project);
      }
      if (!isLearningProject(project)) return;
      const progress = progressFor(project.id);
      navigate(`/app/learning-project/?project=${encodeURIComponent(project.id)}`);
      render();
      void saveStep(project, Number(progress.currentStep || 0), progress.completedSteps || [], false)
        .catch((error) => showError(error));
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
        const progress = progressFor(project.id);
        const currentStep = Number(progress.currentStep || 0);
        await postJson("/api/platform/learning-feedback", {
          projectId: project.id,
          learningStepId: project.viewManifest?.views?.[currentStep]?.id || "",
          ratings: Object.fromEntries(["clarity", "fun", "difficulty", "completeness"].map((key) => [key, Number(values.get(key))])),
          message: String(values.get("message") || ""),
        });
        form.reset();
        status.textContent = "Danke – deine Bewertung wurde gespeichert.";
      } catch (error) {
        status.textContent = error?.message || "Die Bewertung konnte nicht gespeichert werden.";
      } finally {
        button.disabled = false;
      }
    }

    function showError(error) {
      const status = document.querySelector("[data-learning-project-status]");
      if (!status) return;
      status.className = "flash-status error";
      status.textContent = error?.message || "Der Lernfortschritt konnte nicht gespeichert werden. Bitte erneut versuchen.";
    }

    return { render, open, openLesson };
  }
  return { create };
})();
