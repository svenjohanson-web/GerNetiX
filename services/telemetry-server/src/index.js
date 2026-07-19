const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqliteTelemetryRepository } = require("./repositories/sqlite-telemetry-repository");
const { TelemetryService } = require("./services/telemetry-service");
const { createRemoteOwnershipResolver } = require("./ownership-resolver");
const { createIdentityPushNotifier } = require("./push-notifier");
const { createIdentityRuntimeNotifier } = require("./runtime-notifier");
const { startMqttTelemetryAdapter, startMqttRuntimeAdapter } = require("./mqtt-telemetry-adapter");

function createDefaultTelemetryServer(config = createConfig()) {
  const service = new TelemetryService({
    repository: new SqliteTelemetryRepository(config.sqlitePath),
    ownershipResolver: createRemoteOwnershipResolver(config),
    pushNotifier: createIdentityPushNotifier(config),
    runtimeNotifier: createIdentityRuntimeNotifier(config),
    defaultMeasurementRetentionDays: config.defaultMeasurementRetentionDays,
    defaultEventRetentionDays: config.defaultEventRetentionDays,
  });
  service.mqttAdapter = startMqttTelemetryAdapter({ mqttBrokerUrl: config.mqttBrokerUrl, service });
  service.mqttRuntimeAdapter = startMqttRuntimeAdapter({ mqttBrokerUrl: config.mqttBrokerUrl, service });
  return service;
}

module.exports = { createConfig, createHttpApp, SqliteTelemetryRepository, TelemetryService, createDefaultTelemetryServer, startMqttTelemetryAdapter, startMqttRuntimeAdapter };
