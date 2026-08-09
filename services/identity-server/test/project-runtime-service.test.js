const assert = require("node:assert/strict");
const test = require("node:test");

const { createProjectRuntimeService } = require("../src/dev/projects/project-runtime-service");

test("shares concurrent project loads and keeps synchronization behind the learning boundary", async () => {
  let projectRequests = 0;
  let resourcePlanChecks = 0;
  const learningProjects = {
    learningProjectManifestForPersistedProject: () => ({ schema_version: 2 }),
    synchronizeLearningProjectStructure: async (project) => ({ ...project, synchronized: true }),
  };
  const service = createProjectRuntimeService({
    ensureAccountResourcePlan: async () => { resourcePlanChecks += 1; },
    getLearningProjects: () => learningProjects,
    getUserIdeState: () => ({ projectDefinitions: [{ learning_project_id: "learning.one" }] }),
    mapProjectServerProject: (_session, project) => project,
    mapUserIdeProjectSummaries: (_session, projects) => projects,
    mapUserIdeProjects: (_session, projects) => Array.from(projects.values()),
    projectServerJson: async (url) => {
      if (url.includes("?user_id=")) projectRequests += 1;
      return { items: [{ project_id: "p1", learning_project_id: "learning.one", view_manifest: { schema_version: 1 } }] };
    },
    projectServerUserId: () => "account-1",
    scheduleProjectServerDemoProjects() {},
  });

  const [left, right] = await Promise.all([
    service.loadUserIdeProjects({}),
    service.loadUserIdeProjects({}),
  ]);
  assert.deepEqual(left, right);
  assert.equal(left[0].synchronized, true);
  assert.equal(projectRequests, 1);
  assert.equal(resourcePlanChecks, 1);
});

test("rejects project access across account boundaries", async () => {
  const service = createProjectRuntimeService({
    ensureAccountResourcePlan: async () => {},
    getLearningProjects: () => ({}),
    getUserIdeState: () => ({ projectDefinitions: [] }),
    mapProjectServerProject: (_session, project) => project,
    mapUserIdeProjectSummaries: () => [],
    mapUserIdeProjects: () => [],
    projectServerJson: async () => ({ project_id: "p1", user_id: "another-account" }),
    projectServerUserId: () => "account-1",
    scheduleProjectServerDemoProjects() {},
  });
  await assert.rejects(() => service.requireSessionProject({}, "p1"), { status: 404 });
});

