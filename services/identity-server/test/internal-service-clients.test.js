"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDevServiceClients } = require("../src/dev/service-clients");
const { verifyInternalToken, verifyDelegation } = require("../../shared/internal-api-auth");

test("identity service clients emit short lived target-bound service tokens", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => ({}) }; };
  try {
    const clients = createDevServiceClients({ aiContextBaseUrl:"http://context", aiUsageBaseUrl:"http://usage", buildDeployBaseUrl:"http://build", deviceManagementBaseUrl:"http://devices", hardwareCatalogBaseUrl:"http://catalog", hardwareShopBaseUrl:"http://shop", projectServerBaseUrl:"http://projects", internalApiSigningKey:"test-key" });
    await clients.aiUsageJson("/api/ai-usage/accounts/acct-1/credits");
    const token = calls[0].init.headers.Authorization.replace(/^Bearer\s+/, "");
    const claims = verifyInternalToken(token, "test-key", { audience:"ai-usage-server", requiredScopes:["ai.usage.read"] });
    assert.equal(claims.sub, "identity-server");
  } finally { global.fetch = originalFetch; }
});

test("identity service clients issue a resource-bound delegation only when supplied by a trusted handler", async () => {
  const originalFetch = global.fetch;
  let headers;
  global.fetch = async (_url, init) => { headers = init.headers; return { ok: true, status: 200, json: async () => ({}) }; };
  try {
    const clients = createDevServiceClients({ aiContextBaseUrl:"http://context", aiUsageBaseUrl:"http://usage", buildDeployBaseUrl:"http://build", deviceManagementBaseUrl:"http://devices", hardwareCatalogBaseUrl:"http://catalog", hardwareShopBaseUrl:"http://shop", projectServerBaseUrl:"http://projects", internalApiSigningKey:"test-key" });
    await clients.projectServerJson("/api/projects/project-1", { internalAuth:{ delegation:{ account_id:"acct-1", project_ids:["project-1"], entitlements:["ai_assistant"] } } });
    const claims = verifyDelegation(headers["X-GerNetiX-Project-Delegation"], "test-key", { audience:"project-server", requiredScopes:["project.read"] });
    assert.deepEqual(claims.context.project_ids, ["project-1"]);
  } finally { global.fetch = originalFetch; }
});

test("identity device client binds account routes to the account delegation", async () => {
  const originalFetch = global.fetch;
  let headers;
  global.fetch = async (_url, init) => { headers = init.headers; return { ok: true, status: 200, json: async () => ({ items:[] }) }; };
  try {
    const clients = createDevServiceClients({ aiContextBaseUrl:"http://context", aiUsageBaseUrl:"http://usage", buildDeployBaseUrl:"http://build", deviceManagementBaseUrl:"http://devices", hardwareCatalogBaseUrl:"http://catalog", hardwareShopBaseUrl:"http://shop", projectServerBaseUrl:"http://projects", internalApiSigningKey:"test-key" });
    await clients.deviceManagementJson("/api/device-management/accounts/acct-1/devices");
    verifyInternalToken(headers.Authorization.replace(/^Bearer\s+/, ""), "test-key", {
      audience:"device-management-server", requiredScopes:["device.account.read"],
    });
    const delegation = verifyDelegation(headers["X-GerNetiX-Delegation"], "test-key", {
      audience:"device-management-server", requiredScopes:["device.account.read"],
    });
    assert.equal(delegation.context.account_id, "acct-1");
  } finally { global.fetch = originalFetch; }
});

test("identity telemetry client binds reads to account and project", async () => {
  const originalFetch = global.fetch;
  let headers;
  global.fetch = async (_url, init) => { headers = init.headers; return { ok: true, status: 200, json: async () => ({ items:[] }) }; };
  try {
    const clients = createDevServiceClients({ aiContextBaseUrl:"http://context", aiUsageBaseUrl:"http://usage", buildDeployBaseUrl:"http://build", deviceManagementBaseUrl:"http://devices", hardwareCatalogBaseUrl:"http://catalog", hardwareShopBaseUrl:"http://shop", projectServerBaseUrl:"http://projects", telemetryBaseUrl:"http://telemetry", internalApiSigningKey:"test-key" });
    await clients.telemetryJson("/api/telemetry/internal/accounts/acct-1/projects/project-1/measurements");
    verifyInternalToken(headers.Authorization.replace(/^Bearer\s+/, ""), "test-key", {
      audience:"telemetry-server", requiredScopes:["telemetry.read"],
    });
    const delegation = verifyDelegation(headers["X-GerNetiX-Delegation"], "test-key", {
      audience:"telemetry-server", requiredScopes:["telemetry.read"],
    });
    assert.equal(delegation.context.account_id, "acct-1");
    assert.deepEqual(delegation.context.project_ids, ["project-1"]);
  } finally { global.fetch = originalFetch; }
});
