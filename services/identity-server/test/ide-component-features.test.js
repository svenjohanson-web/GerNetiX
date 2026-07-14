const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("IDE exposes component properties and an embedded device webserver view", () => {
  assert.match(html, /id="ideComponentFeaturesView"/);
  assert.match(html, /id="ideBoardPropertiesView"/);
  assert.match(html, /id="ideDeviceWebView"/);
  assert.match(app, /Webserver des Entwicklungsprojekts/);
  assert.match(app, /<iframe title="Device-Webserver"/);
});

test("software separates general properties webserver configuration and preview", () => {
  assert.match(app, /`\$\{component\}\/Konfiguration\/Software\/Eigenschaften`/);
  assert.match(app, /`\$\{component\}\/Konfiguration\/Software\/Webserver\/Konfiguration`/);
  assert.match(app, /`\$\{component\}\/Konfiguration\/Software\/Webserver\/Vorschau`/);
  assert.match(app, /function renderWebserverConfiguration\(project\)/);
  assert.match(app, /webserver-configuration-form/);
  assert.doesNotMatch(app, /role: "Live-Ansicht"/);
  assert.doesNotMatch(app, /file\.role \|\| file\.content_type \? `<small>/);
});

test("project browser separates hardware files from software configuration views", () => {
  assert.match(app, /function projectBrowserSources\(project, sources\)/);
  assert.match(app, /sourcePrefix: String\(component\.component_path\)/);
  assert.match(app, /treePrefix: `Komponenten\/\$\{componentTreeLabel\(component\)\}`/);
  assert.match(app, /treePath: \[mapping\.treePrefix, relativePath\]\.filter\(Boolean\)\.join\("\/"\)/);
  assert.match(app, /relativePath = relativePath\.replace\(\/\^Konfiguration/);
  assert.match(app, /source\.treePath \|\| source\.path/);
  assert.match(app, /`Komponenten\/\$\{label\}\/Konfiguration\/Hardware\/Board\/Boardeigenschaften`/);
  assert.match(app, /data-board-properties="\$\{escapeAttribute\(file\.componentId \|\| ""\)\}"/);
  assert.match(app, /"GPIO", "Digitale Ein- und Ausgänge", profile\.digital_pins/);
  assert.match(app, /"ADC", "Analoge Eingänge", profile\.analog_inputs/);
  assert.match(app, /"PWM", "Pulsweitenmodulation", profile\.pwm_pins/);
  assert.match(app, /ADC verwenden/);
  assert.match(app, /PWM verwenden/);
  assert.match(app, /component_hardware_features/);
  assert.match(app, /component-hardware-features/);
  assert.match(server, /handleProjectComponentHardwareFeatures/);
  assert.match(server, /const allowed = new Set\(\["adc", "pwm"\]\)/);
  assert.match(server, /component_hardware_features:/);
  assert.match(server, /board\.pin_profile\?\.analog_inputs/);
  assert.match(server, /board\.pin_profile\?\.pwm_pins/);
  assert.match(server, /board_peripheral_not_supported/);
  assert.match(app, /"I²C", "Bus-Anschlüsse", profile\.i2c/);
});

test("basis features are visibly immutable and project web extensions remain configurable", () => {
  assert.match(app, /\["wifi", "mqtt", "ota", "http", "webserver"\]/);
  assert.match(app, /basisId === "gernetix-runtime-basissoftware"/);
  assert.match(app, /firmware_basis_variant \|\| \(basisId === "gernetix-runtime-basissoftware" \? "comfort" : ""\)/);
  assert.match(app, /Basissoftware · unveränderlich/);
  assert.match(app, /Messwertdiagramm/);
  assert.match(server, /component-features/);
  assert.match(server, /handleProjectComponentFeatures/);
});
