const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqliteTelemetryRepository } = require("./repositories/sqlite-telemetry-repository");
const { PostgresTelemetryRepository } = require("./repositories/postgres-telemetry-repository");
const { TelemetryService } = require("./services/telemetry-service");
const { createRemoteOwnershipResolver } = require("./ownership-resolver");
const { createIdentityPushNotifier } = require("./push-notifier");
const { createIdentityRuntimeNotifier } = require("./runtime-notifier");
const { startMqttTelemetryAdapter, startMqttRuntimeAdapter } = require("./mqtt-telemetry-adapter");

async function createDefaultTelemetryServer(config = createConfig()) {
  const repository = ["postgres", "postgresql"].includes(config.persistenceBackend)
    ? await PostgresTelemetryRepository.create({
        poolOptions: config.postgres.connectionString
          ? { connectionString: config.postgres.connectionString }
          : config.postgres,
      })
    : new SqliteTelemetryRepository(config.sqlitePath);
  const service = new TelemetryService({
    repository,
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

module.exports = { createConfig, createHttpApp, PostgresTelemetryRepository, SqliteTelemetryRepository, TelemetryService, createDefaultTelemetryServer, startMqttTelemetryAdapter, startMqttRuntimeAdapter };
