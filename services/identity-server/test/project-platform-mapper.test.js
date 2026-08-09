const assert = require("node:assert/strict");
const test = require("node:test");

const { createProjectPlatformMapper } = require("../src/dev/projects/project-platform-mapper");

function createMapper() {
  const projectDefinitions = [{
    project_server_id: "catalog-source",
    slug: "blink",
    title: "Blink",
    summary: "LED lernen",
    area: "guided_project",
    course_id: "course",
    lesson_id: "lesson",
    learning_project_id: "learning_project.blink",
    hardware_profile_id: "esp32",
    tags: ["LED"],
  }];
  return createProjectPlatformMapper({
    catalogProjectIdForDefinition: (definition) => `catalog_${definition.slug}`,
    developmentProjectViewManifest: ({ source }) => ({ primary_source_path: "docs/architecture.puml", source }),
    getUserIdeState: () => ({ projectDefinitions }),
    getWorkspaceState: () => ({ lastProjectId: "owned", lastMode: "ide", updatedAt: "2026-08-09" }),
    hardwareConfigurationFromManifest: () => null,
    hardwareWiringPlantUml: () => "",
    initialArchitecturePlantUml: () => "@startuml\n@enduml",
    isEstablishedLearningProject: () => false,
    isRetiredCatalogProject: () => false,
    latestBuildStatus: () => "success",
    normalizeHardwareConfiguration: (value) => value,
    platformActiveSoftwareUnitId: () => "firmware",
    platformSoftwareUnits: () => [],
    projectServerUserId: () => "account-1",
    projectViewManifest: () => ({ entry_mode: "project_story" }),
    restoreDevelopmentTemplateReference: (manifest) => manifest,
  });
}

test("maps Project Server summaries without loading project details", () => {
  const mapper = createMapper();
  const mapped = mapper.mapUserIdeProjectSummaries({}, [{
    project_id: "owned",
    user_id: "account-1",
    title: "Mein Blink",
    learning_project_id: "learning_project.blink",
    updated_at: "2026-08-09",
  }]);
  const owned = mapper.toPlatformProjectSummary(mapped.find((project) => project.project_server_id === "owned"));
  assert.equal(owned.detailsLoaded, false);
  assert.equal(owned.name, "Mein Blink");
  assert.equal(owned.lastOpenedMode, "ide");
  assert.equal(Object.hasOwn(owned, "viewManifest"), false);
});

test("maps project details and limits architecture dialog history", () => {
  const mapper = createMapper();
  const messages = Array.from({ length: 15 }, (_, index) => ({ text: String(index) }));
  const mapped = mapper.toPlatformProject({
    project_server_id: "owned",
    title: "Projekt",
    summary: "Beschreibung",
    project_origin: "account_project",
    hardware_profile_id: "esp32",
    view_manifest: { architecture_dialog: { messages } },
  });
  assert.equal(mapped.detailsLoaded, true);
  assert.equal(mapped.viewManifest.architecture_dialog.messages.length, 12);
  assert.equal(mapped.viewManifest.architecture_dialog.messages[0].text, "3");
});

