"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresBuildCoordination } = require("../src/modules/postgres-build-coordination");

test("PostgreSQL coordination rejects duplicate jobs and exposes status across workers", async () => {
  const shared = fakePostgresState();
  const workerA = new PostgresBuildCoordination(new FakePool(shared), { workerId: "worker-a" });
  const workerB = new PostgresBuildCoordination(new FakePool(shared), { workerId: "worker-b" });
  await workerA.migrate();
  await workerA.registerWorker();
  await workerB.registerWorker();
  const job = buildJob("distributed-job");

  await workerA.registerJob(job, { job_id: job.job_id, status: "accepted" });
  await assert.rejects(
    workerB.registerJob(job, { job_id: job.job_id, status: "accepted" }),
    (error) => error.code === "duplicate_job_id" && error.status === 409,
  );
  job.status = "running";
  await workerA.saveJob(job, { job_id: job.job_id, status: "running" });

  assert.deepEqual(await workerB.getJob(job.job_id), { job_id: job.job_id, status: "running", worker_id: "worker-a" });
  assert.equal(await workerB.hasActiveProjectJob(job.project_id), true);
});

test("PostgreSQL advisory locks serialize one target across build workers", async () => {
  const shared = fakePostgresState();
  const workerA = new PostgresBuildCoordination(new FakePool(shared), { workerId: "worker-a" });
  const workerB = new PostgresBuildCoordination(new FakePool(shared), { workerId: "worker-b" });
  const jobA = buildJob("job-a");
  const jobB = buildJob("job-b");
  let releaseA;
  const gate = new Promise((resolve) => { releaseA = resolve; });
  let startedA;
  const started = new Promise((resolve) => { startedA = resolve; });
  let active = 0;
  let maximumActive = 0;
  let waited = false;

  const first = workerA.runExclusive(jobA, async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    startedA();
    await gate;
    active -= 1;
  });
  await started;
  const second = workerB.runExclusive(jobB, async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    active -= 1;
  }, () => { waited = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(waited, true);
  assert.equal(maximumActive, 1);
  releaseA();
  await Promise.all([first, second]);
  assert.equal(maximumActive, 1);
});

test("a project cache epoch invalidates caches on every build worker", async () => {
  const shared = fakePostgresState();
  const workerA = new PostgresBuildCoordination(new FakePool(shared), { workerId: "worker-a" });
  const workerB = new PostgresBuildCoordination(new FakePool(shared), { workerId: "worker-b" });

  assert.equal(await workerA.getProjectCacheEpoch("project-1"), 0);
  assert.equal(await workerA.bumpProjectCacheEpoch("project-1"), 1);
  assert.equal(await workerB.getProjectCacheEpoch("project-1"), 1);
  assert.equal(await workerB.bumpProjectCacheEpoch("project-1"), 2);
  assert.equal(await workerA.getProjectCacheEpoch("project-1"), 2);
});

test("jobs from a stale build worker are failed instead of remaining running", async () => {
  const shared = fakePostgresState();
  const worker = new PostgresBuildCoordination(new FakePool(shared), { workerId: "lost-worker", staleMs: 120000 });
  await worker.registerWorker();
  const job = buildJob("lost-job");
  await worker.registerJob(job, { job_id: job.job_id, status: "running" });
  shared.jobs.get(job.job_id).status = "running";
  shared.workers.get("lost-worker").stale = true;

  await worker.failJobsFromStaleWorkers();

  assert.deepEqual(await worker.getJob(job.job_id), {
    job_id: job.job_id,
    worker_id: "lost-worker",
    status: "failed",
    error: {
      code: "worker_lost",
      message: "Der ausführende Build-Rechner ist nicht mehr erreichbar.",
      details: {},
    },
  });
  job.status = "succeeded";
  await assert.rejects(
    worker.saveJob(job, { job_id: job.job_id, status: "succeeded" }),
    (error) => error.code === "job_not_registered",
  );
});

function buildJob(jobId) {
  return {
    job_id: jobId,
    project_id: "shared-project",
    software_unit_id: "camera",
    device_id: null,
    status: "accepted",
  };
}

function fakePostgresState() {
  return { jobs: new Map(), workers: new Map(), epochs: new Map(), locks: new Map() };
}

class FakePool {
  constructor(state) {
    this.state = state;
  }

  async query(sql, params = []) {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("create table")) return { rowCount: 0, rows: [] };
    if (normalized.startsWith("insert into build_workers")) {
      this.state.workers.set(params[0], { hostname: params[1], stale: false });
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith("update build_workers")) return { rowCount: 1, rows: [] };
    if (normalized.startsWith("insert into build_execution_jobs")) {
      if (this.state.jobs.has(params[0])) return { rowCount: 0, rows: [] };
      this.state.jobs.set(params[0], {
        targetKey: params[1], projectId: params[2], workerId: params[5], status: params[6], state: JSON.parse(params[7]),
      });
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith("update build_execution_jobs as jobs")) {
      for (const row of this.state.jobs.values()) {
        if (!["accepted", "queued", "running"].includes(row.status)) continue;
        if (!this.state.workers.get(row.workerId)?.stale) continue;
        row.status = "failed";
        row.state = {
          ...row.state,
          status: "failed",
          error: {
            code: "worker_lost",
            message: "Der ausführende Build-Rechner ist nicht mehr erreichbar.",
            details: {},
          },
        };
      }
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith("update build_execution_jobs")) {
      const row = this.state.jobs.get(params[0]);
      if (!row) return { rowCount: 0, rows: [] };
      if (row.status === "failed" && row.state.error?.code === "worker_lost") return { rowCount: 0, rows: [] };
      Object.assign(row, { workerId: params[1], status: params[2], state: JSON.parse(params[3]) });
      return { rowCount: 1, rows: [] };
    }
    if (normalized.startsWith("select state_json")) {
      const row = this.state.jobs.get(params[0]);
      return { rowCount: row ? 1 : 0, rows: row ? [{ state_json: row.state, worker_id: row.workerId }] : [] };
    }
    if (normalized.includes("select exists") && normalized.includes("build_execution_jobs")) {
      const active = Array.from(this.state.jobs.values())
        .some((row) => row.projectId === params[0] && ["accepted", "queued", "running"].includes(row.status));
      return { rowCount: 1, rows: [{ active }] };
    }
    if (normalized.startsWith("select generation::bigint")) {
      const generation = this.state.epochs.get(params[0]);
      return { rowCount: generation === undefined ? 0 : 1, rows: generation === undefined ? [] : [{ generation }] };
    }
    if (normalized.startsWith("insert into build_project_cache_epochs")) {
      const generation = (this.state.epochs.get(params[0]) || 0) + 1;
      this.state.epochs.set(params[0], generation);
      return { rowCount: 1, rows: [{ generation }] };
    }
    throw new Error(`Unexpected fake PostgreSQL query: ${normalized}`);
  }

  async connect() {
    return new FakeClient(this.state);
  }

  async end() {}
}

class FakeClient {
  constructor(state) {
    this.state = state;
  }

  async query(sql, params = []) {
    const key = params[0];
    const lock = this.state.locks.get(key) || { held: false, waiters: [] };
    this.state.locks.set(key, lock);
    if (sql.includes("pg_try_advisory_lock")) {
      if (lock.held) return { rows: [{ acquired: false }] };
      lock.held = true;
      return { rows: [{ acquired: true }] };
    }
    if (sql.includes("pg_advisory_lock")) {
      if (!lock.held) {
        lock.held = true;
        return { rows: [] };
      }
      await new Promise((resolve) => lock.waiters.push(resolve));
      return { rows: [] };
    }
    if (sql.includes("pg_advisory_unlock")) {
      const next = lock.waiters.shift();
      if (next) next();
      else lock.held = false;
      return { rows: [{ pg_advisory_unlock: true }] };
    }
    throw new Error(`Unexpected fake advisory-lock query: ${sql}`);
  }

  release() {}
}
