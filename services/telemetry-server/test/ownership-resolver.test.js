const assert = require("node:assert/strict");
const test = require("node:test");
const { createRemoteOwnershipResolver } = require("../src/ownership-resolver");

function resolver(project) {
  return createRemoteOwnershipResolver({ projectServerBaseUrl: "http://projects", deviceManagementBaseUrl: "http://devices", fetchImpl: async (url) => ({ ok: true, async json() { return url.startsWith("http://projects") ? project : { account_ids: ["acct-owner"] }; } }) });
}

test("requires a concrete project allocation in addition to account ownership", async () => {
  await assert.rejects(() => resolver({ user_id: "acct-owner", device_id: "device-other" })({ device_id: "device-1", project_id: "project-1" }), { code: "device_not_allocated_to_project" });
  const result = await resolver({ user_id: "acct-owner", build_config: { component_device_allocations: [{ component_path: "Komponenten/IoT", device_id: "device-1" }] } })({ device_id: "device-1", project_id: "project-1" });
  assert.deepEqual(result, { account_id: "acct-owner" });
});
