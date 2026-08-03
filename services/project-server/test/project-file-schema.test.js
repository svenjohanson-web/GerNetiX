"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { PROJECT_FILE_SCHEMA, loadProjectFileSet, validateProjectChanges, writeProjectFileSet } = require("../src/repository-store/project-file-schema");

test("loads and writes a versioned complex multi-target project without information loss", () => {
  const files = [
    { path: "gernetix/project.json", content: JSON.stringify({ schema_version: 1, schema_id: "gernetix.project", project_id: "multi", title: "Multi", active_software_unit_id: "camera" }) },
    { path: "gernetix/software-units/camera.json", content: JSON.stringify({ schema_version: 1, software_unit_id: "camera", title: "Camera", software_kind: "embedded_firmware", build_system: "platformio", source_root: "Komponenten/Kamera" }) },
    { path: "gernetix/software-units/display.json", content: JSON.stringify({ schema_version: 1, software_unit_id: "display", title: "Display", software_kind: "embedded_firmware", build_system: "platformio", source_root: "Komponenten/Display" }) },
    { path: "gernetix/hardware/allocation.json", content: JSON.stringify({ schema_version: 1, components: [{ component_id: "camera-board" }] }) },
    { path: "gernetix/architecture/project.puml", content: "@startuml\nKamera --> Display\n@enduml\n" },
    { path: "Komponenten/Kamera/src/main.cpp", content: "// Grüße 🌍\n" },
    { path: "docs/empty.md", content: "" },
  ];
  const loaded = loadProjectFileSet(files);
  assert.equal(PROJECT_FILE_SCHEMA.schema_version, 1);
  const written = writeProjectFileSet(loaded);
  assert.deepEqual(written.map(({ path, content }) => ({ path, content })), [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map(({ path, content }) => ({ path, content })));
  assert.deepEqual(loaded.software_units.map((unit) => unit.software_unit_id), ["camera", "display"]);
});

test("rejects unknown schema versions and binary text payloads", () => {
  assert.throws(() => loadProjectFileSet([{ path: "gernetix/project.json", content: '{"schema_version":2}' }]), (error) => error.code === "project_schema_version_unsupported");
  assert.throws(() => validateProjectChanges([{ path: "gernetix/project.json", content: '{"schema_version":99}' }]), (error) => error.code === "project_schema_version_unsupported");
  assert.throws(() => loadProjectFileSet([{ path: "gernetix/project.json", content: '{"schema_version":1}\u0000' }]), (error) => error.code === "repository_binary_forbidden");
});
