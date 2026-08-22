"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createProjectConfigurationService } = require("../src/dev/projects/project-configuration-service");

test("project dialog derives the stored architecture through its injected hardware model", async () => {
  const responses = [];
  let architectureReads = 0;
  const diagram = { source: "@startuml\n@enduml", title: "Architektur", summary: "" };
  const project = {
    area: "development_project",
    title: "Testprojekt",
    summary: "",
    project_server_id: "project-1",
    active_software_unit_id: "",
    build_config: null,
    view_manifest: { template_id: "empty" },
  };
  const service = createProjectConfigurationService({
    projectServerUserId: () => "account-1",
    requireSessionProject: async () => project,
    readJsonBody: async () => ({}),
    developmentProjectViewManifest: () => project.view_manifest,
    initialArchitecturePlantUml: () => diagram.source,
    normalizeArchitectureDiagram: (value) => value || diagram,
    architectureDiagramFromManifest: () => { architectureReads += 1; return diagram; },
    normalizeArchitectureDialog: () => ({ architectureDiagram: diagram }),
    normalizeHomeAutomationConfiguration: () => null,
    normalizeTouchscreenGameConfiguration: () => null,
    hardwareConfigurationFromManifest: () => null,
    developmentSoftwareUnits: () => [],
    projectServerJson: async () => ({ configuration_projection: null }),
    touchWorkspace: () => {},
    loadUserIdeProjects: async () => [project],
    toPlatformProject: (value) => value,
    sendJson: (_res, status, body) => responses.push({ status, body }),
  });

  await service.handleDevelopmentProjectDialogSave({}, {}, { account: { user_id: "account-1" } }, "project-1");

  assert.equal(architectureReads, 1);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[0].body.project, project);
});
