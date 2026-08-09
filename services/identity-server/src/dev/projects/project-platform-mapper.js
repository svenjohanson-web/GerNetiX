"use strict";

function createProjectPlatformMapper({
  catalogProjectIdForDefinition,
  developmentProjectViewManifest,
  getUserIdeState,
  getWorkspaceState,
  hardwareConfigurationFromManifest,
  hardwareWiringPlantUml,
  initialArchitecturePlantUml,
  isEstablishedLearningProject,
  isRetiredCatalogProject,
  latestBuildStatus,
  normalizeHardwareConfiguration,
  platformActiveSoftwareUnitId,
  platformSoftwareUnits,
  projectServerUserId,
  projectViewManifest,
  restoreDevelopmentTemplateReference,
}) {
  function mapUserIdeProjectSummaries(session, storedProjects) {
    const userId = projectServerUserId(session);
    const workspace = getWorkspaceState(userId);
    const catalog = getUserIdeState().projectDefinitions.map((definition) => ({
      project_server_id: catalogProjectIdForDefinition(definition),
      owner_user_id: userId,
      title: definition.title,
      summary: definition.summary,
      area: definition.area,
      project_origin: "catalog",
      hardware_profile_id: definition.hardware_profile_id,
      linked_device_id: "",
      linked_device_ids: [],
      slug: definition.slug,
      course_id: definition.course_id,
      lesson_id: definition.lesson_id,
      learning_project_id: definition.learning_project_id,
      entry_mode: "project_story",
      access_model: definition.access_model || "subscription",
      learning_category: definition.learning_category,
      tags: definition.tags || [],
      status: "catalog_template",
      has_project_app: false,
      created_at: "",
      updated_at: "",
    }));
    const accountProjects = storedProjects.map((project) => {
      const definition = getUserIdeState().projectDefinitions
        .find((item) => item.learning_project_id === project.learning_project_id);
      return {
        project_server_id: project.project_id,
        owner_user_id: project.user_id || userId,
        title: project.title || definition?.title || "Projekt",
        summary: project.description || definition?.summary || "",
        area: definition?.area || (project.learning_project_id === "development_project" ? "development_project" : "custom_project"),
        project_origin: "account_project",
        hardware_profile_id: project.hardware_profile_id || definition?.hardware_profile_id || "",
        linked_device_id: project.device_ids?.[0] || project.device_id || "",
        linked_device_ids: project.device_ids || (project.device_id ? [project.device_id] : []),
        slug: definition?.slug || project.project_id,
        course_id: definition?.course_id || "development",
        lesson_id: definition?.lesson_id || "",
        learning_project_id: project.learning_project_id || "",
        entry_mode: project.entry_mode || "project_story",
        access_model: definition?.access_model || "owned",
        learning_category: definition?.learning_category,
        tags: definition?.tags || [],
        status: project.status || "active",
        has_project_app: project.has_project_app === true,
        created_at: project.created_at || "",
        updated_at: project.updated_at || "",
        last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
        last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
      };
    });
    return catalog.concat(accountProjects)
      .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
  }

  function mapUserIdeProjects(session, projectsById) {
    const userId = projectServerUserId(session);
    const definitions = getUserIdeState().projectDefinitions;
    const definitionIds = new Set(definitions.map((definition) => definition.project_server_id));
    const seededProjects = definitions.map((definition) => ({
      ...definition,
      project_server_id: catalogProjectIdForDefinition(definition),
      owner_user_id: userId,
      hardware_profile_id: definition.hardware_profile_id,
      build_config: definition.build_config,
      linked_device_id: "",
      linked_device_ids: [],
      project_origin: "catalog",
      status: "catalog_template",
      last_build_status: "",
      source_count: 0,
      build_count: 0,
      access_model: definition.access_model || "subscription",
      view_manifest: projectViewManifest(definition),
      created_at: "",
      updated_at: "",
      last_opened_mode: "",
      last_opened_at: "",
      source_files: [],
    }));
    const customProjects = Array.from(projectsById.values())
      .filter((project) => !isRetiredCatalogProject(project))
      .filter((project) => !definitionIds.has(project.project_id) || isEstablishedLearningProject(project))
      .map((project) => mapProjectServerProject(session, project));
    return seededProjects.concat(customProjects)
      .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
  }

  function mapProjectServerProject(session, project) {
    const userId = projectServerUserId(session);
    const workspace = getWorkspaceState(userId);
    const learningDefinition = getUserIdeState().projectDefinitions
      .find((definition) => definition.learning_project_id === project.learning_project_id);
    if (learningDefinition && (project.project_id !== learningDefinition.project_server_id || isEstablishedLearningProject(project))) {
      const lessonFocusId = project.view_manifest?.lesson_focus_id || "";
      const focusedLesson = learningDefinition.development_lessons?.find((lesson) => lesson.id === lessonFocusId);
      const focusedSteps = focusedLesson
        ? (project.view_manifest?.views || []).map((view) => ({
            title: view.title,
            text: view.summary || "",
            insight: `Teil der Entwicklungslesson ${focusedLesson.title}.`,
          }))
        : learningDefinition.steps;
      return {
        ...learningDefinition,
        project_server_id: project.project_id,
        title: project.title || learningDefinition.title,
        summary: project.description || learningDefinition.summary,
        project_origin: "account_project",
        owner_user_id: project.user_id || userId,
        repository_binding: project.repository_binding || null,
        hardware_profile_id: project.hardware_profile_id || learningDefinition.hardware_profile_id,
        build_config: project.build_config || learningDefinition.build_config,
        software_units: platformSoftwareUnits(project, learningDefinition.build_config),
        active_software_unit_id: platformActiveSoftwareUnitId(project),
        linked_device_id: project.device_ids?.[0] || project.device_id || "",
        linked_device_ids: project.device_ids || (project.device_id ? [project.device_id] : []),
        status: project.status || "active",
        last_build_status: latestBuildStatus(project),
        source_count: project.source_count || 0,
        source_files: project.source_files || learningDefinition.source_files || [],
        build_count: project.build_count || 0,
        view_manifest: project.view_manifest || projectViewManifest(learningDefinition),
        lesson_id: focusedLesson?.id || learningDefinition.lesson_id,
        steps: focusedSteps,
        entry_mode: project.view_manifest?.entry_mode || "project_story",
        current_lesson_id: focusedLesson?.id || "",
        created_at: project.created_at || "",
        updated_at: project.updated_at || "",
        last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
        last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
      };
    }
    const manifest = restoreDevelopmentTemplateReference(project.view_manifest || developmentProjectViewManifest({
      title: project.title,
      description: project.description,
      source: initialArchitecturePlantUml(project.title),
    }), project);
    const primarySourcePath = manifest.primary_source_path || "docs/architecture.puml";
    return {
      project_server_id: project.project_id,
      slug: project.project_id,
      title: project.title,
      summary: project.description || "",
      area: project.learning_project_id === "development_project" ? "development_project" : "custom_project",
      project_origin: "account_project",
      course_id: "development",
      lesson_id: `architecture_${project.project_id}`,
      learning_project_id: project.learning_project_id || "",
      owner_user_id: project.user_id || userId,
      repository_binding: project.repository_binding || null,
      hardware_profile_id: project.hardware_profile_id || "architecture.discovery",
      build_config: project.build_config || null,
      software_units: platformSoftwareUnits(project),
      active_software_unit_id: platformActiveSoftwareUnitId(project),
      linked_device_id: project.device_ids?.[0] || project.device_id || "",
      linked_device_ids: project.device_ids || (project.device_id ? [project.device_id] : []),
      status: project.status || "active",
      last_build_status: latestBuildStatus(project),
      source_count: project.source_count || 0,
      build_count: project.build_count || 0,
      view_manifest: manifest,
      created_at: project.created_at || "",
      updated_at: project.updated_at || "",
      last_opened_mode: workspace.lastProjectId === project.project_id ? workspace.lastMode : "",
      last_opened_at: workspace.lastProjectId === project.project_id ? workspace.updatedAt : "",
      source_files: project.source_files || [{ path: primarySourcePath, role: "architecture_model" }],
      steps: [],
      required_capability_ids: [],
      access_model: "owned",
    };
  }

  function toPlatformProject(project) {
    const storedHardwareConfiguration = hardwareConfigurationFromManifest(project.view_manifest);
    const hardwareConfiguration = storedHardwareConfiguration
      ? normalizeHardwareConfiguration(storedHardwareConfiguration, project)
      : null;
    const platformProject = {
      detailsLoaded: true,
      id: project.project_server_id,
      ownerUserId: project.owner_user_id || "",
      name: project.title,
      description: project.summary,
      type: project.area || "guided_project",
      projectOrigin: project.project_origin || "account_project",
      sourceFiles: project.source_files || [{ path: "src/main.cpp", role: "user_code" }],
      targetRuntime: project.hardware_profile_id,
      linkedDeviceId: project.linked_device_id || project.default_device_id || "",
      linkedDeviceIds: project.linked_device_ids?.length
        ? project.linked_device_ids
        : project.linked_device_id || project.default_device_id ? [project.linked_device_id || project.default_device_id] : [],
      lastOpenedMode: project.last_opened_mode || "learn",
      lastOpenedAt: project.last_opened_at || "",
      createdAt: project.created_at || "",
      updatedAt: project.updated_at || "",
      slug: project.slug,
      courseId: project.course_id,
      lessonId: project.lesson_id,
      entryMode: project.entry_mode || "project_story",
      currentLessonId: project.current_lesson_id || "",
      developmentLessons: project.development_lessons || [],
      projectStory: project.project_story || null,
      projectLessonAssignments: project.project_lesson_assignments || [],
      requiredCapabilityIds: project.required_capability_ids,
      accessModel: project.access_model || "subscription",
      customerEntries: project.customer_entries || [],
      productStage: project.product_stage || "",
      buildConfig: project.build_config,
      softwareUnits: platformSoftwareUnits(project),
      activeSoftwareUnitId: platformActiveSoftwareUnitId(project),
      status: project.status,
      sourceCount: project.source_count,
      buildCount: project.build_count,
      viewManifest: projectViewManifestForClient(project.view_manifest),
      hardwareArchitecture: hardwareConfiguration ? {
        source: hardwareWiringPlantUml(hardwareConfiguration, project.title),
        title: "Hardware-Architektur",
        summary: "Vollstaendige Hardware-Realisierung des Projekts.",
      } : null,
      steps: project.steps,
    };
    if (project.project_origin === "catalog" || project.learning_project_id?.startsWith("learning_project.")) {
      platformProject.learningCategory = project.learning_category;
      platformProject.tags = project.tags || [];
    }
    return platformProject;
  }

  function projectViewManifestForClient(viewManifest) {
    if (!viewManifest?.architecture_dialog) return viewManifest;
    return {
      ...viewManifest,
      architecture_dialog: {
        ...viewManifest.architecture_dialog,
        messages: Array.isArray(viewManifest.architecture_dialog.messages)
          ? viewManifest.architecture_dialog.messages.slice(-12)
          : [],
      },
    };
  }

  function toPlatformProjectSummary(project) {
    const summary = {
      id: project.project_server_id,
      detailsLoaded: false,
      ownerUserId: project.owner_user_id || "",
      name: project.title,
      description: project.summary || "",
      type: project.area || "guided_project",
      projectOrigin: project.project_origin || "account_project",
      targetRuntime: project.hardware_profile_id || "",
      linkedDeviceId: project.linked_device_id || "",
      linkedDeviceIds: project.linked_device_ids || [],
      lastOpenedMode: project.last_opened_mode || "",
      lastOpenedAt: project.last_opened_at || "",
      createdAt: project.created_at || "",
      updatedAt: project.updated_at || "",
      slug: project.slug,
      courseId: project.course_id,
      lessonId: project.lesson_id,
      accessModel: project.access_model || "subscription",
      status: project.status,
      hasProjectApp: project.has_project_app === true,
    };
    if (project.project_origin === "catalog" || project.learning_project_id?.startsWith("learning_project.")) {
      summary.learningCategory = project.learning_category;
      summary.tags = project.tags || [];
    }
    return summary;
  }

  return {
    mapProjectServerProject,
    mapUserIdeProjectSummaries,
    mapUserIdeProjects,
    toPlatformProject,
    toPlatformProjectSummary,
  };
}

module.exports = { createProjectPlatformMapper };
