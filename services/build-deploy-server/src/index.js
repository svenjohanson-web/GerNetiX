const { BuildCache } = require("./modules/build-cache");
const { BuildPackageStore } = require("./modules/build-package-store");
const { ArtifactStore } = require("./modules/artifact-store");
const { FirmwareBuildJobRunner } = require("./modules/firmware-build-job-runner");
const { DeployJobOrchestrator } = require("./modules/deploy-job-orchestrator");
const { MqttTransport } = require("./modules/mqtt-transport");
const { PemOtaCommandSigner, SqliteOtaAcknowledgementStore } = require("./modules/ota-security");
const { DeviceJobLock } = require("./modules/device-job-lock");
const { BuildDeployService } = require("./services/build-deploy-service");
const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqliteStateStore } = require("../../shared");
const { createInterfaceCallTelemetry } = require("../../shared/persistence/interface-call-telemetry");

function createDefaultBuildDeployService(config = createConfig()) {
  const acknowledgementStore = new SqliteOtaAcknowledgementStore(config.sqlitePath);
  const authorizationSigner = new PemOtaCommandSigner({
    privateKeyPath: config.otaSigningPrivateKeyPath,
    keyId: config.otaSigningKeyId,
  });
  const interfaceTelemetry = createInterfaceCallTelemetry({ dbPath: config.interfaceTelemetrySqlitePath, sourceService: "build-deploy-server" });
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
    artifactStore: new ArtifactStore({
      artifactDir: config.artifactDir,
      publicBaseUrl: config.publicBaseUrl,
    }),
    deployOrchestrator: new DeployJobOrchestrator({
      publicBaseUrl: config.publicBaseUrl,
      mqttPublisher: mqttTransport,
      authorizationSigner,
      acknowledgementStore,
    }),
    deviceJobLock: new DeviceJobLock(),
    stateStore: config.persistenceBackend === "sqlite"
      ? new SqliteStateStore(config.sqlitePath, "build-deploy-server", {
        defaultState: { jobs: [] },
        collectionMap: { jobs: "jobs" },
      })
      : null,
  });
}

module.exports = {
  BuildCache,
  BuildPackageStore,
  ArtifactStore,
  FirmwareBuildJobRunner,
  DeployJobOrchestrator,
  MqttTransport,
  PemOtaCommandSigner,
  SqliteOtaAcknowledgementStore,
  DeviceJobLock,
  BuildDeployService,
  createConfig,
  createHttpApp,
  createDefaultBuildDeployService,
};
