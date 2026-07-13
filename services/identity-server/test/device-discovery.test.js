const assert = require("node:assert/strict");
const test = require("node:test");
const { createDeviceDiscoveryService } = require("../src/dev/device-discovery");

test("discovers GerNetiX node by default hostname candidate", async () => {
  const requestedUrls = [];
  const service = createDeviceDiscoveryService({
    deviceDiscoveryUrls: "",
    deviceManagementJson: async () => ({ items: [] }),
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      if (url !== "http://gernetix-esp32/status") {
        return { ok: false, async json() { return {}; } };
      }
      return {
        ok: true,
        async json() {
          return {
            device: "gernetix-esp32",
            runtime: "basissoftware/esp32",
            runtimeVersion: "0.1.0",
            wifiMode: "station",
            capabilities: ["wifi", "ota"],
          };
        },
      };
    },
    loadUserIdeDevices: async () => [],
    networkBases: () => [],
    normalizeCapabilityIds: (items) => items,
  });

  const result = await service.discoverNetworkDevices({});

  assert.ok(requestedUrls.includes("http://gernetix-esp32/status"));
  assert.ok(requestedUrls.includes("http://gernetix-esp32.local/status"));
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].hostname, "gernetix-esp32");
  assert.equal(result.items[0].esp32_inventory_state, "node_online");
});

test("keeps explicit discovery URL path unchanged", async () => {
  const requestedUrls = [];
  const service = createDeviceDiscoveryService({
    deviceDiscoveryUrls: "http://192.168.178.44/custom-status",
    deviceManagementJson: async () => ({ items: [] }),
    fetchImpl: async (url) => {
      requestedUrls.push(url);
      return { ok: false, async json() { return {}; } };
    },
    loadUserIdeDevices: async () => [],
    networkBases: () => [],
    normalizeCapabilityIds: (items) => items,
  });

  await service.discoverNetworkDevices({});

  assert.ok(requestedUrls.includes("http://192.168.178.44/custom-status"));
  assert.ok(!requestedUrls.includes("http://192.168.178.44/custom-status/status"));
});

test("coalesces concurrent node scans into one network search", async () => {
  let fetchCount = 0;
  let releaseScan;
  const scanGate = new Promise((resolve) => { releaseScan = resolve; });
  const service = createDeviceDiscoveryService({
    deviceDiscoveryUrls: "",
    deviceManagementJson: async () => ({ items: [] }),
    fetchImpl: async () => {
      fetchCount += 1;
      await scanGate;
      return { ok: false, async json() { return {}; } };
    },
    loadUserIdeDevices: async () => [],
    networkBases: () => [],
    normalizeCapabilityIds: (items) => items,
  });
  const first = service.discoverNetworkDevices({ account_id: "one" });
  const second = service.discoverNetworkDevices({ account_id: "one" });
  releaseScan();
  await Promise.all([first, second]);
  assert.equal(fetchCount, 2);
});
