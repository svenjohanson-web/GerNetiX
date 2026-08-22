const assert = require("node:assert/strict");
const test = require("node:test");
const { createRemoteOwnershipResolver } = require("../src/ownership-resolver");
const { verifyInternalToken } = require("../../shared/internal-api-auth");

function resolver(project) {
  return createRemoteOwnershipResolver({
    projectServerBaseUrl: "http://projects",
    deviceManagementBaseUrl: "http://devices",
    internalApiSigningKey: "telemetry-ownership-test-key",
    fetchImpl: async (url, options) => {
      if (url.startsWith("http://projects")) {
        verifyInternalToken(options.headers.Authorization.replace(/^Bearer /, ""), "telemetry-ownership-test-key", {
          audience: "project-server", requiredScopes: ["project.ownership.resolve"],
        });
      } else {
        verifyInternalToken(options.headers.Authorization.replace(/^Bearer /, ""), "telemetry-ownership-test-key", {
          audience: "device-management-server", requiredScopes: ["device.ownership.resolve"],
        });
      }
      return { ok: true, async json() { return url.startsWith("http://projects") ? project : { account_ids: ["acct-owner"] }; } };
    },
  });
}

test("requires a concrete project allocation in addition to account ownership", async () => {
  await assert.rejects(() => resolver({ account_id: "acct-owner", allocated_device_ids: ["device-other"] })({ device_id: "device-1", project_id: "project-1" }), { code: "device_not_allocated_to_project" });
  const result = await resolver({ account_id: "acct-owner", allocated_device_ids: ["device-1"] })({ device_id: "device-1", project_id: "project-1" });
  assert.deepEqual(result, { account_id: "acct-owner" });
});
