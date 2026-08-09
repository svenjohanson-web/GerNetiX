"use strict";

const path = require("node:path");

function createDeviceRuntimeService({ deviceManagementJson, loadUserIdeDevices, sendJson, discoverNetworkDevices, publicDemoBaseUrl, esptoolJsDir, serveStatic, readJsonBody }) {
async function handleDeviceConnectivityCheck(res, session, deviceId) {
  const devices = await loadUserIdeDevices(session);
  const accountDevice = devices.find((device) => device.device_id === deviceId);
  if (!accountDevice) {
    sendJson(res, 404, { error: "device_not_in_account", message: "Das Device gehört nicht zum aktuellen Account." });
    return;
  }
  const discovery = await discoverNetworkDevices(session, { scope: "node" });
  const discovered = (discovery.items || []).find((device) => device.device_id === deviceId);
  if (!discovered) {
    sendJson(res, 200, {
      reachable: false,
      device_id: deviceId,
      checked_at: discovery.searched_at,
      message: `Das Board wurde über ${discovery.candidate_count || 0} lokale Adressen nicht erreicht.`,
    });
    return;
  }
  const status = await deviceManagementJson(`/api/device-management/devices/${encodeURIComponent(deviceId)}/connectivity/status`, {
    method: "POST",
    body: {
      connectivity_status: "online",
      ota_status: discovered.ota_status || accountDevice.ota_status,
      ota_hostname: discovered.hostname || "",
      last_seen_ip: new URL(discovered.source_url).hostname,
    },
  });
  sendJson(res, 200, {
    reachable: true,
    checked_at: discovery.searched_at,
    hostname: discovered.hostname,
    source_url: discovered.source_url,
    device: {
      ...accountDevice,
      connectivity_status: status.connectivity_status || "online",
      ota_status: status.ota_status || discovered.ota_status || accountDevice.ota_status,
    },
  });
}

async function proxyPublicDemo(res, requestPath) {
  try {
    const upstream = await fetch(`${publicDemoBaseUrl.replace(/\/$/, "")}${requestPath}`);
    const content = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
      "Content-Length": content.length,
      "Cache-Control": upstream.headers.get("cache-control") || "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  } catch {
    sendJson(res, 503, {
      error: "public_demo_unavailable",
      message: "Der lokale Demo-Katalog ist noch nicht erreichbar. Starte den Public Demo Server auf Port 4920.",
    });
  }
}

function serveVendorEsptool(res, requestPath) {
  const relativePath = requestPath.replace(/^\/vendor\/esptool-js\//, "");
  const root = relativePath === "bundle.js" ? esptoolJsDir : path.join(esptoolJsDir, "lib");
  serveStatic(res, root, `/${relativePath}`);
}

async function handleDeviceRecoveryFirmwareCheck(req, res, session) {
  const body = await readJsonBody(req);
  const devices = await loadUserIdeDevices(session);
  const device = devices.find((item) => item.device_id === body.device_id);
  if (!device) {
    sendJson(res, 404, { error: "device_not_found", message: "Device wurde nicht gefunden." });
    return;
  }
  const mode = String(body.mode || "").trim().toLowerCase();
  if (!["usb", "ota"].includes(mode)) {
    sendJson(res, 400, { error: "invalid_recovery_mode", message: "Recovery Check muss usb oder ota verwenden." });
    return;
  }
  sendJson(res, 200, createFirmwareRecoveryCheck(device, mode, {
    upload_port: body.upload_port || "",
  }));
}

function createFirmwareRecoveryCheck(device, mode, input = {}) {
  const checks = [
    recoveryCheckItem("device_known", true, "Device ist dem Account zugeordnet."),
    recoveryCheckItem("board_profile", Boolean(device.build_config), device.build_config
      ? `Boardprofil erkannt: ${device.build_target_label || device.hardware_profile_id || "konfiguriert"}.`
      : "Kein Boardprofil fuer Firmware-Checks hinterlegt."),
  ];
  if (mode === "usb") {
    const port = String(input.upload_port || device.upload_port || "").trim();
    checks.push(
      recoveryCheckItem("usb_supported", Boolean(device.usb_flash_supported), device.usb_flash_supported
        ? "USB-Firmwarepfad wird fuer dieses Device unterstuetzt."
        : "Dieses Device ist nicht fuer USB-Firmwarechecks konfiguriert."),
      recoveryCheckItem("usb_port", Boolean(port), port
        ? `USB-Port: ${port}.`
        : "Kein USB-Port ausgewaehlt oder erkannt."),
    );
  } else {
    checks.push(
      recoveryCheckItem("ota_ready", device.ota_status === "ready", device.ota_status === "ready"
        ? "OTA ist fuer dieses Device bereit."
        : `OTA ist nicht bereit: ${device.ota_status || "unknown"}.`),
      recoveryCheckItem("network_reachable", device.connectivity_status === "online", device.connectivity_status === "online"
        ? `Verbindungsstatus: ${device.connectivity_status}.`
        : `Device ist nicht erreichbar: ${device.connectivity_status || "unknown"}.`),
    );
  }
  const ok = checks.every((item) => item.ok);
  return {
    check_id: `firmware_${mode}_${Date.now()}`,
    device_id: device.device_id,
    device_label: device.display_name,
    mode,
    status: ok ? "ready" : "blocked",
    summary: ok
      ? `Firmware-Check ueber ${mode.toUpperCase()} ist bereit.`
      : `Firmware-Check ueber ${mode.toUpperCase()} ist noch blockiert.`,
    checks,
    next_action: ok
      ? (mode === "usb" ? "USB-Firmwarecheck kann als Recovery-Schritt angeschlossen werden." : "OTA-Firmwarecheck kann als Recovery-Schritt angeschlossen werden.")
      : "Fehlende Voraussetzungen beheben, dann erneut pruefen.",
  };
}

function recoveryCheckItem(checkId, ok, message) {
  return {
    check_id: checkId,
    ok: Boolean(ok),
    status: ok ? "ok" : "blocked",
    message,
  };
}

  return {
    handleDeviceConnectivityCheck,
    proxyPublicDemo,
    serveVendorEsptool,
    handleDeviceRecoveryFirmwareCheck,
    createFirmwareRecoveryCheck,
  };
}

module.exports = { createDeviceRuntimeService };

