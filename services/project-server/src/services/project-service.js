const crypto = require("node:crypto");
const { ProjectServerError } = require("../errors");
const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../modules/esp32-basissoftware-package");

class ProjectService {
  constructor(options) {
    this.repository = options.repository;
    this.loadEsp32BasissoftwareFiles = options.loadEsp32BasissoftwareFiles || loadEsp32BasissoftwareFiles;
    this.ready = this.ensureResourcePolicies();
  }

  async createProject(input = {}) {
    await this.ready;
    await this.assertProjectQuota(input.user_id, input.plan_id || input.plan || "free");
    const now = new Date().toISOString();
    const project = {
      project_id: input.project_id || createId("project"),
      user_id: required(input.user_id, "user_id"),
      plan_id: String(input.plan_id || input.plan || "free").toLowerCase(),
      title: required(input.title, "title"),
      description: input.description || "",
      learning_project_id: input.learning_project_id || "",
      hardware_profile_id: input.hardware_profile_id || "hardware.processor_board.generic_esp_wroom32",
      device_id: input.device_id || null,
      build_config: normalizeBuildConfig(input.build_config),
      view_manifest: normalizeViewManifest(input.view_manifest || input.project_view_manifest || {}),
      status: input.status || "active",
      created_at: now,
      updated_at: now,
    };
    await this.repository.saveProject(project);
    for (const source of defaultSources(project, input.sources || [])) {
      await this.upsertSource(project.project_id, source);
    }
    return this.projectWithSummary(project);
  }

  async getProject(projectId) {
    await this.ready;
    return this.projectWithSummary(await this.requireProject(projectId));
  }

  async deleteProject(projectId) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const deleted = await this.repository.deleteProject(projectId);
    return { project_id: project.project_id, deleted };
  }

  async listProjects(query = {}) {
    await this.ready;
    return Promise.all((await this.repository.listProjects({ user_id: query.user_id || query.userId || "" }))
      .map((project) => this.projectWithSummary(project)));
  }

  async updateProject(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const next = {
      ...project,
      title: input.title || project.title,
      description: input.description === undefined ? project.description : input.description,
      hardware_profile_id: input.hardware_profile_id || project.hardware_profile_id,
      device_id: input.device_id === undefined ? project.device_id : input.device_id,
      build_config: Object.hasOwn(input, "build_config")
        ? normalizeBuildConfig(input.build_config ? { ...(project.build_config || {}), ...input.build_config } : null)
        : project.build_config,
      view_manifest: input.view_manifest || input.project_view_manifest
        ? normalizeViewManifest(input.view_manifest || input.project_view_manifest)
        : project.view_manifest,
      status: input.status || project.status,
      updated_at: new Date().toISOString(),
    };
    return this.projectWithSummary(await this.repository.saveProject(next));
  }

  async listSources(projectId) {
    await this.ready;
    await this.requireProject(projectId);
    return (await this.repository.listSources(projectId)).map(maskSourceContent);
  }

  async searchSources(projectId, input = {}) {
    await this.ready;
    await this.requireProject(projectId);
    const query = String(input.query || "").toLocaleLowerCase("de-DE");
    const currentPath = String(input.current_path || "");
    const sourceKind = normalizeSourceKind(input.source_kind);
    const limit = Math.max(1, Math.min(8, Number(input.limit) || 6));
    const terms = [...new Set(query.match(/[\p{L}\p{N}_-]{3,}/gu) || [])]
      .filter((term) => !SOURCE_SEARCH_STOP_WORDS.has(term));
    return (await this.repository.listSources(projectId))
      .filter((source) => !sourceKind || sourceMatchesKind(source.path, sourceKind))
      .map((source) => ({ source, score: sourceSearchScore(source, terms, currentPath) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.source.path.localeCompare(right.source.path))
      .slice(0, limit)
      .map((item) => item.source);
  }

  async getSource(projectId, sourcePath) {
    await this.ready;
    await this.requireProject(projectId);
    const source = await this.repository.findSource(projectId, sourcePath);
    if (!source) throw new ProjectServerError("source_not_found", "Projektquelle wurde nicht gefunden.", 404);
    return source;
  }

  async upsertSource(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const path = normalizeSourcePath(required(input.path, "path"));
    const now = new Date().toISOString();
    const content = String(input.content || "");
    const source = {
      project_id: projectId,
      path,
      content,
      content_sha256: sha256(content),
      content_type: input.content_type || contentType(path),
      role: input.role || inferSourceRole(path),
      updated_at: now,
    };
    await this.repository.saveSource(source);
    await this.touchProject(projectId);
    return source;
  }

  async createBuildJob(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const now = new Date().toISOString();
    const mode = input.mode || "build";
    if (!["build", "build_and_flash", "build_and_usb_flash", "prebuild"].includes(mode)) {
      throw new ProjectServerError("invalid_build_mode", "Build-Modus muss build, build_and_flash, build_and_usb_flash oder prebuild sein.");
    }
    if (!project.build_config) {
      throw new ProjectServerError("project_not_buildable", "Projekt besitzt keine Build-Konfiguration und kann nicht gebaut werden.", 400);
    }
    const job = {
      build_job_id: input.build_job_id || createId("build_job"),
      project_id: project.project_id,
      user_id: project.user_id,
      mode,
      status: "created",
      build_deploy_job_id: null,
      device_id: input.device_id || project.device_id || null,
      created_at: now,
      updated_at: now,
      submitted_at: null,
      finished_at: null,
      build_config: project.build_config ? { ...project.build_config } : null,
      result: null,
      error: null,
    };
    return this.repository.saveBuildJob(job);
  }

  async getBuildJob(jobId) {
    await this.ready;
    const job = await this.repository.findBuildJob(jobId);
    if (!job) throw new ProjectServerError("build_job_not_found", "BuildJob wurde nicht gefunden.", 404);
    return job;
  }

  async listBuildJobs(query = {}) {
    await this.ready;
    return this.repository.listBuildJobs({
      project_id: query.project_id || query.projectId || "",
      user_id: query.user_id || query.userId || "",
    });
  }

  async createBuildPackage(jobId) {
    await this.ready;
    const job = await this.getBuildJob(jobId);
    const project = await this.requireProject(job.project_id);
    const sources = await this.repository.listSources(project.project_id);
    const projectSnapshot = sanitizeProject(project);
    const snapshotHash = projectVersionHash(projectSnapshot, sources);
    await this.repository.saveBuildJob({
      ...job,
      project_snapshot: projectSnapshot,
      source_snapshot: sources,
      snapshot_sha256: snapshotHash,
      updated_at: new Date().toISOString(),
    });
    const firmwareSources = project.build_config?.firmware_basis_id === "gernetix-runtime-basissoftware"
      ? composeEsp32BasissoftwarePackage({
          basisFiles: this.loadEsp32BasissoftwareFiles(),
          projectSources: sources,
          buildConfig: project.build_config,
        })
      : sources;
    const platformioIni = firmwareSources.find((source) => source.path === "platformio.ini")?.content || renderPlatformioIni(project);
    const buildJob = {
      job_id: job.build_job_id,
      project_id: project.project_id,
      user_id: project.user_id,
      mode: job.mode,
      device_id: job.device_id,
      build_config: project.build_config,
      created_at: new Date().toISOString(),
    };
    return {
      package_id: `pkg_${job.build_job_id}`,
      project: sanitizeProject(project),
      build_job: buildJob,
      platformio_ini: platformioIni,
      files: [
        { path: "build-job.json", content: JSON.stringify(buildJob, null, 2), content_type: "application/json" },
        { path: "project-view-manifest.json", content: JSON.stringify(effectiveViewManifest(project), null, 2), content_type: "application/json" },
        ...(project.build_config?.firmware_basis_id ? [] : [{ path: "platformio.ini", content: renderPlatformioIni(project), content_type: "text/plain" }]),
        ...firmwareSources.map((source) => ({
          path: source.path,
          content: source.content,
          content_type: source.content_type,
          sha256: source.content_sha256,
        })),
      ],
    };
  }

  async markBuildSubmitted(jobId, input = {}) {
    await this.ready;
    const job = await this.getBuildJob(jobId);
    const next = {
      ...job,
      status: "submitted",
      build_deploy_job_id: input.build_deploy_job_id || input.job_id || job.build_job_id,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.repository.saveBuildJob(next);
  }

  async recordBuildResult(jobId, input = {}) {
    await this.ready;
    const job = await this.getBuildJob(jobId);
    const status = input.status || input.build_status || "succeeded";
    const next = {
      ...job,
      status,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result: {
        build: input.build || null,
        deploy: input.deploy || null,
        logs: input.logs || [],
      },
      error: input.error || null,
    };
    await this.repository.saveBuildJob(next);
    for (const artifact of input.artifacts || []) {
      await this.repository.saveArtifact({
        artifact_id: artifact.artifact_id || createId("artifact"),
        project_id: job.project_id,
        build_job_id: job.build_job_id,
        artifact_type: artifact.artifact_type || artifact.type || "firmware",
        file_name: artifact.file_name || artifact.name || "",
        url: artifact.url || "",
        sha256: artifact.sha256 || "",
        size_bytes: artifact.size_bytes || artifact.size || 0,
        created_at: new Date().toISOString(),
      });
    }
    return this.getBuildJob(jobId);
  }

  async listArtifacts(query = {}) {
    await this.ready;
    return this.repository.listArtifacts({
      project_id: query.project_id || query.projectId || "",
      build_job_id: query.build_job_id || query.buildJobId || "",
    });
  }

  async createVersion(projectId, input = {}) {
    return this.createVersionRecord(projectId, input);
  }

  async createVersionRecord(projectId, input = {}, internal = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const versions = await this.repository.listVersions({ project_id: projectId });
    const now = new Date().toISOString();
    let projectSnapshot = sanitizeProject(project);
    let sources = await this.repository.listSources(project.project_id);
    let buildJob = null;
    let binaryArtifacts = [];
    if (input.include_binary === true) {
      buildJob = await this.repository.findBuildJob(required(input.build_job_id, "build_job_id"));
      if (!buildJob || buildJob.project_id !== projectId || buildJob.status !== "succeeded") {
        throw new ProjectServerError("version_binary_build_required", "Die Binary-Version benötigt einen erfolgreichen Build dieses Projekts.", 409);
      }
      binaryArtifacts = await this.repository.listArtifacts({ build_job_id: buildJob.build_job_id });
      if (!binaryArtifacts.length) throw new ProjectServerError("version_binary_artifact_missing", "Der erfolgreiche Build enthält kein speicherbares Binary.", 409);
      projectSnapshot = buildJob.project_snapshot;
      sources = buildJob.source_snapshot;
      if (!projectSnapshot || !sources) throw new ProjectServerError("version_build_snapshot_missing", "Der eingefrorene Build-Stand fehlt.", 409);
    }
    const snapshotSha256 = projectVersionHash(projectSnapshot, sources);
    const version = {
      version_id: createId("project_version"),
      project_id: project.project_id,
      parent_version_id: internal.parent_version_id || versions[0]?.version_id || null,
      created_by_user_id: required(input.user_id, "user_id"),
      message: String(input.message || "Projektstand gespeichert").trim().slice(0, 240),
      commit_kind: internal.commit_kind || "snapshot",
      restored_from_version_id: internal.restored_from_version_id || null,
      preserved_before_restore_version_id: internal.preserved_before_restore_version_id || null,
      state: "saved",
      includes_binary: input.include_binary === true,
      build_job_id: buildJob?.build_job_id || null,
      binary_artifacts: binaryArtifacts.map((artifact) => ({
        artifact_id: artifact.artifact_id, file_name: artifact.file_name,
        sha256: artifact.sha256, size_bytes: artifact.size_bytes, url: artifact.url,
      })),
      snapshot_sha256: snapshotSha256,
      project_snapshot: projectSnapshot,
      sources,
      created_at: now,
    };
    return this.repository.saveVersion(version);
  }

  async listVersions(projectId) {
    await this.ready;
    await this.requireProject(projectId);
    return this.repository.listVersions({ project_id: projectId });
  }

  async restoreVersion(projectId, versionId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const version = await this.repository.findVersion(versionId);
    if (!version || version.project_id !== project.project_id) throw new ProjectServerError("project_version_not_found", "Projektversion wurde nicht gefunden.", 404);
    let versions = await this.repository.listVersions({ project_id: projectId });
    const currentSources = await this.repository.listSources(project.project_id);
    const currentHash = projectVersionHash(sanitizeProject(project), currentSources);
    let preservedVersion = null;
    if (versions[0]?.snapshot_sha256 !== currentHash) {
      preservedVersion = await this.createVersionRecord(projectId, {
        user_id: required(input.user_id, "user_id"),
        message: input.preserve_message || "Stand vor Wiederherstellung",
      });
      versions = await this.repository.listVersions({ project_id: projectId });
    }
    const versionPaths = new Set((version.sources || []).map((source) => source.path));
    for (const source of currentSources) {
      if (!versionPaths.has(source.path)) await this.repository.deleteSource(project.project_id, source.path);
    }
    for (const source of version.sources || []) await this.repository.saveSource({ ...source, project_id: project.project_id, updated_at: new Date().toISOString() });
    const snapshot = version.project_snapshot || {};
    await this.repository.saveProject({
      ...project,
      title: snapshot.title || project.title,
      description: snapshot.description ?? project.description,
      hardware_profile_id: snapshot.hardware_profile_id ?? project.hardware_profile_id,
      device_id: snapshot.device_id ?? project.device_id,
      build_config: snapshot.build_config ?? project.build_config,
      view_manifest: snapshot.view_manifest ?? project.view_manifest,
      status: snapshot.status || project.status,
      updated_at: new Date().toISOString(),
    });
    const restored = await this.createVersionRecord(projectId, {
      user_id: required(input.user_id, "user_id"),
      message: input.message || `Wiederhergestellt aus ${version.message || version.version_id}`,
    }, {
      parent_version_id: versions[0]?.version_id || null,
      commit_kind: "restore",
      restored_from_version_id: versionId,
      preserved_before_restore_version_id: preservedVersion?.version_id || null,
    });
    return restored;
  }

  async createFeedback(input = {}) {
    await this.ready;
    const project = await this.requireProject(required(input.project_id, "project_id"));
    const now = new Date().toISOString();
    const feedback = {
      feedback_id: input.feedback_id || createId("feedback"),
      project_id: project.project_id,
      user_id: input.user_id || project.user_id,
      learning_step_id: input.learning_step_id || "",
      category: input.category || "project_feedback",
      message: required(input.message, "message"),
      contact_mode: input.contact_mode || "no_contact",
      contact_email: input.contact_email || "",
      anonymize_after: input.anonymize_after || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      anonymized_at: null,
      created_at: now,
    };
    return redactFeedback(await this.repository.saveFeedback(feedback));
  }

  async listFeedback(query = {}) {
    await this.ready;
    const feedbackItems = await this.repository.listFeedback({
      project_id: query.project_id || query.projectId || "",
      user_id: query.user_id || query.userId || "",
    });
    return Promise.all(feedbackItems.map(async (feedback) =>
      redactFeedback(feedback, await this.repository.findFeedbackConsent(feedback.feedback_id))));
  }

  async getLearningProgress(projectId, userId) {
    await this.ready;
    const project = await this.requireOwnedProject(projectId, userId);
    return (await this.repository.findLearningProgress(projectId))
      || emptyLearningProgress(project);
  }

  async updateLearningProgress(projectId, input = {}) {
    await this.ready;
    const userId = required(input.user_id || input.userId, "user_id");
    const project = await this.requireOwnedProject(projectId, userId);
    if (!project.learning_project_id) {
      throw new ProjectServerError("learning_project_required", "Lernfortschritt kann nur fuer ein Lernprojekt gespeichert werden.", 409);
    }
    const previous = (await this.repository.findLearningProgress(projectId))
      || emptyLearningProgress(project);
    const views = Array.isArray(project.view_manifest?.views) ? project.view_manifest.views : [];
    const requestedStepId = String(input.current_step_id || input.currentStepId || "");
    const requestedStepIndex = requestedStepId
      ? views.findIndex((view) => view.id === requestedStepId)
      : -1;
    const currentStepIndex = requestedStepIndex >= 0
      ? requestedStepIndex
      : boundedIndex(input.current_step_index ?? input.currentStep ?? input.current_step, views.length);
    const currentView = views[currentStepIndex] || {};
    const currentLessonId = String(
      currentView.lesson_id
      || project.view_manifest?.lesson_focus_id
      || input.current_lesson_id
      || input.currentLessonId
      || input.lesson_id
      || input.lessonId
      || previous.current_lesson_id
      || "",
    );
    const currentStepId = String(
      currentView.id
      || requestedStepId
      || previous.current_step_id
      || "",
    );
    const completedStepIndexes = uniqueNonNegativeIntegers(
      input.completed_step_indexes || input.completedSteps || input.completed_steps || [],
    );
    const submittedCompletedStepIds = Array.from(new Set([
      ...(previous.completed_step_ids || []),
      ...(input.completed_step_ids || input.completedStepIds || []).map(String),
      ...completedStepIndexes.map((index) => views[index]?.id).filter(Boolean),
    ]));
    const knownStepIds = new Set(views.map((view) => view.id).filter(Boolean));
    const completedStepIds = views.length
      ? submittedCompletedStepIds.filter((stepId) => knownStepIds.has(stepId))
      : submittedCompletedStepIds;
    const persistedCompletedStepIndexes = views.length
      ? views.map((view, index) => completedStepIds.includes(view.id) ? index : -1).filter((index) => index >= 0)
      : completedStepIndexes;
    const lessonProgress = lessonProgressFromViews(
      views,
      completedStepIds,
      currentLessonId,
      currentStepId,
      currentStepIndex,
      previous.lesson_progress,
    );
    const allStepIds = views.map((view) => String(view.id || "")).filter(Boolean);
    const status = allStepIds.length && allStepIds.every((stepId) => completedStepIds.includes(stepId))
      ? "completed"
      : "active";
    const now = new Date().toISOString();
    return this.repository.saveLearningProgress({
      progress_id: previous.progress_id || `account_project_progress.${project.project_id}`,
      project_id: project.project_id,
      user_id: project.user_id,
      learning_project_id: project.learning_project_id,
      entry_mode: project.view_manifest?.entry_mode || "project_story",
      status,
      current_lesson_id: currentLessonId,
      current_step_id: currentStepId,
      current_step_index: currentStepIndex,
      completed_step_indexes: persistedCompletedStepIndexes,
      completed_step_ids: completedStepIds,
      lesson_progress: lessonProgress,
      started_at: previous.started_at || now,
      last_seen_at: now,
      completed_at: status === "completed" ? (previous.completed_at || now) : null,
    });
  }

  async createFeedbackConsent(feedbackId, input = {}) {
    await this.ready;
    const feedback = await this.requireFeedback(feedbackId);
    const now = new Date().toISOString();
    return this.repository.saveConsent({
      consent_id: input.consent_id || createId("consent"),
      feedback_id: feedback.feedback_id,
      user_id: feedback.user_id,
      purpose: input.purpose || "feedback_follow_up",
      granted_to_role: input.granted_to_role || "support",
      valid_from: now,
      valid_until: required(input.valid_until, "valid_until"),
      revoked_at: null,
      created_at: now,
    });
  }

  async anonymizeExpiredFeedback(at = new Date()) {
    await this.ready;
    const updated = [];
    for (const feedback of await this.repository.listFeedback()) {
      if (feedback.anonymized_at || new Date(feedback.anonymize_after).getTime() > at.getTime()) continue;
      const anonymized = {
        ...feedback,
        user_id: "anonymous",
        contact_email: "",
        contact_mode: "no_contact",
        anonymized_at: at.toISOString(),
      };
      updated.push(redactFeedback(await this.repository.saveFeedback(anonymized)));
    }
    return updated;
  }

  async projectWithSummary(project) {
    return {
      ...sanitizeProject(project),
      source_count: (await this.repository.listSources(project.project_id)).length,
      build_count: (await this.repository.listBuildJobs({ project_id: project.project_id })).length,
    };
  }

  async resourceSummary() {
    await this.ready;
    const policies = await this.repository.listResourcePolicies();
    const byAccount = new Map();
    for (const project of await this.repository.listProjects()) {
      const entry = byAccount.get(project.user_id) || { account_id: project.user_id, plan_id: project.plan_id || "free", projects: 0, storage_bytes: 0 };
      entry.projects += 1;
      entry.storage_bytes += await this.projectStorageBytes(project.project_id);
      byAccount.set(project.user_id, entry);
    }
    return { policies, accounts: Array.from(byAccount.values()).sort((a, b) => b.storage_bytes - a.storage_bytes) };
  }

  async updateResourcePolicy(planId, input = {}) {
    await this.ready;
    const current = await this.policyFor(planId);
    const policy = {
      ...current,
      plan_id: String(planId).toLowerCase(),
      max_projects: unlimitedOrPositiveLimit(input.max_projects, current.max_projects),
      max_storage_bytes: unlimitedOrPositiveLimit(input.max_storage_bytes, current.max_storage_bytes),
      max_monthly_traffic_bytes: unlimitedOrPositiveLimit(input.max_monthly_traffic_bytes, current.max_monthly_traffic_bytes),
      updated_at: new Date().toISOString(),
    };
    return this.repository.saveResourcePolicy(policy);
  }

  async ensureResourcePolicies() {
    const existing = new Map((await this.repository.listResourcePolicies()).map((policy) => [policy.plan_id, policy]));
    for (const policy of defaultResourcePolicies()) {
      const current = existing.get(policy.plan_id);
      if (!current) { await this.repository.saveResourcePolicy(policy); continue; }
      // Migration bisheriger Premium-Vorgaben auf die beschlossene grosszuegige Missbrauchsgrenze.
      if (["premium", "premium_demo"].includes(policy.plan_id) && [null, 50].includes(current.max_projects)) {
        await this.repository.saveResourcePolicy({ ...current, max_projects: 200, updated_at: new Date().toISOString() });
      }
    }
  }

  async policyFor(planId) {
    const normalized = String(planId || "free").toLowerCase();
    const policies = await this.repository.listResourcePolicies();
    return policies.find((item) => item.plan_id === normalized)
      || policies.find((item) => item.plan_id === "free")
      || defaultResourcePolicies()[0];
  }

  async assertProjectQuota(userId, planId) {
    const policy = await this.policyFor(planId);
    if (policy.max_projects !== null && (await this.repository.listProjects({ user_id: userId })).length >= policy.max_projects) {
      throw new ProjectServerError("project_quota_exceeded", `Maximal ${policy.max_projects} Projekte fuer den Plan ${policy.plan_id}.`, 409);
    }
  }

  async assertStorageQuota(project, sourcePath, content, planId) {
    const policy = await this.policyFor(planId);
    const existing = await this.repository.findSource(project.project_id, sourcePath);
    const nextBytes = await this.projectStorageBytes(project.project_id) - Buffer.byteLength(existing?.content || "", "utf8") + Buffer.byteLength(content, "utf8");
    if (policy.max_storage_bytes !== null && nextBytes > policy.max_storage_bytes) {
      throw new ProjectServerError("storage_quota_exceeded", `Speicherlimit von ${policy.max_storage_bytes} Bytes fuer den Plan ${policy.plan_id} erreicht.`, 413);
    }
  }

  async projectStorageBytes(projectId) {
    return (await this.repository.listSources(projectId)).reduce((sum, source) => sum + Buffer.byteLength(source.content || "", "utf8"), 0);
  }

  async touchProject(projectId) {
    const project = await this.requireProject(projectId);
    await this.repository.saveProject({ ...project, updated_at: new Date().toISOString() });
  }

  async requireProject(projectId) {
    const project = await this.repository.findProject(projectId);
    if (!project) throw new ProjectServerError("project_not_found", "Projekt wurde nicht gefunden.", 404);
    return project;
  }

  async requireOwnedProject(projectId, userId) {
    const project = await this.requireProject(projectId);
    if (!userId || project.user_id !== userId) {
      throw new ProjectServerError("project_access_denied", "Das Lernprojekt gehoert nicht zu diesem Account.", 403);
    }
    return project;
  }

  async requireFeedback(feedbackId) {
    const feedback = await this.repository.findFeedback(feedbackId);
    if (!feedback) throw new ProjectServerError("feedback_not_found", "Feedback wurde nicht gefunden.", 404);
    return feedback;
  }
}

function emptyLearningProgress(project) {
  const views = Array.isArray(project.view_manifest?.views) ? project.view_manifest.views : [];
  const firstView = views[0] || {};
  return {
    progress_id: `account_project_progress.${project.project_id}`,
    project_id: project.project_id,
    user_id: project.user_id,
    learning_project_id: project.learning_project_id || "",
    entry_mode: project.view_manifest?.entry_mode || "project_story",
    status: "not_started",
    current_lesson_id: firstView.lesson_id || project.view_manifest?.lesson_focus_id || "",
    current_step_id: firstView.id || "",
    current_step_index: 0,
    completed_step_indexes: [],
    completed_step_ids: [],
    lesson_progress: lessonProgressFromViews(views, [], firstView.lesson_id || "", firstView.id || "", 0, []),
    started_at: null,
    last_seen_at: null,
    completed_at: null,
  };
}

function lessonProgressFromViews(views, completedStepIds, currentLessonId, currentStepId, currentStepIndex, previous = []) {
  const previousByLesson = new Map((previous || []).map((item) => [item.lesson_id, item]));
  const lessonIds = Array.from(new Set(views.map((view) => String(view.lesson_id || "")).filter(Boolean)));
  if (currentLessonId && !lessonIds.includes(currentLessonId)) lessonIds.push(currentLessonId);
  return lessonIds.map((lessonId) => {
    const lessonViews = views.filter((view) => view.lesson_id === lessonId);
    const lessonStepIds = lessonViews.map((view) => String(view.id || "")).filter(Boolean);
    const completedLessonStepIds = lessonStepIds.filter((stepId) => completedStepIds.includes(stepId));
    const currentLessonStepIndex = lessonId === currentLessonId
      ? Math.max(0, lessonViews.findIndex((view) => view.id === currentStepId))
      : Number(previousByLesson.get(lessonId)?.current_step_index || 0);
    return {
      lesson_id: lessonId,
      status: lessonStepIds.length && lessonStepIds.every((stepId) => completedStepIds.includes(stepId))
        ? "completed"
        : (completedLessonStepIds.length || lessonId === currentLessonId ? "active" : "not_started"),
      current_step_id: lessonId === currentLessonId
        ? currentStepId
        : String(previousByLesson.get(lessonId)?.current_step_id || lessonViews[0]?.id || ""),
      current_step_index: currentLessonStepIndex,
      completed_step_ids: completedLessonStepIds,
      completed_step_indexes: completedLessonStepIds.map((stepId) => lessonViews.findIndex((view) => view.id === stepId)),
      global_step_index: lessonId === currentLessonId
        ? currentStepIndex
        : Number(previousByLesson.get(lessonId)?.global_step_index || 0),
    };
  });
}

function uniqueNonNegativeIntegers(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(Number)
    .filter((value) => Number.isInteger(value) && value >= 0))).sort((left, right) => left - right);
}

function boundedIndex(value, length) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, Math.max(0, length - 1));
}

function normalizeBuildConfig(input = {}) {
  if (!input || typeof input !== "object") return null;
  const firmwareBasisId = input.firmware_basis_id || "";
  return {
    platform: input.platform || "espressif32",
    framework: input.framework === undefined ? "arduino" : input.framework,
    board: input.board || "esp32dev",
    environment: input.environment || "esp32dev",
    libraries: input.libraries || [],
    firmware_basis_id: firmwareBasisId,
    firmware_basis_version: input.firmware_basis_version || "",
    firmware_basis_variant: input.firmware_basis_variant === "comfort" ? "full" : input.firmware_basis_variant || (firmwareBasisId ? "full" : ""),
    partition_profile_id: input.partition_profile_id || "",
    flash_size_mb: [4, 8, 16].includes(Number(input.flash_size_mb)) ? Number(input.flash_size_mb) : 4,
    user_source_path: input.user_source_path || "",
    user_target_path: input.user_target_path || "",
    component_device_allocations: Array.isArray(input.component_device_allocations)
      ? input.component_device_allocations.map((item) => ({ ...item })).filter((item) => item.component_path && item.device_id)
      : [],
    component_features: normalizeComponentFeatures(input.component_features, input.firmware_basis_variant === "comfort" ? "full" : input.firmware_basis_variant || (firmwareBasisId ? "full" : "")),
  };
}

function normalizeComponentFeatures(input, basisVariant) {
  const configured = input && typeof input === "object" ? input : {};
  const immutable = basisVariant === "low"
    ? ["wifi", "http", "webserver"]
    : ["wifi", "mqtt", "ota", "http", "webserver"];
  const enabled = new Set(Array.isArray(configured.enabled) ? configured.enabled.map(String) : []);
  immutable.forEach((feature) => enabled.add(feature));
  return {
    enabled: Array.from(enabled),
    immutable,
    webserver: {
      title: String(configured.webserver?.title || "GerNetiX Device").slice(0, 80),
      measurement_chart: Boolean(configured.webserver?.measurement_chart),
      measurement_label: String(configured.webserver?.measurement_label || "Messwert").slice(0, 60),
      measurement_unit: String(configured.webserver?.measurement_unit || "").slice(0, 16),
    },
  };
}

function normalizeViewManifest(input = {}) {
  const manifest = input && typeof input === "object" ? input : {};
  const templateId = String(manifest.template_id || manifest.templateId || "").trim();
  const templateRef = manifest.template_ref || manifest.templateRef || {};
  const architectureDialog = manifest.architecture_dialog || manifest.architectureDialog;
  const homeAutomationConfiguration = manifest.home_automation_configuration || manifest.homeAutomationConfiguration;
  const gameConfiguration = manifest.game_configuration || manifest.gameConfiguration;
  const pwaDashboard = manifest.pwa_dashboard || manifest.pwaDashboard;
  return {
    schema_version: Number(manifest.schema_version || manifest.schemaVersion || 1),
    title: manifest.title || "",
    summary: manifest.summary || "",
    ...(templateId ? {
      template_id: templateId,
      template_ref: {
        template_id: String(templateRef.template_id || templateRef.templateId || templateId),
        model_schema_version: Number(templateRef.model_schema_version || templateRef.modelSchemaVersion || 1),
      },
    } : {}),
    ...(architectureDialog && typeof architectureDialog === "object" ? { architecture_dialog: architectureDialog } : {}),
    ...(homeAutomationConfiguration && typeof homeAutomationConfiguration === "object"
      ? { home_automation_configuration: homeAutomationConfiguration }
      : {}),
    ...(gameConfiguration && typeof gameConfiguration === "object"
      ? { game_configuration: gameConfiguration }
      : {}),
    ...(pwaDashboard && typeof pwaDashboard === "object"
      ? { pwa_dashboard: normalizePwaDashboard(pwaDashboard) }
      : {}),
    primary_source_path: normalizeOptionalSourcePath(manifest.primary_source_path || manifest.primarySourcePath || ""),
    hide_source_editor: Boolean(manifest.hide_source_editor || manifest.hideSourceEditor),
    mode: manifest.mode || "guided_ide",
    entry_mode: manifest.entry_mode || manifest.entryMode || "project_story",
    lesson_focus_id: String(manifest.lesson_focus_id || manifest.lessonFocusId || ""),
    parent_learning_project_id: String(manifest.parent_learning_project_id || manifest.parentLearningProjectId || ""),
    views: Array.isArray(manifest.views) ? manifest.views.map(normalizeProjectView).filter(Boolean) : [],
  };
}

function positiveLimit(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function unlimitedOrPositiveLimit(value, fallback) {
  if (value === null || value === "" || Number(value) === 0) return null;
  return positiveLimit(value, fallback);
}

function defaultResourcePolicies() {
  const now = new Date().toISOString();
  return [
    { plan_id: "free", max_projects: 5, max_storage_bytes: 5 * 1024 * 1024, max_monthly_traffic_bytes: 25 * 1024 * 1024, updated_at: now },
    { plan_id: "premium", max_projects: 200, max_storage_bytes: null, max_monthly_traffic_bytes: 1024 * 1024 * 1024, updated_at: now },
    { plan_id: "premium_demo", max_projects: 200, max_storage_bytes: null, max_monthly_traffic_bytes: 1024 * 1024 * 1024, updated_at: now },
  ];
}

function normalizePwaDashboard(input = {}) {
  const configured = input && typeof input === "object" ? input : {};
  const availableCards = new Set(["current_values", "history", "events", "device_status"]);
  const selected = Array.isArray(configured.visible_cards || configured.visibleCards)
    ? (configured.visible_cards || configured.visibleCards).map(String).filter((id) => availableCards.has(id))
    : Array.from(availableCards);
  return {
    schema_version: 1,
    title: String(configured.title || "Mein Datenlogger").trim().slice(0, 80),
    visible_cards: Array.from(new Set(selected)),
  };
}

function normalizeProjectView(input = {}) {
  if (!input || typeof input !== "object") return null;
  const id = String(input.id || "").trim();
  const type = String(input.type || "").trim();
  if (!id || !type) return null;
  return {
    id,
    type,
    lesson_id: String(input.lesson_id || input.lessonId || ""),
    title: input.title || id,
    summary: input.summary || input.text || "",
    source_path: normalizeOptionalSourcePath(input.source_path || input.sourcePath || ""),
    source_lines: Array.isArray(input.source_lines || input.sourceLines)
      ? (input.source_lines || input.sourceLines).map(Number).filter(Number.isFinite)
      : [],
    editable_lines: Array.isArray(input.editable_lines || input.editableLines)
      ? (input.editable_lines || input.editableLines).map(Number).filter(Number.isFinite)
      : [],
    completion: input.completion && typeof input.completion === "object" ? input.completion : {},
    validation: input.validation && typeof input.validation === "object" ? input.validation : {},
    controls: input.controls && typeof input.controls === "object" ? input.controls : {},
    required_functions: Array.isArray(input.required_functions || input.requiredFunctions)
      ? (input.required_functions || input.requiredFunctions).map(String).filter(Boolean)
      : [],
    media: input.media && typeof input.media === "object" ? input.media : {},
    runtime_preview: input.runtime_preview || input.runtimePreview || null,
    payload: input.payload && typeof input.payload === "object" ? input.payload : {},
  };
}

function defaultViewManifest(project) {
  return normalizeViewManifest({
    title: project.title,
    summary: project.description,
    primary_source_path: "src/main.cpp",
    views: [
      {
        id: "source",
        type: "source_analysis",
        title: "Quellcode",
        summary: "Primaere Projektdatei analysieren und bearbeiten.",
        source_path: "src/main.cpp",
      },
    ],
  });
}

function effectiveViewManifest(project) {
  const manifest = project.view_manifest || {};
  return Array.isArray(manifest.views) && manifest.views.length ? manifest : defaultViewManifest(project);
}

function defaultSources(project, sources) {
  if (sources.length) return sources;
  return [{
    path: "src/main.cpp",
    role: "user_code",
    content_type: "text/x-c++src",
    content: [
      "#include <Arduino.h>",
      "",
      "void setup() {",
      "  Serial.begin(115200);",
      "}",
      "",
      "void loop() {",
      `  Serial.println("${project.title}");`,
      "  delay(1000);",
      "}",
      "",
    ].join("\n"),
  }];
}

function renderPlatformioIni(project) {
  const config = normalizeBuildConfig(project.build_config);
  const lines = [
    `[env:${config.environment}]`,
    `platform = ${config.platform}`,
    `board = ${config.board}`,
  ];
  if (config.framework) lines.push(`framework = ${config.framework}`);
  if (config.libraries.length) lines.push(`lib_deps = ${config.libraries.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

function sanitizeProject(project) {
  return {
    project_id: project.project_id,
    user_id: project.user_id,
    title: project.title,
    description: project.description,
    learning_project_id: project.learning_project_id,
    hardware_profile_id: project.hardware_profile_id,
    device_id: project.device_id,
    build_config: project.build_config,
    view_manifest: effectiveViewManifest(project),
    status: project.status,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

function projectVersionHash(projectSnapshot, sources) {
  const canonical = {
    project: {
      title: projectSnapshot.title,
      description: projectSnapshot.description,
      learning_project_id: projectSnapshot.learning_project_id,
      hardware_profile_id: projectSnapshot.hardware_profile_id,
      device_id: projectSnapshot.device_id,
      build_config: projectSnapshot.build_config,
      view_manifest: projectSnapshot.view_manifest,
      status: projectSnapshot.status,
    },
    sources: [...(sources || [])]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({ path, content, content_type, role }) => ({ path, content, content_type, role })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function maskSourceContent(source) {
  return {
    project_id: source.project_id,
    path: source.path,
    content_sha256: source.content_sha256,
    content_type: source.content_type,
    role: source.role,
    updated_at: source.updated_at,
  };
}

const SOURCE_SEARCH_STOP_WORDS = new Set(["aber", "bitte", "datei", "diese", "dieser", "einen", "einer", "etwas", "fuege", "füge", "hinzu", "machen", "mein", "meine", "mich", "projekt", "soll", "und", "werden"]);

function normalizeSourceKind(value) {
  return ["architecture", "code", "configuration", "documentation"].includes(value) ? value : "";
}

function sourceMatchesKind(pathValue, sourceKind) {
  const path = String(pathValue || "").replaceAll("\\", "/");
  if (sourceKind === "architecture") return /(^|\/)Architektur\/|\.(?:puml|plantuml)$/i.test(path);
  if (sourceKind === "code") return /\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx|ino|py|js|ts|java|rs)$/i.test(path);
  if (sourceKind === "configuration") return /(^|\/)(?:Konfiguration|config)(?:\/|$)|\.(?:json|ya?ml|toml|ini)$/i.test(path);
  return /\.(?:md|txt|adoc)$/i.test(path);
}

function sourceSearchScore(source, terms, currentPath) {
  if (source.path === currentPath) return 100000;
  if (!terms.length) return 0;
  const path = String(source.path || "").toLocaleLowerCase("de-DE");
  const content = String(source.content || "").toLocaleLowerCase("de-DE");
  return terms.reduce((score, term) => {
    const pathMatches = path.split(term).length - 1;
    const contentMatches = Math.min(8, content.split(term).length - 1);
    return score + (pathMatches * 20) + contentMatches;
  }, 0);
}

function redactFeedback(feedback, consent = null) {
  return {
    ...feedback,
    contact_email: consent ? feedback.contact_email : "",
    has_contact_consent: Boolean(consent),
  };
}

function normalizeSourcePath(value) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new ProjectServerError("invalid_source_path", "Source-Pfad muss relativ und innerhalb des Projekts liegen.");
  }
  return normalized;
}

function normalizeOptionalSourcePath(value) {
  const raw = String(value || "").trim();
  return raw ? normalizeSourcePath(raw) : "";
}

function contentType(sourcePath) {
  if (sourcePath.endsWith(".json")) return "application/json";
  if (sourcePath.endsWith(".h")) return "text/x-c++hdr";
  if (sourcePath.endsWith(".cpp") || sourcePath.endsWith(".ino")) return "text/x-c++src";
  return "text/plain";
}

function inferSourceRole(sourcePath) {
  if (sourcePath === "platformio.ini") return "build_config";
  if (sourcePath.startsWith("include/")) return "header";
  if (sourcePath.startsWith("lib/")) return "library";
  if (sourcePath.startsWith("assets/")) return "asset";
  return "user_code";
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new ProjectServerError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { ProjectService };
