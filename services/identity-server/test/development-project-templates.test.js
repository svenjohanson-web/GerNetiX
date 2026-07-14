const assert = require("node:assert/strict");
const test = require("node:test");
const {
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  templateArchitecturePlantUml,
  templateBuildConfig,
  templateFirmwareSources,
  templateHardwareProfileId,
} = require("../src/dev/development-project-templates");

test("separates semantic template models from rendered views", () => {
  const template = developmentProjectTemplate("esp32_datalogger_local_web");
  assert.equal(template.schemaVersion, 1);
  assert.equal(template.nodes, undefined);
  assert.deepEqual(template.architecture.elements.find((element) => element.id === "device"), {
    id: "device",
    label: "IoT-Device Datenlogger",
    kind: "iot_device",
  });
  assert.deepEqual(template.architecture.relations.find((relation) => relation.target === "storage"), {
    source: "device",
    target: "storage",
    label: "Historie",
  });
  assert.match(templateArchitecturePlantUml(template, template.title), /rectangle "IoT-Device Datenlogger" as device/);
});

test("exposes one UI catalog without architecture or realization internals", () => {
  const catalog = developmentProjectTemplateCatalog();
  assert.equal(catalog.length, 4);
  assert.equal(catalog.find((template) => template.id === "empty").default_title, "");
  assert.equal(catalog.some((template) => "architecture" in template || "realization" in template), false);
});

test("provides IoT device project templates with distinct start architectures", () => {
  const device = developmentProjectTemplate("esp32_device_only");
  const localLogger = developmentProjectTemplate("esp32_datalogger_local_web");
  const internetLogger = developmentProjectTemplate("esp32_datalogger_internet_web");

  assert.match(templateArchitecturePlantUml(device, device.title), /IoT-Device 1/);
  assert.match(templateArchitecturePlantUml(device, device.title), /rectangle "Sensoren" as sensors/);
  assert.doesNotMatch(templateArchitecturePlantUml(device, device.title), /Sensoren \/ Aktoren|Aktorik|Aktoren/);
  assert.doesNotMatch(templateArchitecturePlantUml(device, device.title), /Internet|ESP32/);
  assert.doesNotMatch(templateArchitecturePlantUml(device, device.title), /database|SQLite/i);
  assert.match(templateArchitecturePlantUml(localLogger, localLogger.title), /Lokaler Webserver/);
  assert.match(templateArchitecturePlantUml(internetLogger, internetLogger.title), /Webserver \/ API/);
  assert.match(templateArchitecturePlantUml(internetLogger, internetLogger.title), /Webserver \/ API\\nSoftware: SQL-Datenbank/);
  assert.doesNotMatch(templateArchitecturePlantUml(internetLogger, internetLogger.title), /database "/);
  assert.match(templateArchitecturePlantUml(localLogger, localLogger.title), /NVS \/ LittleFS/);
  for (const template of [device, localLogger, internetLogger]) {
    const source = templateArchitecturePlantUml(template, template.title);
    assert.doesNotMatch(source, /\bnote\b|end note|KI-abgeleitete|bestaetigte Architekturentscheidung/i);
    assert.doesNotMatch(source, /ESP32/);
    assert.doesNotMatch(source, /^\s*(?:node|component|database|cloud|queue|artifact)\s+"/gmi);
  }
});

test("falls back to the empty project template for unknown ids", () => {
  assert.equal(developmentProjectTemplate("unknown").id, "empty");
});

test("IoT-device-only template provides a buildable ESP32 firmware scaffold", () => {
  const template = developmentProjectTemplate("esp32_device_only");
  const sources = templateFirmwareSources(template, "Durchstich");

  const buildConfig = templateBuildConfig(template);
  assert.equal(templateHardwareProfileId(template), "hardware.processor_board.generic_esp_wroom32");
  assert.equal(buildConfig.platform, "espressif32");
  assert.equal(buildConfig.board, "esp32dev");
  assert.equal(buildConfig.framework, "espidf");
  assert.equal(buildConfig.firmware_basis_id, "gernetix-runtime-basissoftware");
  assert.equal(sources[0].path, "Komponenten/ESP32/src/user_main.cpp");
  assert.match(sources[0].content, /void userMain/);
  assert.deepEqual(templateFirmwareSources(developmentProjectTemplate("empty"), "Leer"), []);
});
