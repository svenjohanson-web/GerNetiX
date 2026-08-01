const crypto = require("node:crypto");
const { ProjectServerError } = require("../errors");
const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../modules/esp32-basissoftware-package");
const { normalizeBasissoftwareConfiguration } = require("../../../shared/basissoftware-configuration");
const { normalizeProjectCommunicationSetup } = require("../../../shared/project-communication-setup");
const { renderPlatformioIni } = require("../../../shared/platformio-config");
const { filterSoftwareUnitsForArchitecture } = require("../../../shared/project-software-ownership");
const { createFirmwareBuildPackageContract, firmwareSoftwareUnitProblems } = require("../../../shared/firmware-project-contract");

const RESERVED_PLATFORMIO_OPTIONS = new Set([
  "platform", "board", "framework", "monitor_speed", "upload_protocol", "upload_speed",
  "board_build.flash_size", "board_upload.flash_size", "board_upload.maximum_size",
  "board_upload.maximum_ram_size", "board_build.partitions", "lib_deps", "build_flags",
]);

class ProjectService {
  constructor(options) {
    this.repository = options.repository;
    this.loadEsp32BasissoftwareFiles = options.loadEsp32BasissoftwareFiles || loadEsp32BasissoftwareFiles;
    this.ready = this.ensureResourcePolicies();
  }

  async createProject(input = {}) {
    await this.ready;
    const template = input.template_project_id ? await this.requireProject(input.template_project_id) : null;
    if (template && template.status !== "template") throw new ProjectServerError("project_template_required", "Die Projektquelle ist kein unveränderliches Template.", 409);
    if (input.status !== "template") await this.assertProjectQuota(input.user_id, input.plan_id || input.plan || "free");
    const now = new Date().toISOString();
    const templateSources = template ? await this.repository.listSources(template.project_id) : [];
    const templateHash = template ? projectVersionHash(sanitizeProject(template), templateSources) : "";
    const inheritedManifest = template ? structuredClone(template.view_manifest || {}) : {};
    const inheritedBuildConfig = Object.hasOwn(input, "build_config") ? input.build_config : template ? template.build_config : undefined;
    const initialInputSources = input.sources?.length ? input.sources : templateSources;
    const inferredEntrypoint = inferFirmwareEntrypoint(initialInputSources);
    const normalizedBuildConfig = normalizeBuildConfig(inheritedBuildConfig && inferredEntrypoint && !inheritedBuildConfig.user_source_path
      ? { ...inheritedBuildConfig, user_source_path: inferredEntrypoint }
      : inheritedBuildConfig);
    const normalizedManifest = normalizeViewManifest({
      ...inheritedManifest,
      ...(input.view_manifest || input.project_view_manifest || {}),
      ...(template ? { template_ref: { project_id: template.project_id, version: template.view_manifest?.template_ref?.version || 1, source_sha256: templateHash } } : {}),
    });
    const softwareUnits = filterSoftwareUnitsForArchitecture(normalizeSoftwareUnits(
      Object.hasOwn(input, "software_units") ? input.software_units : template?.software_units,
      normalizedBuildConfig,
    ), normalizedManifest);
    const sourceLayoutMappings = softwareLayoutMappings(
      Object.hasOwn(input, "software_units") ? input.software_units || [] : template?.software_units || [],
      softwareUnits,
    );
    const activeSoftwareUnitId = activeSoftwareUnitIdFor(
      input.active_software_unit_id || template?.active_software_unit_id,
      softwareUnits,
    );
    const activeSoftwareUnit = softwareUnits.find((unit) => unit.software_unit_id === activeSoftwareUnitId) || null;
    const project = {
      project_id: input.project_id || createId("project"),
      user_id: required(input.user_id, "user_id"),
      plan_id: String(input.plan_id || input.plan || "free").toLowerCase(),
      title: required(input.title, "title"),
      description: input.description || "",
      learning_project_id: input.learning_project_id || "",
      hardware_profile_id: input.hardware_profile_id || "hardware.processor_board.generic_esp_wroom32",
      device_id: input.device_id || null,
      build_config: activeSoftwareUnit?.build_config || normalizedBuildConfig,
      software_units: softwareUnits,
      active_software_unit_id: activeSoftwareUnitId,
      view_manifest: remapSoftwarePathValues(normalizedManifest, sourceLayoutMappings),
      status: input.status || "active",
      created_at: now,
      updated_at: now,
    };
    await this.repository.saveProject(project);
    const initialSources = (input.sources?.length ? input.sources : templateSources)
      .map((source) => ({ ...source, path: remapSoftwareSourcePath(source.path, sourceLayoutMappings) }));
    for (const source of defaultSources(project, initialSources)) {
      if (project.status === "template") {
        const sourcePath = normalizeSourcePath(required(source.path, "path"));
        const content = String(source.content || "");
        await this.repository.saveSource({ project_id: project.project_id, path: sourcePath, content, content_sha256: sha256(content), content_type: source.content_type || contentType(sourcePath), role: source.role || inferSourceRole(sourcePath), updated_at: now });
      } else await this.upsertSource(project.project_id, source);
    }
    if (project.status !== "template") await this.syncPlatformioSources(project);
    return this.projectWithSummary(project);
  }

  async getProject(projectId) {
    await this.ready;
    return this.projectWithSummary(await this.requireProject(projectId));
  }

  async deleteProject(projectId) {
    await this.ready;
    const project = await this.requireProject(projectId);
    if (project.status === "template") throw new ProjectServerError("project_template_immutable", "Projekt-Templates dürfen nicht gelöscht werden.", 409);
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
    if (project.status === "template") throw new ProjectServerError("project_template_immutable", "Projekt-Templates dürfen nicht verändert werden.", 409);
    const nextViewManifest = input.view_manifest || input.project_view_manifest
      ? normalizeViewManifest(input.view_manifest || input.project_view_manifest)
      : project.view_manifest;
    let softwareUnits = filterSoftwareUnitsForArchitecture(
      normalizeSoftwareUnits(project.software_units, project.build_config),
      nextViewManifest,
    );
    let activeSoftwareUnitId = activeSoftwareUnitIdFor(
      input.active_software_unit_id || project.active_software_unit_id,
      softwareUnits,
    );
    if (Object.hasOwn(input, "software_units")) {
      softwareUnits = filterSoftwareUnitsForArchitecture(normalizeSoftwareUnits(input.software_units, null), nextViewManifest);
      activeSoftwareUnitId = activeSoftwareUnitIdFor(input.active_software_unit_id || activeSoftwareUnitId, softwareUnits);
    }
    let buildConfig = Object.hasOwn(input, "build_config")
      ? normalizeBuildConfig(input.build_config ? { ...(project.build_config || {}), ...input.build_config } : null)
      : softwareUnits.find((unit) => unit.software_unit_id === activeSoftwareUnitId)?.build_config || project.build_config;
    if (Object.hasOwn(input, "build_config") && softwareUnits.length) {
      softwareUnits = softwareUnits.map((unit) => unit.software_unit_id === activeSoftwareUnitId
        ? { ...unit, build_config: buildConfig }
        : unit);
    }
    if (Object.hasOwn(input, "software_units") || Object.hasOwn(input, "active_software_unit_id")) {
      buildConfig = softwareUnits.find((unit) => unit.software_unit_id === activeSoftwareUnitId)?.build_config || null;
    }
    const next = {
      ...project,
      title: input.title || project.title,
      description: input.description === undefined ? project.description : input.description,
      hardware_profile_id: input.hardware_profile_id || project.hardware_profile_id,
      device_id: input.device_id === undefined ? project.device_id : input.device_id,
      build_config: buildConfig,
      software_units: softwareUnits,
      active_software_unit_id: activeSoftwareUnitId,
      view_manifest: nextViewManifest,
      status: input.status || project.status,
      updated_at: new Date().toISOString(),
    };
    const saved = await this.repository.saveProject(next);
    await this.syncPlatformioSources(saved);
    return this.projectWithSummary(saved);
  }

  async syncPlatformioSources(project) {
    const units = softwareUnitsForProject(project).filter(isPlatformioSoftwareUnit);
    const expectedPaths = new Set(units.map((unit) => [unit.source_root, "platformio.ini"].filter(Boolean).join("/")));
    const activeRoots = units.map((unit) => String(unit.source_root || "").replace(/\/$/, "")).filter(Boolean);
    const generatedRoles = new Set(["build_config", "device_board_config", "device_sensor_input_config", "device_actuator_output_config", "device_measurement_circuit_config"]);
    const existingSources = await this.repository.listSources(project.project_id);
    for (const source of existingSources) {
      const belongsToActiveRoot = activeRoots.some((root) => source.path === root || source.path.startsWith(`${root}/`));
      const stalePlatformio = source.role === "build_config" && /(^|\/)platformio\.ini$/.test(source.path) && !expectedPaths.has(source.path);
      const staleGeneratedComponentSource = generatedRoles.has(source.role) && source.path.startsWith("Komponenten/") && !belongsToActiveRoot;
      if (stalePlatformio || staleGeneratedComponentSource) await this.repository.deleteSource(project.project_id, source.path);
    }
    for (const unit of units) {
      const content = renderPlatformioIni(unit.build_config);
      const now = new Date().toISOString();
      const sourcePath = [unit.source_root, "platformio.ini"].filter(Boolean).join("/");
      await this.repository.saveSource({
        project_id: project.project_id,
        path: sourcePath,
        content,
        content_sha256: sha256(content),
        content_type: "text/plain",
        role: "build_config",
        updated_at: now,
      });
    }
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
    if (project.status === "template") throw new ProjectServerError("project_template_immutable", "Template-Quellen dürfen nicht verändert werden.", 409);
    const requestedPath = normalizeSourcePath(required(input.path, "path"));
    const path = remapSoftwareSourcePath(requestedPath, softwareLayoutMappings([], project.software_units || []));
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
    const softwareUnits = softwareUnitsForProject(project);
    const requestedSoftwareUnitId = String(input.software_unit_id || project.active_software_unit_id || "").trim();
    const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === requestedSoftwareUnitId)
      || (!requestedSoftwareUnitId ? softwareUnits[0] : null);
    if (requestedSoftwareUnitId && !softwareUnit) {
      throw new ProjectServerError("software_unit_not_found", "Die gewählte Softwareeinheit gehört nicht zu diesem Projekt.", 404);
    }
    if (softwareUnit && !isPlatformioSoftwareUnit(softwareUnit)) {
      throw new ProjectServerError("software_unit_builder_not_supported", `Das Build-System ${softwareUnit.build_system} ist noch nicht an einen Build-Runner angebunden.`, 409);
    }
    const buildConfig = softwareUnit?.build_config || project.build_config;
    if (!buildConfig) {
      throw new ProjectServerError("project_not_buildable", "Projekt besitzt keine Build-Konfiguration und kann nicht gebaut werden.", 400);
    }
    const job = {
      build_job_id: input.build_job_id || createId("build_job"),
      project_id: project.project_id,
      user_id: project.user_id,
      mode,
      status: "created",
      build_deploy_job_id: null,
      device_id: input.device_id || softwareUnit?.device_id || project.device_id || null,
      software_unit_id: softwareUnit?.software_unit_id || "",
      software_unit: softwareUnit ? structuredClone(softwareUnit) : null,
      created_at: now,
      updated_at: now,
      submitted_at: null,
      finished_at: null,
      build_config: { ...buildConfig },
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
    const softwareUnits = softwareUnitsForProject(project);
    const softwareUnit = job.software_unit
      || softwareUnits.find((unit) => unit.software_unit_id === job.software_unit_id)
      || softwareUnits[0]
      || null;
    const allSources = await this.repository.listSources(project.project_id);
    const sources = sourcesForSoftwareUnit(allSources, softwareUnit, softwareUnits);
    const buildConfig = job.build_config || softwareUnit?.build_config || project.build_config;
    const contractProblems = firmwareSoftwareUnitProblems(softwareUnit, sources.map((source) => source.path), {
      pathsAreScoped: true,
      requireEntrypointSource: true,
      allowLegacyHeaders: true,
    });
    if (contractProblems.length) {
      throw new ProjectServerError(
        "invalid_firmware_project_contract",
        `Firmware-Projektstruktur ist nicht buildfaehig: ${contractProblems.join("; ")}`,
      );
    }
    const projectSnapshot = sanitizeProject(project);
    const snapshotHash = projectVersionHash(projectSnapshot, sources);
    await this.repository.saveBuildJob({
      ...job,
      project_snapshot: projectSnapshot,
      source_snapshot: sources,
      snapshot_sha256: snapshotHash,
      updated_at: new Date().toISOString(),
    });
    const firmwareSources = buildConfig?.firmware_basis_id === "gernetix-runtime-basissoftware"
      ? composeEsp32BasissoftwarePackage({
          basisFiles: this.loadEsp32BasissoftwareFiles(),
          projectSources: sources,
          buildConfig,
        })
      : sources;
    const platformioIni = renderPlatformioIni(buildConfig);
    const buildJob = {
      job_id: job.build_job_id,
      project_id: project.project_id,
      user_id: project.user_id,
      mode: job.mode,
      device_id: job.device_id,
      software_unit_id: softwareUnit?.software_unit_id || "",
      software_unit_title: softwareUnit?.title || "Firmware",
      build_config: buildConfig,
      created_at: new Date().toISOString(),
    };
    const packageFiles = [
      { path: "build-job.json", content: JSON.stringify(buildJob, null, 2), content_type: "application/json" },
      { path: "project-view-manifest.json", content: JSON.stringify(effectiveViewManifest(project), null, 2), content_type: "application/json" },
      { path: "platformio.ini", content: platformioIni, content_type: "text/plain" },
      ...firmwareSources.filter((source) => source.path !== "platformio.ini").map((source) => ({
        path: source.path,
        content: source.content,
        content_type: source.content_type,
        sha256: source.content_sha256,
      })),
    ];
    return {
      package_id: `pkg_${job.build_job_id}`,
      project: sanitizeProject(project),
      build_job: buildJob,
      platformio_ini: platformioIni,
      contract: createFirmwareBuildPackageContract({ softwareUnit, buildConfig, packageFiles: packageFiles.map((file) => file.path) }),
      files: packageFiles,
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
      software_units: snapshot.software_units ?? project.software_units,
      active_software_unit_id: snapshot.active_software_unit_id ?? project.active_software_unit_id,
      view_manifest: snapshot.view_manifest ?? project.view_manifest,
      status: snapshot.status || project.status,
      updated_at: new Date().toISOString(),
    });
    const restored = await this.createVersionRecord(projectId, {
      user_id: required(input.user_id, "user_id"),
      message: input.message || `Wiederhergestellt aus ${version.message || version.version_id}`,
    }, {
      parent_version_id: preservedVersion?.version_id || versions[0]?.version_id || null,
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
    let project = await this.repository.findProject(projectId);
    if (!project) throw new ProjectServerError("project_not_found", "Projekt wurde nicht gefunden.", 404);
    project = await this.ensureComponentSoftwareLayout(project);
    return project;
  }

  async ensureComponentSoftwareLayout(project) {
    const previousUnits = Array.isArray(project.software_units) ? project.software_units : [];
    const softwareUnits = normalizeSoftwareUnits(previousUnits, project.build_config || null);
    const activeSoftwareUnitId = activeSoftwareUnitIdFor(project.active_software_unit_id, softwareUnits);
    const buildConfig = softwareUnits.find((unit) => unit.software_unit_id === activeSoftwareUnitId)?.build_config || project.build_config || null;
    const mappings = softwareLayoutMappings(previousUnits, softwareUnits);
    const changed = JSON.stringify(previousUnits) !== JSON.stringify(softwareUnits)
      || JSON.stringify(project.build_config || null) !== JSON.stringify(buildConfig);
    const sources = await this.repository.listSources(project.project_id);
    const obsoletePaths = obsoleteIotComponentPlaceholderPaths(softwareUnits);
    const hasObsoleteSources = sources.some((source) => {
      const targetPath = remapSoftwareSourcePath(source.path, mappings);
      return obsoletePaths.has(source.path) || obsoletePaths.has(targetPath);
    });
    if (!changed && !mappings.length && !hasObsoleteSources) return project;

    const existingPaths = new Set(sources.map((source) => source.path));
    for (const source of sources) {
      const targetPath = remapSoftwareSourcePath(source.path, mappings);
      if (obsoletePaths.has(source.path) || obsoletePaths.has(targetPath)) {
        await this.repository.deleteSource(project.project_id, source.path);
        existingPaths.delete(source.path);
        if (targetPath !== source.path && existingPaths.has(targetPath)) {
          await this.repository.deleteSource(project.project_id, targetPath);
          existingPaths.delete(targetPath);
        }
        continue;
      }
      if (!targetPath || targetPath === source.path) continue;
      if (!existingPaths.has(targetPath)) {
        await this.repository.saveSource({ ...source, path: targetPath });
        existingPaths.add(targetPath);
      }
      await this.repository.deleteSource(project.project_id, source.path);
    }
    if (!changed && !mappings.length) return project;
    const migrated = {
      ...project,
      software_units: softwareUnits,
      active_software_unit_id: activeSoftwareUnitId,
      build_config: buildConfig,
      view_manifest: remapSoftwarePathValues(project.view_manifest || {}, mappings),
    };
    return this.repository.saveProject(migrated);
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
  const platform = input.platform || "espressif32";
  return {
    platform,
    framework: input.framework === undefined ? "arduino" : input.framework,
    board: input.board || "esp32dev",
    environment: input.environment || "esp32dev",
    libraries: input.libraries || [],
    monitor_speed: positiveInteger(input.monitor_speed ?? input.monitorSpeed) || 115200,
    upload_speed: positiveInteger(input.upload_speed ?? input.uploadSpeed),
    upload_protocol: safeSingleLine(input.upload_protocol ?? input.uploadProtocol),
    build_flags: safeStringList(input.build_flags),
    maximum_program_size_bytes: positiveInteger(input.maximum_program_size_bytes),
    maximum_ram_size_bytes: positiveInteger(input.maximum_ram_size_bytes),
    partition_file: safeSingleLine(input.partition_file),
    platformio_options: normalizePlatformioOptions(input.platformio_options),
    firmware_basis_id: firmwareBasisId,
    firmware_basis_version: input.firmware_basis_version || "",
    firmware_basis_variant: input.firmware_basis_variant === "comfort" ? "full" : input.firmware_basis_variant || (firmwareBasisId ? "full" : ""),
    partition_profile_id: input.partition_profile_id || "",
    flash_size_mb: positiveInteger(input.flash_size_mb) || (/^espressif(32|8266)$/i.test(platform) ? 4 : 0),
    user_source_path: input.user_source_path || "",
    user_target_path: input.user_target_path || "",
    component_device_allocations: Array.isArray(input.component_device_allocations)
      ? input.component_device_allocations.map((item) => ({ ...item })).filter((item) => item.component_path && item.device_id)
      : [],
    component_features: normalizeComponentFeatures(input.component_features, input.firmware_basis_variant === "comfort" ? "full" : input.firmware_basis_variant || (firmwareBasisId ? "full" : "")),
    basissoftware_configuration: firmwareBasisId ? normalizeBasissoftwareConfiguration(input.basissoftware_configuration) : null,
    component_hardware_features: input.component_hardware_features && typeof input.component_hardware_features === "object"
      ? JSON.parse(JSON.stringify(input.component_hardware_features))
      : {},
    board_configuration: normalizeBoardConfiguration(input.board_configuration),
  };
}

function normalizeSoftwareUnits(input, fallbackBuildConfig = null) {
  const rawUnits = Array.isArray(input) ? input : [];
  if (!rawUnits.length) {
    return fallbackBuildConfig ? [{
      software_unit_id: "firmware",
      title: "Firmware",
      software_kind: "embedded_firmware",
      build_system: "platformio",
      source_root: "Komponenten/IoT-Device 1",
      entrypoint: componentRelativeSourcePath(defaultUserSourcePath(fallbackBuildConfig), "", "Komponenten/IoT-Device 1"),
      device_id: "",
      build_config: normalizeSoftwareUnitBuildConfig(fallbackBuildConfig, "", "Komponenten/IoT-Device 1"),
    }] : [];
  }
  const seen = new Set();
  let embeddedIndex = 0;
  return rawUnits.slice(0, 40).map((unit, index) => {
    const candidate = String(unit?.software_unit_id || unit?.id || `software_${index + 1}`)
      .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || `software_${index + 1}`;
    let softwareUnitId = candidate;
    for (let suffix = 2; seen.has(softwareUnitId); suffix += 1) softwareUnitId = `${candidate}_${suffix}`.slice(0, 80);
    seen.add(softwareUnitId);
    const buildSystem = String(unit?.build_system || (unit?.build_config ? "platformio" : "none")).trim().toLowerCase().slice(0, 40);
    const previousSourceRoot = normalizeOptionalSourcePath(unit?.source_root || "").replace(/\/$/, "");
    const embedded = String(unit?.software_kind || "") === "embedded_firmware" || buildSystem === "platformio";
    if (embedded) embeddedIndex += 1;
    const sourceRoot = componentSoftwareRoot(unit, embedded ? embeddedIndex : index + 1, previousSourceRoot);
    return {
      software_unit_id: softwareUnitId,
      title: String(unit?.title || `Software ${index + 1}`).trim().slice(0, 120),
      software_kind: String(unit?.software_kind || "software").trim().toLowerCase().slice(0, 60),
      build_system: buildSystem,
      source_root: sourceRoot,
      entrypoint: componentRelativeSourcePath(unit?.entrypoint || defaultUserSourcePath(unit?.build_config), previousSourceRoot, sourceRoot),
      device_id: String(unit?.device_id || "").trim().slice(0, 180),
      hardware_profile_id: String(unit?.hardware_profile_id || "").trim().slice(0, 180),
      build_config: buildSystem === "platformio" && unit?.build_config
        ? normalizeSoftwareUnitBuildConfig(unit.build_config, previousSourceRoot, sourceRoot)
        : null,
      build_configuration: buildSystem === "platformio" || !unit?.build_configuration
        ? null
        : JSON.parse(JSON.stringify(unit.build_configuration)),
    };
  });
}

function componentSoftwareRoot(unit, index, previousSourceRoot = "") {
  const embedded = String(unit?.software_kind || "") === "embedded_firmware" || String(unit?.build_system || "") === "platformio";
  const existingComponent = String(previousSourceRoot).match(/^(Komponenten\/[^/]+)/)?.[1];
  if (embedded && (!existingComponent || /^Komponenten\/IoT-Device(?:[ -]|$)/i.test(existingComponent))) {
    return `Komponenten/IoT-Device ${index}`;
  }
  if (existingComponent) return existingComponent;
  if (embedded) return `Komponenten/IoT-Device ${index}`;
  const label = String(unit?.title || unit?.software_unit_id || `Software ${index}`)
    .trim().replace(/[^A-Za-z0-9ÄÖÜäöüß._ -]+/g, "-").replace(/\s+/g, " ").slice(0, 100) || `Software ${index}`;
  return `Komponenten/${label}`;
}

function componentRelativeSourcePath(value, previousSourceRoot, componentRoot) {
  let sourcePath = normalizeOptionalSourcePath(value || "");
  for (const prefix of [previousSourceRoot, componentRoot].filter(Boolean)) {
    if (sourcePath.startsWith(`${prefix}/`)) sourcePath = sourcePath.slice(prefix.length + 1);
  }
  sourcePath = sourcePath.replace(/^Komponenten\/[^/]+\//, "");
  return sourcePath;
}

function normalizeSoftwareUnitBuildConfig(input, previousSourceRoot, componentRoot) {
  const buildConfig = normalizeBuildConfig(input);
  if (!buildConfig) return null;
  return {
    ...buildConfig,
    user_source_path: componentRelativeSourcePath(defaultUserSourcePath(buildConfig), previousSourceRoot, componentRoot),
  };
}

function defaultUserSourcePath(buildConfig = {}) {
  return buildConfig.user_source_path || (buildConfig.firmware_basis_id ? "src/user_main.cpp" : "src/main.cpp");
}

function inferFirmwareEntrypoint(sources = []) {
  const candidates = sources.map((source) => normalizeOptionalSourcePath(source?.path || ""));
  const preferred = candidates.find((sourcePath) => /(?:^|\/)src\/(?:user_)?main\.(?:c|cc|cpp|cxx|m|mm|ino|cu)$/i.test(sourcePath));
  if (!preferred) return "";
  const componentRelative = preferred.match(/^(?:Komponenten\/[^/]+\/)?(src\/.+)$/i);
  return componentRelative?.[1] || "";
}

function softwareLayoutMappings(previousUnits, softwareUnits) {
  return softwareUnits.map((unit, index) => ({
    from: normalizeOptionalSourcePath(previousUnits[index]?.source_root || "").replace(/\/$/, ""),
    to: unit.source_root,
  })).filter((mapping) => mapping.from !== mapping.to);
}

function obsoleteIotComponentPlaceholderPaths(softwareUnits) {
  const relativePaths = [
    "Schnittstellen/provided.md",
    "Schnittstellen/required.md",
    "Verhalten/Modell/modell.md",
    "Verhalten/Code/code.md",
  ];
  return new Set(softwareUnits
    .map((unit) => String(unit.source_root || "").replace(/\/$/, ""))
    .filter((root) => /^Komponenten\/IoT-Device \d+$/.test(root))
    .flatMap((root) => relativePaths.map((relativePath) => `${root}/${relativePath}`)));
}

function remapSoftwareSourcePath(sourcePath, mappings) {
  for (const mapping of mappings) {
    if (!mapping.from && sourcePath !== "platformio.ini" && !sourcePath.startsWith("src/")) continue;
    if (mapping.from && sourcePath !== mapping.from && !sourcePath.startsWith(`${mapping.from}/`)) continue;
    let relative = mapping.from ? sourcePath.slice(mapping.from.length).replace(/^\//, "") : sourcePath;
    relative = relative.replace(/^Komponenten\/[^/]+\//, "");
    return `${mapping.to}/${relative}`;
  }
  return sourcePath;
}

function remapSoftwarePathValues(value, mappings) {
  if (Array.isArray(value)) return value.map((item) => remapSoftwarePathValues(item, mappings));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapSoftwarePathValues(item, mappings)]));
  }
  return typeof value === "string" ? remapSoftwareSourcePath(value, mappings) : value;
}

function activeSoftwareUnitIdFor(requestedId, softwareUnits) {
  const requested = String(requestedId || "").trim();
  return softwareUnits.some((unit) => unit.software_unit_id === requested)
    ? requested
    : softwareUnits[0]?.software_unit_id || "";
}

function softwareUnitsForProject(project = {}) {
  return filterSoftwareUnitsForArchitecture(
    normalizeSoftwareUnits(project.software_units, project.build_config || null),
    project.view_manifest,
  );
}

function isPlatformioSoftwareUnit(unit) {
  return unit?.build_system === "platformio" && Boolean(unit.build_config);
}

function sourcesForSoftwareUnit(sources, selectedUnit, softwareUnits) {
  if (!selectedUnit) return sources;
  const sourceRoot = String(selectedUnit.source_root || "").replace(/\/$/, "");
  if (sourceRoot) {
    const prefix = `${sourceRoot}/`;
    const scoped = sources.filter((source) => source.path.startsWith(prefix)).map((source) => ({
      ...source,
      path: source.path.slice(prefix.length),
    }));
    const componentPrefixes = softwareUnits
      .map((unit) => String(unit.source_root || "").replace(/\/$/, ""))
      .filter(Boolean)
      .map((root) => `${root}/`);
    const sharedBuildSupport = sources.filter((source) => (
      !componentPrefixes.some((componentPrefix) => source.path.startsWith(componentPrefix))
      && !source.path.startsWith("Komponenten/")
      && !source.path.startsWith("src/")
      && source.path !== "platformio.ini"
      && !/^(?:Architektur|docs)\//i.test(source.path)
    ));
    return [...scoped, ...sharedBuildSupport];
  }
  const otherRoots = softwareUnits
    .filter((unit) => unit.software_unit_id !== selectedUnit.software_unit_id && unit.source_root)
    .map((unit) => `${String(unit.source_root).replace(/\/$/, "")}/`);
  return sources.filter((source) => !otherRoots.some((prefix) => source.path.startsWith(prefix)));
}

function positiveInteger(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : 0;
}

function safeSingleLine(value) {
  const normalized = String(value || "").trim();
  return /[\r\n]/.test(normalized) ? "" : normalized.slice(0, 240);
}

function safeStringList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(safeSingleLine)
    .filter(Boolean)))
    .slice(0, 100);
}

function normalizePlatformioOptions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).slice(0, 30)
    .map(([key, value]) => [String(key).trim(), safeSingleLine(value)])
    .filter(([key, value]) => /^[a-z][a-z0-9_.-]{0,79}$/i.test(key)
      && !RESERVED_PLATFORMIO_OPTIONS.has(key.toLowerCase())
      && value));
}

function normalizeBoardConfiguration(input = null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const features = {};
  for (const [featureId, raw] of Object.entries(input.board_features || {}).slice(0, 40)) {
    const id = String(featureId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    if (!id || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const pins = Object.fromEntries(Object.entries(raw.pins || {}).slice(0, 40)
      .map(([signal, pin]) => [String(signal).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60), Number(pin)])
      .filter(([signal, pin]) => signal && Number.isInteger(pin) && pin >= -1 && pin <= 255));
    features[id] = {
      enabled: raw.enabled === true,
      hardware: String(raw.hardware || "").slice(0, 100),
      driver: String(raw.driver || "").slice(0, 100),
      connection: String(raw.connection || "").slice(0, 100),
      pins,
      value: String(raw.value || "").slice(0, 100),
    };
  }
  return {
    schema_version: 1,
    source: ["catalog", "account", "project"].includes(input.source) ? input.source : "project",
    name: String(input.name || "").slice(0, 120),
    base_board_profile_id: String(input.base_board_profile_id || "").slice(0, 180),
    account_board_id: String(input.account_board_id || "").slice(0, 180),
    account_board_version: Number.isInteger(Number(input.account_board_version)) ? Number(input.account_board_version) : 0,
    board_features: features,
    snapshot_at: String(input.snapshot_at || input.saved_at || "").slice(0, 40),
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
  const communicationSetup = manifest.communication_setup || manifest.communicationSetup;
  return {
    schema_version: Number(manifest.schema_version || manifest.schemaVersion || 1),
    title: manifest.title || "",
    summary: manifest.summary || "",
    ...(templateId ? {
      template_id: templateId,
      template_ref: {
        template_id: String(templateRef.template_id || templateRef.templateId || templateId),
        model_schema_version: Number(templateRef.model_schema_version || templateRef.modelSchemaVersion || 1),
        ...(templateRef.project_id ? { project_id: String(templateRef.project_id) } : {}),
        ...(templateRef.version ? { version: Number(templateRef.version) } : {}),
        ...(templateRef.source_sha256 ? { source_sha256: String(templateRef.source_sha256) } : {}),
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
    ...(communicationSetup && typeof communicationSetup === "object"
      ? { communication_setup: normalizeProjectCommunicationSetup(communicationSetup) }
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
  if (Array.isArray(manifest.views) && manifest.views.length) return manifest;
  const fallback = defaultViewManifest(project);
  return { ...fallback, ...manifest, views: fallback.views };
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

function sanitizeProject(project) {
  const softwareUnits = softwareUnitsForProject(project);
  return {
    project_id: project.project_id,
    user_id: project.user_id,
    title: project.title,
    description: project.description,
    learning_project_id: project.learning_project_id,
    hardware_profile_id: project.hardware_profile_id,
    device_id: project.device_id,
    build_config: project.build_config,
    software_units: softwareUnits,
    active_software_unit_id: activeSoftwareUnitIdFor(project.active_software_unit_id, softwareUnits),
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
      software_units: projectSnapshot.software_units,
      active_software_unit_id: projectSnapshot.active_software_unit_id,
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
  if (/\.(?:h|hh|hpp|hxx|inc|inl|ipp|tpp|cuh)$/i.test(sourcePath)) return "text/x-c++hdr";
  if (/\.(?:c|cc|cpp|cxx|m|mm|ino|cu)$/i.test(sourcePath)) return "text/x-c++src";
  return "text/plain";
}

function inferSourceRole(sourcePath) {
  if (sourcePath === "platformio.ini") return "build_config";
  if (/(?:^|\/)include\//i.test(sourcePath) || /\.(?:h|hh|hpp|hxx|inc|inl|ipp|tpp|cuh)$/i.test(sourcePath)) return "header";
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
