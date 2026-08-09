"use strict";

function createProjectConfigurationService({ readJsonBody, projectServerUserId, developmentProjectTemplate, requireEntitlements, requiredField, templateBuildConfig, templateHardwareConfiguration, templateSoftwareUnits, loadAvailableProcessorBoards, sendJson, compilerBoardConfiguration, normalizeHardwareConfiguration, defaultProjectCommunicationSetup, applyProjectCommunicationSetup, slugifyProjectId, templateArchitecturePlantUml, developmentProjectSources, templateFirmwareSources, templateHardwareProfileId, projectServerJson, accountSubscription, developmentProjectViewManifest, defaultHomeAutomationConfiguration, defaultTouchscreenGameConfiguration, touchWorkspace, toPlatformProject, mapProjectServerProject, requireSessionProject, normalizeArchitectureDiagram, architectureDiagramFromManifest, projectSources, hardwareConfigurationFromManifest, loadUserIdeProjects, initialArchitecturePlantUml, normalizeArchitectureDialog, normalizeHomeAutomationConfiguration, normalizeTouchscreenGameConfiguration, isTouchscreenGameBoard, buildConfigForBoard, touchscreenGameInventoryMatches, mergeSelectedGamesHeader, developmentSoftwareUnits, loadUserIdeDevices, hardwareConfigurationSources, hardwareWiringPlantUml, loadProcessorBoards, normalizeBasissoftwareConfiguration, platformSoftwareUnits, normalizeProjectCommunicationSetup }) {
async function handleDevelopmentProjectCreate(req, res, session) {
  const body = await readJsonBody(req);
  const userId = projectServerUserId(session);
  const template = developmentProjectTemplate(body.template_id);
  if (!requireEntitlements(res, session, template.requiredEntitlements || [])) return;
  const title = requiredField(body.title || template.title || "Neues Entwicklungsprojekt", "title").slice(0, 120);
  const description = String(body.description || template.description || "Architektur-Discovery-Projekt").trim().slice(0, 1000);
  let buildConfig = templateBuildConfig(template);
  let hardwareConfiguration = templateHardwareConfiguration(template);
  let softwareUnits = templateSoftwareUnits(template);
  let selectedPlaygroundBoard = null;
  if (template.id === "ai_board_playground") {
    const requestedBoardId = requiredField(body.board_profile_id, "board_profile_id").slice(0, 180);
    const boards = await loadAvailableProcessorBoards(session);
    selectedPlaygroundBoard = boards.find((board) => board.hardware_item_id === requestedBoardId);
    if (!selectedPlaygroundBoard?.platformio_build?.board) {
      sendJson(res, 409, {
        error: "board_playground_board_unavailable",
        message: "Das gewählte Board ist nicht als buildfähiges GerNetiX-Boardprofil verfügbar.",
      });
      return;
    }
    const catalogBuild = selectedPlaygroundBoard.platformio_build;
    buildConfig = {
      ...catalogBuild,
      libraries: Array.isArray(catalogBuild.libraries) ? catalogBuild.libraries : [],
      build_flags: Array.isArray(catalogBuild.build_flags) ? catalogBuild.build_flags : [],
      platformio_options: catalogBuild.platformio_options || {},
      firmware_basis_id: catalogBuild.firmware_basis_id || "gernetix-runtime-basissoftware",
      firmware_basis_version: catalogBuild.firmware_basis_version || "workspace",
      firmware_basis_variant: catalogBuild.firmware_basis_variant || "full",
      partition_profile_id: catalogBuild.partition_profile_id || "full",
      user_source_path: "src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
      board_configuration: compilerBoardConfiguration(null, selectedPlaygroundBoard),
    };
    softwareUnits = [{
      software_unit_id: "board_playground",
      title: "Board-Spielprojekt",
      software_kind: "embedded_firmware",
      build_system: "platformio",
      source_root: "Komponenten/IoT-Device 1",
      entrypoint: "src/user_main.cpp",
      device_id: "",
      hardware_profile_id: selectedPlaygroundBoard.hardware_item_id,
      build_config: structuredClone(buildConfig),
    }];
    hardwareConfiguration = {
      schema_version: 6,
      components: [{
        component_id: "device",
        label: selectedPlaygroundBoard.title || "Ausgewähltes Board",
        plantuml_type: "rectangle",
        abstract_type: "iot_device",
        concrete_type: "processor_board",
        board_profile_id: selectedPlaygroundBoard.hardware_item_id,
        board_configuration: compilerBoardConfiguration(null, selectedPlaygroundBoard),
      }],
    };
  }
  if (softwareUnits.length) {
    const boards = await loadAvailableProcessorBoards(session);
    const missingBoard = softwareUnits.find((unit) => !boards.some((board) => board.hardware_item_id === unit.hardware_profile_id));
    if (missingBoard) {
      sendJson(res, 409, {
        error: "project_template_board_missing",
        message: `Das Boardprofil ${missingBoard.hardware_profile_id} fuer ${missingBoard.title} ist nicht verfügbar.`,
      });
      return;
    }
    softwareUnits = softwareUnits.map((unit) => {
      const board = boards.find((item) => item.hardware_item_id === unit.hardware_profile_id);
      const catalogBuild = board.platformio_build || {};
      return {
        ...unit,
        build_config: {
          ...unit.build_config,
          ...catalogBuild,
          board: unit.build_config.board || catalogBuild.board,
          framework: unit.build_config.framework || catalogBuild.framework,
          environment: unit.build_config.environment || catalogBuild.environment,
          libraries: unit.build_config.libraries || [],
          build_flags: unit.build_config.build_flags || [],
          platformio_options: unit.build_config.platformio_options || {},
          firmware_basis_id: unit.build_config.firmware_basis_id || "",
          firmware_basis_version: unit.build_config.firmware_basis_version || "",
          firmware_basis_variant: unit.build_config.firmware_basis_variant || "",
          partition_profile_id: unit.build_config.partition_profile_id || "",
          user_source_path: unit.build_config.user_source_path,
          user_target_path: unit.build_config.user_target_path,
          board_configuration: compilerBoardConfiguration(null, board),
        },
      };
    });
    if (hardwareConfiguration) {
      hardwareConfiguration.components = hardwareConfiguration.components.map((component) => {
        if (component.abstract_type !== "iot_device" || !component.board_profile_id) return component;
        const board = boards.find((item) => item.hardware_item_id === component.board_profile_id);
        return {
          ...component,
          board_configuration: compilerBoardConfiguration(null, board),
        };
      });
    }
    buildConfig = softwareUnits[0].build_config;
  }
  if (template.id === "touchscreen_game_collection") {
    const boards = await loadAvailableProcessorBoards(session);
    const board = boards.find((item) => item.hardware_item_id === "hardware.processor_board.esp32_s3_es3c28p");
    if (!board) {
      sendJson(res, 409, { error: "game_template_board_missing", message: "Das ES3C28P-Boardprofil für die Spielesammlung ist nicht verfügbar." });
      return;
    }
    buildConfig = { ...buildConfig, flash_size_mb: 16, board_configuration: compilerBoardConfiguration(null, board) };
  }
  if (hardwareConfiguration) {
    hardwareConfiguration = normalizeHardwareConfiguration(hardwareConfiguration, {
      software_units: softwareUnits,
      build_config: buildConfig,
    });
  }
  let communicationSetup = null;
  if (template.id === "esp32_camera_to_touch_display") {
    const defaultCommunication = defaultProjectCommunicationSetup(softwareUnits);
    const derivedCommunication = applyProjectCommunicationSetup(softwareUnits, {
      ...defaultCommunication,
      mode: "device_access_point",
    });
    communicationSetup = derivedCommunication.setup;
    softwareUnits = derivedCommunication.software_units;
    buildConfig = softwareUnits[0]?.build_config || buildConfig;
  }
  const projectId = `dev_project_${slugifyProjectId(title)}_${Date.now().toString(36)}`;
  const initialSource = template.id === "empty" ? "" : templateArchitecturePlantUml(template, title);
  const sources = developmentProjectSources({ title, description, architectureSource: initialSource })
    .concat(templateFirmwareSources(template, title));
  const templateVariant = selectedPlaygroundBoard
    ? `_${slugifyProjectId(selectedPlaygroundBoard.hardware_item_id)}`
    : "";
  const templateProjectId = `system_template_${template.id}${templateVariant}_v${template.schemaVersion}`;
  if (template.id !== "empty") {
    const existingTemplate = await projectServerJson(`/api/projects/${encodeURIComponent(templateProjectId)}`).catch((error) => error.status === 404 ? null : Promise.reject(error));
    if (!existingTemplate) await projectServerJson("/api/projects", {
      method: "POST",
      body: {
        project_id: templateProjectId, user_id: "system", title: template.title, description: template.description,
        learning_project_id: "system_template", hardware_profile_id: templateHardwareProfileId(template), build_config: buildConfig,
        ...(softwareUnits.length ? { software_units: softwareUnits, active_software_unit_id: softwareUnits[0].software_unit_id } : {}),
        status: "template", view_manifest: { template_id: template.id, template_ref: { version: template.schemaVersion } }, sources,
      },
    });
  }
  const project = await projectServerJson("/api/projects", {
    method: "POST",
    body: {
      project_id: projectId,
      ...(template.id !== "empty" ? { template_project_id: templateProjectId } : {}),
      user_id: userId,
      plan_id: accountSubscription(session).plan_id,
      title,
      description,
      learning_project_id: "development_project",
      hardware_profile_id: templateHardwareProfileId(template),
      device_id: null,
      build_config: buildConfig,
      ...(softwareUnits.length ? { software_units: softwareUnits, active_software_unit_id: softwareUnits[0].software_unit_id } : {}),
      view_manifest: developmentProjectViewManifest({
        title,
        description,
        source: initialSource,
        buildConfig,
        templateId: template.id,
        templateModelVersion: template.schemaVersion,
        hardwareConfiguration,
        communicationSetup,
        homeAutomationConfiguration: template.id === "distributed_home_automation"
          ? defaultHomeAutomationConfiguration()
          : null,
        gameConfiguration: template.id === "touchscreen_game_collection"
          ? defaultTouchscreenGameConfiguration()
          : null,
        dataLoggerConfiguration: template.dataLogger,
      }),
      ...(template.id === "empty" ? { sources } : {}),
    },
  });
  touchWorkspace(session, project.project_id, "development-platform", "/app/development-platform/");
  sendJson(res, 201, { project: toPlatformProject(mapProjectServerProject(session, project)) });
}

async function handleDevelopmentProjectArchitectureSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Architektur-Discovery kann nur in eigenen Entwicklungsprojekten gespeichert werden." });
    return;
  }
  const body = await readJsonBody(req);
  const diagram = normalizeArchitectureDiagram(body.architectureDiagram || body.architecture_diagram || body.diagram);
  if (!diagram.source) {
    sendJson(res, 400, { error: "missing_diagram", message: "Keine PlantUML-Quelle zum Speichern vorhanden." });
    return;
  }
  const title = String(body.title || project.title || diagram.title || "Architektur").trim().slice(0, 120);
  const description = String(body.description || project.summary || diagram.summary || "").trim().slice(0, 1000);
  const sources = developmentProjectSources({ title, description, diagram, architectureSource: diagram.source });
  const expectedHeadSha = await projectSources.persistGenerated(project, sources, "Architekturansichten aktualisiert");
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      ...(expectedHeadSha ? { expected_head_sha: expectedHeadSha } : {}),
      title,
      description,
      view_manifest: developmentProjectViewManifest({
        title,
        description,
        source: diagram.source,
        diagram,
        buildConfig: project.build_config,
        architectureDialog: project.view_manifest?.architecture_dialog,
        templateId: project.view_manifest?.template_id,
        templateModelVersion: project.view_manifest?.template_ref?.model_schema_version,
        hardwareConfiguration: hardwareConfigurationFromManifest(project.view_manifest),
        homeAutomationConfiguration: project.view_manifest?.home_automation_configuration,
        gameConfiguration: project.view_manifest?.game_configuration,
        pwaDashboardConfiguration: project.view_manifest?.pwa_dashboard,
        dataLoggerConfiguration: project.view_manifest?.data_logger,
        eventConfiguration: project.view_manifest?.event_configuration,
        communicationSetup: project.view_manifest?.communication_setup,
      }),
      build_config: project.build_config || null,
    },
  });
  touchWorkspace(session, project.project_server_id, "development-platform", "/app/development-platform/");
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, { project: toPlatformProject(updated), saved_at: new Date().toISOString(), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleDevelopmentProjectDialogSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Architektur-Dialog kann nur in eigenen Entwicklungsprojekten gespeichert werden." });
    return;
  }

  const body = await readJsonBody(req);
  const existingManifest = project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.summary,
    source: initialArchitecturePlantUml(project.title),
    buildConfig: project.build_config,
  });
  const diagram = normalizeArchitectureDiagram(body.architectureDiagram || existingManifest.architecture_dialog?.architectureDiagram || architectureDiagramFromManifest(existingManifest));
  const architectureDialog = normalizeArchitectureDialog(body, diagram);
  const homeAutomationConfiguration = normalizeHomeAutomationConfiguration(
    body.homeAutomationConfiguration || body.home_automation_configuration || existingManifest.home_automation_configuration,
  );
  const gameConfiguration = normalizeTouchscreenGameConfiguration(
    body.gameConfiguration || body.game_configuration || existingManifest.game_configuration,
  );
  if (gameConfiguration?.board_configuration?.source === "custom_draft") {
    sendJson(res, 409, { error: "custom_board_not_saved", message: "Die geänderte Touch-Display-Boardkonfiguration muss zuerst als eigenes Board gespeichert werden." });
    return;
  }
  let buildConfig = project.build_config || null;
  let selectedBoard = null;
  let selectedInventoryDevice = null;
  if (existingManifest.template_id === "touchscreen_game_collection" && gameConfiguration) {
    const boards = await loadAvailableProcessorBoards(session);
    selectedBoard = boards.find((board) => board.hardware_item_id === gameConfiguration.board_profile_id) || null;
    if (gameConfiguration.board_profile_id && !selectedBoard) {
      sendJson(res, 409, { error: "game_board_not_found", message: "Das gewaehlte Touch-Display-Board ist nicht mehr im Hardware-Katalog vorhanden." });
      return;
    }
    if (selectedBoard && !isTouchscreenGameBoard(selectedBoard)) {
      sendJson(res, 409, { error: "game_board_not_touchscreen", message: "Das gewaehlte Board besitzt laut Hardware-Katalog keinen integrierten Touchscreen." });
      return;
    }
    if (selectedBoard) {
      buildConfig = buildConfigForBoard(selectedBoard, buildConfig);
      const configuredFlashValue = gameConfiguration.board_configuration?.board_features?.flash?.value || "";
      const configuredFlashSizeMb = Number(String(configuredFlashValue).match(/^(\d+)_mb$/)?.[1] || 0);
      if (buildConfig) {
        buildConfig.board_configuration = compilerBoardConfiguration(gameConfiguration.board_configuration, selectedBoard);
        if ([4, 8, 16].includes(configuredFlashSizeMb)) buildConfig.flash_size_mb = configuredFlashSizeMb;
      }
    }
    if (gameConfiguration.inventory_device_id) {
      const inventoryDevices = await loadUserIdeDevices(session);
      selectedInventoryDevice = inventoryDevices.find((device) => device.device_id === gameConfiguration.inventory_device_id) || null;
      if (!selectedInventoryDevice) {
        sendJson(res, 404, { error: "game_inventory_device_not_found", message: "Das gewaehlte Inventar-Board wurde nicht gefunden." });
        return;
      }
      const physicalBoardProfileId = selectedBoard?.base_board_profile_id || gameConfiguration.board_profile_id;
      if (physicalBoardProfileId && !touchscreenGameInventoryMatches(physicalBoardProfileId, selectedInventoryDevice)) {
        sendJson(res, 409, { error: "game_inventory_device_not_compatible", message: "Das Inventar-Board entspricht nicht dem gewaehlten Touch-Display-Board." });
        return;
      }
    }
    if (buildConfig) {
      buildConfig = {
        ...buildConfig,
        component_device_allocations: selectedInventoryDevice ? [{
          component_path: "Komponenten/IoT-Device 1",
          device_id: selectedInventoryDevice.device_id,
          allocated_at: new Date().toISOString(),
        }] : [],
      };
    }
    const selectedGamesPath = "Komponenten/IoT-Device 1/include/config/selected_games.h";
    const existingSelectedGames = await projectServerJson(
      `/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(selectedGamesPath)}`,
    ).catch(() => null);
    await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, {
      method: "PUT",
      body: {
        path: selectedGamesPath,
        role: "user_code",
        content_type: "text/x-c++hdr",
        content: mergeSelectedGamesHeader(gameConfiguration.selected_game_ids, existingSelectedGames?.content),
      },
    });
  }
  let softwareUnits = developmentSoftwareUnits(project, diagram, hardwareConfigurationFromManifest(existingManifest), {
    primaryBuildConfig: buildConfig,
  });
  if (existingManifest.communication_setup) {
    softwareUnits = applyProjectCommunicationSetup(softwareUnits, existingManifest.communication_setup).software_units;
  }
  const activeSoftwareUnitId = softwareUnits.some((unit) => unit.software_unit_id === project.active_software_unit_id)
    ? project.active_software_unit_id
    : softwareUnits[0]?.software_unit_id || "";
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      ...(selectedBoard ? { hardware_profile_id: selectedBoard.base_board_profile_id || selectedBoard.hardware_item_id } : {}),
      device_id: selectedInventoryDevice?.device_id || project.device_id || "",
      view_manifest: {
        ...existingManifest,
        architecture_dialog: architectureDialog,
        ...(homeAutomationConfiguration ? { home_automation_configuration: homeAutomationConfiguration } : {}),
        ...(gameConfiguration ? { game_configuration: gameConfiguration } : {}),
      },
      build_config: buildConfig,
      software_units: softwareUnits,
      active_software_unit_id: activeSoftwareUnitId,
    },
  });
  touchWorkspace(session, project.project_server_id, "development-platform", "/app/development-platform/");
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, { project: toPlatformProject(updated), saved_at: new Date().toISOString(), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleDevelopmentProjectHardwareSave(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!["development_project", "custom_project"].includes(project.area)) {
    sendJson(res, 400, { error: "not_development_project", message: "Hardware kann nur in eigenen Entwicklungsprojekten konfiguriert werden." });
    return;
  }
  const body = await readJsonBody(req);
  const existingManifest = project.view_manifest || developmentProjectViewManifest({
    title: project.title,
    description: project.summary,
    source: initialArchitecturePlantUml(project.title),
    buildConfig: project.build_config,
  });
  const diagram = architectureDiagramFromManifest(existingManifest);
  const hardwareConfiguration = normalizeHardwareConfiguration(body.hardware_configuration || body.hardwareConfiguration, project);
  const unsavedBoard = hardwareConfiguration.components.find((component) => component.abstract_type === "iot_device" && component.board_configuration?.source === "custom_draft");
  if (unsavedBoard) {
    sendJson(res, 409, { error: "custom_board_not_saved", message: `Die geänderte Boardkonfiguration für ${unsavedBoard.label} muss zuerst als eigenes Board gespeichert werden.` });
    return;
  }
  const boardComponent = hardwareConfiguration.components.find((component) => component.abstract_type === "iot_device" && component.board_profile_id);
  const availableBoards = boardComponent ? await loadAvailableProcessorBoards(session) : [];
  const selectedBoard = boardComponent
    ? availableBoards.find((board) => [board.hardware_item_id, board.hardware_profile_id, board.id]
      .filter(Boolean).some((id) => String(id) === String(boardComponent.board_profile_id))) || null
    : null;
  if (boardComponent && !selectedBoard) {
    sendJson(res, 409, { error: "project_board_not_found", message: "Das gewaehlte Board ist nicht mehr im Hardware-Katalog oder in deinen Account-Boards vorhanden." });
    return;
  }
  if (existingManifest.template_id === "touchscreen_game_collection" && selectedBoard && !isTouchscreenGameBoard(selectedBoard)) {
    sendJson(res, 409, { error: "game_board_not_touchscreen", message: "Die Spielesammlung benoetigt ein Board mit integriertem Touchscreen." });
    return;
  }
  const selectedBoardConfiguration = boardComponent
    ? compilerBoardConfiguration(boardComponent.board_configuration, selectedBoard)
    : null;
  const selectedBaseBoardId = selectedBoardConfiguration?.base_board_profile_id
    || selectedBoard?.base_board_profile_id
    || boardComponent?.board_profile_id
    || "";
  const baseBuildConfig = boardComponent
    ? buildConfigForBoard(selectedBoard || selectedBaseBoardId, project.build_config)
    : project.build_config;
  const inventoryDevices = await loadUserIdeDevices(session);
  const allocations = [];
  let primaryInventoryDevice = null;
  for (const component of hardwareConfiguration.components.filter((item) => item.abstract_type === "iot_device")) {
    component.inventory_device_label = "";
  }
  for (const component of hardwareConfiguration.components.filter((item) => item.abstract_type === "iot_device" && item.inventory_device_id)) {
    const inventoryDevice = inventoryDevices.find((device) => device.device_id === component.inventory_device_id);
    if (!inventoryDevice) {
      sendJson(res, 404, { error: "device_not_found", message: `Das Inventar-Device fuer ${component.label} wurde nicht gefunden.` });
      return;
    }
    const physicalBoardProfileId = component.board_configuration?.base_board_profile_id || component.board_profile_id;
    if (physicalBoardProfileId && inventoryDevice.hardware_profile_id !== physicalBoardProfileId) {
      sendJson(res, 409, { error: "device_not_compatible", message: `Das Inventar-Device fuer ${component.label} entspricht nicht dem gewaehlten Board.` });
      return;
    }
    component.inventory_device_label = String(inventoryDevice.display_name || inventoryDevice.device_id).slice(0, 180);
    primaryInventoryDevice ||= inventoryDevice;
    allocations.push({
      component_path: component.component_path,
      device_id: inventoryDevice.device_id,
      allocated_at: new Date().toISOString(),
    });
  }
  const allocatedBasissoftwareProfile = primaryInventoryDevice?.instance_configuration?.basissoftware_profile || null;
  const allocatedFlashValue = primaryInventoryDevice?.instance_configuration?.board_features?.flash?.value || "";
  const allocatedFlashSizeMb = Number(String(allocatedFlashValue).match(/^(\d+)_mb$/)?.[1] || 0);
  const configuredFlashValue = selectedBoardConfiguration?.board_features?.flash?.value || "";
  const configuredFlashSizeMb = Number(String(configuredFlashValue).match(/^(\d+)_mb$/)?.[1] || 0);
  const buildConfig = baseBuildConfig ? {
    ...baseBuildConfig,
    board_configuration: selectedBoardConfiguration,
    component_device_allocations: allocations,
    ...(allocatedBasissoftwareProfile ? {
      firmware_basis_variant: allocatedBasissoftwareProfile.class,
      partition_profile_id: allocatedBasissoftwareProfile.partition_profile_id,
      flash_size_mb: allocatedFlashSizeMb || undefined,
    } : {}),
    ...(!allocatedBasissoftwareProfile && [4, 8, 16].includes(configuredFlashSizeMb) ? { flash_size_mb: configuredFlashSizeMb } : {}),
  } : null;
  let softwareUnits = developmentSoftwareUnits(project, diagram, hardwareConfiguration, {
    primaryBuildConfig: buildConfig,
    boards: availableBoards,
  });
  if (existingManifest.communication_setup) {
    softwareUnits = applyProjectCommunicationSetup(softwareUnits, existingManifest.communication_setup).software_units;
  }
  const activeSoftwareUnitId = softwareUnits.some((unit) => unit.software_unit_id === project.active_software_unit_id)
    ? project.active_software_unit_id
    : softwareUnits[0]?.software_unit_id || "";
  const gameConfiguration = existingManifest.template_id === "touchscreen_game_collection"
    ? normalizeTouchscreenGameConfiguration({
        ...(existingManifest.game_configuration || defaultTouchscreenGameConfiguration()),
        board_profile_id: selectedBoard?.hardware_item_id || boardComponent?.board_profile_id || "",
        board_configuration: selectedBoardConfiguration,
        inventory_device_id: primaryInventoryDevice?.device_id || "",
      })
    : existingManifest.game_configuration;
  const sources = hardwareConfigurationSources(hardwareConfiguration, project.title);
  const expectedHeadSha = await projectSources.persistGenerated(project, sources, "Hardwareansichten aktualisiert");
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      ...(expectedHeadSha ? { expected_head_sha: expectedHeadSha } : {}),
      hardware_profile_id: selectedBaseBoardId || project.hardware_profile_id,
      device_id: primaryInventoryDevice?.device_id || "",
      build_config: buildConfig || null,
      software_units: softwareUnits,
      active_software_unit_id: activeSoftwareUnitId,
      view_manifest: developmentProjectViewManifest({
        title: project.title,
        description: project.summary,
        source: diagram.source,
        diagram,
        buildConfig,
        architectureDialog: existingManifest.architecture_dialog,
        templateId: existingManifest.template_id,
        templateModelVersion: existingManifest.template_ref?.model_schema_version,
        hardwareConfiguration,
        communicationSetup: existingManifest.communication_setup,
        homeAutomationConfiguration: existingManifest.home_automation_configuration,
        gameConfiguration,
        pwaDashboardConfiguration: existingManifest.pwa_dashboard,
        dataLoggerConfiguration: existingManifest.data_logger,
        eventConfiguration: existingManifest.event_configuration,
      }),
    },
  });
  touchWorkspace(session, project.project_server_id, "development-hardware", `/app/development-platform/hardware/?project=${encodeURIComponent(project.project_server_id)}`);
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  sendJson(res, 200, {
    project: toPlatformProject(updated),
    configuration_projection: persistedProject.configuration_projection || null,
    hardware_configuration: hardwareConfiguration,
    hardware_architecture: {
      source: hardwareWiringPlantUml(hardwareConfiguration, project.title),
      title: "Hardware-Architektur",
      summary: "Vollstaendige Hardware-Realisierung des Projekts.",
    },
    saved_at: new Date().toISOString(),
  });
}

async function handleProjectComponentFeatures(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.build_config) {
    sendJson(res, 409, { error: "missing_build_config", message: "Das Projekt besitzt keine konfigurierbare Firmware-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const allowed = new Set(["wifi", "mqtt", "ota", "http", "webserver", "measurement_chart"]);
  const enabled = Array.isArray(body.enabled) ? body.enabled.map(String).filter((item) => allowed.has(item)) : [];
  const current = project.build_config.component_features || {};
  const webserver = body.webserver && typeof body.webserver === "object" ? body.webserver : {};
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      build_config: {
        ...project.build_config,
        component_features: {
          ...current,
          enabled,
          webserver: {
            ...(current.webserver || {}),
            title: String(webserver.title || "GerNetiX Device").trim().slice(0, 80),
            measurement_chart: Boolean(webserver.measurement_chart),
            measurement_label: String(webserver.measurement_label || "Messwert").trim().slice(0, 60),
            measurement_unit: String(webserver.measurement_unit || "").trim().slice(0, 16),
          },
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectBasissoftwareConfiguration(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  const body = await readJsonBody(req);
  const softwareUnitId = String(body.software_unit_id || "").trim();
  const softwareUnits = Array.isArray(project.software_units) ? project.software_units : [];
  const softwareUnit = softwareUnits.find((unit) => unit.software_unit_id === softwareUnitId);
  if (!softwareUnit?.build_config?.firmware_basis_id) {
    sendJson(res, 409, { error: "basissoftware_unit_not_found", message: "Die gewählte Software-Einheit besitzt keine konfigurierbare GerNetiX-Basissoftware." });
    return;
  }
  const basissoftwareConfiguration = normalizeBasissoftwareConfiguration(body.configuration);
  let updatedUnits = softwareUnits.map((unit) => unit.software_unit_id === softwareUnitId
    ? { ...unit, build_config: { ...unit.build_config, basissoftware_configuration: basissoftwareConfiguration } }
    : unit);
  if (project.view_manifest?.communication_setup) {
    updatedUnits = applyProjectCommunicationSetup(updatedUnits, project.view_manifest.communication_setup).software_units;
  }
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: { software_units: updatedUnits, active_software_unit_id: softwareUnitId },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), software_unit_id: softwareUnitId, configuration: basissoftwareConfiguration, configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectCommunicationSetup(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  const softwareUnits = platformSoftwareUnits(project);
  const embeddedUnits = softwareUnits.filter((unit) => unit.build_system === "platformio" || unit.software_kind === "embedded_firmware");
  if (embeddedUnits.length < 2) {
    sendJson(res, 409, { error: "communication_setup_requires_multiple_devices", message: "Ein geräteübergreifendes Kommunikationssetup benötigt mindestens zwei IoT-Firmware-Ziele." });
    return;
  }
  const setup = normalizeProjectCommunicationSetup(await readJsonBody(req), softwareUnits);
  const derived = applyProjectCommunicationSetup(softwareUnits, setup);
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: { ...project.view_manifest, communication_setup: derived.setup },
      software_units: derived.software_units,
      active_software_unit_id: project.active_software_unit_id || derived.software_units[0]?.software_unit_id || "",
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), communication_setup: derived.setup, configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectComponentHardwareFeatures(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (!project.build_config) {
    sendJson(res, 409, { error: "missing_build_config", message: "Das Projekt besitzt keine konfigurierbare IoT-Device-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const componentId = String(body.component_id || "").trim();
  const hardwareConfiguration = hardwareConfigurationFromManifest(project.view_manifest);
  const component = hardwareConfiguration?.components?.find((item) => item.component_id === componentId && item.abstract_type === "iot_device");
  if (!component) {
    sendJson(res, 409, { error: "iot_device_component_not_found", message: "Die IoT-Device-Komponente gehoert nicht zur Hardware-Architektur des Projekts." });
    return;
  }
  const boards = await loadProcessorBoards();
  const effectiveBoardId = component.board_configuration?.base_board_profile_id || component.board_profile_id;
  const board = boards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
    .filter(Boolean).some((id) => String(id) === String(effectiveBoardId)));
  if (!board) {
    sendJson(res, 409, { error: "processor_board_not_found", message: "Das reale Board der IoT-Device-Komponente wurde im Hardware Catalog nicht gefunden." });
    return;
  }
  const resources = Array.isArray(board.peripheral_profile?.resources)
    ? board.peripheral_profile.resources
    : [
      { id: "adc", configurable: true, pin_profile_key: "analog_inputs" },
      { id: "pwm", configurable: true, pin_profile_key: "pwm_pins" },
    ];
  const configurable = new Map(resources.filter((item) => item.configurable).map((item) => [String(item.id), item]));
  const enabled = Array.isArray(body.enabled)
    ? Array.from(new Set(body.enabled.map(String).filter((item) => configurable.has(item))))
    : [];
  const unsupported = enabled.filter((item) => {
    const resource = configurable.get(item);
    if (resource.supported === false) return true;
    if (!resource.pin_profile_key) return false;
    return !Array.isArray(board.pin_profile?.[resource.pin_profile_key]) || board.pin_profile[resource.pin_profile_key].length === 0;
  });
  if (unsupported.length) {
    sendJson(res, 409, { error: "board_peripheral_not_supported", message: `Das gewaehlte Board unterstuetzt nicht: ${unsupported.join(", ")}.` });
    return;
  }
  const current = project.build_config.component_hardware_features || {};
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      build_config: {
        ...project.build_config,
        component_hardware_features: {
          ...current,
          [componentId]: { enabled },
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectPwaDashboard(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (project.view_manifest?.template_id !== "iot_datalogger_web_push_pwa") {
    sendJson(res, 409, { error: "pwa_dashboard_not_available", message: "Dieses Projekt besitzt keine konfigurierbare PWA-Dashboard-Komponente." });
    return;
  }
  const body = await readJsonBody(req);
  const pwaDashboard = normalizePwaDashboardConfiguration(body);
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: {
        ...project.view_manifest,
        pwa_dashboard: pwaDashboard,
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

async function handleProjectEventConfiguration(req, res, session, projectId) {
  const project = await requireSessionProject(session, projectId);
  if (project.view_manifest?.template_id !== "event_driven_project_application") {
    sendJson(res, 409, { error: "event_configuration_not_available", message: "Dieses Projekt besitzt keinen konfigurierbaren Ereignis-Worker oder Dispatcher." });
    return;
  }
  const configuration = normalizeEventConfiguration(await readJsonBody(req), project.view_manifest);
  const persistedProject = await projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, {
    method: "PATCH",
    body: {
      view_manifest: {
        ...project.view_manifest,
        event_configuration: {
          ...(project.view_manifest.event_configuration || {}),
          [configuration.kind]: configuration.value,
        },
      },
    },
  });
  const projects = await loadUserIdeProjects(session);
  const updated = projects.find((item) => item.project_server_id === project.project_server_id);
  touchWorkspace(session, project.project_server_id, "ide", `/app/ide/?project=${encodeURIComponent(project.project_server_id)}`);
  sendJson(res, 200, { project: toPlatformProject(updated), configuration_projection: persistedProject.configuration_projection || null });
}

function normalizeEventConfiguration(input = {}, manifest = {}) {
  const kind = String(input.kind || "").trim();
  if (!new Set(["worker", "dispatcher"]).has(kind)) throw new Error("Ungueltige Ereigniskomponente.");
  if (kind === "worker") {
    const triggerType = String(input.trigger_type || "timer");
    if (!new Set(["timer", "project_event"]).has(triggerType)) throw new Error("Ungueltiger Ausloeser.");
    const cycleMinutes = Number(input.cycle_minutes || 15);
    if (!Number.isInteger(cycleMinutes) || cycleMinutes < 1 || cycleMinutes > 10080) throw new Error("Der Timer-Zyklus muss zwischen 1 und 10.080 Minuten liegen.");
    const eventName = String(input.event_name || "").trim().slice(0, 80);
    if (!eventName) throw new Error("Ein Ereignisname wird benoetigt.");
    return { kind, value: { schema_version: 1, event_name: eventName, trigger_type: triggerType, cycle_minutes: cycleMinutes } };
  }
  const conditionType = String(input.condition_type || "event_available");
  if (!new Set(["event_available", "field_equals"]).has(conditionType)) throw new Error("Ungueltige Bedingung.");
  const targetComponentId = String(input.target_component_id || "").trim();
  const components = hardwareConfigurationFromManifest(manifest)?.components || [];
  const validTarget = components.some((component) => component.component_id === targetComponentId && component.abstract_type === "iot_device" && /ziel|target/i.test(`${component.label || ""} ${component.component_path || ""}`));
  if (!validTarget) throw new Error("Waehle ein IoT-Zielgeraet aus diesem Projekt.");
  return {
    kind,
    value: {
      schema_version: 1,
      condition_type: conditionType,
      condition_value: String(input.condition_value || "").trim().slice(0, 120),
      target_component_id: targetComponentId,
      push_enabled: input.push_enabled === true,
    },
  };
}

function normalizePwaDashboardConfiguration(input = {}) {
  const cards = new Set(["current_values", "history", "events", "device_status"]);
  const visibleCards = Array.isArray(input.visible_cards || input.visibleCards)
    ? (input.visible_cards || input.visibleCards).map(String).filter((id) => cards.has(id))
    : Array.from(cards);
  return {
    schema_version: 1,
    title: String(input.title || "Mein Datenlogger").trim().slice(0, 80),
    visible_cards: Array.from(new Set(visibleCards)),
  };
}

function primaryProjectComponentPath(project) {
  return String(project?.build_config?.user_source_path || "").match(/^(Komponenten\/[^/]+)\//)?.[1] || "Komponenten/IoT-Device 1";
}

  return {
    handleDevelopmentProjectCreate,
    handleDevelopmentProjectArchitectureSave,
    handleDevelopmentProjectDialogSave,
    handleDevelopmentProjectHardwareSave,
    handleProjectComponentFeatures,
    handleProjectBasissoftwareConfiguration,
    handleProjectCommunicationSetup,
    handleProjectComponentHardwareFeatures,
    handleProjectPwaDashboard,
    handleProjectEventConfiguration,
    normalizePwaDashboardConfiguration,
  };
}

module.exports = { createProjectConfigurationService };
