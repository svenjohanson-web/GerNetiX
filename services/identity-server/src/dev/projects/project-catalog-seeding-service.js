"use strict";

function createProjectCatalogSeedingService({
  accountSubscription,
  demoProjectSources,
  getUserIdeState,
  projectServerJson,
  projectServerUserId,
  projectViewManifest,
}) {
  const seededUsers = new Set();
  const seedPromises = new Map();

  function scheduleProjectServerDemoProjects(session) {
    void ensureProjectServerDemoProjects(session).catch((error) => {
      console.warn(`Project-Server-Katalogsynchronisierung fehlgeschlagen: ${error.message || error}`);
    });
  }

  function ensureProjectServerDemoProjects(session) {
    const userId = projectServerUserId(session);
    if (seededUsers.has(userId)) return Promise.resolve();
    if (seedPromises.has(userId)) return seedPromises.get(userId);
    const promise = seedProjectServerDemoProjects(session, userId)
      .then(() => { seededUsers.add(userId); })
      .finally(() => { seedPromises.delete(userId); });
    seedPromises.set(userId, promise);
    return promise;
  }

  async function seedProjectServerDemoProjects(session, userId) {
    for (const definition of getUserIdeState().projectDefinitions) {
      await projectServerJson("/api/projects", {
        method: "POST",
        body: {
          project_id: definition.project_server_id,
          user_id: userId,
          plan_id: accountSubscription(session).plan_id,
          title: definition.title,
          description: definition.summary,
          learning_project_id: definition.learning_project_id,
          hardware_profile_id: definition.hardware_profile_id,
          device_id: definition.default_device_id,
          build_config: definition.build_config,
          ...(definition.system_source_id ? { system_source_id: definition.system_source_id } : {}),
          view_manifest: projectViewManifest(definition),
          sources: demoProjectSources(definition),
        },
      }).catch((error) => {
        if (![400, 409].includes(error.status)) throw error;
      });
      await projectServerJson(`/api/projects/${encodeURIComponent(definition.project_server_id)}`, {
        method: "PATCH",
        body: {
          hardware_profile_id: definition.hardware_profile_id,
          device_id: definition.default_device_id || null,
          build_config: definition.build_config || null,
          view_manifest: projectViewManifest(definition),
        },
      }).catch((error) => {
        if (error.status !== 404) throw error;
      });
      for (const source of demoProjectSources(definition)) {
        await projectServerJson(`/api/projects/${encodeURIComponent(definition.project_server_id)}/sources`, {
          method: "PUT",
          body: source,
        });
      }
    }
  }

  return { ensureProjectServerDemoProjects, scheduleProjectServerDemoProjects };
}

module.exports = { createProjectCatalogSeedingService };

