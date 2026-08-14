const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5800),
    deviceManagementBaseUrl: env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700/api/device-management",
    aiUsageBaseUrl: env.AI_USAGE_BASE_URL || "http://127.0.0.1:5000/api/ai-usage",
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "device-voice-orchestrator"),
    provider: env.DEVICE_VOICE_PROVIDER || "disabled",
    model: env.DEVICE_VOICE_MODEL || "device-voice-pipeline-v1",
    sessionTtlSeconds: boundedNumber(env.DEVICE_VOICE_SESSION_TTL_SECONDS, 120, 30, 300),
    maximumRecordingSeconds: boundedNumber(env.DEVICE_VOICE_MAX_RECORDING_SECONDS, 15, 1, 15),
    deviceSessionsPerMinute: boundedNumber(env.DEVICE_VOICE_DEVICE_SESSIONS_PER_MINUTE, 6, 1, 30),
    accountSessionsPerHour: boundedNumber(env.DEVICE_VOICE_ACCOUNT_SESSIONS_PER_HOUR, 30, 1, 300),
  };
}

function boundedNumber(value, fallback, minimum, maximum) {
  const number = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) return fallback;
  return number;
}

module.exports = { createConfig };
