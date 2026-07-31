const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const devServer = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const platformSummary = devServer.match(/async function handlePlatformSummary[\s\S]*?\r?\n}\r?\n\r?\nfunction externalLoginMessage/)?.[0] || "";
const platformBootstrap = devServer.match(/async function handlePlatformBootstrap[\s\S]*?\r?\n}\r?\n\r?\nasync function loadKnowledgeState/)?.[0] || "";
const projectLoader = devServer.match(/async function loadUserIdeProjects[\s\S]*?\r?\n}\r?\n\r?\nfunction mapUserIdeProjects/)?.[0] || "";

test("loads independent platform summary dependencies concurrently", () => {
  assert.match(platformSummary, /const projectsPromise = loadUserIdeProjects/);
  assert.match(platformSummary, /const devicesPromise = loadUserIdeDevices/);
  assert.match(platformSummary, /const aiUsagePromise = loadAiUsageSummary/);
  assert.match(platformSummary, /const communitySummaryPromise = loadCommunityDashboardSummary/);
  assert.match(platformSummary, /const accountPromise = createAccountSummary/);
  assert.match(platformSummary, /const knowledgeStatePromise = loadKnowledgeState/);
  assert.match(platformSummary, /const projects = await projectsPromise;[\s\S]*const buildsPromise = loadProjectBuilds\(projects/);
  assert.match(platformSummary, /const \[devices, builds, aiUsage, communitySummary, account, knowledgeState\] = await Promise\.all/);
  assert.doesNotMatch(platformSummary, /const devices = await loadUserIdeDevices/);
});

test("renders development projects from a critical bootstrap before loading secondary platform data", () => {
  assert.match(devServer, /url\.pathname === "\/api\/platform\/bootstrap"/);
  assert.match(platformBootstrap, /const projects = await loadUserIdeProjects\(session\)/);
  assert.match(platformBootstrap, /projects: projects\.map\(toPlatformProject\)/);
  assert.match(platformBootstrap, /bootstrap_duration_ms/);
  assert.doesNotMatch(platformBootstrap, /loadUserIdeDevices|loadProjectBuilds|loadAiUsageSummary|loadCommunityDashboardSummary/);
  assert.match(app, /await refreshBootstrap\(\);[\s\S]*renderAll\(\);[\s\S]*renderRoute\(\);[\s\S]*void hydratePlatformState\(\);/);
  assert.match(app, /async function hydratePlatformState\(\)[\s\S]*loadPlatformDownloads\(\)[\s\S]*refresh\(\)/);
});

test("synchronizes catalog projects once per account without blocking the project list", () => {
  assert.match(projectLoader, /scheduleProjectServerDemoProjects\(session\)/);
  assert.doesNotMatch(projectLoader, /await ensureProjectServerDemoProjects/);
  assert.match(devServer, /const projectServerSeededUsers = new Set\(\)/);
  assert.match(devServer, /const projectServerSeedPromises = new Map\(\)/);
  assert.match(devServer, /if \(projectServerSeedPromises\.has\(userId\)\) return projectServerSeedPromises\.get\(userId\)/);
});
