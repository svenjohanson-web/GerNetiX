const crypto = require("node:crypto");
const { ProjectServerError } = require("../errors");
const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../modules/esp32-basissoftware-package");

class ProjectService {
  constructor(options) {
    this.repository = options.repository;
    this.loadEsp32BasissoftwareFiles = options.loadEsp32BasissoftwareFiles || loadEsp32BasissoftwareFiles;
    this.ensureResourcePolicies();
  }

  createProject(input = {}) {
    this.assertProjectQuota(input.user_id, input.plan_id || input.plan || "free");
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
    this.repository.saveProject(project);
    for (const source of defaultSources(project, input.sources || [])) {
      this.upsertSource(project.project_id, source);
    }
    return this.projectWithSummary(project);
  }

  getProject(projectId) {
    return this.projectWithSummary(this.requireProject(projectId));
  }

  deleteProject(projectId) {
    const project = this.requireProject(projectId);
    const deleted = { sources: 0, build_jobs: 0, artifacts: 0, feedback: 0, consents: 0 };
    for (const [id, source] of this.repository.sources) if (source.project_id === projectId) { this.repository.sources.delete(id); deleted.sources += 1; }
    for (const [id, job] of this.repository.buildJobs) if (job.project_id === projectId) { this.repository.buildJobs.delete(id); deleted.build_jobs += 1; }
    for (const [id, artifact] of this.repository.artifacts) if (artifact.project_id === projectId) { this.repository.artifacts.delete(id); deleted.artifacts += 1; }
    const feedbackIds = new Set();
    for (const [id, feedback] of this.repository.feedback) if (feedback.project_id === projectId) { feedbackIds.add(feedback.feedback_id); this.repository.feedback.delete(id); deleted.feedback += 1; }
    for (const [id, consent] of this.repository.consents) if (feedbackIds.has(consent.feedback_id)) { this.repository.consents.delete(id); deleted.consents += 1; }
    this.repository.projects.delete(projectId);
    this.repository.persist?.();
    return { project_id: project.project_id, deleted };
  }

  listProjects(query = {}) {
    return this.repository.listProjects({ user_id: query.user_id || query.userId || "" })
      .map((project) => this.projectWithSummary(project));
  }

  updateProject(projectId, input = {}) {
    const project = this.requireProject(projectId);
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
    return this.projectWithSummary(this.repository.saveProject(next));
  }

  listSources(projectId) {
    this.requireProject(projectId);
    return this.repository.listSources(projectId).map(maskSourceContent);
  }

  searchSources(projectId, input = {}) {
    this.requireProject(projectId);
    const query = String(input.query || "").toLocaleLowerCase("de-DE");
    const currentPath = String(input.current_path || "");
    const sourceKind = normalizeSourceKind(input.source_kind);
    const limit = Math.max(1, Math.min(8, Number(input.limit) || 6));
    const terms = [...new Set(query.match(/[\p{L}\p{N}_-]{3,}/gu) || [])]
      .filter((term) => !SOURCE_SEARCH_STOP_WORDS.has(term));
    return this.repository.listSources(projectId)
      .filter((source) => !sourceKind || sourceMatchesKind(source.path, sourceKind))
      .map((source) => ({ source, score: sourceSearchScore(source, terms, currentPath) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.source.path.localeCompare(right.source.path))
      .slice(0, limit)
      .map((item) => item.source);
  }

  getSource(projectId, sourcePath) {
    this.requireProject(projectId);
    const source = this.repository.findSource(projectId, sourcePath);
    if (!source) throw new ProjectServerError("source_not_found", "Projektquelle wurde nicht gefunden.", 404);
    return source;
  }

  upsertSource(projectId, input = {}) {
    const project = this.requireProject(projectId);
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
    this.repository.saveSource(source);
    this.touchProject(projectId);
    return source;
  }

  createBuildJob(projectId, input = {}) {
    const project = this.requireProject(projectId);
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
      result: null,
      error: null,
    };
    return this.repository.saveBuildJob(job);
  }

  getBuildJob(jobId) {
    const job = this.repository.findBuildJob(jobId);
    if (!job) throw new ProjectServerError("build_job_not_found", "BuildJob wurde nicht gefunden.", 404);
    return job;
  }

  listBuildJobs(query = {}) {
    return this.repository.listBuildJobs({
      project_id: query.project_id || query.projectId || "",
      user_id: query.user_id || query.userId || "",
    });
  }

  createBuildPackage(jobId) {
    const job = this.getBuildJob(jobId);
    const project = this.requireProject(job.project_id);
    const sources = this.repository.listSources(project.project_id);
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

  markBuildSubmitted(jobId, input = {}) {
    const job = this.getBuildJob(jobId);
    const next = {
      ...job,
      status: "submitted",
      build_deploy_job_id: input.build_deploy_job_id || input.job_id || job.build_job_id,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return this.repository.saveBuildJob(next);
  }

  recordBuildResult(jobId, input = {}) {
    const job = this.getBuildJob(jobId);
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
    this.repository.saveBuildJob(next);
    for (const artifact of input.artifacts || []) {
      this.repository.saveArtifact({
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

  listArtifacts(query = {}) {
    return this.repository.listArtifacts({
      project_id: query.project_id || query.projectId || "",
      build_job_id: query.build_job_id || query.buildJobId || "",
    });
  }

  createFeedback(input = {}) {
    const project = this.requireProject(required(input.project_id, "project_id"));
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
    return redactFeedback(this.repository.saveFeedback(feedback));
  }

  listFeedback(query = {}) {
    return this.repository.listFeedback({
      project_id: query.project_id || query.projectId || "",
      user_id: query.user_id || query.userId || "",
    }).map((feedback) => redactFeedback(feedback, this.repository.findFeedbackConsent(feedback.feedback_id)));
  }

  createFeedbackConsent(feedbackId, input = {}) {
    const feedback = this.requireFeedback(feedbackId);
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

  anonymizeExpiredFeedback(at = new Date()) {
    const updated = [];
    for (const feedback of this.repository.listFeedback()) {
      if (feedback.anonymized_at || new Date(feedback.anonymize_after).getTime() > at.getTime()) continue;
      const anonymized = {
        ...feedback,
        user_id: "anonymous",
        contact_email: "",
        contact_mode: "no_contact",
        anonymized_at: at.toISOString(),
      };
      updated.push(redactFeedback(this.repository.saveFeedback(anonymized)));
    }
    return updated;
  }

  projectWithSummary(project) {
    return {
      ...sanitizeProject(project),
      source_count: this.repository.listSources(project.project_id).length,
      build_count: this.repository.listBuildJobs({ project_id: project.project_id }).length,
    };
  }

  resourceSummary() {
    const policies = this.repository.listResourcePolicies();
    const byAccount = new Map();
    for (const project of this.repository.listProjects()) {
      const entry = byAccount.get(project.user_id) || { account_id: project.user_id, plan_id: project.plan_id || "free", projects: 0, storage_bytes: 0 };
      entry.projects += 1;
      entry.storage_bytes += this.projectStorageBytes(project.project_id);
      byAccount.set(project.user_id, entry);
    }
    return { policies, accounts: Array.from(byAccount.values()).sort((a, b) => b.storage_bytes - a.storage_bytes) };
  }

  updateResourcePolicy(planId, input = {}) {
    const current = this.policyFor(planId);
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

  ensureResourcePolicies() {
    const existing = new Map(this.repository.listResourcePolicies().map((policy) => [policy.plan_id, policy]));
    for (const policy of defaultResourcePolicies()) {
      const current = existing.get(policy.plan_id);
      if (!current) { this.repository.saveResourcePolicy(policy); continue; }
      // Migration bisheriger Premium-Vorgaben auf die beschlossene grosszuegige Missbrauchsgrenze.
      if (["premium", "premium_demo"].includes(policy.plan_id) && [null, 50].includes(current.max_projects)) {
        this.repository.saveResourcePolicy({ ...current, max_projects: 200, updated_at: new Date().toISOString() });
      }
    }
  }

  policyFor(planId) {
    const normalized = String(planId || "free").toLowerCase();
    return this.repository.listResourcePolicies().find((item) => item.plan_id === normalized)
      || this.repository.listResourcePolicies().find((item) => item.plan_id === "free")
      || defaultResourcePolicies()[0];
  }

  assertProjectQuota(userId, planId) {
    const policy = this.policyFor(planId);
    if (policy.max_projects !== null && this.repository.listProjects({ user_id: userId }).length >= policy.max_projects) {
      throw new ProjectServerError("project_quota_exceeded", `Maximal ${policy.max_projects} Projekte fuer den Plan ${policy.plan_id}.`, 409);
    }
  }

  assertStorageQuota(project, sourcePath, content, planId) {
    const policy = this.policyFor(planId);
    const existing = this.repository.findSource(project.project_id, sourcePath);
    const nextBytes = this.projectStorageBytes(project.project_id) - Buffer.byteLength(existing?.content || "", "utf8") + Buffer.byteLength(content, "utf8");
    if (policy.max_storage_bytes !== null && nextBytes > policy.max_storage_bytes) {
      throw new ProjectServerError("storage_quota_exceeded", `Speicherlimit von ${policy.max_storage_bytes} Bytes fuer den Plan ${policy.plan_id} erreicht.`, 413);
    }
  }

  projectStorageBytes(projectId) {
    return this.repository.listSources(projectId).reduce((sum, source) => sum + Buffer.byteLength(source.content || "", "utf8"), 0);
  }

  touchProject(projectId) {
    const project = this.requireProject(projectId);
    this.repository.saveProject({ ...project, updated_at: new Date().toISOString() });
  }

  requireProject(projectId) {
    const project = this.repository.findProject(projectId);
    if (!project) throw new ProjectServerError("project_not_found", "Projekt wurde nicht gefunden.", 404);
    return project;
  }

  requireFeedback(feedbackId) {
    const feedback = this.repository.findFeedback(feedbackId);
    if (!feedback) throw new ProjectServerError("feedback_not_found", "Feedback wurde nicht gefunden.", 404);
    return feedback;
  }
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
