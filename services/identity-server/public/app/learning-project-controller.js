const LearningProjectController = (() => {
  function create(deps) {
    const { state, postJson, navigate, renderLearn, renderDashboard, renderGuidedProject, projectById, progressFor, escapeHtml } = deps;

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
      const rendered = LearningProjectView.render({ target, project, escapeHtml });
      if (!target || !project || !rendered) return;
      renderGuidedProject(project);
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

    async function saveStep(project, currentStep, completedSteps, shouldRender = true) {
      const progress = await postJson("/api/platform/learning-progress", { projectId: project.id, courseId: project.courseId, lessonId: project.lessonId, currentStep, completedSteps });
      state.progress = state.progress.filter((item) => item.projectId !== project.id).concat(progress);
      state.workspace = { ...state.workspace, lastProjectId: project.id, lastMode: "learn", lastRoute: `/app/learning-project/?project=${encodeURIComponent(project.id)}` };
      if (shouldRender) { render(); renderDashboard(); }
    }

    function showError(error) {
      const status = document.querySelector("[data-learning-project-status]");
      if (!status) return;
      status.className = "flash-status error";
      status.textContent = error?.message || "Der Lernfortschritt konnte nicht gespeichert werden. Bitte erneut versuchen.";
    }

    return { render, open };
  }
  return { create };
})();
