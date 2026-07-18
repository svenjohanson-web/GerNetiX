const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("learning area leads with a dedicated project catalog", () => {
  const catalogPosition = html.indexOf("Lernprojekt-Katalog");
  const personalPosition = html.indexOf("Meine Lernprojekte");
  assert.ok(catalogPosition > 0);
  assert.ok(personalPosition > catalogPosition);
  assert.match(html, /id="projectList" class="project-grid learning-catalog-grid"/);
});

test("catalog cards describe learning scope instead of internal file metadata", () => {
  const renderer = app.match(/function renderProjects\(\)[\s\S]*?\nfunction renderLearn/)?.[0] || "";
  assert.match(renderer, /Lernschritte/);
  assert.match(renderer, /Hardware/);
  assert.match(renderer, /Lernprojekt starten/);
  assert.match(renderer, /learningAccessLabel\(project\.accessModel\)/);
  assert.doesNotMatch(renderer, /Projektdateien/);
});

test("catalog classifies free, purchased and subscription access", () => {
  assert.match(app, /free: "Frei verfuegbar"/);
  assert.match(app, /purchased: "Kurs gekauft"/);
  assert.match(app, /subscription: "Im Abo enthalten"/);
});

test("catalog includes the button-to-smartphone notification learning project", () => {
  assert.match(server, /button-to-smartphone-notification/);
  assert.match(server, /createButtonToSmartphoneNotificationCourseModel/);
});

test("catalog includes the home automation network course with a resource boundary", () => {
  const guidedView = fs.readFileSync(path.resolve(__dirname, "../public/app/guided-project-view.js"), "utf8");
  const course = fs.readFileSync(path.resolve(__dirname, "../src/dev/project-models/home-automation-network-course.json"), "utf8");
  assert.match(server, /home-automation-network/);
  assert.match(server, /createHomeAutomationNetworkCourseModel/);
  assert.match(server, /homeAutomationNetworkCourseModel\.createProject/);
  assert.match(guidedView, /access_gate/);
  assert.match(guidedView, /open_billing/);
  assert.match(course, /background_worker/);
  assert.match(course, /Home-Assistant-Kompatibilitaet/);
});
