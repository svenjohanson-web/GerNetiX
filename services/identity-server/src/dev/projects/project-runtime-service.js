"use strict";

function createProjectRuntimeService({
  ensureAccountResourcePlan,
  getLearningProjects,
  getUserIdeState,
  mapProjectServerProject,
  mapUserIdeProjectSummaries,
  mapUserIdeProjects,
  projectServerJson,
  projectServerUserId,
  scheduleProjectServerDemoProjects,
  projectCacheMs = 2_500,
  summaryCacheMs = 15_000,
}) {
  const projectsCache = new Map();
  const projectLoads = new Map();
  const summariesCache = new Map();
  const summaryLoads = new Map();

  async function requireSessionProject(session, projectId) {
    const requestedProjectId = String(projectId || "");
    const accountId = projectServerUserId(session);
    const storedProject = await projectServerJson(`/api/projects/${encodeURIComponent(requestedProjectId)}`)
      .catch((error) => error.status === 404 ? null : Promise.reject(error));
    if (!storedProject || storedProject.user_id !== accountId) throw sessionProjectNotFound();
    const learningDefinition = getUserIdeState().projectDefinitions
      .find((item) => item.learning_project_id === storedProject.learning_project_id);
    const learningProjects = getLearningProjects();
    const canonicalManifest = learningDefinition
      ? learningProjects.learningProjectManifestForPersistedProject(storedProject, learningDefinition)
      : null;
    const needsLearningViewSync = Number(canonicalManifest?.schema_version || 0)
      > Number(storedProject.view_manifest?.schema_version || 0);
    const synchronizedProject = storedProject.status === "plan_locked" || !needsLearningViewSync
      ? storedProject
      : await learningProjects.synchronizeLearningProjectStructure(storedProject, learningDefinition);
    return mapProjectServerProject(session, synchronizedProject);
  }

  function sessionProjectNotFound() {
    const error = new Error("Projekt wurde nicht gefunden.");
    error.status = 404;
    return error;
  }

  async function loadUserIdeProjects(session) {
    const userId = projectServerUserId(session);
    const cached = projectsCache.get(userId);
    if (cached && cached.expires_at > Date.now()) return cached.value;
    if (projectLoads.has(userId)) return projectLoads.get(userId);
    const load = loadUserIdeProjectsUncached(session, userId)
      .then((value) => {
        projectsCache.set(userId, { value, expires_at: Date.now() + projectCacheMs });
        return value;
      })
      .finally(() => projectLoads.delete(userId));
    projectLoads.set(userId, load);
    return load;
  }

  function invalidateUserIdeProjectCaches(userId) {
    projectsCache.delete(userId);
    summariesCache.delete(userId);
  }

  async function loadUserIdeProjectSummaries(session) {
    const userId = projectServerUserId(session);
    const cached = summariesCache.get(userId);
    if (cached && cached.expires_at > Date.now()) return cached.value;
    if (summaryLoads.has(userId)) return summaryLoads.get(userId);
    const load = loadUserIdeProjectSummariesUncached(session, userId)
      .then((value) => {
        summariesCache.set(userId, { value, expires_at: Date.now() + summaryCacheMs });
        return value;
      })
      .finally(() => summaryLoads.delete(userId));
    summaryLoads.set(userId, load);
    return load;
  }

  async function loadUserIdeProjectSummariesUncached(session, userId) {
    await ensureAccountResourcePlan(session);
    scheduleProjectServerDemoProjects(session);
    const response = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}&profile=summary`);
    return mapUserIdeProjectSummaries(session, response.items || []);
  }

  async function loadUserIdeProjectsUncached(session, userId) {
    await ensureAccountResourcePlan(session);
    scheduleProjectServerDemoProjects(session);
    const response = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}`);
    const learningProjects = getLearningProjects();
    const synchronizedItems = await Promise.all(response.items.map(async (project) => {
      if (project.status === "plan_locked") return project;
      const definition = getUserIdeState().projectDefinitions
        .find((item) => item.learning_project_id === project.learning_project_id);
      const canonicalManifest = definition
        ? learningProjects.learningProjectManifestForPersistedProject(project, definition)
        : null;
      const needsLearningViewSync = Number(canonicalManifest?.schema_version || 0)
        > Number(project.view_manifest?.schema_version || 0);
      if (needsLearningViewSync) return learningProjects.synchronizeLearningProjectStructure(project, definition);
      return project;
    }));
    return mapUserIdeProjects(session, new Map(synchronizedItems.map((item) => [item.project_id, item])));
  }

  return {
    invalidateUserIdeProjectCaches,
    loadUserIdeProjectSummaries,
    loadUserIdeProjects,
    requireSessionProject,
    sessionProjectNotFound,
  };
}

module.exports = { createProjectRuntimeService };
