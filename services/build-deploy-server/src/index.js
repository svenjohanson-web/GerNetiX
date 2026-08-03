const { BuildCache } = require("./modules/build-cache");
const { BuildPackageStore } = require("./modules/build-package-store");
const { ArtifactStore } = require("./modules/artifact-store");
const { PostgresArtifactStore } = require("./modules/postgres-artifact-store");
const { HttpArtifactStore } = require("./modules/http-artifact-store");
const { ArtifactUploadIngress } = require("./modules/artifact-upload-ingress");
const { ArtifactRetentionScheduler } = require("./modules/artifact-retention-scheduler");
const { createArtifactPolicySource } = require("./modules/artifact-contract");
const { FirmwareBuildJobRunner } = require("./modules/firmware-build-job-runner");
const { DeployJobOrchestrator } = require("./modules/deploy-job-orchestrator");
const { MqttTransport } = require("./modules/mqtt-transport");
const { PemOtaCommandSigner, SqliteOtaAcknowledgementStore, PostgresOtaAcknowledgementStore } = require("./modules/ota-security");
const { DeviceJobLock } = require("./modules/device-job-lock");
const { BuildTargetLock } = require("./modules/build-target-lock");
const { PostgresBuildCoordination } = require("./modules/postgres-build-coordination");
const { ElfSymbolizer } = require("./modules/elf-symbolizer");
const { createFirmwareBuildComputeJob } = require("./modules/compute-build-contract");
const { ComputeBuildPoolBridge } = require("./modules/compute-build-pool-bridge");
const { BuildDeployService } = require("./services/build-deploy-service");
const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqliteStateStore } = require("../../shared");
const { createInterfaceCallTelemetry } = require("../../shared/persistence/interface-call-telemetry");

function createBuildDeployService(config, { acknowledgementStore, artifactStore, buildCoordination = null, artifactPolicySource = null }) {
  artifactPolicySource = artifactPolicySource || createArtifactPolicySource(config.artifactPolicyOverrides || {});
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
  const service = new BuildDeployService({
    cache: new BuildCache({ cacheDir: config.cacheDir }),
    packageStore: new BuildPackageStore({
      tempDir: config.tempDir,
      incrementalCacheDir: config.incrementalCacheDir,
      incrementalCacheTtlMs: config.incrementalCacheTtlMs,
      incrementalCachePruneIntervalMs: config.incrementalCachePruneIntervalMs,
    }),
    runner: new FirmwareBuildJobRunner({
      runner: config.runner,
      platformioCommand: config.platformioCommand,
      cacheDir: config.cacheDir,
      allowMockRunner: config.allowMockRunner,
    }),
    artifactStore,
    artifactPolicySource,
    elfSymbolizer: new ElfSymbolizer({ commands: config.addr2lineCommands }),
    deployOrchestrator: new DeployJobOrchestrator({
      publicBaseUrl: config.publicBaseUrl,
      mqttPublisher: mqttTransport,
      authorizationSigner,
      acknowledgementStore,
    }),
    deviceJobLock: new DeviceJobLock(),
    buildTargetLock: buildCoordination || new BuildTargetLock(),
    buildCoordination,
    workerRole: config.workerRole,
    cancellationPollMs: config.cancellationPollMs,
    stateStore: config.persistenceBackend === "sqlite"
      ? new SqliteStateStore(config.sqlitePath, "build-deploy-server", {
        defaultState: { jobs: [] },
        collectionMap: { jobs: "jobs" },
      })
      : null,
  });
  if (typeof artifactStore.pruneExpired === "function") {
    service.artifactRetentionScheduler = new ArtifactRetentionScheduler({
      artifactStore,
      intervalMs: config.artifactRetentionPruneIntervalMs,
      onError: (error) => console.error(`Artefakt-Retention fehlgeschlagen: ${error.message}`),
    }).start();
  }
  return service;
}

function createDefaultBuildDeployService(config = createConfig()) {
  const artifactPolicySource = createArtifactPolicySource(config.artifactPolicyOverrides || {});
  if (config.artifactPersistenceBackend === "postgres" || config.coordinationBackend === "postgres") {
    const { Pool } = require("pg");
    const poolOptions = config.postgres.connectionString
      ? { connectionString: config.postgres.connectionString }
      : config.postgres;
    const runtimePool = new Pool(poolOptions);
    const artifactStorePromise = config.artifactPersistenceBackend === "postgres"
      ? PostgresArtifactStore.create({
        poolOptions,
        publicBaseUrl: config.publicBaseUrl,
        manageSchema: config.databaseSchemaManagement,
        reportMetrics: (metrics) => console.log(`[artifact-store-metrics] ${JSON.stringify(metrics)}`),
        artifactPolicySource,
      })
      : config.artifactPersistenceBackend === "http"
        ? Promise.resolve(new HttpArtifactStore({
          baseUrl: config.artifactUploadBaseUrl,
          token: config.artifactUploadToken,
          publicBaseUrl: config.publicBaseUrl,
          tempDir: config.tempDir,
          timeoutMs: config.artifactUploadTimeoutMs,
          reportMetrics: (metrics) => console.log(`[artifact-store-metrics] ${JSON.stringify(metrics)}`),
          artifactPolicySource,
        }))
        : Promise.resolve(new ArtifactStore({
          artifactDir: config.artifactDir,
          sqlitePath: config.artifactSqlitePath,
          publicBaseUrl: config.publicBaseUrl,
          artifactPolicySource,
        }));
    return Promise.all([
      PostgresOtaAcknowledgementStore.create(runtimePool, { manageSchema: config.databaseSchemaManagement }),
      artifactStorePromise,
      config.coordinationBackend === "postgres"
        ? PostgresBuildCoordination.create({
          poolOptions,
          poolMax: config.coordinationPoolMax,
          workerId: config.workerId,
          heartbeatMs: config.workerHeartbeatMs,
          staleMs: config.workerStaleMs,
          manageSchema: config.databaseSchemaManagement,
        })
        : null,
    ]).then(([acknowledgementStore, artifactStore, buildCoordination]) => {
      const service = createBuildDeployService(config, { acknowledgementStore, artifactStore, buildCoordination, artifactPolicySource });
      if (config.artifactPersistenceBackend === "postgres" && config.artifactUploadToken) {
        if (config.artifactUploadToken.length < 32) throw new Error("Artifact-Upload-Token muss mindestens 32 Zeichen lang sein.");
        service.artifactUploadToken = config.artifactUploadToken;
        service.artifactUploadIngress = new ArtifactUploadIngress({
          artifactStore,
          stagingDir: config.artifactUploadStagingDir,
          maxStoredBytes: config.artifactUploadMaxStoredBytes,
          maxOriginalBytes: config.artifactUploadMaxOriginalBytes,
          staleMs: config.artifactUploadStaleMs,
          artifactPolicySource,
        });
      }
      return service;
    });
  }
  return createBuildDeployService(config, {
    acknowledgementStore: new SqliteOtaAcknowledgementStore(config.sqlitePath),
    artifactStore: new ArtifactStore({
      artifactDir: config.artifactDir,
      sqlitePath: config.artifactSqlitePath,
      publicBaseUrl: config.publicBaseUrl,
      artifactPolicySource,
    }),
    artifactPolicySource,
  });
}

module.exports = {
  BuildCache,
  BuildPackageStore,
  ArtifactStore,
  PostgresArtifactStore,
  HttpArtifactStore,
  ArtifactUploadIngress,
  ArtifactRetentionScheduler,
  createArtifactPolicySource,
  FirmwareBuildJobRunner,
  ElfSymbolizer,
  DeployJobOrchestrator,
  MqttTransport,
  PemOtaCommandSigner,
  SqliteOtaAcknowledgementStore,
  PostgresOtaAcknowledgementStore,
  DeviceJobLock,
  createFirmwareBuildComputeJob,
  ComputeBuildPoolBridge,
  BuildDeployService,
  PostgresBuildCoordination,
  createConfig,
  createHttpApp,
  createDefaultBuildDeployService,
};
