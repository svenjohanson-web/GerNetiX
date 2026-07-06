const { BuildCache } = require("./modules/build-cache");
const { BuildPackageStore } = require("./modules/build-package-store");
const { ArtifactStore } = require("./modules/artifact-store");
const { FirmwareBuildJobRunner } = require("./modules/firmware-build-job-runner");
const { DeployJobOrchestrator } = require("./modules/deploy-job-orchestrator");
const { DeviceJobLock } = require("./modules/device-job-lock");
const { BuildDeployService } = require("./services/build-deploy-service");
const { createConfig } = require("./config");
const { createHttpApp } = require("./http-app");
const { SqliteSnapshotStore } = require("../../shared");

function createDefaultBuildDeployService(config = createConfig()) {
  return new BuildDeployService({
    cache: new BuildCache({ cacheDir: config.cacheDir }),
    packageStore: new BuildPackageStore({ tempDir: config.tempDir }),
    runner: new FirmwareBuildJobRunner({
      runner: config.runner,
      platformioCommand: config.platformioCommand,
      cacheDir: config.cacheDir,
    }),
    artifactStore: new ArtifactStore({
      artifactDir: config.artifactDir,
      publicBaseUrl: config.publicBaseUrl,
    }),
    deployOrchestrator: new DeployJobOrchestrator(),
    deviceJobLock: new DeviceJobLock(),
    snapshotStore: config.persistenceBackend === "sqlite"
      ? new SqliteSnapshotStore(config.sqlitePath, "build-deploy-server", { defaultState: { jobs: [] } })
      : null,
  });
}

module.exports = {
  BuildCache,
  BuildPackageStore,
  ArtifactStore,
  FirmwareBuildJobRunner,
  DeployJobOrchestrator,
  DeviceJobLock,
  BuildDeployService,
  createConfig,
  createHttpApp,
  createDefaultBuildDeployService,
};
