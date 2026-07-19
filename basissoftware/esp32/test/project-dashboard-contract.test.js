const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..", "..");
const webServer = fs.readFileSync(path.join(root, "esp32", "src", "functions", "startDeviceWebServer.cpp"), "utf8");
const dashboard = fs.readFileSync(path.join(root, "esp32", "src", "functions", "project_dashboard.cpp"), "utf8");
const demo = fs.readFileSync(path.join(root, "..", "projects", "demo-web-dashboard", "demo_web_dashboard.cpp"), "utf8");
const platformio = fs.readFileSync(path.join(root, "esp32", "platformio.ini"), "utf8");

test("project dashboard stays outside the basissoftware setup portal", () => {
  assert.doesNotMatch(webServer, /registerUri\("\/project\/dashboard"/);
  assert.doesNotMatch(webServer, /projectDashboardPageHtml\(\)/);
  assert.match(dashboard, /projectDashboardPublishMeasurement/);
  assert.match(dashboard, /SAMPLE_CAPACITY = 24/);
  assert.match(dashboard, /Projekt-Log/);
  assert.match(demo, /INTERVAL_US = 5 \* 1000 \* 1000/);
  assert.match(demo, /measurement = \(measurement \+ 1\) % 11/);
  assert.match(platformio, /\[env:esp32-s3-16mb-project-dashboard-demo\]/);
  assert.doesNotMatch(demo, /httpd_register_uri_handler|httpd_start/);
});
