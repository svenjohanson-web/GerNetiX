"use strict";

function createLearningProgressService({ projectServerJson, projectServerUserId, requireSessionProject, requiredField, touchWorkspace }) {
  async function list(userId, projects) {
    return Promise.all(projects.map(async (project) => {
      const fallback = empty(userId, project);
      if (project.project_origin !== "account_project" || !project.learning_project_id?.startsWith("learning_project.")) return fallback;
      return projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/learning-progress?user_id=${encodeURIComponent(userId)}`)
        .then((progress) => toPlatform(progress, project))
        .catch((error) => {
          if ([403, 404].includes(error.status)) return fallback;
          throw error;
        });
    }));
  }

  async function hasSubmittedFeedback(userId, projectId) {
    const response = await projectServerJson(`/api/learning-feedback?${new URLSearchParams({ project_id: projectId, user_id: userId })}`);
    return (response.items || []).some((feedback) => feedback.category === "learning_experience_rating");
  }

  async function update(session, input = {}) {
    const userId = projectServerUserId(session);
    const projectId = requiredField(input.projectId || input.project_id, "projectId");
    const project = await requireSessionProject(session, projectId);
    if (project.project_origin !== "account_project" || !project.learning_project_id?.startsWith("learning_project.")) {
      const error = new Error("Lernfortschritt kann nur für ein accountgebundenes Lernprojekt gespeichert werden.");
      error.status = 409;
      throw error;
    }
    const courseId = requiredField(project.course_id || input.courseId || input.course_id, "courseId");
    const persisted = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/learning-progress`, {
      method: "PUT",
      body: {
        user_id: userId,
        course_id: courseId,
        current_lesson_id: String(input.currentLessonId || input.current_lesson_id || input.lessonId || input.lesson_id || project.lesson_id || ""),
        current_step_id: input.currentStepId || input.current_step_id || "",
        current_step_index: Number(input.currentStep ?? input.current_step ?? 0),
        completed_step_indexes: Array.from(new Set((input.completedSteps || input.completed_steps || []).map(Number))).sort((left, right) => left - right),
        completed_step_ids: input.completedStepIds || input.completed_step_ids || [],
        reset_progress: input.resetProgress === true || input.reset_progress === true,
      },
    });
    touchWorkspace(session, projectId, "learn", `/app/learn/?project=${encodeURIComponent(projectId)}`);
    return toPlatform(persisted, project);
  }

  function empty(userId, project) {
    const firstView = project.view_manifest?.views?.[0] || {};
    return { id: `account_project_progress.${project.project_server_id}`, userId, courseId: project.course_id, lessonId: firstView.lesson_id || project.lesson_id || "", currentLessonId: firstView.lesson_id || "", currentStepId: firstView.id || "", projectId: project.project_server_id, status: "not_started", currentStep: 0, completedSteps: [], completedStepIds: [], lessonProgress: [], updatedAt: "" };
  }

  function toPlatform(progress, project) {
    return {
      id: progress.progress_id || `account_project_progress.${project.project_server_id}`,
      userId: progress.user_id || project.owner_user_id || "", courseId: project.course_id,
      lessonId: progress.current_lesson_id || project.lesson_id || "", currentLessonId: progress.current_lesson_id || "", currentStepId: progress.current_step_id || "", projectId: progress.project_id || project.project_server_id, entryMode: progress.entry_mode || project.entry_mode || "project_story", status: progress.status || "not_started", currentStep: Number(progress.current_step_index || 0), completedSteps: progress.completed_step_indexes || [], completedStepIds: progress.completed_step_ids || [],
      lessonProgress: (progress.lesson_progress || []).map((lesson) => ({ lessonId: lesson.lesson_id, status: lesson.status, currentStepId: lesson.current_step_id, currentStep: lesson.current_step_index, completedStepIds: lesson.completed_step_ids || [], completedSteps: lesson.completed_step_indexes || [], globalStepIndex: lesson.global_step_index || 0 })),
      startedAt: progress.started_at || "", updatedAt: progress.last_seen_at || "", completedAt: progress.completed_at || "",
    };
  }
  return { list, hasSubmittedFeedback, update, empty, toPlatform };
}

module.exports = { createLearningProgressService };
