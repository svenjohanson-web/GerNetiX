const DEVICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function normalizeDeviceId(value) {
  const deviceId = String(value || "");
  if (!DEVICE_ID_PATTERN.test(deviceId)) {
    throw new Error("device_id must contain only letters, digits, dot, underscore or hyphen (max. 128 characters)");
  }
  return deviceId;
}

function telemetryTopic(deviceId) {
  return `gernetix/devices/${normalizeDeviceId(deviceId)}/telemetry`;
}

function heartbeatTopic(deviceId) {
  return `gernetix/devices/${normalizeDeviceId(deviceId)}/status/heartbeat`;
}

function assertDevicePublishTopic(deviceId, topic) {
  const prefix = `gernetix/devices/${normalizeDeviceId(deviceId)}/`;
  const allowed = topic === `${prefix}telemetry` || topic.startsWith(`${prefix}status/`);
  if (!allowed) throw new Error("publish topic is outside the simulated device identity boundary");
  return topic;
}

function buildTelemetryPayload({ deviceId, projectId, sequence, measuredAt, value }) {
  const safeDeviceId = normalizeDeviceId(deviceId);
  const safeProjectId = String(projectId || "").trim();
  if (!safeProjectId || safeProjectId.length > 128) throw new Error("project_id is required and must not exceed 128 characters");
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("sequence must be a positive integer");
  const timestamp = new Date(measuredAt);
  if (Number.isNaN(timestamp.getTime())) throw new Error("measuredAt must be a valid timestamp");
  if (!Number.isFinite(value)) throw new Error("measurement value must be finite");
  return {
    device_id: safeDeviceId,
    project_id: safeProjectId,
    measurements: [{
      measurement_id: `sim-${safeDeviceId}-${sequence}`,
      metric: "temperature",
      value,
      unit: "C",
      aggregation: "sample",
      measured_at: timestamp.toISOString(),
      metadata: { source: "system-test-device-simulator", sequence },
    }],
  };
}

module.exports = {
  DEVICE_ID_PATTERN,
  assertDevicePublishTopic,
  buildTelemetryPayload,
  heartbeatTopic,
  normalizeDeviceId,
  telemetryTopic,
};
