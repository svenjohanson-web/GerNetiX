const assert = require("node:assert/strict");
const test = require("node:test");
const { developmentProjectTemplate, templateArchitecturePlantUml, templateFirmwareSources } = require("../src/dev/development-project-templates");

test("provides ESP32 project templates with distinct start architectures", () => {
  const device = developmentProjectTemplate("esp32_device_only");
  const localLogger = developmentProjectTemplate("esp32_datalogger_local_web");
  const internetLogger = developmentProjectTemplate("esp32_datalogger_internet_web");

  assert.match(templateArchitecturePlantUml(device, device.title), /ESP32 Device/);
  assert.doesNotMatch(templateArchitecturePlantUml(device, device.title), /Internet/);
  assert.match(templateArchitecturePlantUml(localLogger, localLogger.title), /Lokaler Webserver/);
  assert.match(templateArchitecturePlantUml(internetLogger, internetLogger.title), /Webserver \/ API/);
  assert.match(templateArchitecturePlantUml(internetLogger, internetLogger.title), /Messwertdatenbank/);
});

test("falls back to the empty project template for unknown ids", () => {
  assert.equal(developmentProjectTemplate("unknown").id, "empty");
});

test("ESP32-only template provides a buildable firmware scaffold", () => {
  const template = developmentProjectTemplate("esp32_device_only");
  const sources = templateFirmwareSources(template, "Durchstich");

  assert.equal(template.hardwareProfileId, "hardware.processor_board.generic_esp_wroom32");
  assert.equal(template.buildConfig.platform, "espressif32");
  assert.equal(template.buildConfig.board, "esp32dev");
  assert.equal(template.buildConfig.framework, "espidf");
  assert.equal(template.buildConfig.firmware_basis_id, "gernetix-runtime-basissoftware");
  assert.equal(sources[0].path, "Komponenten/ESP32/src/user_main.cpp");
  assert.match(sources[0].content, /void userMain/);
  assert.deepEqual(templateFirmwareSources(developmentProjectTemplate("empty"), "Leer"), []);
});
