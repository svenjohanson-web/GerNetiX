"use strict";

function createDeviceService({ readJsonBody, projectServerUserId, requiredField, createGerNetixSerialNumber, normalizeGerNetixNodeName, findProcessorBoard, normalizeCapabilityIds, deviceManagementJson, assignFirstEsp32AsRecoveryToken, sendJson, decorateUserIdeDevice, recordDeviceInventoryFailure }) {
async function handlePlatformDeviceCreate(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const hardwareProfileId = requiredField(body.hardware_profile_id, "hardware_profile_id");
    const serialNumber = String(body.serial_number || "").trim() || createGerNetixSerialNumber(hardwareProfileId);
    const displayName = requiredField(body.display_name || serialNumber, "display_name");
    const nodeName = normalizeGerNetixNodeName(body.node_name || body.board_short_name || displayName);
    const processorBoard = await findProcessorBoard(hardwareProfileId);
    const capabilities = normalizeCapabilityIds(
      body.technical_capability_ids || body.capability_ids || processorBoard?.capability_ids || [],
    );
    const registered = await deviceManagementJson("/api/device-management/devices/register", {
      method: "POST",
      body: {
        serial_number: serialNumber,
        hardware_profile_id: hardwareProfileId,
        authenticity_status: "community_unverified",
        lifecycle_state: "registered_by_customer",
        connectivity_status: body.connectivity_status || "unknown",
        ota_status: body.ota_status || (capabilities.includes("ota") ? "unknown" : "unsupported"),
        app_version: body.app_version || "",
        runtime_version: body.runtime_version || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const recoveryAccount = await assignFirstEsp32AsRecoveryToken(req, session, registered.device_id, hardwareProfileId);
    sendJson(res, 201, {
      ...decorateUserIdeDevice(accountDevice),
      recovery_token_assigned: Boolean(recoveryAccount),
      account: recoveryAccount || undefined,
    });
  } catch (error) {
    recordDeviceInventoryFailure(session, "device_inventory_create_failed", error, {
      operation: "handlePlatformDeviceCreate",
      route: "/app/device-management/inventory/",
    });
    sendJson(res, error.status || 400, {
      error: error.code || "device_inventory_create_failed",
      message: error.message || "Device konnte nicht inventarisiert werden.",
      details: error.payload || {},
    });
  }
}

async function handlePlatformDiscoveredDeviceClaim(req, res, session) {
  const body = await readJsonBody(req);
  return claimPlatformDiscoveredDevice(req, res, session, body);
}

async function handlePlatformProvisioningSession(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const provisioningBinding = requiredField(body.provisioning_binding, "provisioning_binding");
    const token = await deviceManagementJson("/api/device-management/provisioning/tokens", {
      method: "POST",
      body: { account_id: accountId, provisioning_binding: provisioningBinding },
    });
    sendJson(res, 201, token);
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "provisioning_session_create_failed",
      message: error.message || "Provisionierungs-Token konnte nicht erstellt werden.",
    });
  }
}

async function handlePlatformProvisioningComplete(req, res, session) {
  try {
    const body = await readJsonBody(req);
    const accountId = projectServerUserId(session);
    const consumed = await deviceManagementJson("/api/device-management/provisioning/tokens/consume", {
      method: "POST",
      body: {
        provisioning_token: requiredField(body.provisioning_token, "provisioning_token"),
        provisioning_binding: requiredField(body.provisioning_binding, "provisioning_binding"),
      },
    });
    if (consumed.account_id !== accountId) throw new Error("Provisionierungs-Token gehoert nicht zum angemeldeten Account.");
    delete body.provisioning_token;
    delete body.provisioning_binding;
    return claimPlatformDiscoveredDevice(req, res, session, body);
  } catch (error) {
    sendJson(res, error.status || 400, {
      error: error.code || "provisioning_complete_failed",
      message: error.message || "WLAN-Provisionierung konnte nicht abgeschlossen werden.",
    });
  }
}

async function claimPlatformDiscoveredDevice(req, res, session, body) {
  try {
    const accountId = projectServerUserId(session);
    const discoveredDeviceId = body.device_id || body.deviceId || "";
    const hardwareProfileId = requiredField(body.hardware_profile_id || body.hardwareProfileId, "hardware_profile_id");
    const serialNumber = String(body.serial_number || body.serialNumber || "").trim() || createGerNetixSerialNumber(hardwareProfileId);
    const displayName = requiredField(body.display_name || body.displayName || serialNumber, "display_name");
    const nodeName = normalizeGerNetixNodeName(body.node_name || body.board_short_name || body.hostname || displayName);
    const capabilities = normalizeCapabilityIds(body.technical_capability_ids || body.capability_ids || body.capabilities || []);
    const registered = await deviceManagementJson("/api/device-management/devices/register", {
      method: "POST",
      body: {
        device_id: discoveredDeviceId || undefined,
        serial_number: serialNumber,
        hardware_profile_id: hardwareProfileId,
        authenticity_status: body.authenticity_status || body.authenticityStatus || "gernetix_verified_pending_proof",
        lifecycle_state: "discovered_by_user_ide",
        connectivity_status: body.connectivity_status || body.connectivityStatus || "online",
        ota_status: body.ota_status || body.otaStatus || (capabilities.includes("ota") ? "ready" : "unknown"),
        app_version: body.app_version || body.firmwareVersion || "",
        runtime_version: body.runtime_version || body.runtimeVersion || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const accountDevice = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`, {
      method: "POST",
      body: {
        device_id: registered.device_id,
        display_name: displayName,
        technical_capability_ids: capabilities,
        purchase_context_id: body.purchase_context_id || "",
        board_short_name: body.board_short_name || "",
        node_name: nodeName,
        instance_configuration: body.instance_configuration || {},
      },
    });
    const recoveryAccount = await assignFirstEsp32AsRecoveryToken(req, session, registered.device_id, hardwareProfileId);
    sendJson(res, 201, {
      ...decorateUserIdeDevice(accountDevice),
      recovery_token_assigned: Boolean(recoveryAccount),
      account: recoveryAccount || undefined,
    });
  } catch (error) {
    recordDeviceInventoryFailure(session, "discovered_device_claim_failed", error, {
      operation: "handlePlatformDiscoveredDeviceClaim",
      route: "/app/device-management/inventory/",
    });
    sendJson(res, error.status || 400, {
      error: error.code || "discovered_device_claim_failed",
      message: error.message || "Gefundenes Device konnte nicht ins Inventar uebernommen werden.",
      details: error.payload || {},
    });
  }
}

async function handlePlatformDeviceRemove(res, session, accountDeviceId) {
  try {
    const accountId = projectServerUserId(session);
    const result = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices/${encodeURIComponent(accountDeviceId)}`, {
      method: "DELETE",
    });
    sendJson(res, 200, result);
  } catch (error) {
    recordDeviceInventoryFailure(session, "device_inventory_remove_failed", error, {
      operation: "handlePlatformDeviceRemove",
      route: "/app/device-management/inventory/",
    });
    sendJson(res, error.status || 400, {
      error: error.code || "device_inventory_remove_failed",
      message: error.message || "Device konnte nicht aus dem Inventar entfernt werden.",
      details: error.payload || {},
    });
  }
}


  return { handlePlatformDeviceCreate, handlePlatformDiscoveredDeviceClaim, handlePlatformProvisioningSession, handlePlatformProvisioningComplete, handlePlatformDeviceRemove };
}

module.exports = { createDeviceService };

