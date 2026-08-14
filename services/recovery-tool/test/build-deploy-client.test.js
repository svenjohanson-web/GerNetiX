"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { BuildDeployClient } = require("../src/services/build-deploy-client");
const { verifyDelegation, verifyInternalToken } = require("../../shared/internal-api-auth");

test("Build Deploy client binds service and delegation tokens to account and project", async () => {
  const calls = [];
  const client = new BuildDeployClient({
    baseUrl: "https://build.internal",
    signingKey: "recovery-build-test-key",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ job_id: "job-1" }), { status: options.method === "POST" ? 202 : 200 });
    },
  });
  await client.submit({ account_id: "acct-1", project_id: "project-1" });
  const service = verifyInternalToken(calls[0].options.headers.Authorization.replace(/^Bearer /, ""), "recovery-build-test-key", {
    audience: "build-deploy-server", requiredScopes: ["build.job.request"],
  });
  const delegation = verifyDelegation(calls[0].options.headers["X-GerNetiX-Delegation"], "recovery-build-test-key", {
    audience: "build-deploy-server", requiredScopes: ["build.job.request"],
  });
  assert.equal(service.sub, "recovery-tool");
  assert.equal(delegation.context.account_id, "acct-1");
  assert.deepEqual(delegation.context.project_ids, ["project-1"]);
});

test("Build Deploy client fails closed without the shared signing key", () => {
  const client = new BuildDeployClient({ baseUrl: "https://build.internal" });
  assert.throws(() => client.authHeaders("build.job.read", { account_id: "acct-1" }), /nicht konfiguriert/);
});
