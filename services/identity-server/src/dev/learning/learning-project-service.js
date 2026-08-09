"use strict";

function createLearningProjectService({ userIdeState, catalogProjectIdForDefinition, sendJson, projectServerUserId, projectServerJson, crypto, accountSubscription, projectViewManifest, demoProjectSources, mapProjectServerProject, invalidateUserIdeProjectCaches, touchWorkspace, learningProgress, toPlatformProject, nexiCourseModel, mapUserIdeProjects, requireSessionProject, readJsonBody, loadUserIdeDevices, loadAvailableProcessorBoards, platformSoftwareUnits, buildConfigForBoard, compilerBoardConfiguration, telemetryJson, webPushService }) {
async function handleLearningProjectStart(res, session, catalogProjectId) {
  const definition = userIdeState.projectDefinitions
    .find((item) => item.project_server_id === catalogProjectId || catalogProjectIdForDefinition(item) === catalogProjectId);
  if (!definition) {
    sendJson(res, 404, { error: "learning_project_not_found", message: "Dieses Lernprojekt ist im Katalog nicht vorhanden." });
    return;
  }

  const userId = projectServerUserId(session);
  const existing = await projectServerJson(`/api/projects?user_id=${encodeURIComponent(userId)}&profile=summary`);
  const existingSummary = existing.items.find((item) => item.learning_project_id === definition.learning_project_id
    && item.project_id !== definition.project_server_id
    && item.entry_mode !== "standalone_lesson");
  const alreadyStarted = existingSummary
    ? await projectServerJson(`/api/projects/${encodeURIComponent(existingSummary.project_id)}`)
    : null;
  const projectId = `learning_${definition.slug}_${crypto.randomUUID().slice(0, 8)}`;
  const project = alreadyStarted
    ? await synchronizeLearningProjectOnStart(alreadyStarted, definition)
    : await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: userId,
      plan_id: accountSubscription(session).plan_id,
      title: definition.title,
      description: definition.summary,
      learning_project_id: definition.learning_project_id,
      hardware_profile_id: definition.hardware_profile_id,
      device_id: null,
      build_config: definition.build_config,
      ...(definition.system_source_id ? { system_source_id: definition.system_source_id } : {}),
      view_manifest: projectViewManifest(definition),
      sources: demoProjectSources(definition, { projectId }),
    },
    });
  const mapped = mapProjectServerProject(session, project);
  invalidateUserIdeProjectCaches(userId);
  touchWorkspace(session, project.project_id, "learn", `/app/learning-project/?project=${encodeURIComponent(project.project_id)}`);
  const progress = alreadyStarted
    ? (await learningProgress.list(userId, [mapped]))[0]
    : learningProgress.empty(userId, mapped);
  const learningFeedbackSubmitted = progress.status === "completed"
    ? await learningProgress.hasSubmittedFeedback(userId, mapped.project_server_id)
    : false;
  sendJson(res, alreadyStarted ? 200 : 201, {
    project: toPlatformProject(mapped),
    learning_progress: progress,
    learning_feedback_submitted: learningFeedbackSubmitted,
    created: !alreadyStarted,
  });
}

async function synchronizeLearningProjectOnStart(project, definition) {
  const canonicalManifest = learningProjectManifestForPersistedProject(project, definition);
  const needsManifestSync = Number(canonicalManifest?.schema_version || 0)
    > Number(project.view_manifest?.schema_version || 0);
  const existingPaths = new Set((project.source_files || []).map((source) => source.path));
  const needsSourceSync = demoProjectSources(definition, { projectId: project.project_id })
    .some((source) => !existingPaths.has(source.path));
  const needsLegacyNexiCheck = definition.slug === nexiCourseModel.slug;
  if (!needsManifestSync && !needsSourceSync && !needsLegacyNexiCheck) return project;
  return synchronizeLearningProjectStructure(project, definition);
}

async function handlePlatformProjectRead(res, session, projectId) {
  const definition = userIdeState.projectDefinitions
    .find((item) => item.project_server_id === projectId || catalogProjectIdForDefinition(item) === projectId);
  if (definition) {
    const catalogProject = mapUserIdeProjects(session, new Map())
      .find((item) => item.project_server_id === catalogProjectIdForDefinition(definition));
    sendJson(res, 200, { project: toPlatformProject(catalogProject) });
    return;
  }
  try {
    const project = await requireSessionProject(session, projectId);
    const isLearningProject = project.project_origin === "account_project"
      && project.learning_project_id?.startsWith("learning_project.");
    const userId = projectServerUserId(session);
    const [progress] = isLearningProject
      ? await learningProgress.list(userId, [project])
      : [null];
    const learningFeedbackSubmitted = progress?.status === "completed"
      ? await learningProgress.hasSubmittedFeedback(userId, project.project_server_id)
      : false;
    sendJson(res, 200, {
      project: toPlatformProject(project),
      ...(progress ? { learning_progress: progress } : {}),
      ...(isLearningProject ? { learning_feedback_submitted: learningFeedbackSubmitted } : {}),
    });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.status === 404 ? "project_not_found" : "project_load_failed",
      message: error.message || "Das Projekt konnte nicht geladen werden.",
    });
  }
}

async function handleDevelopmentLessonStart(res, session, catalogProjectId, lessonId) {
  const definition = userIdeState.projectDefinitions
    .find((item) => item.project_server_id === catalogProjectId || catalogProjectIdForDefinition(item) === catalogProjectId);
  const lesson = definition?.development_lessons?.find((item) => item.id === lessonId);
  if (!definition || !lesson) {
    sendJson(res, 404, {
      error: "development_lesson_not_found",
      message: "Diese Entwicklungslesson ist im gewählten Entwicklungsprojekt nicht vorhanden.",
    });
    return;
  }

  const userId = projectServerUserId(session);
  const projectId = `lesson_${lesson.id.replace(/[^a-zA-Z0-9]+/g, "_")}_${crypto.randomUUID().slice(0, 8)}`;
  const project = await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      user_id: userId,
      plan_id: accountSubscription(session).plan_id,
      title: `${lesson.title} – Einzelübung`,
      description: lesson.summary,
      learning_project_id: definition.learning_project_id,
      hardware_profile_id: lesson.standalone_start.runtime,
      device_id: null,
      build_config: null,
      view_manifest: projectViewManifest(definition, { lessonId: lesson.id }),
      sources: demoProjectSources(definition, { lessonId: lesson.id, projectId }),
    },
  });
  const mapped = mapProjectServerProject(session, project);
  touchWorkspace(session, project.project_id, "learn", `/app/learning-project/?project=${encodeURIComponent(project.project_id)}`);
  sendJson(res, 201, {
    project: toPlatformProject(mapped),
    created: true,
    entryMode: "standalone_lesson",
    lessonId: lesson.id,
  });
}

async function synchronizeLearningProjectStructure(project, definition) {
  const projectId = project.project_id;
  const isLegacyNexiBuild = definition.slug === nexiCourseModel.slug
    && project.build_config?.environment !== definition.build_config?.environment;
  const needsBuildConfig = !project.build_config?.user_source_path || isLegacyNexiBuild;
  const canonicalManifest = learningProjectManifestForPersistedProject(project, definition);
  const updated = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: {
      view_manifest: canonicalManifest,
      ...(needsBuildConfig ? { build_config: definition.build_config } : {}),
    },
  });
  const lessonId = canonicalManifest.entry_mode === "standalone_lesson"
    ? canonicalManifest.lesson_focus_id
    : "";
  for (const source of demoProjectSources(definition, { lessonId, projectId })) {
    const persistedSource = await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(source.path)}`)
      .catch((error) => {
        if (error.status === 404) return null;
        throw error;
      });
    const isLegacyNexiManifest = definition.slug === nexiCourseModel.slug
      && source.path === "project-app/manifest.json"
      && persistedSource?.content?.includes('"app_id": "nexi"')
      && projectAppManifestVersion(persistedSource.content) < 3;
    if (!persistedSource || isLegacyNexiManifest) {
      await projectServerJson(`/api/projects/${encodeURIComponent(projectId)}/sources`, { method: "PUT", body: source });
    }
  }
  return updated;
}

function projectAppManifestVersion(content) {
  try {
    return Number(JSON.parse(content || "{}").manifest_version) || 0;
  } catch {
    return 0;
  }
}

function learningProjectManifestForPersistedProject(project, definition) {
  const lessonId = project.view_manifest?.entry_mode === "standalone_lesson"
    ? project.view_manifest.lesson_focus_id || ""
    : "";
  return projectViewManifest(definition, { lessonId });
}

async function handleLearningProjectDeviceAssign(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.learning_project_id || project.project_origin !== "account_project") {
    sendJson(res, 409, { error: "learning_project_required", message: "Ein Board kann hier nur einem eigenen Lernprojekt zugeordnet werden." });
    return;
  }
  const body = await readJsonBody(req);
  const deviceId = String(body.device_id || "").trim();
  const boardProfileId = String(body.board_profile_id || "").trim();
  const device = deviceId ? (await loadUserIdeDevices(session)).find((item) => item.device_id === deviceId) : null;
  if (deviceId && !device) { sendJson(res, 404, { error: "inventory_device_not_found", message: "Das gewaehlte Board ist nicht in deinem Inventar." }); return; }
  const availableBoards = await loadAvailableProcessorBoards(session);
  let selectedBoard = boardProfileId
    ? availableBoards.find((board) => [board.hardware_item_id, board.hardware_profile_id, board.id].filter(Boolean).includes(boardProfileId))
    : null;
  if (boardProfileId && !selectedBoard) { sendJson(res, 404, { error: "board_configuration_not_found", message: "Die gewaehlte GerNetiX- oder Account-Boardkonfiguration wurde nicht gefunden." }); return; }
  if (!selectedBoard && device) {
    selectedBoard = availableBoards.find((board) => String(board.base_board_profile_id || board.hardware_item_id) === String(device.hardware_profile_id)) || null;
  }
  if (selectedBoard && device && String(selectedBoard.base_board_profile_id || selectedBoard.hardware_item_id) !== String(device.hardware_profile_id)) {
    sendJson(res, 409, { error: "inventory_board_target_mismatch", message: "Inventar-Device und gewähltes Compiler-Board verwenden nicht dasselbe physische Boardprofil." });
    return;
  }
  const softwareUnits = platformSoftwareUnits(project);
  const softwareUnitId = String(body.software_unit_id || project.active_software_unit_id || softwareUnits[0]?.software_unit_id || "").trim();
  const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === softwareUnitId) || null;
  if (!softwareUnit) { sendJson(res, 404, { error: "software_unit_not_found", message: "Die gewählte Softwareeinheit gehört nicht zu diesem Lernprojekt." }); return; }
  if (softwareUnit.build_system !== "platformio") { sendJson(res, 409, { error: "software_unit_target_not_board", message: "Diese Softwareeinheit besitzt kein PlatformIO-Boardziel." }); return; }
  const baseBoardId = selectedBoard?.base_board_profile_id || device?.hardware_profile_id || softwareUnit.build_config?.board_configuration?.base_board_profile_id || project.hardware_profile_id;
  let buildConfig = buildConfigForBoard(selectedBoard || baseBoardId, softwareUnit.build_config || project.build_config);
  if (buildConfig && selectedBoard) buildConfig = {
    ...buildConfig,
    board_configuration: compilerBoardConfiguration(null, selectedBoard),
  };
  const nextSoftwareUnits = softwareUnits.map((unit) => unit.software_unit_id === softwareUnitId ? {
    ...unit,
    device_id: deviceId || unit.device_id || "",
    build_config: buildConfig,
  } : unit);
  const updated = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      device_id: device?.device_id || project.device_id || "",
      hardware_profile_id: baseBoardId,
      build_config: buildConfig,
      software_units: nextSoftwareUnits,
      active_software_unit_id: softwareUnitId,
    },
  });
  sendJson(res, 200, { project: toPlatformProject(mapProjectServerProject(session, updated)), device, board: selectedBoard, software_unit_id: softwareUnitId });
}

async function handlePlatformProjectDelete(res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!['development_project', 'custom_project'].includes(project.area)) {
    sendJson(res, 400, { error: 'not_development_project', message: 'Nur eigene Entwicklungsprojekte koennen geloescht werden.' });
    return;
  }
  const accountId = projectServerUserId(session);
  const telemetryPath = `/api/telemetry/internal/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(project.project_server_id)}/data`;
  const telemetry = await telemetryJson(telemetryPath, { method: 'DELETE' });
  const push = await webPushService.unsubscribeProject(accountId, project.project_server_id);
  const deletion = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, { method: 'DELETE' });
  sendJson(res, 200, { deleted: true, project_id: project.project_server_id, project: deletion, telemetry, push });
}


  return {
    handleLearningProjectStart,
    handlePlatformProjectRead,
    handleDevelopmentLessonStart,
    handleLearningProjectDeviceAssign,
    handlePlatformProjectDelete,
    learningProjectManifestForPersistedProject,
    synchronizeLearningProjectStructure,
  };
}

module.exports = { createLearningProjectService };
