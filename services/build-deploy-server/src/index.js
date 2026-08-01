const { BuildCache } = require("./modules/build-cache");
const { BuildPackageStore } = require("./modules/build-package-store");
const { ArtifactStore } = require("./modules/artifact-store");
const { PostgresArtifactStore } = require("./modules/postgres-artifact-store");
const { FirmwareBuildJobRunner } = require("./modules/firmware-build-job-runner");
const { DeployJobOrchestrator } = require("./modules/deploy-job-orchestrator");
const { MqttTransport } = require("./modules/mqtt-transport");
const { PemOtaCommandSigner, SqliteOtaAcknowledgementStore, PostgresOtaAcknowledgementStore } = require("./modules/ota-security");
const { DeviceJobLock } = require("./modules/device-job-lock");
const { BuildTargetLock } = require("./modules/build-target-lock");
const { PostgresBuildCoordination } = require("./modules/postgres-build-coordination");
const { BuildDeployService } = require("./services/build-deploy-service");
const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqliteStateStore } = require("../../shared");
const { createInterfaceCallTelemetry } = require("../../shared/persistence/interface-call-telemetry");

function createBuildDeployService(config, { acknowledgementStore, artifactStore, buildCoordination = null }) {
  const authorizationSigner = new PemOtaCommandSigner({
    privateKeyPath: config.otaSigningPrivateKeyPath,
    keyId: config.otaSigningKeyId,
  });
  const interfaceTelemetry = createInterfaceCallTelemetry({
    dbPath: config.interfaceTelemetrySqlitePath,
    endpoint: config.interfaceTelemetryEndpoint,
    token: config.interfaceTelemetryToken,
    sourceService: "build-deploy-server",
  });
  const mqttTransport = config.mqttBrokerUrl ? new MqttTransport({
    url: config.mqttBrokerUrl,
    topicFilter: "gernetix/devices/+/status/#",
    onMessage: (topic, payload) => acknowledgementStore.receive(topic, payload),
    telemetry: interfaceTelemetry,
  }) : null;
  mqttTransport?.start().catch((error) => console.error(`MQTT-Verbindung fehlgeschlagen: ${error.message}`));
  return new BuildDeployService({
    cache: new BuildCache({ cacheDir: config.cacheDir }),
    packageStore: new BuildPackageStore({
      tempDir: config.tempDir,
      incrementalCacheDir: config.incrementalCacheDir,
    }),
    runner: new FirmwareBuildJobRunner({
      runner: config.runner,
      platformioCommand: config.platformioCommand,
      cacheDir: config.cacheDir,
      allowMockRunner: config.allowMockRunner,
    }),
    artifactStore,
    deployOrchestrator: new DeployJobOrchestrator({
      publicBaseUrl: config.publicBaseUrl,
      mqttPublisher: mqttTransport,
      authorizationSigner,
      acknowledgementStore,
    }),
    deviceJobLock: new DeviceJobLock(),
    buildTargetLock: buildCoordination || new BuildTargetLock(),
    buildCoordination,
    stateStore: config.persistenceBackend === "sqlite"
      ? new SqliteStateStore(config.sqlitePath, "build-deploy-server", {
        defaultState: { jobs: [] },
        collectionMap: { jobs: "jobs" },
      })
      : null,
  });
}

function createDefaultBuildDeployService(config = createConfig()) {
  if (config.artifactPersistenceBackend === "postgres") {
    const { Pool } = require("pg");
    const poolOptions = config.postgres.connectionString
      ? { connectionString: config.postgres.connectionString }
      : config.postgres;
    const runtimePool = new Pool(poolOptions);
    return Promise.all([
      PostgresOtaAcknowledgementStore.create(runtimePool),
      PostgresArtifactStore.create({ poolOptions, publicBaseUrl: config.publicBaseUrl }),
      config.coordinationBackend === "postgres"
        ? PostgresBuildCoordination.create({
          poolOptions,
          poolMax: config.coordinationPoolMax,
          workerId: config.workerId,
          heartbeatMs: config.workerHeartbeatMs,
          staleMs: config.workerStaleMs,
        })
        : null,
    ]).then(([acknowledgementStore, artifactStore, buildCoordination]) => createBuildDeployService(config, {
      acknowledgementStore,
      artifactStore,
      buildCoordination,
    }));
  }
  return createBuildDeployService(config, {
    acknowledgementStore: new SqliteOtaAcknowledgementStore(config.sqlitePath),
    artifactStore: new ArtifactStore({
      artifactDir: config.artifactDir,
      sqlitePath: config.artifactSqlitePath,
      publicBaseUrl: config.publicBaseUrl,
    }),
  });
}

module.exports = {
  BuildCache,
  BuildPackageStore,
  ArtifactStore,
  PostgresArtifactStore,
  FirmwareBuildJobRunner,
  DeployJobOrchestrator,
  MqttTransport,
  PemOtaCommandSigner,
  SqliteOtaAcknowledgementStore,
  PostgresOtaAcknowledgementStore,
  DeviceJobLock,
  BuildDeployService,
  PostgresBuildCoordination,
  createConfig,
  createHttpApp,
  createDefaultBuildDeployService,
};
