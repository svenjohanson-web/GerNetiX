const os = require("node:os");

function createDeviceDiscoveryService({
  deviceDiscoveryUrls,
  deviceManagementJson,
  loadUserIdeDevices,
  normalizeCapabilityIds,
  nodeHostnamePrefix = "gernetix-",
}) {
  async function discoverNetworkDevices(session, options = {}) {
    const accountDevices = await loadUserIdeDevices(session).catch(() => []);
    const adminDevices = await loadAdminDeviceSummaries().catch(() => []);
    const knownDeviceIds = new Set(accountDevices.map((device) => device.device_id));
    const adminByDeviceId = new Map(adminDevices.map((device) => [device.device_id, device]));
    const scope = String(options.scope || "node").trim();
    const candidates = discoveryCandidateUrls({ includeSetupAp: scope === "setup_ap", onlySetupAp: scope === "setup_ap" });
    const found = [];
    const errors = [];
    await runLimited(candidates, 32, async (url) => {
      const result = await probeDeviceStatus(url);
      if (result.device) {
        const adminDevice = adminByDeviceId.get(result.device.device_id);
        const alreadyInInventory = knownDeviceIds.has(result.device.device_id);
        found.push({
          ...result.device,
          already_in_inventory: alreadyInInventory,
          ownership_status: alreadyInInventory
            ? "current_account"
            : (adminDevice?.pairing_status === "paired_to_account" ? "other_account" : "unregistered"),
        });
      } else if (result.error) {
        errors.push(result.error);
      }
    });
    const unique = [];
    const seen = new Set();
    for (const item of found) {
      const key = item.device_id || item.serial_number || item.source_url;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return {
      searched_at: new Date().toISOString(),
      strategy: scope === "setup_ap" ? "http_status_setup_ap" : "http_status_scan_gernetix_prefix",
      hostname_pattern: `${nodeHostnamePrefix}*`,
      candidate_count: candidates.length,
      items: unique,
      errors: errors.slice(0, 10),
    };
  }

  async function loadAdminDeviceSummaries() {
    const response = await deviceManagementJson("/api/device-management/admin/devices");
    return response.items || [];
  }

  function discoveryCandidateUrls(options = {}) {
    if (options.onlySetupAp) return ["http://192.168.4.1/status"];
    const explicit = deviceDiscoveryUrls
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.startsWith("http") ? item : `http://${item}`);
    const candidates = new Set(explicit.map(statusUrl));
    for (const baseAddress of localIpv4NetworkBases()) {
      for (let host = 1; host <= 254; host += 1) {
        candidates.add(`http://${baseAddress}.${host}/status`);
      }
    }
    if (options.includeSetupAp) candidates.add("http://192.168.4.1/status");
    return Array.from(candidates);
  }

  function normalizeDiscoveredDevice(sourceUrl, status = {}) {
    const deviceName = String(status.device || status.hostname || "").trim();
    const displayName = String(status.displayName || status.display_name || "").trim();
    const runtimeName = String(status.runtime || "").trim();
    const isGerNetixRuntime = runtimeName === "basissoftware/esp32" || runtimeName.toLowerCase().includes("gernetix");
    const isGerNetix = deviceName.toLowerCase().startsWith(nodeHostnamePrefix)
      || displayName.toLowerCase().startsWith(nodeHostnamePrefix)
      || isGerNetixRuntime;
    if (!isGerNetix) return null;
    const capabilities = normalizeCapabilityIds(status.capabilities || inferDiscoveredCapabilities(status));
    const deviceId = status.deviceId || status.device_id || "";
    const serialNumber = status.serialNumber || status.serial_number || "";
    const hostname = status.hostname || deviceName;
    return {
      discovery_id: Buffer.from(sourceUrl).toString("base64url"),
      source_url: sourceUrl,
      device_id: deviceId,
      serial_number: serialNumber,
      display_name: displayName || serialNumber || deviceId || hostname || `GerNetiX Device ${sourceUrl}`,
      hostname,
      hardware_profile_id: status.hardwareProfileId || status.hardware_profile_id || "hardware.processor_board.generic_esp_wroom32",
      technical_capability_ids: capabilities,
      runtime_version: status.runtimeVersion || status.runtime_version || "",
      firmware_version: status.firmwareVersion || status.firmware_version || "",
      provisioning_state: status.provisioningState || status.provisioning_state || "",
      connectivity_status: status.wifiMode === "setup_ap" ? "setup_ap" : "online",
      esp32_inventory_state: status.wifiMode === "setup_ap" ? "basissoftware_setup_ap" : "node_online",
      treatment: status.wifiMode === "setup_ap"
        ? "Basissoftware ist vorhanden, aber noch nicht im Kunden-WLAN. Im Setup-AP WLAN-Daten speichern und danach Node-Suche erneut ausfuehren."
        : "Basissoftware ist als Node im WLAN erreichbar. Nach Kontopruefung kann das Board ins Inventar uebernommen werden.",
      ota_status: capabilities.includes("ota") ? "ready" : "unknown",
      authenticity_status: status.hasDeviceSecret ? "gernetix_verified_pending_proof" : "community_unverified",
    };
  }

  async function probeDeviceStatus(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 450);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return {};
      const status = await response.json();
      const device = normalizeDiscoveredDevice(url, status);
      return device ? { device } : {};
    } catch {
      return {};
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    discoverNetworkDevices,
  };
}

function statusUrl(value) {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.endsWith("/status") ? trimmed : `${trimmed}/status`;
}

function localIpv4NetworkBases() {
  const bases = new Set();
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (!/^(10\.|172\.(1[6-9]|2\d|3[0-1])\.|192\.168\.)/.test(entry.address)) continue;
      const parts = entry.address.split(".");
      if (parts.length === 4) bases.add(parts.slice(0, 3).join("."));
    }
  }
  return Array.from(bases);
}

function inferDiscoveredCapabilities(status = {}) {
  const capabilities = ["wifi", "flash_firmware"];
  if (String(status.runtime || "").toLowerCase().includes("ota") || String(status.firmwareBasis || "").toLowerCase().includes("ota")) {
    capabilities.push("ota");
  }
  return capabilities;
}

async function runLimited(items, limit, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

module.exports = {
  createDeviceDiscoveryService,
};
