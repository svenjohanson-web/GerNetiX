const { randomUUID } = require("node:crypto");
const { BuildDeployError } = require("../errors");

class BuildDeployService {
  constructor(options) {
    this.cache = options.cache;
    this.packageStore = options.packageStore;
    this.runner = options.runner;
    this.artifactStore = options.artifactStore;
    this.deployOrchestrator = options.deployOrchestrator;
    this.deviceJobLock = options.deviceJobLock;
    this.snapshotStore = options.snapshotStore || null;
    this.jobs = new Map(((this.snapshotStore && this.snapshotStore.load().jobs) || []).map((job) => [job.job_id, job]));
  }

  async submitJob(input) {
    const job = normalizeJob(input);
    this.jobs.set(job.job_id, job);
    this.persistJobs();

    if (this.deviceJobLock.canStart(job)) {
      this.startJob(job);
    } else {
      const replacedJobId = this.deviceJobLock.replaceWaiting(job);
      if (replacedJobId) {
        const replaced = this.jobs.get(replacedJobId);
        if (replaced && replaced.status === "queued") {
          replaced.status = "replaced";
          replaced.finished_at = new Date().toISOString();
          this.persistJobs();
        }
      }
      job.status = "queued";
      this.persistJobs();
    }

    return summarizeJob(job);
  }

  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) throw new BuildDeployError("job_not_found", "BuildJob wurde nicht gefunden.", 404);
    return summarizeJob(job);
  }

  startJob(job) {
    job.status = "running";
    job.started_at = new Date().toISOString();
    this.persistJobs();
    this.deviceJobLock.markActive(job);
    job.promise = this.runJob(job)
      .catch((error) => {
        job.status = "failed";
        job.error = serializeError(error);
        this.persistJobs();
      })
      .finally(() => {
        job.finished_at = new Date().toISOString();
        this.deviceJobLock.release(job);
        this.persistJobs();
        if (job.device_id) this.startWaitingJob(job.device_id);
      });
  }

  startWaitingJob(deviceId) {
    const nextJobId = this.deviceJobLock.takeWaiting(deviceId);
    if (!nextJobId) return;
    const nextJob = this.jobs.get(nextJobId);
    if (nextJob && nextJob.status === "queued") this.startJob(nextJob);
  }

  async runJob(job) {
    await this.cache.ensureReady();
    const workspace = await this.packageStore.materialize(job);
    try {
      const buildOutput = await this.runner.run(job, workspace.packageDir);
      const artifacts = await this.artifactStore.saveBuildArtifacts(job.job_id, buildOutput);
      const buildResult = {
        status: buildOutput.status,
        artifacts,
        build_log: artifacts["build.log"],
      };
      const deployResult = await this.deployOrchestrator.maybeCreateDeploy(job, buildResult);
      job.status = "succeeded";
      job.result = {
        job_id: job.job_id,
        mode: job.mode,
        device_id: job.device_id,
        build: buildResult,
        deploy: deployResult,
      };
      this.persistJobs();
    } finally {
      await this.packageStore.cleanup(workspace.jobDir);
    }
  }

  persistJobs() {
    if (!this.snapshotStore) return;
    this.snapshotStore.save({
      jobs: Array.from(this.jobs.values()).map((job) => {
        const { promise, ...rest } = job;
        return rest;
      }),
    });
  }
}

function normalizeJob(input = {}) {
  const mode = input.mode || "build";
  if (!["build", "build_and_flash", "prebuild"].includes(mode)) {
    throw new BuildDeployError("invalid_job_mode", "BuildJob mode muss build, build_and_flash oder prebuild sein.");
  }

  return {
    job_id: input.job_id || randomUUID(),
    mode,
    device_id: input.device_id || (input.deploy && input.deploy.device_id) || null,
    build_package: input.build_package,
    deploy: input.deploy || null,
    status: "accepted",
    created_at: new Date().toISOString(),
  };
}

function summarizeJob(job) {
  return {
    job_id: job.job_id,
    mode: job.mode,
    device_id: job.device_id,
    status: job.status,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    result: job.result,
    error: job.error,
  };
}

function serializeError(error) {
  return {
    code: error.code || "internal_error",
    message: error.message || "Interner Fehler.",
    details: error.details || {},
  };
}

module.exports = { BuildDeployService };
