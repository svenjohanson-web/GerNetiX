const crypto = require("node:crypto");
const { ProjectServerError } = require("../errors");
const { composeEsp32BasissoftwarePackage, loadEsp32BasissoftwareFiles } = require("../modules/esp32-basissoftware-package");
const {
  GENERATED_CONFIGURATION_ROLE,
  PROJECT_CONFIGURATION_ROLE,
  projectConfigurationSources,
} = require("../modules/project-configuration-projection");
const { normalizeBasissoftwareConfiguration } = require("../../../shared/basissoftware-configuration");
const { normalizeProjectCommunicationSetup } = require("../../../shared/project-communication-setup");
const { renderPlatformioIni } = require("../../../shared/platformio-config");
const { filterSoftwareUnitsForArchitecture } = require("../../../shared/project-software-ownership");
const { createFirmwareBuildPackageContract, firmwareSoftwareUnitProblems } = require("../../../shared/firmware-project-contract");
const { validateSha } = require("../repository-store/git-project-repository-store");
const { loadProjectFileSet, mimeTypeForPath, validateProjectChanges } = require("../repository-store/project-file-schema");
const { SqlCacheAccountStorageMeter } = require("./sql-cache-account-storage-meter");

const RESERVED_PLATFORMIO_OPTIONS = new Set([
  "platform", "board", "framework", "monitor_speed", "upload_protocol", "upload_speed",
  "board_build.flash_size", "board_upload.flash_size", "board_upload.maximum_size",
  "board_upload.maximum_ram_size", "board_build.partitions", "lib_deps", "build_flags",
]);

class ProjectService {
  constructor(options) {
    this.repository = options.repository;
    this.projectRepositoryStore = options.projectRepositoryStore || null;
    this.storageMeter = options.storageMeter || new SqlCacheAccountStorageMeter(this.repository);
    this.loadEsp32BasissoftwareFiles = options.loadEsp32BasissoftwareFiles || loadEsp32BasissoftwareFiles;
    this.ready = this.ensureResourcePolicies();
  }

  async createProject(input = {}) {
    await this.ready;
    const requestedStatus = normalizeProjectStatus(input.status || "active");
    if (requestedStatus === "plan_locked") {
      throw new ProjectServerError("project_status_managed", "Tarifgesperrte Projekte werden ausschließlich durch interne Tarifprozesse erzeugt.", 409);
    }
    const template = input.template_project_id ? await this.requireProject(input.template_project_id) : null;
    if (template && template.status !== "template") throw new ProjectServerError("project_template_required", "Die Projektquelle ist kein unveränderliches Template.", 409);
    if (requestedStatus !== "template") await this.assertProjectQuota(input.user_id, input.plan_id || input.plan || "free");
    const now = new Date().toISOString();
    const templateBinding = template ? this.activeRepositoryBinding(template) : null;
    const templateSources = template
      ? templateBinding ? await this.repositoryFiles(template, templateBinding.head_sha) : await this.repository.listSources(template.project_id)
      : [];
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
      ...(template ? { template_id: inheritedManifest.template_id || template.project_id, template_ref: {
        project_id: template.project_id,
        version: template.view_manifest?.template_ref?.version || 1,
        source_sha256: templateHash,
        ...(templateBinding ? { commit_sha: templateBinding.head_sha } : {}),
      } } : {}),
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
      status: requestedStatus,
      created_at: now,
      updated_at: now,
    };
    await this.repository.saveProject(project);
    let configurationProjection = emptyProjectionResult();
    try {
      const initialSources = (input.sources?.length ? input.sources : templateSources)
        .map((source) => ({ ...source, path: remapSoftwareSourcePath(source.path, sourceLayoutMappings) }));
      for (const source of defaultSources(project, initialSources)) {
        if (project.status === "template") {
          const sourcePath = normalizeSourcePath(required(source.path, "path"));
          const content = String(source.content || "");
          await this.repository.saveSource({ project_id: project.project_id, path: sourcePath, content, content_sha256: sha256(content), content_type: source.content_type || contentType(sourcePath), role: source.role || inferSourceRole(sourcePath), updated_at: now });
        } else await this.upsertSource(project.project_id, source);
      }
      if (project.status !== "template" || this.projectRepositoryStore) {
        const platformioProjection = await this.syncPlatformioSources(project);
        const projectProjection = await this.syncProjectConfigurationSources(project);
        configurationProjection = mergeProjectionResults(platformioProjection, projectProjection);
      }
    } catch (error) {
      if (error.code === "storage_quota_exceeded") await this.repository.deleteProject(project.project_id);
      throw error;
    }
    let persistedProject = project;
    if (this.projectRepositoryStore) {
      try {
        const repositorySources = await this.repository.listSources(project.project_id);
        loadProjectFileSet(repositorySources);
        const binding = await this.projectRepositoryStore.provisionProject({
          project_id: project.project_id,
          message: `Projekt ${project.title} angelegt`,
          changes: repositorySources.map((source) => ({ path: source.path, content: source.content })),
        });
        persistedProject = await this.repository.saveProject({ ...project, repository_binding: { ...binding, provisioned_at: now } });
      } catch (error) {
        await this.repository.saveProject({
          ...project,
          repository_binding: { provider: "forgejo", state: "failed", error_code: error.code || "repository_provision_failed", failed_at: new Date().toISOString() },
        });
        throw error;
      }
    }
    return { ...await this.projectWithSummary(persistedProject), configuration_projection: configurationProjection };
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
    this.assertProjectWritable(project);
    if (Object.hasOwn(input, "status") && normalizeProjectStatus(input.status) !== project.status) {
      throw new ProjectServerError("project_status_managed", "Der Projektstatus wird ausschließlich durch interne Tarif- und Template-Prozesse geändert.", 409);
    }
    if (this.activeRepositoryBinding(project)) validateSha(input.expected_head_sha, "expected_head_sha");
    this.assertExpectedRepositoryHead(project, input.expected_head_sha);
    const rollbackSources = await this.repository.listSources(projectId);
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
      status: project.status,
      updated_at: new Date().toISOString(),
    };
    let saved = await this.repository.saveProject(next);
    let platformioProjection;
    let projectProjection;
    let repositoryCommit = null;
    let repositoryCommitPushed = false;
    try {
      platformioProjection = await this.syncPlatformioSources(saved);
      projectProjection = await this.syncProjectConfigurationSources(saved);
      const projection = mergeProjectionResults(platformioProjection, projectProjection);
      repositoryCommit = await this.commitProjectedChanges(saved, projection, input.expected_head_sha, "Entwicklungskonfiguration aktualisiert");
      repositoryCommitPushed = Boolean(repositoryCommit && !repositoryCommit.no_change);
      if (repositoryCommit && !repositoryCommit.no_change) {
        saved = await this.repository.saveProject({
          ...saved,
          repository_binding: { ...saved.repository_binding, head_sha: repositoryCommit.head_sha, updated_at: new Date().toISOString() },
        });
      }
    } catch (error) {
      if (rollbackSources && !repositoryCommitPushed) await this.restoreSqlSourceCache(project, rollbackSources);
      if (repositoryCommitPushed) throw new ProjectServerError(
        "repository_metadata_sync_failed",
        "Git-Commit wurde geschrieben, aber seine SQL-Referenz konnte nicht aktualisiert werden.",
        503,
        { committed_head_sha: repositoryCommit.head_sha, cause: error.code || "sql_update_failed" },
      );
      throw error;
    }
    return {
      ...await this.projectWithSummary(saved),
      configuration_projection: mergeProjectionResults(platformioProjection, projectProjection),
      repository_commit: repositoryCommit,
    };
  }

  async setProjectPlanStatus(projectId, status) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const normalizedStatus = normalizeProjectStatus(status);
    if (project.status === "template" || normalizedStatus === "template") {
      throw new ProjectServerError("project_template_immutable", "Der Template-Status kann nicht durch eine Tariftransition geändert werden.", 409);
    }
    const saved = await this.repository.saveProject({
      ...project,
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    });
    return this.projectWithSummary(saved);
  }

  async syncPlatformioSources(project) {
    const result = emptyProjectionResult();
    const units = softwareUnitsForProject(project).filter(isPlatformioSoftwareUnit);
    const expectedPaths = new Set(units.map((unit) => [unit.source_root, "platformio.ini"].filter(Boolean).join("/")));
    const activeRoots = units.map((unit) => String(unit.source_root || "").replace(/\/$/, "")).filter(Boolean);
    const generatedRoles = new Set(["build_config", "device_board_config", "device_sensor_input_config", "device_actuator_output_config", "device_measurement_circuit_config"]);
    const existingSources = await this.repository.listSources(project.project_id);
    for (const source of existingSources) {
      const belongsToActiveRoot = activeRoots.some((root) => source.path === root || source.path.startsWith(`${root}/`));
      const stalePlatformio = source.role === "build_config" && /(^|\/)platformio\.ini$/.test(source.path) && !expectedPaths.has(source.path);
      const staleGeneratedComponentSource = generatedRoles.has(source.role) && source.path.startsWith("Komponenten/") && !belongsToActiveRoot;
      if (stalePlatformio || staleGeneratedComponentSource) {
        await this.repository.deleteSource(project.project_id, source.path);
        result.removed_paths.push(source.path);
      }
    }
    for (const unit of units) {
      const content = renderPlatformioIni(unit.build_config);
      const now = new Date().toISOString();
      const sourcePath = [unit.source_root, "platformio.ini"].filter(Boolean).join("/");
      await this.saveProjectedSource(project.project_id, {
        project_id: project.project_id,
        path: sourcePath,
        content,
        content_sha256: sha256(content),
        content_type: "text/plain",
        role: "build_config",
        updated_at: now,
      }, result);
    }
    return result;
  }

  async syncProjectConfigurationSources(project) {
    const result = emptyProjectionResult();
    const expectedSources = projectConfigurationSources(project);
    const expectedPaths = new Set(expectedSources.map((source) => source.path));
    const existingSources = await this.repository.listSources(project.project_id);
    for (const source of existingSources) {
      if (![PROJECT_CONFIGURATION_ROLE, GENERATED_CONFIGURATION_ROLE].includes(source.role)) continue;
      if (expectedPaths.has(source.path)) continue;
      await this.repository.deleteSource(project.project_id, source.path);
      result.removed_paths.push(source.path);
    }
    for (const source of expectedSources) {
      await this.saveProjectedSource(project.project_id, {
        ...source,
        project_id: project.project_id,
        content_sha256: sha256(source.content),
        updated_at: new Date().toISOString(),
      }, result);
    }
    return result;
  }

  async saveProjectedSource(projectId, source, result) {
    const existing = await this.repository.findSource(projectId, source.path);
    if (existing
      && existing.content_sha256 === source.content_sha256
      && existing.content_type === source.content_type
      && existing.role === source.role) {
      result.unchanged_paths.push(source.path);
      return existing;
    }
    const project = await this.repository.findProject(projectId);
    await this.assertStorageQuota(project, [{ path: source.path, content: source.content }]);
    await this.repository.saveSource(source);
    result.changed_paths.push(source.path);
    return source;
  }

  async listSources(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const binding = this.activeRepositoryBinding(project);
    if (binding) {
      const commitSha = validateSha(input.commit_sha || binding.head_sha, "commit_sha");
      const paths = await this.projectRepositoryStore.tree(binding, commitSha);
      return paths.map((sourcePath) => repositoryTreeSource(projectId, sourcePath, commitSha));
    }
    return (await this.repository.listSources(projectId)).map(maskSourceContent);
  }

  async searchSources(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const query = String(input.query || "").toLocaleLowerCase("de-DE");
    const currentPath = String(input.current_path || "");
    const sourceKind = normalizeSourceKind(input.source_kind);
    const limit = Math.max(1, Math.min(8, Number(input.limit) || 6));
    const terms = [...new Set(query.match(/[\p{L}\p{N}_-]{3,}/gu) || [])]
      .filter((term) => !SOURCE_SEARCH_STOP_WORDS.has(term));
    const binding = this.activeRepositoryBinding(project);
    const sources = binding ? await this.repositoryFiles(project, input.commit_sha) : await this.repository.listSources(projectId);
    return sources
      .filter((source) => !sourceKind || sourceMatchesKind(source.path, sourceKind))
      .map((source) => ({ source, score: sourceSearchScore(source, terms, currentPath) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.source.path.localeCompare(right.source.path))
      .slice(0, limit)
      .map((item) => item.source);
  }

  async getSource(projectId, sourcePath, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const binding = this.activeRepositoryBinding(project);
    if (binding) {
      const commitSha = validateSha(input.commit_sha || binding.head_sha, "commit_sha");
      const file = await this.projectRepositoryStore.readFile(binding, commitSha, normalizeSourcePath(sourcePath));
      return repositoryFileSource(projectId, file, commitSha);
    }
    const source = await this.repository.findSource(projectId, sourcePath);
    if (!source) throw new ProjectServerError("source_not_found", "Projektquelle wurde nicht gefunden.", 404);
    return source;
  }

  async upsertSource(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    this.assertProjectWritable(project);
    this.assertExpectedRepositoryHead(project, input.expected_head_sha);
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
    await this.assertStorageQuota(project, [{ path, content }]);
    let repositoryCommit = null;
    const binding = this.activeRepositoryBinding(project);
    if (binding) {
      validateSha(input.expected_head_sha, "expected_head_sha");
      await this.assertValidProjectFileChangeSet(project, binding, input.expected_head_sha, [{ path, content }]);
      repositoryCommit = await this.projectRepositoryStore.commitChanges(binding, {
        expected_head_sha: input.expected_head_sha,
        message: input.message || `Datei ${path} aktualisiert`,
        changes: [{ path, content }],
      });
    }
    await this.repository.saveSource(source);
    await this.repository.saveProject({
      ...project,
      ...(repositoryCommit && !repositoryCommit.no_change ? {
        repository_binding: { ...binding, head_sha: repositoryCommit.head_sha, updated_at: now },
      } : {}),
      updated_at: now,
    });
    return { ...source, repository_commit: repositoryCommit };
  }

  async commitRepositoryChanges(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    this.assertProjectWritable(project);
    const binding = this.activeRepositoryBinding(project);
    if (!binding) throw new ProjectServerError("repository_not_active", "Projekt besitzt kein aktives Forgejo-Repository.", 409);
    const expectedHeadSha = validateSha(input.expected_head_sha, "expected_head_sha");
    this.assertExpectedRepositoryHead(project, expectedHeadSha);
    const changes = validateProjectChanges(input.changes);
    await this.assertStorageQuota(project, changes);
    await this.assertValidProjectFileChangeSet(project, binding, expectedHeadSha, changes);
    const commit = await this.projectRepositoryStore.commitChanges(binding, {
      expected_head_sha: expectedHeadSha,
      message: input.message,
      changes,
    });
    const now = new Date().toISOString();
    for (const change of changes) {
      if (change.operation === "delete") {
        await this.repository.deleteSource(projectId, change.path);
        continue;
      }
      await this.repository.saveSource({
        project_id: projectId,
        path: change.path,
        content: change.content,
        content_sha256: sha256(change.content),
        content_type: contentType(change.path),
        role: inferSourceRole(change.path),
        updated_at: now,
      });
    }
    const saved = await this.repository.saveProject({
      ...project,
      repository_binding: { ...binding, head_sha: commit.head_sha, updated_at: now },
      updated_at: now,
    });
    return { project_id: projectId, repository_binding: publicRepositoryBinding(saved.repository_binding), commit };
  }

  async renameSource(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    this.assertProjectWritable(project);
    const binding = this.activeRepositoryBinding(project);
    if (!binding) throw new ProjectServerError("repository_not_active", "Umbenennen erfordert ein aktives Forgejo-Repository.", 409);
    const expectedHeadSha = validateSha(input.expected_head_sha, "expected_head_sha");
    this.assertExpectedRepositoryHead(project, expectedHeadSha);
    const fromPath = normalizeSourcePath(required(input.from_path, "from_path"));
    const toPath = normalizeSourcePath(required(input.to_path, "to_path"));
    if (fromPath === toPath) throw new ProjectServerError("repository_rename_no_change", "Quell- und Zielpfad sind identisch.", 409);
    const source = await this.projectRepositoryStore.readFile(binding, expectedHeadSha, fromPath);
    try {
      await this.projectRepositoryStore.readFile(binding, expectedHeadSha, toPath);
      throw new ProjectServerError("repository_rename_target_exists", "Der Zielpfad existiert bereits.", 409, { path: toPath });
    } catch (error) {
      if (error.code !== "repository_file_not_found") throw error;
    }
    return this.commitRepositoryChanges(projectId, {
      expected_head_sha: expectedHeadSha,
      message: input.message || `Datei ${fromPath} nach ${toPath} umbenannt`,
      changes: [{ path: fromPath, operation: "delete" }, { path: toPath, content: source.content }],
    });
  }

  async deleteSource(projectId, sourcePath, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    this.assertProjectWritable(project);
    const binding = this.activeRepositoryBinding(project);
    if (!binding) {
      const path = normalizeSourcePath(sourcePath);
      const deleted = await this.repository.deleteSource(projectId, path);
      if (!deleted) throw new ProjectServerError("source_not_found", "Projektquelle wurde nicht gefunden.", 404);
      return { project_id: projectId, path, deleted: true, repository_commit: null };
    }
    const expectedHeadSha = validateSha(input.expected_head_sha, "expected_head_sha");
    const path = normalizeSourcePath(sourcePath);
    await this.projectRepositoryStore.readFile(binding, expectedHeadSha, path);
    const result = await this.commitRepositoryChanges(projectId, {
      expected_head_sha: expectedHeadSha,
      message: input.message || `Datei ${path} gelöscht`,
      changes: [{ path, operation: "delete" }],
    });
    return { ...result, path, deleted: true };
  }

  async repositoryTree(projectId, commitSha = "") {
    await this.ready;
    const project = await this.requireProject(projectId);
    const binding = this.activeRepositoryBinding(project);
    if (!binding) throw new ProjectServerError("repository_not_active", "Projekt besitzt kein aktives Forgejo-Repository.", 409);
    const resolvedCommitSha = validateSha(commitSha || binding.head_sha, "commit_sha");
    return { commit_sha: resolvedCommitSha, paths: await this.projectRepositoryStore.tree(binding, resolvedCommitSha) };
  }

  async repositoryHistory(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const binding = this.activeRepositoryBinding(project);
    if (!binding) throw new ProjectServerError("repository_not_active", "Projekt besitzt kein aktives Forgejo-Repository.", 409);
    const commitSha = validateSha(input.commit_sha || binding.head_sha, "commit_sha");
    return { commit_sha: commitSha, items: await this.projectRepositoryStore.history(binding, { commit_sha: commitSha, limit: input.limit }) };
  }

  async repositoryDiff(projectId, commitSha) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const binding = this.activeRepositoryBinding(project);
    if (!binding) throw new ProjectServerError("repository_not_active", "Projekt besitzt kein aktives Forgejo-Repository.", 409);
    return this.projectRepositoryStore.diff(binding, validateSha(commitSha, "commit_sha"));
  }

  async restoreRepository(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    this.assertProjectWritable(project);
    const binding = this.activeRepositoryBinding(project);
    if (!binding) throw new ProjectServerError("repository_not_active", "Projekt besitzt kein aktives Forgejo-Repository.", 409);
    const expectedHeadSha = validateSha(input.expected_head_sha, "expected_head_sha");
    this.assertExpectedRepositoryHead(project, expectedHeadSha);
    const restoreCommitSha = validateSha(input.restore_commit_sha, "restore_commit_sha");
    const restoredSources = (await this.projectRepositoryStore.readFiles(binding, restoreCommitSha))
      .map((file) => repositoryFileSource(projectId, file, restoreCommitSha));
    await this.assertStorageQuotaForReplacement(project, restoredSources);
    const commit = await this.projectRepositoryStore.restore(binding, {
      expected_head_sha: expectedHeadSha,
      restore_commit_sha: restoreCommitSha,
      message: input.message,
    });
    const now = new Date().toISOString();
    const saved = await this.repository.saveProject({
      ...project,
      repository_binding: { ...binding, head_sha: commit.head_sha, updated_at: now },
      updated_at: now,
    });
    await this.replaceSqlSourceCache(projectId, restoredSources);
    return { project_id: projectId, repository_binding: publicRepositoryBinding(saved.repository_binding), commit };
  }

  async repositoryFiles(project, commitSha = "") {
    const binding = this.activeRepositoryBinding(project);
    const resolvedCommitSha = validateSha(commitSha || binding.head_sha, "commit_sha");
    return (await this.projectRepositoryStore.readFiles(binding, resolvedCommitSha))
      .map((file) => repositoryFileSource(project.project_id, file, resolvedCommitSha));
  }

  async assertValidProjectFileChangeSet(project, binding, commitSha, changes) {
    if (!changes.some((change) => change.path.startsWith("gernetix/"))) return;
    const files = await this.projectRepositoryStore.readFiles(binding, validateSha(commitSha, "expected_head_sha"));
    const byPath = new Map(files.map((file) => [file.path, { path: file.path, content: file.content }]));
    for (const change of changes) {
      if (change.operation === "delete") byPath.delete(change.path);
      else byPath.set(change.path, { path: change.path, content: change.content });
    }
    loadProjectFileSet([...byPath.values()]);
  }

  activeRepositoryBinding(project) {
    return this.projectRepositoryStore && project?.repository_binding?.provider === "forgejo" && project.repository_binding.state === "active"
      ? project.repository_binding
      : null;
  }

  assertExpectedRepositoryHead(project, expectedHeadSha) {
    const binding = this.activeRepositoryBinding(project);
    if (!binding || !expectedHeadSha) return;
    const expected = validateSha(expectedHeadSha, "expected_head_sha");
    if (expected !== binding.head_sha) throw new ProjectServerError("repository_head_conflict", "Der Repository-Stand wurde zwischenzeitlich geändert.", 409, {
      expected_head_sha: expected,
      actual_head_sha: binding.head_sha,
    });
  }

  async commitProjectedChanges(project, projection, expectedHeadSha, message) {
    const binding = this.activeRepositoryBinding(project);
    if (!binding) return null;
    const changedPaths = uniqueSorted(projection.changed_paths || []);
    const removedPaths = uniqueSorted(projection.removed_paths || []);
    if (!changedPaths.length && !removedPaths.length) return { head_sha: binding.head_sha, branch: binding.default_branch, changed_paths: [], no_change: true };
    const changes = [];
    for (const sourcePath of changedPaths) {
      const source = await this.repository.findSource(project.project_id, sourcePath);
      if (source) changes.push({ path: sourcePath, content: source.content });
    }
    for (const sourcePath of removedPaths) changes.push({ path: sourcePath, operation: "delete" });
    return this.projectRepositoryStore.commitChanges(binding, {
      expected_head_sha: expectedHeadSha || binding.head_sha,
      message,
      changes,
    });
  }

  async restoreSqlSourceCache(project, sources) {
    const expectedPaths = new Set(sources.map((source) => source.path));
    for (const source of await this.repository.listSources(project.project_id)) {
      if (!expectedPaths.has(source.path)) await this.repository.deleteSource(project.project_id, source.path);
    }
    for (const source of sources) await this.repository.saveSource(source);
    await this.repository.saveProject(project);
  }

  async replaceSqlSourceCache(projectId, sources) {
    const expectedPaths = new Set(sources.map((source) => source.path));
    for (const source of await this.repository.listSources(projectId)) {
      if (!expectedPaths.has(source.path)) await this.repository.deleteSource(projectId, source.path);
    }
    for (const source of sources) await this.repository.saveSource({ ...source, project_id: projectId, updated_at: new Date().toISOString() });
  }

  async getDebugSession(projectId) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const session = await this.expireDebugSession(project);
    return debugSessionEnvelope(project, session);
  }

  async startDebugSession(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    this.assertProjectBuildAllowed(project);
    const current = await this.expireDebugSession(project);
    if (current) return debugSessionEnvelope(project, current);
    const now = new Date();
    const policy = await this.policyFor(project.plan_id || "free");
    const idleHours = positiveLimit(policy.debug_session_idle_hours, 48);
    const binding = this.activeRepositoryBinding(project);
    const sources = binding ? [] : await this.repository.listSources(project.project_id);
    const session = {
      debug_session_id: createId("debug_session"),
      project_id: project.project_id,
      user_id: project.user_id,
      status: "build_required",
      build_profile: "debug",
      repository_id: binding?.repository_id || null,
      commit_sha: binding?.head_sha || null,
      snapshot_sha256: binding ? null : projectVersionHash(sanitizeProject(project), sources),
      component_ids: safeIdentifiers(input.component_ids, 64),
      software_unit_ids: safeIdentifiers(input.software_unit_ids, 64),
      device_ids: safeIdentifiers(input.device_ids, 64),
      build_jobs: [],
      started_at: now.toISOString(),
      last_user_activity_at: now.toISOString(),
      expires_at: new Date(now.getTime() + idleHours * 60 * 60 * 1000).toISOString(),
      inactivity_ttl_hours: idleHours,
    };
    await this.repository.saveProject({ ...project, debug_session: session, updated_at: now.toISOString() });
    return debugSessionEnvelope(project, session);
  }

  async touchDebugSession(projectId) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const session = await this.expireDebugSession(project);
    if (!session) throw new ProjectServerError("debug_session_not_found", "Es ist keine aktive Debug-Session vorhanden.", 404);
    const now = new Date();
    const next = {
      ...session,
      last_user_activity_at: now.toISOString(),
      expires_at: new Date(now.getTime() + positiveLimit(session.inactivity_ttl_hours, 48) * 60 * 60 * 1000).toISOString(),
    };
    await this.repository.saveProject({ ...project, debug_session: next, updated_at: now.toISOString() });
    return debugSessionEnvelope(project, next);
  }

  async endDebugSession(projectId) {
    await this.ready;
    const project = await this.requireProject(projectId);
    const session = await this.expireDebugSession(project);
    if (!session) return debugSessionEnvelope(project, null);
    await this.repository.saveProject({ ...project, debug_session: null, updated_at: new Date().toISOString() });
    return debugSessionEnvelope(project, null);
  }

  async expireDebugSession(project, at = new Date()) {
    const session = project.debug_session && typeof project.debug_session === "object" ? project.debug_session : null;
    if (!session) return null;
    if (Date.parse(session.expires_at || 0) > at.getTime()) return session;
    await this.repository.saveProject({ ...project, debug_session: null, updated_at: at.toISOString() });
    project.debug_session = null;
    return null;
  }

  async cleanupExpiredDebugSessions(at = new Date()) {
    await this.ready;
    let deleted = 0;
    for (const project of await this.repository.listProjects()) {
      if (!project.debug_session || Date.parse(project.debug_session.expires_at || 0) > at.getTime()) continue;
      await this.expireDebugSession(project, at);
      deleted += 1;
    }
    return { deleted, checked_at: at.toISOString() };
  }

  async createBuildJob(projectId, input = {}) {
    await this.ready;
    const project = await this.requireProject(projectId);
    this.assertProjectBuildAllowed(project);
    const binding = this.activeRepositoryBinding(project);
    const commitSha = binding ? validateSha(input.commit_sha || binding.head_sha, "commit_sha") : "";
    const buildProject = binding
      ? projectFromRepositoryFiles(project, await this.repositoryFiles(project, commitSha))
      : project;
    const now = new Date().toISOString();
    const mode = input.mode || "build";
    if (!["build", "build_and_flash", "build_and_usb_flash", "prebuild"].includes(mode)) {
      throw new ProjectServerError("invalid_build_mode", "Build-Modus muss build, build_and_flash, build_and_usb_flash oder prebuild sein.");
    }
    const buildProfile = normalizeBuildProfile(input.build_profile);
    const debugSession = buildProfile === "debug" ? await this.expireDebugSession(project) : null;
    if (buildProfile === "debug" && !debugSession) {
      throw new ProjectServerError("debug_session_required", "Ein Debug-Build benötigt eine aktive Debug-Session.", 409);
    }
    if (debugSession && binding && debugSession.commit_sha !== binding.head_sha) {
      throw new ProjectServerError("debug_session_project_changed", "Der Projektstand hat sich seit dem Start der Debug-Session geändert. Starte die Session neu.", 409);
    }
    if (debugSession && !binding) {
      const currentSnapshotSha256 = projectVersionHash(sanitizeProject(project), await this.repository.listSources(project.project_id));
      if (debugSession.snapshot_sha256 !== currentSnapshotSha256) {
        throw new ProjectServerError("debug_session_project_changed", "Der Projektstand hat sich seit dem Start der Debug-Session geändert. Starte die Session neu.", 409);
      }
    }
    const softwareUnits = softwareUnitsForProject(buildProject);
    const requestedSoftwareUnitId = String(input.software_unit_id || buildProject.active_software_unit_id || "").trim();
    const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === requestedSoftwareUnitId)
      || (!requestedSoftwareUnitId ? softwareUnits[0] : null);
    if (requestedSoftwareUnitId && !softwareUnit) {
      throw new ProjectServerError("software_unit_not_found", "Die gewählte Softwareeinheit gehört nicht zu diesem Projekt.", 404);
    }
    if (softwareUnit && !isPlatformioSoftwareUnit(softwareUnit)) {
      throw new ProjectServerError("software_unit_builder_not_supported", `Das Build-System ${softwareUnit.build_system} ist noch nicht an einen Build-Runner angebunden.`, 409);
    }
    const buildConfig = debugBuildConfig(softwareUnit?.build_config || buildProject.build_config, buildProfile);
    if (!buildConfig) {
      throw new ProjectServerError("project_not_buildable", "Projekt besitzt keine Build-Konfiguration und kann nicht gebaut werden.", 400);
    }
    const job = {
      build_job_id: input.build_job_id || createId("build_job"),
      project_id: project.project_id,
      user_id: project.user_id,
      repository_id: binding?.repository_id || null,
      repository_provider: binding?.provider || null,
      commit_sha: commitSha || null,
      mode,
      build_profile: buildProfile,
      status: "created",
      build_deploy_job_id: null,
      device_id: input.device_id || softwareUnit?.device_id || project.device_id || null,
      software_unit_id: softwareUnit?.software_unit_id || "",
      software_unit: binding ? null : softwareUnit ? structuredClone(softwareUnit) : null,
      created_at: now,
      updated_at: now,
      submitted_at: null,
      finished_at: null,
      build_config: binding ? null : { ...buildConfig },
      result: null,
      error: null,
    };
    const saved = await this.repository.saveBuildJob(job);
    if (buildProfile === "debug" && debugSession) {
      const buildJobs = [...(debugSession.build_jobs || []).filter((item) => item.build_job_id !== saved.build_job_id), {
        build_job_id: saved.build_job_id,
        software_unit_id: saved.software_unit_id || "",
        device_id: saved.device_id || null,
        status: saved.status,
        build_id: "",
      }].slice(-32);
      await this.repository.saveProject({
        ...project,
        debug_session: { ...debugSession, status: "building", build_jobs: buildJobs },
        updated_at: now,
      });
    }
    return saved;
  }

  async getBuildJob(jobId) {
    await this.ready;
    const job = await this.repository.findBuildJob(jobId);
    if (!job) throw new ProjectServerError("build_job_not_found", "BuildJob wurde nicht gefunden.", 404);
    return job;
  }

  async buildReuseStatus(jobId) {
    await this.ready;
    const job = await this.getBuildJob(jobId);
    const project = await this.requireProject(job.project_id);
    const binding = this.activeRepositoryBinding(project);
    if (job.commit_sha) {
      const currentCommitSha = binding?.head_sha || "";
      const reusable = job.status === "succeeded"
        && Boolean(binding)
        && String(binding.repository_id) === String(job.repository_id)
        && currentCommitSha === job.commit_sha;
      return {
        build_job_id: job.build_job_id,
        project_id: job.project_id,
        software_unit_id: job.software_unit_id || "",
        build_status: job.status,
        reusable,
        reason: reusable
          ? "build_commit_matches"
          : job.status !== "succeeded"
            ? "build_not_successful"
            : !binding || String(binding.repository_id) !== String(job.repository_id)
              ? "project_repository_changed"
              : "project_commit_changed",
        build_commit_sha: job.commit_sha,
        current_commit_sha: currentCommitSha,
        build_snapshot_sha256: job.package_sha256 || "",
        current_snapshot_sha256: "",
      };
    }
    const softwareUnits = softwareUnitsForProject(project);
    const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === job.software_unit_id)
      || (!job.software_unit_id ? softwareUnits[0] : null);
    const allSources = await this.repository.listSources(project.project_id);
    const sources = sourcesForSoftwareUnit(allSources, softwareUnit, softwareUnits);
    const currentSnapshotSha256 = projectVersionHash(sanitizeProject(project), sources);
    const normalizedBuildSnapshotSha256 = job.project_snapshot && Array.isArray(job.source_snapshot)
      ? projectVersionHash(job.project_snapshot, job.source_snapshot)
      : job.snapshot_sha256;
    const reusable = job.status === "succeeded"
      && Boolean(normalizedBuildSnapshotSha256)
      && normalizedBuildSnapshotSha256 === currentSnapshotSha256;
    return {
      build_job_id: job.build_job_id,
      project_id: job.project_id,
      software_unit_id: job.software_unit_id || "",
      build_status: job.status,
      reusable,
      reason: reusable
        ? "build_snapshot_matches"
        : job.status !== "succeeded"
          ? "build_not_successful"
          : "project_snapshot_changed",
      build_snapshot_sha256: normalizedBuildSnapshotSha256 || "",
      current_snapshot_sha256: currentSnapshotSha256,
    };
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
    this.assertProjectBuildAllowed(project);
    const binding = this.activeRepositoryBinding(project);
    let buildProject = project;
    let allSources;
    if (job.commit_sha) {
      if (!binding || String(binding.repository_id) !== String(job.repository_id)) {
        throw new ProjectServerError("build_repository_binding_changed", "Die Repository-Bindung des BuildJobs ist nicht mehr aktiv.", 409);
      }
      const commitSha = validateSha(job.commit_sha, "commit_sha");
      allSources = await this.repositoryFiles(project, commitSha);
      buildProject = projectFromRepositoryFiles(project, allSources);
    } else {
      allSources = await this.repository.listSources(project.project_id);
    }
    const softwareUnits = softwareUnitsForProject(buildProject);
    const softwareUnit = job.software_unit
      || softwareUnits.find((unit) => unit.software_unit_id === job.software_unit_id)
      || softwareUnits[0]
      || null;
    if (job.software_unit_id && softwareUnit?.software_unit_id !== job.software_unit_id) {
      throw new ProjectServerError("build_commit_software_unit_missing", "Die Softwareeinheit des BuildJobs fehlt im gebundenen Commit.", 409);
    }
    const sources = sourcesForSoftwareUnit(allSources, softwareUnit, softwareUnits);
    const buildConfig = debugBuildConfig(job.build_config || softwareUnit?.build_config || buildProject.build_config, job.build_profile);
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
    const projectSnapshot = sanitizeProject(buildProject);
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
      repository_id: job.repository_id || null,
      commit_sha: job.commit_sha || null,
      mode: job.mode,
      build_profile: job.build_profile || "standard",
      device_id: job.device_id,
      software_unit_id: softwareUnit?.software_unit_id || "",
      software_unit_title: softwareUnit?.title || "Firmware",
      build_config: buildConfig,
      created_at: job.created_at,
    };
    const packageFiles = [
      { path: "build-job.json", content: JSON.stringify(buildJob, null, 2), content_type: "application/json" },
      { path: "project-view-manifest.json", content: JSON.stringify(effectiveViewManifest(buildProject), null, 2), content_type: "application/json" },
      { path: "platformio.ini", content: platformioIni, content_type: "text/plain" },
      ...firmwareSources.filter((source) => source.path !== "platformio.ini").map((source) => ({
        path: source.path,
        content: source.content,
        content_type: source.content_type,
        sha256: source.content_sha256,
      })),
    ];
    const packageSha256 = buildPackageHash(packageFiles);
    await this.repository.saveBuildJob(job.commit_sha ? {
      ...job,
      package_sha256: packageSha256,
      updated_at: new Date().toISOString(),
    } : {
      ...job,
      project_snapshot: projectSnapshot,
      source_snapshot: sources,
      snapshot_sha256: projectVersionHash(projectSnapshot, sources),
      package_sha256: packageSha256,
      updated_at: new Date().toISOString(),
    });
    return {
      package_id: `pkg_${job.build_job_id}`,
      package_sha256: packageSha256,
      repository_id: job.repository_id || null,
      commit_sha: job.commit_sha || null,
      project: projectSnapshot,
      build_job: buildJob,
      platformio_ini: platformioIni,
      contract: createFirmwareBuildPackageContract({ softwareUnit, buildConfig, packageFiles: packageFiles.map((file) => file.path) }),
      files: packageFiles,
    };
  }

  async markBuildSubmitted(jobId, input = {}) {
    await this.ready;
    const job = await this.getBuildJob(jobId);
    this.assertProjectBuildAllowed(await this.requireProject(job.project_id));
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
    const project = await this.requireProject(job.project_id);
    if (job.commit_sha && input.commit_sha && validateSha(input.commit_sha, "commit_sha") !== job.commit_sha) {
      throw new ProjectServerError("build_result_commit_mismatch", "Build-Ergebnis und BuildJob referenzieren unterschiedliche Commits.", 409);
    }
    const status = input.status || input.build_status || "succeeded";
    const next = {
      ...job,
      status,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result: {
        repository_id: job.repository_id || null,
        commit_sha: job.commit_sha || null,
        package_sha256: job.package_sha256 || null,
        build: input.build || null,
        deploy: input.deploy || null,
        flashbox: input.flashbox || null,
        logs: input.logs || [],
      },
      error: input.error || null,
    };
    await this.repository.saveBuildJob(next);
    await this.updateDebugSessionForBuild(project, next);
    for (const artifact of input.artifacts || []) {
      await this.repository.saveArtifact({
        artifact_id: artifact.artifact_id || createId("artifact"),
        project_id: job.project_id,
        build_job_id: job.build_job_id,
        repository_id: job.repository_id || null,
        commit_sha: job.commit_sha || null,
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

  async updateDebugSessionForBuild(project, job) {
    const session = await this.expireDebugSession(project);
    const successfulFlash = job.status === "succeeded" && (
      job.result?.build?.usb_flash?.status === "succeeded"
      || ["rebooting", "confirmed", "delivered", "succeeded"].includes(job.result?.deploy?.status)
      || ["accepted", "delivered", "confirmed", "succeeded"].includes(job.result?.flashbox?.status)
    );
    if (job.build_profile === "standard" && successfulFlash && job.device_id) {
      const remaining = (project.debug_firmware_devices || []).filter((item) => item.device_id !== job.device_id);
      await this.repository.saveProject({ ...project, debug_firmware_devices: remaining, updated_at: new Date().toISOString() });
      return;
    }
    if (!session || job.build_profile !== "debug") return;
    const buildId = String(job.result?.build?.build_id || "");
    const buildJobs = (session.build_jobs || []).map((item) => item.build_job_id === job.build_job_id ? {
      ...item,
      status: job.status,
      build_id: buildId,
    } : item);
    const allSucceeded = buildJobs.length > 0 && buildJobs.every((item) => item.status === "succeeded");
    const firmwareDevices = successfulFlash && job.device_id
      ? upsertDebugFirmwareDevice(project.debug_firmware_devices, job, session)
      : project.debug_firmware_devices || [];
    await this.repository.saveProject({
      ...project,
      debug_firmware_devices: firmwareDevices,
      debug_session: {
        ...session,
        status: successfulFlash ? "active" : allSucceeded ? "ready_to_flash" : job.status === "failed" ? "build_failed" : session.status,
        build_jobs: buildJobs,
      },
      updated_at: new Date().toISOString(),
    });
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
    this.assertProjectPlanUnlocked(project, "Für das tarifgesperrte Projekt kann keine neue Version angelegt werden.");
    const versions = await this.repository.listVersions({ project_id: projectId });
    const now = new Date().toISOString();
    const binding = this.activeRepositoryBinding(project);
    if (binding) {
      const commitSha = validateSha(input.commit_sha || binding.head_sha, "commit_sha");
      if (commitSha !== binding.head_sha) throw new ProjectServerError("repository_head_conflict", "Eine benannte Version kann nur den bestaetigten Repository-Head referenzieren.", 409, {
        expected_head_sha: commitSha, actual_head_sha: binding.head_sha,
      });
      if (input.include_binary === true) {
        const buildJob = await this.repository.findBuildJob(required(input.build_job_id, "build_job_id"));
        if (!buildJob || buildJob.project_id !== projectId || buildJob.status !== "succeeded" || buildJob.commit_sha !== commitSha) {
          throw new ProjectServerError("version_binary_commit_mismatch", "Binary und benannte Version müssen denselben erfolgreichen Commit referenzieren.", 409);
        }
      }
      return this.repository.saveVersion({
        version_id: createId("project_version"), project_id: projectId,
        parent_version_id: internal.parent_version_id || versions[0]?.version_id || null,
        created_by_user_id: required(input.user_id, "user_id"),
        message: String(input.message || "Projektstand gespeichert").trim().slice(0, 240),
        commit_kind: internal.commit_kind || "named_version",
        restored_from_version_id: internal.restored_from_version_id || null,
        state: "saved", commit_sha: commitSha, includes_binary: input.include_binary === true,
        build_job_id: input.build_job_id || null, created_at: now,
      });
    }
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
    this.assertProjectWritable(project);
    const version = await this.repository.findVersion(versionId);
    if (!version || version.project_id !== project.project_id) throw new ProjectServerError("project_version_not_found", "Projektversion wurde nicht gefunden.", 404);
    const binding = this.activeRepositoryBinding(project);
    if (binding) {
      if (!version.commit_sha) throw new ProjectServerError("project_version_commit_missing", "Projektversion besitzt keinen Git-Commit.", 409);
      const restored = await this.restoreRepository(projectId, {
        expected_head_sha: input.expected_head_sha,
        restore_commit_sha: version.commit_sha,
        message: input.message || `Wiederhergestellt aus ${version.message || version.version_id}`,
      });
      return this.createVersionRecord(projectId, {
        user_id: required(input.user_id, "user_id"), message: input.message || `Wiederhergestellt aus ${version.message || version.version_id}`,
        commit_sha: restored.commit.head_sha,
      }, { commit_kind: "restore", restored_from_version_id: versionId });
    }
    await this.assertStorageQuotaForReplacement(project, version.sources || []);
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
      status: project.status,
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
      ratings: normalizeLearningRatings(input.ratings, input.category || "project_feedback"),
      message: String(input.message || "").trim().slice(0, 2000),
      status: "new",
      contact_mode: input.contact_mode || "no_contact",
      contact_email: input.contact_email || "",
      anonymize_after: input.anonymize_after || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      anonymized_at: null,
      created_at: now,
    };
    return redactFeedback(await this.repository.saveFeedback(feedback));
  }

  async createTemplateFeedback(input = {}) {
    await this.ready;
    const category = input.category === "template_improvement_suggestion"
      ? "template_improvement_suggestion"
      : "template_experience_rating";
    const message = String(input.message || "").trim().slice(0, 2000);
    if (category === "template_improvement_suggestion" && !message) {
      throw new ProjectServerError("missing_required_field", "Pflichtfeld fehlt: message");
    }
    const now = new Date().toISOString();
    const feedback = {
      feedback_id: input.feedback_id || createId("template_feedback"),
      subject_type: "project_template",
      subject_id: required(input.template_id || input.subject_id, "template_id"),
      template_id: required(input.template_id || input.subject_id, "template_id"),
      user_id: required(input.user_id, "user_id"),
      category,
      ratings: normalizeLearningRatings(input.ratings, category),
      message,
      status: "new",
      contact_mode: "no_contact",
      contact_email: "",
      anonymize_after: input.anonymize_after || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      anonymized_at: null,
      created_at: now,
    };
    return redactFeedback(await this.repository.saveTemplateFeedback(feedback));
  }

  async listFeedback(query = {}) {
    await this.ready;
    const feedbackItems = await this.repository.listFeedback({
      project_id: query.project_id || query.projectId || "",
      user_id: query.user_id || query.userId || "",
    });
    const templateItems = await this.repository.listTemplateFeedback?.({
      template_id: query.template_id || query.templateId || "",
      user_id: query.user_id || query.userId || "",
    }) || [];
    return Promise.all([...feedbackItems, ...templateItems].map(async (feedback) =>
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
    const projectFeedback = await this.repository.listFeedback();
    const templateFeedback = await this.repository.listTemplateFeedback?.() || [];
    for (const feedback of [...projectFeedback, ...templateFeedback]) {
      if (feedback.anonymized_at || new Date(feedback.anonymize_after).getTime() > at.getTime()) continue;
      const anonymized = {
        ...feedback,
        user_id: "anonymous",
        contact_email: "",
        contact_mode: "no_contact",
        anonymized_at: at.toISOString(),
      };
      const saved = feedback.subject_type === "project_template"
        ? await this.repository.saveTemplateFeedback(anonymized)
        : await this.repository.saveFeedback(anonymized);
      updated.push(redactFeedback(saved));
    }
    return updated;
  }

  async projectWithSummary(project) {
    return {
      ...sanitizeProject(project),
      repository_binding: publicRepositoryBinding(project.repository_binding),
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
      entry.storage_bytes += await this.storageMeter.projectStorageBytes(project.project_id);
      byAccount.set(project.user_id, entry);
    }
    return {
      policies,
      accounts: Array.from(byAccount.values()).sort((a, b) => b.storage_bytes - a.storage_bytes),
      measurement_source: "sql_source_cache",
    };
  }

  async accountResourceSummary(accountId, planId = "free") {
    await this.ready;
    const normalizedAccountId = required(accountId, "account_id");
    const policy = await this.policyFor(planId);
    const projects = (await this.repository.listProjects({ user_id: normalizedAccountId }))
      .filter((project) => project.status !== "template");
    const storageBytes = await this.storageMeter.accountStorageBytes(normalizedAccountId);
    return {
      account_id: normalizedAccountId,
      plan_id: policy.plan_id,
      policy,
      usage: {
        projects: projects.length,
        active_projects: projects.filter((project) => project.status === "active").length,
        locked_projects: projects.filter((project) => project.status === "plan_locked").length,
        storage_bytes: storageBytes,
      },
      over_quota: {
        projects: policy.max_projects !== null && projects.length > policy.max_projects,
        storage: policy.max_storage_bytes !== null && storageBytes > policy.max_storage_bytes,
      },
      measurement_source: "sql_source_cache",
    };
  }

  async applyAccountResourcePlan(accountId, input = {}) {
    await this.ready;
    const normalizedAccountId = required(accountId, "account_id");
    const policy = await this.policyFor(input.plan_id || "free");
    const projects = (await this.repository.listProjects({ user_id: normalizedAccountId }))
      .filter((project) => project.status !== "template")
      .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
    const selectable = policy.max_projects === null ? projects.length : policy.max_projects;
    const requested = new Set((input.active_project_ids || []).map(String));
    const unknown = [...requested].filter((projectId) => !projects.some((project) => project.project_id === projectId));
    if (unknown.length) throw new ProjectServerError("project_selection_invalid", "Die Projektauswahl enthält fremde oder unbekannte Projekte.", 400, { project_ids: unknown });
    if (requested.size > selectable) throw new ProjectServerError("project_selection_exceeds_plan", `Der Zielplan erlaubt maximal ${selectable} aktive Projekte.`, 409);
    const selected = requested.size
      ? requested
      : new Set(projects.filter((project) => project.status === "active").slice(0, selectable).map((project) => project.project_id));
    if (selected.size < Math.min(selectable, projects.length)) {
      for (const project of projects) {
        if (selected.size >= selectable) break;
        selected.add(project.project_id);
      }
    }
    const now = new Date().toISOString();
    for (const project of projects) {
      const status = selected.has(project.project_id) ? "active" : "plan_locked";
      if (project.status !== status || project.plan_id !== policy.plan_id) {
        await this.repository.saveProject({ ...project, plan_id: policy.plan_id, status, updated_at: now });
      }
    }
    return this.accountResourceSummary(normalizedAccountId, policy.plan_id);
  }

  async updateResourcePolicy(planId, input = {}) {
    await this.ready;
    const current = await this.policyFor(planId);
    const now = new Date().toISOString();
    const policy = {
      ...current,
      plan_id: String(planId).toLowerCase(),
      policy_id: current.policy_id || resourcePolicyId(planId),
      policy_version: Math.max(1, Number(current.policy_version) || 1) + 1,
      effective_from: now,
      status: "active",
      changed_by: String(input.changed_by || input.admin_id || "admin").trim() || "admin",
      change_reason: required(input.change_reason, "change_reason"),
      max_projects: unlimitedOrPositiveLimit(input.max_projects, current.max_projects),
      max_storage_bytes: unlimitedOrPositiveLimit(input.max_storage_bytes, current.max_storage_bytes),
      storage_warning_threshold_percent: percentageLimit(input.storage_warning_threshold_percent, current.storage_warning_threshold_percent),
      max_monthly_traffic_bytes: unlimitedOrPositiveLimit(input.max_monthly_traffic_bytes, current.max_monthly_traffic_bytes),
      debug_session_idle_hours: positiveLimit(input.debug_session_idle_hours, current.debug_session_idle_hours || 48),
      updated_at: now,
    };
    return this.repository.saveResourcePolicy(policy);
  }

  async ensureResourcePolicies() {
    const existing = new Map((await this.repository.listResourcePolicies()).map((policy) => [policy.plan_id, policy]));
    for (const policy of defaultResourcePolicies()) {
      const current = existing.get(policy.plan_id);
      if (!current) { await this.repository.saveResourcePolicy(policy); continue; }
      const normalized = normalizePersistedResourcePolicy(current);
      // Migration bisheriger Premium-Vorgaben auf die beschlossene grosszuegige Missbrauchsgrenze.
      if (["premium", "premium_demo"].includes(policy.plan_id) && [null, 50].includes(current.max_projects)) {
        await this.repository.saveResourcePolicy({ ...normalized, max_projects: 200, updated_at: new Date().toISOString() });
      } else if (JSON.stringify(normalized) !== JSON.stringify(current)) {
        await this.repository.saveResourcePolicy(normalized);
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

  async assertStorageQuota(project, changes) {
    const usage = await this.storageMeter.projectedAccountStorage(project, changes);
    await this.assertProjectedStorageQuota(project, usage);
  }

  async assertStorageQuotaForReplacement(project, sources) {
    const usage = await this.storageMeter.projectedAccountStorageForReplacement(project, sources);
    await this.assertProjectedStorageQuota(project, usage);
  }

  async assertProjectedStorageQuota(project, usage) {
    const policy = await this.policyFor(project.plan_id);
    const growsStorage = usage.projected_bytes > usage.current_bytes;
    if (policy.max_storage_bytes !== null && growsStorage && usage.projected_bytes > policy.max_storage_bytes) {
      throw new ProjectServerError("storage_quota_exceeded", `Speicherlimit von ${policy.max_storage_bytes} Bytes fuer den Plan ${policy.plan_id} erreicht.`, 413, {
        account_id: project.user_id,
        current_bytes: usage.current_bytes,
        projected_bytes: usage.projected_bytes,
        measurement_source: usage.measurement_source,
      });
    }
  }

  assertProjectWritable(project) {
    if (project.status === "template") throw new ProjectServerError("project_template_immutable", "Projekt-Templates dürfen nicht verändert werden.", 409);
    this.assertProjectPlanUnlocked(project, "Das Projekt ist durch den aktuellen Tarif schreibgeschützt.");
  }

  assertProjectBuildAllowed(project) {
    this.assertProjectPlanUnlocked(project, "Das Projekt kann mit dem aktuellen Tarif nicht gebaut werden.");
  }

  assertProjectPlanUnlocked(project, message) {
    if (project.status === "plan_locked") throw new ProjectServerError("project_plan_locked", message, 409);
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
    if (project.status === "plan_locked") return project;
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
        ...(templateRef.commit_sha ? { commit_sha: String(templateRef.commit_sha) } : {}),
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

function percentageLimit(value, fallback = 80) {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 1 && number <= 100) return number;
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber >= 1 && fallbackNumber <= 100 ? fallbackNumber : 80;
}

function defaultResourcePolicies() {
  const now = new Date().toISOString();
  return [
    { plan_id: "free", max_projects: 5, max_storage_bytes: 5 * 1024 * 1024, storage_warning_threshold_percent: 80, max_monthly_traffic_bytes: 25 * 1024 * 1024, debug_session_idle_hours: 48 },
    { plan_id: "premium", max_projects: 200, max_storage_bytes: null, storage_warning_threshold_percent: 80, max_monthly_traffic_bytes: 1024 * 1024 * 1024, debug_session_idle_hours: 48 },
    { plan_id: "premium_demo", max_projects: 200, max_storage_bytes: null, storage_warning_threshold_percent: 80, max_monthly_traffic_bytes: 1024 * 1024 * 1024, debug_session_idle_hours: 48 },
  ].map((policy) => ({
    ...policy,
    policy_id: resourcePolicyId(policy.plan_id),
    policy_version: 1,
    effective_from: now,
    status: "active",
    changed_by: "system",
    change_reason: "initial_default",
    updated_at: now,
  }));
}

function normalizePersistedResourcePolicy(policy) {
  return {
    ...policy,
    policy_id: policy.policy_id || resourcePolicyId(policy.plan_id),
    policy_version: Math.max(1, Number(policy.policy_version) || 1),
    effective_from: policy.effective_from || policy.updated_at || new Date().toISOString(),
    status: "active",
    changed_by: policy.changed_by || "system",
    change_reason: policy.change_reason || "legacy_policy_migration",
    storage_warning_threshold_percent: percentageLimit(policy.storage_warning_threshold_percent, 80),
    debug_session_idle_hours: positiveLimit(policy.debug_session_idle_hours, 48),
  };
}

function debugBuildConfig(input, buildProfile) {
  const config = input && typeof input === "object" ? structuredClone(input) : input;
  if (!config || buildProfile !== "debug") return config;
  return {
    ...config,
    build_flags: Array.from(new Set([...(config.build_flags || []), "-D GERNETIX_DEBUG_SESSION=1"])),
    platformio_options: {
      ...(config.platformio_options || {}),
      build_type: "debug",
      debug_build_flags: "-Og -g3 -D GERNETIX_DEBUG_SESSION=1",
    },
  };
}

function safeIdentifiers(values, limit = 64) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter((value) => /^[a-zA-Z0-9_.:-]{1,120}$/.test(value))))
    .slice(0, limit);
}

function debugSessionEnvelope(project, session) {
  return {
    session: session ? structuredClone(session) : null,
    debug_firmware_devices: structuredClone(project.debug_firmware_devices || []),
  };
}

function upsertDebugFirmwareDevice(devices, job, session) {
  const current = (devices || []).filter((item) => item.device_id !== job.device_id);
  current.push({
    device_id: job.device_id,
    software_unit_id: job.software_unit_id || "",
    build_job_id: job.build_job_id,
    build_id: String(job.result?.build?.build_id || ""),
    debug_session_id: session.debug_session_id,
    installed_at: new Date().toISOString(),
  });
  return current.slice(-64);
}

function resourcePolicyId(planId) {
  return `resource_policy.${String(planId || "free").trim().toLowerCase()}`;
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
    plan_id: project.plan_id || "free",
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
    project: withoutVolatileSnapshotMetadata({
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
    }),
    sources: [...(sources || [])]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({ path, content, content_type, role }) => ({ path, content, content_type, role })),
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function withoutVolatileSnapshotMetadata(value) {
  if (Array.isArray(value)) return value.map(withoutVolatileSnapshotMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["snapshot_at", "saved_at", "updated_at", "runtime_model_version"].includes(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, withoutVolatileSnapshotMetadata(entry)]));
}

function maskSourceContent(source) {
  return {
    project_id: source.project_id,
    path: source.path,
    content_sha256: source.content_sha256,
    content_type: source.content_type,
    role: source.role,
    size_bytes: source.size_bytes,
    blob_sha: source.blob_sha,
    commit_sha: source.commit_sha,
    updated_at: source.updated_at,
  };
}

function repositoryFileSource(projectId, file, commitSha) {
  return {
    project_id: projectId,
    path: file.path,
    content: file.content,
    content_sha256: sha256(file.content),
    content_type: mimeTypeForPath(file.path),
    role: inferSourceRole(file.path),
    size_bytes: file.size_bytes,
    blob_sha: file.blob_sha,
    commit_sha: commitSha,
    updated_at: "",
  };
}

function repositoryTreeSource(projectId, sourcePath, commitSha) {
  return {
    project_id: projectId,
    path: sourcePath,
    content_type: mimeTypeForPath(sourcePath),
    role: inferSourceRole(sourcePath),
    commit_sha: commitSha,
    updated_at: "",
  };
}

function projectFromRepositoryFiles(project, sources) {
  const fileSet = loadProjectFileSet(sources);
  const manifest = fileSet.manifest;
  if (String(manifest.project_id) !== String(project.project_id)) {
    throw new ProjectServerError("build_commit_project_mismatch", "Der gebundene Commit gehört nicht zum BuildJob-Projekt.", 409);
  }
  const documents = new Map(fileSet.files
    .filter((file) => file.path.endsWith(".json"))
    .map((file) => [file.path, JSON.parse(file.content)]));
  const hardwareAllocation = documents.get("gernetix/hardware/allocation.json") || null;
  const boardDocuments = [...documents]
    .filter(([path]) => /^gernetix\/hardware\/boards\/[^/]+\.json$/.test(path));
  const hardwareFeatures = Object.fromEntries([...documents]
    .filter(([path]) => /^gernetix\/configuration\/board-peripherals\/[^/]+\.json$/.test(path))
    .map(([path, value]) => [path.split("/").pop().replace(/\.json$/, ""), value]));
  const softwareUnits = fileSet.software_units.map((unit) => {
    const unitId = projectFileId(unit.software_unit_id);
    const componentLabel = String(unit.source_root || "").split("/").pop();
    const component = hardwareAllocation?.components?.find((candidate) => (
      String(candidate.label || "") === componentLabel
      || projectFileId(candidate.component_id || "") === projectFileId(componentLabel)
    ));
    const boardPath = component?.board_configuration_path || (boardDocuments.length === 1 ? boardDocuments[0][0] : "");
    const buildConfig = unit.build && typeof unit.build === "object" ? {
      ...unit.build,
      user_source_path: unit.build.user_source_path || unit.entrypoint || "",
      basissoftware_configuration: documents.get(`gernetix/configuration/basissoftware/${unitId}.json`) || null,
      component_features: documents.get(`gernetix/configuration/software-features/${unitId}.json`) || {},
      component_hardware_features: hardwareFeatures,
      board_configuration: boardPath ? documents.get(boardPath) || null : null,
    } : null;
    return {
      software_unit_id: unit.software_unit_id,
      title: unit.title,
      software_kind: unit.software_kind,
      build_system: unit.build_system,
      source_root: unit.source_root,
      entrypoint: unit.entrypoint || "",
      hardware_profile_id: unit.hardware_profile_id || "",
      device_id: "",
      build_config: buildConfig,
    };
  });
  const activeSoftwareUnitId = String(manifest.active_software_unit_id || softwareUnits[0]?.software_unit_id || "");
  const activeSoftwareUnit = softwareUnits.find((unit) => unit.software_unit_id === activeSoftwareUnitId) || softwareUnits[0] || null;
  return {
    ...project,
    title: String(manifest.title || ""),
    description: String(manifest.description || ""),
    hardware_profile_id: String(manifest.hardware_profile_id || activeSoftwareUnit?.hardware_profile_id || ""),
    active_software_unit_id: activeSoftwareUnitId,
    software_units: softwareUnits,
    build_config: activeSoftwareUnit?.build_config || null,
    view_manifest: repositoryViewManifest(project, documents, fileSet.files, hardwareAllocation),
  };
}

function repositoryViewManifest(project, documents, files, hardwareAllocation) {
  const manifestDocument = documents.get("gernetix/project.json") || {};
  const manifest = {
    title: manifestDocument.title || project.title,
    summary: manifestDocument.description || project.description,
    template_ref: manifestDocument.template_ref || null,
  };
  const configurationPaths = {
    architecture_dialog: "gernetix/configuration/architecture-dialog.json",
    communication_setup: "gernetix/configuration/communication.json",
    home_automation_configuration: "gernetix/configuration/home-automation.json",
    game_configuration: "gernetix/configuration/game.json",
    pwa_dashboard: "gernetix/configuration/pwa-dashboard.json",
    data_logger: "gernetix/configuration/data-logger.json",
    event_configuration: "gernetix/configuration/events.json",
  };
  for (const [key, path] of Object.entries(configurationPaths)) {
    if (documents.has(path)) manifest[key] = documents.get(path);
  }
  const views = [];
  const architecture = files.find((file) => file.path === "gernetix/architecture/project.puml");
  if (architecture) views.push({ id: "architecture-diagram", type: "plantuml", payload: { source: architecture.content } });
  if (hardwareAllocation) {
    views.push({
      id: "hardware-configuration",
      type: "hardware_configuration",
      payload: {
        ...hardwareAllocation,
        components: (hardwareAllocation.components || []).map((component) => ({
          ...component,
          ...(component.board_configuration_path
            ? { board_configuration: documents.get(component.board_configuration_path) || null }
            : {}),
        })),
      },
    });
  }
  if (views.length) manifest.views = views;
  return manifest;
}

function buildPackageHash(files) {
  const manifest = [...files]
    .filter((file) => file.path !== "build-job.json")
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => ({
      path: file.path,
      content_type: file.content_type || "application/octet-stream",
      sha256: file.sha256 || sha256(String(file.content || "")),
    }));
  return sha256(JSON.stringify(manifest));
}

function projectFileId(value) {
  return String(value || "item")
    .trim().toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "item";
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

function normalizeLearningRatings(input, category) {
  const ratingCategories = new Set(["learning_experience_rating", "development_project_rating", "template_experience_rating"]);
  if ((!input || typeof input !== "object") && !ratingCategories.has(category)) return {};
  const ratings = input && typeof input === "object" ? input : {};
  const normalized = {};
  for (const criterion of ["clarity", "fun", "difficulty", "completeness"]) {
    const value = Number(ratings[criterion]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new ProjectServerError(
        "invalid_feedback_rating",
        `Bewertung ${criterion} muss eine ganze Zahl von 1 bis 5 sein.`,
      );
    }
    normalized[criterion] = value;
  }
  return normalized;
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

function normalizeProjectStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!["active", "plan_locked", "template"].includes(status)) {
    throw new ProjectServerError("invalid_project_status", "Projektstatus muss active, plan_locked oder template sein.");
  }
  return status;
}

function normalizeBuildProfile(value) {
  const profile = String(value || "standard").trim().toLowerCase();
  if (!["standard", "debug"].includes(profile)) {
    throw new ProjectServerError("invalid_build_profile", "Buildprofil muss standard oder debug sein.", 400);
  }
  return profile;
}

function contentType(sourcePath) {
  if (sourcePath.endsWith(".json")) return "application/json";
  if (/\.(?:h|hh|hpp|hxx|inc|inl|ipp|tpp|cuh)$/i.test(sourcePath)) return "text/x-c++hdr";
  if (/\.(?:c|cc|cpp|cxx|m|mm|ino|cu)$/i.test(sourcePath)) return "text/x-c++src";
  return "text/plain";
}

function inferSourceRole(sourcePath) {
  if (/(^|\/)platformio\.ini$/.test(sourcePath)) return "build_config";
  if (sourcePath.startsWith("gernetix/")) return PROJECT_CONFIGURATION_ROLE;
  if (/(^|\/)gernetix_[^/]*configuration\.h$/i.test(sourcePath)) return GENERATED_CONFIGURATION_ROLE;
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

function emptyProjectionResult() {
  return { changed_paths: [], unchanged_paths: [], removed_paths: [] };
}

function mergeProjectionResults(...results) {
  return {
    changed_paths: uniqueSorted(results.flatMap((result) => result?.changed_paths || [])),
    unchanged_paths: uniqueSorted(results.flatMap((result) => result?.unchanged_paths || [])),
    removed_paths: uniqueSorted(results.flatMap((result) => result?.removed_paths || [])),
  };
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function publicRepositoryBinding(binding) {
  if (!binding || typeof binding !== "object") return null;
  return {
    provider: String(binding.provider || ""),
    state: String(binding.state || ""),
    organization: String(binding.organization || ""),
    repository_name: String(binding.repository_name || ""),
    repository_id: String(binding.repository_id || ""),
    default_branch: String(binding.default_branch || ""),
    head_sha: String(binding.head_sha || ""),
    provisioned_at: String(binding.provisioned_at || ""),
    updated_at: String(binding.updated_at || ""),
    error_code: String(binding.error_code || ""),
  };
}

module.exports = { ProjectService };
