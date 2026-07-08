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
    this.stateStore = options.stateStore || null;
    this.stateStore?.ensureSchema?.(buildDeploySchema());
    this.jobs = new Map(((this.stateStore && this.stateStore.load().jobs) || []).map((job) => [job.job_id, job]));
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
        primary_firmware: selectPrimaryFirmware(artifacts),
        build_log: artifacts["build.log"],
        usb_flash: buildOutput.usb_flash || { requested: false, status: "not_requested" },
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
    if (!this.stateStore) return;
    const jobs = Array.from(this.jobs.values()).map((job) => {
      const { promise, ...rest } = job;
      return rest;
    });
    this.stateStore.save({ jobs });
    this.stateStore.replaceCollection?.("jobs", jobs, "job_id");
    this.stateStore.replaceTable?.("build_deploy_jobs", jobs, buildJobColumns());
  }
}

function buildDeploySchema() {
  return [
    `CREATE TABLE IF NOT EXISTS build_deploy_jobs (
      job_id TEXT PRIMARY KEY,
      mode TEXT,
      device_id TEXT,
      status TEXT,
      created_at TEXT,
      started_at TEXT,
      finished_at TEXT,
      build_package_json TEXT,
      deploy_json TEXT,
      result_json TEXT,
      error_json TEXT,
      raw_json TEXT NOT NULL
    );`,
  ];
}

function buildJobColumns() {
  return {
    job_id: "job_id",
    mode: "mode",
    device_id: "device_id",
    status: "status",
    created_at: "created_at",
    started_at: "started_at",
    finished_at: "finished_at",
    build_package_json: jsonValue("build_package"),
    deploy_json: jsonValue("deploy"),
    result_json: jsonValue("result"),
    error_json: jsonValue("error"),
    raw_json: jsonValue((row) => row),
  };
}

function jsonValue(selector) {
  return (row) => {
    const value = typeof selector === "function" ? selector(row) : row[selector];
    return JSON.stringify(value ?? null);
  };
}

function normalizeJob(input = {}) {
  const mode = input.mode || "build";
  if (!["build", "build_and_flash", "build_and_usb_flash", "prebuild"].includes(mode)) {
    throw new BuildDeployError("invalid_job_mode", "BuildJob mode muss build, build_and_flash, build_and_usb_flash oder prebuild sein.");
  }

  return {
    job_id: input.job_id || randomUUID(),
    mode,
    device_id: input.device_id || (input.deploy && input.deploy.device_id) || null,
    build_package: input.build_package,
    deploy: input.deploy || null,
    usb_flash: input.usb_flash || null,
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

function selectPrimaryFirmware(artifacts) {
  return artifacts["firmware.bin"] || artifacts["firmware.hex"] || null;
}

module.exports = { BuildDeployService };
