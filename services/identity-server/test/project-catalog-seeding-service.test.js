const assert = require("node:assert/strict");
const test = require("node:test");

const { createProjectCatalogSeedingService } = require("../src/dev/projects/project-catalog-seeding-service");

test("seeds a catalog only once per account", async () => {
  const requests = [];
  const service = createProjectCatalogSeedingService({
    accountSubscription: () => ({ plan_id: "premium" }),
    demoProjectSources: () => [{ path: "src/main.cpp", content: "" }],
    getUserIdeState: () => ({ projectDefinitions: [{
      project_server_id: "catalog_one",
      title: "One",
      summary: "Summary",
      learning_project_id: "learning.one",
      hardware_profile_id: "esp32",
    }] }),
    projectServerJson: async (url, options) => { requests.push({ url, options }); return {}; },
    projectServerUserId: () => "account-1",
    projectViewManifest: () => ({ schema_version: 1 }),
  });
  await Promise.all([
    service.ensureProjectServerDemoProjects({}),
    service.ensureProjectServerDemoProjects({}),
  ]);
  await service.ensureProjectServerDemoProjects({});
  assert.equal(requests.length, 3);
  assert.deepEqual(requests.map((request) => request.options.method), ["POST", "PATCH", "PUT"]);
});

