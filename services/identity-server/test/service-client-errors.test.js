const assert = require("node:assert/strict");
const test = require("node:test");

const { createDevServiceClients } = require("../src/dev/service-clients");

test("upstream disconnects become readable gateway errors", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("write EPIPE"); };
  try {
    const clients = createDevServiceClients({
      aiContextBaseUrl: "http://context",
      aiUsageBaseUrl: "http://usage",
      buildDeployBaseUrl: "http://build",
      deviceManagementBaseUrl: "http://devices",
      hardwareCatalogBaseUrl: "http://catalog",
      hardwareShopBaseUrl: "http://shop",
      projectServerBaseUrl: "http://projects",
    });
    await assert.rejects(clients.buildDeployJson("/api/build-jobs"), (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.code, "upstream_connection_failed");
      assert.match(error.message, /Build & Deploy request failed/);
      return true;
    });
  } finally {
    global.fetch = originalFetch;
  }
});
