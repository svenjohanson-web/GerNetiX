import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const filePath = fileURLToPath(new URL("../../labs/pt1000-adc-throughput.js", import.meta.url));
const labSource = fs.readFileSync(filePath, "utf8");
const appSource = fs.readFileSync(path.resolve(path.dirname(filePath), "..", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.resolve(path.dirname(filePath), "..", "styles.css"), "utf8");
const devServerSource = fs.readFileSync(path.resolve(path.dirname(filePath), "..", "dev-server.js"), "utf8");
const routeSource = fs.readFileSync(
  path.resolve(path.dirname(filePath), "..", "..", "..", "services", "identity-server", "src", "dev", "server", "web-routes.js"),
  "utf8",
);

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("Runtime-Import statt doppelter Formel-Wahrheit", () => {
  assert.match(
    labSource,
    /import\s*{\s*COMMAND_TYPES\s*,\s*createPt1000ThroughputRuntime,?\s*}\s*from\s*[\"']\.\/pt1000-adc-throughput-runtime\.mjs/,
  );
  assert.match(labSource, /import\s*{\s*ADC_PROGRAM_START_CODE\s*}\s*from\s*[\"']\.\.\/virtual-mcu\/adc-program-runtime\.mjs/);
  assert.doesNotMatch(labSource, /evaluatePt1000AdcDivider|solveDcOperatingPoint|quantizeAdcSample|ADC_QUANTIZER_MODEL/);
  assert.equal(devServerSource.includes("\".mjs\": \"text/javascript; charset=utf-8\""), true);
});

test("Lab-Metadaten und Registrierung nach GPIO-LED-Durchstich", () => {
  assert.match(labSource, /id:\s*"pt1000-adc-throughput"/);
  assert.match(labSource, /title:\s*\"Durchstich · PT1000 → ADC\"/);
  assert.match(labSource, /summary:\s*\"Temperatur über Spannungsteiler und ADC im Mikrocontroller messen\."/);
  assert.match(appSource, /createGpioLedThroughputLab\(\),\n\s*createPt1000ThroughputLab\(\),/);
});

test("Schaltbild, Temperatursteuerung, Editor und Aktionen vorhanden", () => {
  assert.match(labSource, /class="elab-throughput-circuit"/);
  assert.match(labSource, /id=\"pt1000-temperature-range\"/);
  assert.match(labSource, /id=\"pt1000-temperature-number\"/);
  assert.match(labSource, /id=\"pt1000-throughput-source\"/);
  assert.match(labSource, /id=\"pt1000-throughput-source\"[^>]*>\s*<\/textarea>/);
  assert.match(labSource, /<section class=\"elab-throughput-program elab-throughput-control\">/);
  assert.match(labSource, /data-action=\"start\"/);
  assert.match(labSource, /data-action=\"reset\"/);
  assert.match(labSource, /data-action=\"start\">Simulation starten<\/button>/);
  assert.match(labSource, /data-action=\"reset\">Zurücksetzen<\/button>/);
  assert.equal(countMatches(labSource, /data-net=\"vcc-to-fixed\"/g), 1);
  assert.equal(countMatches(labSource, /data-net=\"fixed-to-sense\"/g), 1);
  assert.equal(countMatches(labSource, /data-net=\"sense-to-a0\"/g), 1);
  assert.equal(countMatches(labSource, /data-net=\"pt1000-to-gnd\"/g), 1);
  assert.equal(countMatches(labSource, /data-component=\"fixed-resistor\"/g), 1);
  assert.equal(countMatches(labSource, /data-component=\"pt1000-sense-to-gnd\"/g), 1);
  assert.equal(countMatches(labSource, /ADC-Masse \/ GND/g), 1);
  assert.equal(countMatches(labSource, /PT1000 \/ ADC-Masse/g), 0);
  assert.equal(countMatches(labSource, /data-component=\"gnd-symbol\"/g), 0);
  assert.match(labSource, /data-net=\"vcc-to-fixed\"[\s\S]*x1=\"108\"[\s\S]*y1=\"60\"[\s\S]*x2=\"200\"[\s\S]*y2=\"60\"/);
  assert.match(labSource, /data-net=\"fixed-to-sense\"[\s\S]*x1=\"340\"[\s\S]*y1=\"60\"[\s\S]*x2=\"430\"[\s\S]*y2=\"60\"/);
  assert.match(labSource, /data-net=\"sense-to-a0\"[\s\S]*x1=\"430\"[\s\S]*y1=\"60\"[\s\S]*x2=\"680\"[\s\S]*y2=\"60\"/);
  assert.match(labSource, /data-component=\"pt1000-sense-to-gnd\"[\s\S]*x1=\"430\"[\s\S]*y1=\"60\"[\s\S]*x2=\"430\"[\s\S]*y2=\"105\"/);
  const pt1000ToGndBlock = labSource.match(/data-net=\"pt1000-to-gnd\"[\s\S]*?<\/g>/)?.[0];
  assert.ok(pt1000ToGndBlock);
  assert.ok(pt1000ToGndBlock.includes('x1="430"') && pt1000ToGndBlock.includes('y1="180"') && pt1000ToGndBlock.includes('x2="430"') && pt1000ToGndBlock.includes('y2="205"'));
  assert.ok(pt1000ToGndBlock.includes('x1="418"') && pt1000ToGndBlock.includes('x2="442"') && pt1000ToGndBlock.includes('y1="205"') && pt1000ToGndBlock.includes('y2="205"'));
  assert.ok(pt1000ToGndBlock.includes('x1="420"') && pt1000ToGndBlock.includes('x2="438"') && pt1000ToGndBlock.includes('y1="209"') && pt1000ToGndBlock.includes('y2="209"'));
  assert.ok(pt1000ToGndBlock.includes('x1="422"') && pt1000ToGndBlock.includes('x2="436"') && pt1000ToGndBlock.includes('y1="213"') && pt1000ToGndBlock.includes('y2="213"'));
  assert.equal((pt1000ToGndBlock.match(/<line[^>]*y1=\"205\"[^>]*>/g) || []).length, 1);
  assert.equal((pt1000ToGndBlock.match(/<line[^>]*y1=\"209\"[^>]*>/g) || []).length, 1);
  assert.equal((pt1000ToGndBlock.match(/<line[^>]*y1=\"213\"[^>]*>/g) || []).length, 1);
  assert.doesNotMatch(labSource, /x1=\"397\"/);
  assert.doesNotMatch(labSource, /y181|y=\"181\"|y1=\"181\"|y2=\"181\"/);
});

test("Alle sieben Ergebnisfelder vorhanden", () => {
  assert.match(labSource, /data-output=\"ambient-temperature\"/);
  assert.match(labSource, /data-output=\"sensor-resistance\"/);
  assert.match(labSource, /data-output=\"sense-voltage\"/);
  assert.match(labSource, /data-output=\"divider-current\"/);
  assert.match(labSource, /data-output=\"adc-code\"/);
  assert.match(labSource, /data-output=\"adc-quantized-voltage\"/);
  assert.match(labSource, /data-output=\"adc-variable\"/);
});

test("Command-Vertrag und DOM-Ausgabe ohne HTML-Injection", () => {
  assert.match(labSource, /function parseTemperatureCommand/);
  assert.doesNotMatch(labSource, /parseTemperatureCommand\(target/);
  assert.match(labSource, /COMMAND_TYPES\.SetTemperature/);
  assert.match(labSource, /COMMAND_TYPES\.UpdateSourceFile/);
  assert.match(labSource, /COMMAND_TYPES\.StartSimulation/);
  assert.match(labSource, /COMMAND_TYPES\.ResetSimulation/);
  assert.match(labSource, /setText\(ambientOutput,/);
  assert.match(labSource, /setText\(resistanceOutput,/);
  assert.match(labSource, /setText\(statusOutput,/);
  assert.doesNotMatch(labSource, /innerHTML\s*=\s*snapshot/);
  assert.match(labSource, /sourceArea\.value = snapshot\.sourceFile/);
});

test("Fehlerausgabe beinhaltet Zeile und Spalte", () => {
  assert.match(labSource, /Zeile \${entry\.line}, Spalte \${entry\.column}/);
  assert.match(labSource, /formatErrorEntry/);
  assert.match(labSource, /entry\.line/);
  assert.match(labSource, /entry\.column/);
});

test("Realitätsübergang und Lernmodell-Hinweis", () => {
  assert.match(labSource, /Vom virtuellen zum echten Labor/);
  assert.match(labSource, /Generisches Lernmodell – keine ESP32-Emulation/);
  assert.match(labSource, /PT1000/);
  assert.match(labSource, /3,3 V/);
  assert.match(labSource, /Masse/);
  assert.match(labSource, /ADC-Referenz/);
});

test("Responsive PT1000-spezifische Styles", () => {
  assert.match(styleSource, /\.elab-pt1000-throughput-layout/);
  assert.match(styleSource, /@media \(max-width: 1280px\)[\s\S]*elab-pt1000-throughput-layout/);
  assert.match(styleSource, /@media \(max-width: 720px\)[\s\S]*elab-pt1000-throughput-layout/);
});

test("Eng begrenzte öffentliche .mjs-Module-Routen", () => {
  assert.ok(routeSource.includes("environment-models\\/[^/]+\\.mjs"));
  assert.ok(routeSource.includes("learning-circuits\\/[^/]+\\.mjs"));
  assert.ok(routeSource.includes("learning-solver\\/[^/]+\\.mjs"));
  assert.ok(routeSource.includes("peripherals\\/[^/]+\\.mjs"));
  assert.ok(routeSource.includes("virtual-mcu\\/[^/]+\\.mjs"));
});

test("Kein Netzwerk, keine Persistenz, keine Clock, kein Zufall", () => {
  assert.doesNotMatch(labSource, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|Date\.now|Math\.random|setTimeout|requestAnimationFrame/);
});

test("Ausgabeformatierung auf Golden-Case", () => {
  assert.match(labSource, /function asText\(value, digits\)/);
  assert.match(labSource, /asText\(value, 3\)/);
  assert.match(labSource, /minimumFractionDigits:\s*fractionDigits/);
  assert.match(labSource, /maximumFractionDigits:\s*fractionDigits/);
  assert.match(labSource, /const fractionDigits = Number\.isFinite\(digits\) \? digits : 2;/);
  assert.match(labSource, /asKohm\(measurement\.sensorResistanceOhm\)/);
  assert.match(labSource, /asVolt\(measurement\.senseVoltageV\)/);
  assert.match(labSource, /asVolt\(measurement\.adcQuantizedVoltageV\)/);
  assert.match(labSource, /asAmp\(measurement\.dividerCurrentA\)/);
  assert.match(labSource, /asCode\(measurement\.adcCode\)/);
  assert.match(labSource, /asInteger\(measurement\.adcValue\)/);
  assert.match(labSource, /sourceArea\.value = snapshot\.sourceFile/);
});

test("Dark/Light lesbare Styles für Number-Eingabe und PT1000-Schema", () => {
  assert.match(styleSource, /elab-pt1000-throughput-range-control input\[type="number"\][\s\S]*color:\s*var\(--text\)/);
  assert.match(styleSource, /html\[data-public-theme=light\] \.elab-pt1000-throughput-range-control input\[type="number"\]/);
  assert.match(styleSource, /html\[data-public-theme=light\] \.elab-pt1000-throughput-schematic/);
  assert.match(styleSource, /elab-pt1000-throughput-schematic/);
  assert.match(styleSource, /html\[data-public-theme=light\] \.elab-throughput-control textarea[\s\S]*background:\s*#fffdf8/);
  assert.match(styleSource, /html\[data-public-theme=light\] \.elab-throughput-control textarea[\s\S]*color:\s*var\(--text\)/);
  assert.match(styleSource, /html\[data-public-theme=light\] \.elab-throughput-control textarea[\s\S]*border-color:\s*#b9afa0/);
});
