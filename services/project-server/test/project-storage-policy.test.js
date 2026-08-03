"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { InMemoryProjectRepository } = require("../src/repositories/in-memory-project-repository");
const { ProjectService } = require("../src/services/project-service");

test("validates project states and makes plan_locked projects read-only and non-buildable", async () => {
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository });

  await assert.rejects(
    service.createProject({ project_id: "invalid-state", user_id: "account-state", title: "Ungültig", status: "archived" }),
    (error) => error.code === "invalid_project_status",
  );
  await assert.rejects(
    service.createProject({ project_id: "client-locked", user_id: "account-state", title: "Gesperrt", status: "plan_locked" }),
    (error) => error.code === "project_status_managed",
  );
  const project = await service.createProject({
    project_id: "lockable-project",
    user_id: "account-state",
    title: "Sperrbar",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  await assert.rejects(
    service.updateProject(project.project_id, { status: "unknown" }),
    (error) => error.code === "invalid_project_status",
  );
  await assert.rejects(
    service.updateProject(project.project_id, { status: "plan_locked" }),
    (error) => error.code === "project_status_managed",
  );
  const pendingJob = await service.createBuildJob(project.project_id);
  const locked = await service.setProjectPlanStatus(project.project_id, "plan_locked");
  assert.equal(locked.status, "plan_locked");

  assert.equal((await service.getProject(project.project_id)).status, "plan_locked");
  assert.ok((await service.listSources(project.project_id)).length > 0);
  await assert.rejects(
    service.updateProject(project.project_id, { title: "Nicht erlaubt" }),
    (error) => error.code === "project_plan_locked",
  );
  await assert.rejects(
    service.upsertSource(project.project_id, { path: "src/new.cpp", content: "int value = 1;" }),
    (error) => error.code === "project_plan_locked",
  );
  await assert.rejects(
    service.deleteSource(project.project_id, "Komponenten/IoT-Device 1/src/main.cpp"),
    (error) => error.code === "project_plan_locked",
  );
  await assert.rejects(
    service.createBuildJob(project.project_id),
    (error) => error.code === "project_plan_locked",
  );
  await assert.rejects(
    service.createBuildPackage(pendingJob.build_job_id),
    (error) => error.code === "project_plan_locked",
  );
  await assert.rejects(
    service.markBuildSubmitted(pendingJob.build_job_id),
    (error) => error.code === "project_plan_locked",
  );
  await assert.rejects(
    service.createVersion(project.project_id, { user_id: "account-state" }),
    (error) => error.code === "project_plan_locked",
  );

  assert.equal((await service.setProjectPlanStatus(project.project_id, "active")).status, "active");
  assert.equal((await service.setProjectPlanStatus(project.project_id, "plan_locked")).status, "plan_locked");

  const deleted = await service.deleteProject(project.project_id);
  assert.equal(deleted.project_id, project.project_id);
});

test("enforces storage quota account-wide from the transitional SQL source cache and permits cleanup", async () => {
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository });
  await service.updateResourcePolicy("free", {
    max_storage_bytes: 0,
    change_reason: "Testprojekte zunächst ohne Speichergrenze anlegen",
  });
  const first = await service.createProject({ project_id: "quota-first", user_id: "quota-account", plan_id: "free", title: "Eins" });
  const second = await service.createProject({ project_id: "quota-second", user_id: "quota-account", plan_id: "free", title: "Zwei" });
  const before = (await service.resourceSummary()).accounts.find((account) => account.account_id === "quota-account").storage_bytes;
  await service.updateResourcePolicy("free", {
    max_storage_bytes: before + 3,
    change_reason: "Accountweite Drei-Byte-Reserve testen",
  });

  await assert.rejects(
    service.upsertSource(second.project_id, { path: "extra.txt", content: "vier" }),
    (error) => error.code === "storage_quota_exceeded"
      && error.details.account_id === "quota-account"
      && error.details.measurement_source === "sql_source_cache",
  );
  await service.upsertSource(second.project_id, { path: "extra.txt", content: "123" });
  const atLimit = (await service.resourceSummary()).accounts.find((account) => account.account_id === "quota-account").storage_bytes;
  assert.equal(atLimit, before + 3);

  await service.updateResourcePolicy("free", {
    max_storage_bytes: atLimit - 1,
    change_reason: "Bereinigung eines bereits überzogenen Kontos testen",
  });
  await assert.doesNotReject(service.deleteSource(second.project_id, "extra.txt"));
  await assert.rejects(
    service.createProject({ project_id: "quota-rolled-back", user_id: "quota-account", plan_id: "free", title: "Zu groß" }),
    (error) => error.code === "storage_quota_exceeded",
  );
  assert.equal((await service.listProjects({ user_id: "quota-account" })).some((project) => project.project_id === "quota-rolled-back"), false);
  assert.equal((await service.getProject(first.project_id)).status, "active");
});

test("versions resource policies and requires an auditable change reason", async () => {
  const service = new ProjectService({ repository: new InMemoryProjectRepository() });
  const initial = (await service.resourceSummary()).policies.find((policy) => policy.plan_id === "free");
  assert.equal(initial.policy_id, "resource_policy.free");
  assert.equal(initial.policy_version, 1);
  assert.equal(initial.status, "active");

  await assert.rejects(
    service.updateResourcePolicy("free", { max_projects: initial.max_projects }),
    (error) => error.code === "missing_required_field",
  );
  const changed = await service.updateResourcePolicy("free", {
    max_projects: initial.max_projects,
    changed_by: "admin-test",
    change_reason: "Versionierung prüfen",
  });
  assert.equal(changed.policy_version, 2);
  assert.equal(changed.changed_by, "admin-test");
  assert.equal(changed.change_reason, "Versionierung prüfen");
  assert.equal(changed.status, "active");
  assert.match(changed.effective_from, /^\d{4}-\d{2}-\d{2}T/);
});

test("applies an effective account plan and locks only projects outside the selectable quota", async () => {
  const service = new ProjectService({ repository: new InMemoryProjectRepository() });
  await service.updateResourcePolicy("free", {
    max_projects: 1,
    change_reason: "Downgrade-Auswahl testen",
  });
  const first = await service.createProject({ project_id: "downgrade-first", user_id: "downgrade-account", plan_id: "premium", title: "Eins" });
  const second = await service.createProject({ project_id: "downgrade-second", user_id: "downgrade-account", plan_id: "premium", title: "Zwei" });

  const summary = await service.applyAccountResourcePlan("downgrade-account", {
    plan_id: "free",
    active_project_ids: [second.project_id],
  });
  assert.equal(summary.policy.policy_version, 2);
  assert.equal(summary.usage.projects, 2);
  assert.equal(summary.usage.active_projects, 1);
  assert.equal(summary.usage.locked_projects, 1);
  assert.equal((await service.getProject(first.project_id)).status, "plan_locked");
  assert.equal((await service.getProject(second.project_id)).status, "active");
  assert.equal((await service.getProject(second.project_id)).plan_id, "free");

  await assert.rejects(
    service.applyAccountResourcePlan("downgrade-account", {
      plan_id: "free",
      active_project_ids: [first.project_id, second.project_id],
    }),
    (error) => error.code === "project_selection_exceeds_plan",
  );
});

test("persists the selected build profile on project build jobs", async () => {
  const service = new ProjectService({ repository: new InMemoryProjectRepository() });
  const project = await service.createProject({
    project_id: "debug-profile-project",
    user_id: "debug-account",
    title: "Debug",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  assert.equal((await service.createBuildJob(project.project_id)).build_profile, "standard");
  assert.equal((await service.createBuildJob(project.project_id, { build_profile: "debug" })).build_profile, "debug");
  await assert.rejects(
    service.createBuildJob(project.project_id, { build_profile: "release" }),
    (error) => error.code === "invalid_build_profile",
  );
});

test("applies the account quota to projected configuration and legacy version restores", async () => {
  const service = new ProjectService({ repository: new InMemoryProjectRepository() });
  await service.updateResourcePolicy("free", { max_storage_bytes: 0, change_reason: "Restore-Test vorbereiten" });
  const project = await service.createProject({ project_id: "quota-restore", user_id: "quota-restore-user", title: "Kurz" });
  await service.upsertSource(project.project_id, { path: "history.txt", content: "0123456789" });
  const version = await service.createVersion(project.project_id, { user_id: project.user_id, message: "Großer Stand" });
  await service.upsertSource(project.project_id, { path: "history.txt", content: "x" });
  const currentBytes = (await service.resourceSummary()).accounts
    .find((account) => account.account_id === project.user_id).storage_bytes;
  await service.updateResourcePolicy("free", { max_storage_bytes: currentBytes, change_reason: "Wachstum durch Restore sperren" });

  await assert.rejects(
    service.updateProject(project.project_id, { title: "Ein sehr viel längerer Projekttitel, der mehr Projektkonfigurationsspeicher benötigt" }),
    (error) => error.code === "storage_quota_exceeded",
  );
  assert.equal((await service.getProject(project.project_id)).title, "Kurz");
  await assert.rejects(
    service.restoreVersion(project.project_id, version.version_id, { user_id: project.user_id }),
    (error) => error.code === "storage_quota_exceeded",
  );
  assert.equal((await service.getSource(project.project_id, "history.txt")).content, "x");
});
