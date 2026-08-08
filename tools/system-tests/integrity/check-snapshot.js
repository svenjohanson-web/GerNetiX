"use strict";

function checkSnapshot(snapshot) {
  const issues = [];
  const accounts = index(snapshot.accounts, "account_id", issues, "account");
  const projects = index(snapshot.projects, "project_id", issues, "project");

  for (const project of snapshot.projects || []) {
    if (!accounts.has(project.owner_account_id)) {
      issues.push(issue("project_without_owner", project.project_id));
    }
  }

  const activeBuildKeys = new Set();
  for (const job of snapshot.build_jobs || []) {
    if (!projects.has(job.project_id)) issues.push(issue("build_without_project", job.build_job_id));
    if (["queued", "running"].includes(job.status)) {
      const key = `${job.project_id}:${job.idempotency_key}`;
      if (activeBuildKeys.has(key)) issues.push(issue("duplicate_active_build", job.build_job_id));
      activeBuildKeys.add(key);
    }
  }

  const ledgerKeys = new Set();
  for (const entry of snapshot.ledger_entries || []) {
    if (!accounts.has(entry.account_id)) issues.push(issue("ledger_without_account", entry.ledger_entry_id));
    if (ledgerKeys.has(entry.operation_id)) issues.push(issue("duplicate_ledger_operation", entry.operation_id));
    ledgerKeys.add(entry.operation_id);
  }

  const telemetryKeys = new Set();
  for (const event of snapshot.telemetry_events || []) {
    const project = projects.get(event.project_id);
    if (!project || project.owner_account_id !== event.account_id) {
      issues.push(issue("telemetry_ownership_mismatch", event.event_id));
    }
    const key = `${event.device_id}:${event.message_id}`;
    if (telemetryKeys.has(key) && event.deduplicated !== true) {
      issues.push(issue("telemetry_duplicate_not_deduplicated", event.event_id));
    }
    telemetryKeys.add(key);
  }

  return Object.freeze({ ok: issues.length === 0, issues });
}

function index(items = [], key, issues, entity) {
  const values = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) {
      issues.push(issue(`${entity}_missing_id`, "unknown"));
    } else if (values.has(value)) {
      issues.push(issue(`duplicate_${entity}`, value));
    } else {
      values.set(value, item);
    }
  }
  return values;
}

function issue(code, subject) {
  return Object.freeze({ code, subject: String(subject || "unknown") });
}

module.exports = { checkSnapshot };
