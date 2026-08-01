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
    this.buildTargetLock = options.buildTargetLock;
    this.stateStore = options.stateStore || null;
    this.stateStore?.ensureSchema?.(buildDeploySchema());
    this.jobs = new Map(((this.stateStore && this.stateStore.load().jobs) || []).map((job) => [job.job_id, job]));
  }

  async submitJob(input) {
    const job = normalizeJob(input);
    if (this.jobs.has(job.job_id)) {
      throw new BuildDeployError("duplicate_job_id", "Diese BuildJob-ID wurde bereits verwendet.", 409);
    }
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
    const deployId = job.result?.deploy?.deploy_id;
    const acknowledgement = deployId ? this.deployOrchestrator.deployStatus(deployId) : null;
    if (acknowledgement) job.result.deploy = { ...job.result.deploy, status: acknowledgement.status, acknowledgement };
    const flashboxJobId = job.result?.flashbox?.flashbox_job_id;
    const flashboxAcknowledgement = flashboxJobId ? this.deployOrchestrator.flashboxStatus(flashboxJobId) : null;
    if (flashboxAcknowledgement) {
      job.result.flashbox = { ...job.result.flashbox, status: flashboxAcknowledgement.status, acknowledgement: flashboxAcknowledgement };
    }
    return summarizeJob(job);
  }

  async cleanProjectCache(input = {}) {
    const projectId = String(input.project_id || "").trim();
    if (!projectId) {
      throw new BuildDeployError("missing_project_id", "Zum Bereinigen des Build-Caches fehlt die Projekt-ID.");
    }
    const activeJob = Array.from(this.jobs.values()).find((job) => job.project_id === projectId
      && ["accepted", "queued", "running"].includes(job.status));
    if (activeJob) {
      throw new BuildDeployError(
        "build_in_progress",
        "Der Build-Cache kann nicht bereinigt werden, solange ein Build dieses Projekts läuft.",
        409,
      );
    }
    const removedCacheCount = await this.packageStore.cleanIncrementalProjectCache(projectId);
    return { project_id: projectId, removed_cache_count: removedCacheCount, status: "clean" };
  }

  otaPreflight() {
    return this.deployOrchestrator.preflight();
  }

  startJob(job) {
    job.status = "running";
    job.started_at = new Date().toISOString();
    this.reportProgress(job, "preparing", "Build-Paket wird vorbereitet.");
    this.persistJobs();
    this.deviceJobLock.markActive(job);
    job.promise = this.runJob(job)
      .catch((error) => {
        this.reportProgress(job, "failed", error.message || "Build fehlgeschlagen.");
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
    return this.buildTargetLock.runExclusive(
      job,
      () => this.runBuildTargetJob(job),
      () => this.reportProgress(job, "waiting", "Ein Build desselben Projektziels läuft bereits. Dieser Auftrag wartet auf dessen Abschluss."),
    );
  }

  async runBuildTargetJob(job) {
    this.reportProgress(job, "packaging", "Build-Paket wird in den Build-Workspace übernommen.");
    const workspace = await this.packageStore.materialize(job);
    try {
      this.reportProgress(job, "compiling", "PlatformIO startet die Kompilierung.");
      const buildOutput = await this.runner.run(job, workspace.packageDir, {
        buildDir: workspace.buildDir,
        onProgress: (line) => this.reportProgress(job, "compiling", line),
      });
      this.reportProgress(job, "artifacts", "Firmware-Artefakte werden gesichert.");
      await this.packageStore.preserveIncrementalCache(job, workspace.packageDir);
      const artifacts = await this.artifactStore.saveBuildArtifacts(job.job_id, buildOutput);
      const buildResult = {
        status: buildOutput.status,
        artifacts,
        flash_manifest: Array.isArray(buildOutput.flash_manifest) ? buildOutput.flash_manifest : [],
        primary_firmware: selectPrimaryFirmware(artifacts),
        build_log: artifacts["build.log"],
        usb_flash: buildOutput.usb_flash || { requested: false, status: "not_requested" },
      };
      const deployResult = await this.deployOrchestrator.maybeCreateDeploy(job, buildResult);
      const flashboxResult = await this.deployOrchestrator.maybeCreateFlashboxDelivery(job, buildResult);
      this.reportProgress(job, "completed", "Build erfolgreich abgeschlossen.");
      job.status = "succeeded";
      job.result = {
        job_id: job.job_id,
        mode: job.mode,
        device_id: job.device_id,
        build: buildResult,
        deploy: deployResult,
        flashbox: flashboxResult,
      };
      this.persistJobs();
    } finally {
      await this.packageStore.cleanup(workspace);
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

  reportProgress(job, phase, message) {
    const text = String(message || "").replace(/\x1b\[[0-9;]*m/g, "").trim();
    if (!text) return;
    const sequence = Number(job.progress_sequence || 0) + 1;
    job.progress_sequence = sequence;
    job.progress = Array.isArray(job.progress) ? job.progress : [];
    job.progress.push({ sequence, phase, message: text.slice(0, 1000), at: new Date().toISOString() });
    if (job.progress.length > 240) job.progress.splice(0, job.progress.length - 240);
    this.persistJobs();
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
    project_id: input.project_id || null,
    software_unit_id: String(input.software_unit_id || "").trim(),
    build_package: input.build_package,
    deploy: input.deploy || null,
    usb_flash: input.usb_flash || null,
    flashbox: normalizeFlashboxDelivery(input.flashbox),
    status: "accepted",
    created_at: new Date().toISOString(),
  };
}

function summarizeJob(job) {
  return {
    job_id: job.job_id,
    mode: job.mode,
    device_id: job.device_id,
    flashbox: job.flashbox,
    status: job.status,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at,
    result: job.result,
    error: job.error,
    progress: Array.isArray(job.progress) ? job.progress : [],
  };
}

function normalizeFlashboxDelivery(input) {
  if (!input) return null;
  const flashboxDeviceId = String(input.flashbox_device_id || "").trim();
  if (!flashboxDeviceId) {
    throw new BuildDeployError("missing_flashbox_device_id", "FlashBox-Auftrag braucht eine konkrete inventarisierte FlashBox.");
  }
  return {
    requested: input.requested === true,
    flashbox_device_id: flashboxDeviceId,
    flashbox_hardware_profile_id: String(input.flashbox_hardware_profile_id || ""),
    target_device_id: String(input.target_device_id || ""),
    target_hardware_profile_id: String(input.target_hardware_profile_id || ""),
    manifest_type: String(input.manifest_type || "project_firmware_flash"),
    transport: "flashbox_certificate_authenticated_mqtt_job",
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
