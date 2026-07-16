const { TelemetryError } = require("./errors");

function createRemoteOwnershipResolver({ projectServerBaseUrl, deviceManagementBaseUrl, fetchImpl = fetch }) {
  return async function resolveOwnership({ device_id: deviceId, project_id: projectId }) {
    const [project, recipients] = await Promise.all([
      requestJson(fetchImpl, `${projectServerBaseUrl}/api/projects/${encodeURIComponent(projectId)}`, "Projekt"),
      requestJson(fetchImpl, `${deviceManagementBaseUrl}/api/device-management/devices/${encodeURIComponent(deviceId)}/push-recipients`, "Device-Besitz"),
    ]);
    const accountId = String(project.user_id || "").trim();
    const accountIds = Array.isArray(recipients.account_ids) ? recipients.account_ids : [];
    if (!accountId || !accountIds.includes(accountId)) {
      throw new TelemetryError("device_project_ownership_mismatch", "Board und Projekt gehören nicht demselben Account.", 403);
    }
    const allocatedDeviceIds = [project.device_id, ...(project.build_config?.component_device_allocations || []).map((item) => item.device_id)]
      .map((value) => String(value || "").trim()).filter(Boolean);
    if (!allocatedDeviceIds.includes(deviceId)) {
      throw new TelemetryError("device_not_allocated_to_project", "Das Board ist diesem Projekt nicht zugeordnet.", 403);
    }
    return { account_id: accountId };
  };
}

async function requestJson(fetchImpl, url, label) {
  let response;
  try { response = await fetchImpl(url); }
  catch { throw new TelemetryError("ownership_resolution_unavailable", `${label} kann nicht geprüft werden.`, 502); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new TelemetryError("ownership_resolution_failed", `${label} konnte nicht geprüft werden.`, 502, { status: response.status });
  return payload;
}

module.exports = { createRemoteOwnershipResolver };
