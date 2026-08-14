const assert = require("node:assert/strict");
const test = require("node:test");

const { createAccountWorkspaceService } = require("../src/dev/account/account-workspace-service");

function createService() {
  const state = { workspaceStates: new Map() };
  const requests = [];
  const service = createAccountWorkspaceService({
    accountSubscription: () => ({ plan: "Premium", plan_id: "premium", entitlements: ["build_and_flash"] }),
    getUserIdeState: () => state,
    loadAiUsageSummary: async () => ({ credits: 7, credit_packages: [] }),
    projectServerJson: async (url, options) => {
      requests.push({ url, options });
      return { plan_id: options.body.plan_id, active_project_ids: options.body.active_project_ids || [] };
    },
    projectServerUserId: () => "account-1",
  });
  return { requests, service };
}

test("keeps workspace state inside the account workspace boundary", () => {
  const { service } = createService();
  assert.equal(service.getWorkspaceState("account-1").lastMode, "learn");
  const updated = service.touchWorkspace({}, "project-1", "ide", "/app/ide/");
  assert.equal(updated.lastProjectId, "project-1");
  assert.equal(service.getWorkspaceState("account-1").lastRoute, "/app/ide/");
});

test("shares and refreshes the account resource plan cache", async () => {
  const { requests, service } = createService();
  const session = { account: { subscription_plan: "premium" } };
  const [left, right] = await Promise.all([
    service.ensureAccountResourcePlan(session),
    service.ensureAccountResourcePlan(session),
  ]);
  assert.deepEqual(left, right);
  assert.equal(requests.length, 1);

  await service.updateAccountProjectSelection(session, { active_project_ids: ["p1", "p1", "p2"] });
  assert.deepEqual(requests.at(-1).options.body.active_project_ids, ["p1", "p2"]);
  assert.deepEqual(requests.at(-1).options.internalAuth, {
    scopes: ["project.write"],
    delegation: { account_id: "account-1", project_ids: [] },
  });
  assert.equal(requests.length, 2);
});
