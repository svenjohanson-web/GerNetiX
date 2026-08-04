const { AiUsageClient, DeviceManagementClient } = require("./clients/service-clients");
const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { DisabledVoiceProvider } = require("./providers/disabled-voice-provider");
const { EphemeralVoiceSessionRepository } = require("./repositories/ephemeral-voice-session-repository");
const { DeviceVoiceService } = require("./services/device-voice-service");

function createDefaultDeviceVoiceService(config = createConfig()) {
  if (config.provider !== "disabled") {
    throw new Error(`Unsupported Device Voice provider: ${config.provider}`);
  }
  return new DeviceVoiceService({
    repository: new EphemeralVoiceSessionRepository(),
    deviceManagementClient: new DeviceManagementClient(config.deviceManagementBaseUrl),
    aiUsageClient: new AiUsageClient(config.aiUsageBaseUrl),
    provider: new DisabledVoiceProvider(),
    model: config.model,
    sessionTtlSeconds: config.sessionTtlSeconds,
    maximumRecordingSeconds: config.maximumRecordingSeconds,
    deviceSessionsPerMinute: config.deviceSessionsPerMinute,
    accountSessionsPerHour: config.accountSessionsPerHour,
  });
}

module.exports = {
  AiUsageClient,
  createConfig,
  createDefaultDeviceVoiceService,
  createHttpApp,
  DeviceManagementClient,
  DeviceVoiceService,
  DisabledVoiceProvider,
  EphemeralVoiceSessionRepository,
};
