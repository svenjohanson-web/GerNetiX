const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "index.html"), "utf8");
const motorProject = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "einfache-elektromotoren", "index.html"), "utf8");
const knowledgeContent = fs.readFileSync(path.join(root, "public", "app", "knowledge-content.js"), "utf8");
const informationView = fs.readFileSync(path.join(root, "public", "app", "information-view.js"), "utf8");
const server = fs.readFileSync(path.join(root, "src", "dev-server.js"), "utf8");

test("serves the public project catalog and links directly to the available project", () => {
  assert.match(server, /url\.pathname === "\/nachbauprojekte"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/index\.html"\)/);
  assert.match(server, /url\.pathname === "\/s3-touch-spielesammlung"[\s\S]*proxyPublicDemo/);
  assert.match(server, /url\.pathname === "\/demos"[\s\S]*redirect\(res, `\/s3-touch-spielesammlung\//);
  assert.match(page, /ESP32-S3 Touch Game Collection/);
  assert.match(page, /MakerWorld/);
  assert.match(page, /href="\/s3-touch-spielesammlung\/"/);
  assert.doesNotMatch(page, /href="\/entdecken\/"|GerNetiX entdecken/);
  assert.match(page, /href="\/nachbauprojekte\/" aria-current="page">Projekte zum Nachbauen/);
  assert.match(page, /href="\/flashbox-einrichten\/">FlashBox einrichten/);
  assert.match(page, /installiere die Spielesammlung per WebSerial/);
  assert.doesNotMatch(page, /Ver&ouml;ffentlichung folgt/);
});

test("publishes a stepwise motor rebuild project in the public catalog", () => {
  assert.match(server, /url\.pathname === "\/nachbauprojekte\/einfache-elektromotoren"[\s\S]*redirect\(res, "\/nachbauprojekte\/einfache-elektromotoren\/"\)/);
  assert.match(server, /url\.pathname === "\/nachbauprojekte\/einfache-elektromotoren\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/einfache-elektromotoren\/index\.html"\)/);
  assert.match(page, /Einfache Elektromotoren bauen/);
  assert.match(page, /href="\/nachbauprojekte\/einfache-elektromotoren\/"/);
  assert.match(page, /class="panel maker-project-tile"/);
  assert.doesNotMatch(page, /maker-release-card|<dl>|maker-project-note/);
  assert.match(motorProject, /Strom → Magnetfeld → Kraft → Drehmoment → Kommutierung/);
  assert.match(motorProject, /id="elektromagnet"[\s\S]*id="kraftversuch"[\s\S]*id="spulenmotor"[\s\S]*id="reedmotor"[\s\S]*id="hallmotor"[\s\S]*id="homopolarmotor"/);
  assert.match(motorProject, /Motor 1 · Mechanische Kommutierung/);
  assert.match(motorProject, /Motor 2 · Lageabhängiger Impuls/);
  assert.match(motorProject, /Motor 3 · Elektronische Kommutierung/);
});

test("uses the motor diagrams at the matching build stages", () => {
  assert.match(motorProject, /motor-learning-current-magnetic-field\.svg/);
  assert.match(motorProject, /motor-learning-current-force\.svg/);
  assert.match(motorProject, /motor-learning-simple-coil\.svg/);
  assert.match(motorProject, /motor-learning-reed-switch\.svg/);
  assert.match(motorProject, /motor-learning-transistor-switch\.svg/);
  assert.match(motorProject, /motor-learning-homopolar\.svg/);
});

test("links every motor build stage to knowledge and knowledge back to the project", () => {
  const links = [
    ["actuator-current-magnetic-field", "elektromagnet"],
    ["actuator-current-force", "kraftversuch"],
    ["actuator-simple-coil-motor", "spulenmotor"],
    ["actuator-reed-motor", "reedmotor"],
    ["actuator-transistor-motor", "hallmotor"],
    ["actuator-homopolar-motor", "homopolarmotor"],
  ];
  for (const [knowledgeId, projectId] of links) {
    assert.match(motorProject, new RegExp(`href="/wissen/#${knowledgeId}"`));
    assert.match(knowledgeContent, new RegExp(`href: "/nachbauprojekte/einfache-elektromotoren/#${projectId}"`));
  }
  assert.match(informationView, /section\.rebuildProjects/);
  assert.match(informationView, /Nachbauprojekt ansehen/);
});

test("keeps the motor builds inside a clear low-voltage safety boundary", () => {
  assert.match(motorProject, /Keine Netzspannung und keine offenen Lithium-Akkus/);
  assert.match(motorProject, /Widerstand jeder Spule messen/);
  assert.match(motorProject, /I = U \/ R/);
  assert.match(motorProject, /Freilaufdiode/);
  assert.match(motorProject, /Homopolarmotor nur mit echter Strombegrenzung/);
  assert.match(motorProject, /ähnelt elektrisch einem Kurzschluss/);
  assert.match(motorProject, /keinen Akku/);
});
