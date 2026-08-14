const { TelemetryError } = require("./errors");
const { issueInternalToken } = require("../../shared/internal-api-auth");

function createRemoteOwnershipResolver({ projectServerBaseUrl, deviceManagementBaseUrl, internalApiSigningKey = "", fetchImpl = fetch }) {
  return async function resolveOwnership({ device_id: deviceId, project_id: projectId }) {
    const projectToken = issueInternalToken({
      iss: "telemetry-server",
      sub: "telemetry-server",
      aud: "project-server",
      scopes: ["project.ownership.resolve"],
    }, internalApiSigningKey);
    const deviceToken = issueInternalToken({
      iss: "telemetry-server",
      sub: "telemetry-server",
      aud: "device-management-server",
      scopes: ["device.ownership.resolve"],
    }, internalApiSigningKey);
    const [project, recipients] = await Promise.all([
      requestJson(fetchImpl, `${projectServerBaseUrl}/api/internal/project-ownership/${encodeURIComponent(projectId)}`, "Projekt", {
        Authorization: `Bearer ${projectToken}`,
      }),
      requestJson(fetchImpl, `${deviceManagementBaseUrl}/api/device-management/devices/${encodeURIComponent(deviceId)}/push-recipients`, "Device-Besitz", {
        Authorization: `Bearer ${deviceToken}`,
      }),
    ]);
    const accountId = String(project.account_id || "").trim();
    const accountIds = Array.isArray(recipients.account_ids) ? recipients.account_ids : [];
    if (!accountId || !accountIds.includes(accountId)) {
      throw new TelemetryError("device_project_ownership_mismatch", "Board und Projekt gehören nicht demselben Account.", 403);
    }
    const allocatedDeviceIds = Array.isArray(project.allocated_device_ids) ? project.allocated_device_ids : [];
    if (!allocatedDeviceIds.includes(deviceId)) {
      throw new TelemetryError("device_not_allocated_to_project", "Das Board ist diesem Projekt nicht zugeordnet.", 403);
    }
    return { account_id: accountId };
  };
}

async function requestJson(fetchImpl, url, label, headers = {}) {
  let response;
  try { response = await fetchImpl(url, { headers }); }
  catch { throw new TelemetryError("ownership_resolution_unavailable", `${label} kann nicht geprüft werden.`, 502); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new TelemetryError("ownership_resolution_failed", `${label} konnte nicht geprüft werden.`, 502, { status: response.status });
  return payload;
}

module.exports = { createRemoteOwnershipResolver };
