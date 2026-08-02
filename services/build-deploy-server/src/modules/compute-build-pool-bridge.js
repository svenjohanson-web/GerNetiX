"use strict";

const crypto = require("node:crypto");
const { createFirmwareBuildComputeJob } = require("./compute-build-contract");
const { BuildDeployError } = require("../errors");

class ComputeBuildPoolBridge {
  constructor({ controlPlane, pollIntervalMs = 5, maxWaitMs = 900000 }) {
    this.controlPlane = controlPlane; this.pollIntervalMs = pollIntervalMs; this.maxWaitMs = maxWaitMs;
    this.inputs = new Map(); this.results = new Map();
  }
  async dispatch(buildJob, context = {}) {
    const contract = createFirmwareBuildComputeJob(buildJob, { account_id: buildJob.account_id, project_id: buildJob.project_id });
    this.inputs.set(contract.job_id, { contract, build_job: structuredClone(buildJob) });
    await this.controlPlane.submitJob(contract);
    const started = Date.now();
    try {
      while (Date.now() - started <= this.maxWaitMs) {
        if (context.signal?.aborted) { await this.cancel(contract.job_id); throw cancelled(); }
        const state = await this.controlPlane.getJob(contract.job_id);
        context.onProgress?.(`ComputeJob ${state.status}.`);
        if (state.status === "succeeded") {
          const result = this.results.get(contract.job_id);
          if (!result) throw new BuildDeployError("compute_build_result_missing", "ComputeJob ist abgeschlossen, aber das Build-Ergebnis fehlt.", 502);
          return structuredClone(result);
        }
        if (["failed", "dead_letter", "cancelled"].includes(state.status)) throw new BuildDeployError("compute_build_failed", `ComputeJob endete mit ${state.status}.`, 502, { compute_status: state.status });
        await delay(this.pollIntervalMs);
      }
      throw new BuildDeployError("compute_build_timeout", "Compute-Build überschritt die maximale Wartezeit.", 504);
    } finally {
      this.inputs.delete(contract.job_id); this.results.delete(contract.job_id);
    }
  }
  createWorkerHandler(executeBuild) {
    return async (computeJob) => {
      const input = this.inputs.get(computeJob.job_id);
      if (!input || input.contract.input_revision !== computeJob.input_revision) throw new BuildDeployError("compute_build_input_mismatch", "Compute-Build-Eingabe stimmt nicht mit ihrer Revision überein.", 409);
      const result = await executeBuild(structuredClone(input.build_job));
      this.results.set(computeJob.job_id, structuredClone(result));
      const serialized = JSON.stringify(result);
      return { output_revision: `sha256:${crypto.createHash("sha256").update(serialized).digest("hex")}`, output_bytes: Buffer.byteLength(serialized) };
    };
  }
  async cancel(jobId) { try { return await this.controlPlane.cancel(jobId); } catch (error) { if (error.code !== "job_not_cancellable") throw error; return null; } }
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function cancelled() { return Object.assign(new Error("Build wurde abgebrochen."), { code: "build_cancelled" }); }

module.exports = { ComputeBuildPoolBridge };
