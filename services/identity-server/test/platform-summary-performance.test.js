const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const devServer = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const app = readPlatformAppSource();
const platformRoutes = fs.readFileSync(path.resolve(__dirname, "../src/dev/server/platform-routes.js"), "utf8");
const platformSummary = devServer.match(/async function handlePlatformSummary[\s\S]*?\r?\n}\r?\n\r?\nfunction externalLoginMessage/)?.[0] || "";
const platformBootstrap = devServer.match(/async function handlePlatformBootstrap[\s\S]*?\r?\n}\r?\n\r?\nasync function loadKnowledgeState/)?.[0] || "";
const projectLoader = devServer.match(/async function loadUserIdeProjects[\s\S]*?\r?\n}\r?\n\r?\nfunction mapUserIdeProjects/)?.[0] || "";

test("loads only requested platform summary sections and keeps selected dependencies concurrent", () => {
  assert.match(platformSummary, /requestedPlatformSummarySections\(requestedSections\)/);
  assert.match(platformSummary, /const needsFullProjects = sections\.has\("builds"\)/);
  assert.match(platformSummary, /needsProjectSummaries \? loadUserIdeProjectSummaries\(session\)/);
  assert.match(platformSummary, /const devicesPromise = sections\.has\("devices"\) \? loadUserIdeDevices/);
  assert.match(platformSummary, /const aiUsagePromise = needsAiUsage \? loadAiUsageSummary/);
  assert.match(platformSummary, /const communitySummaryPromise = sections\.has\("community"\) \? loadCommunityDashboardSummary/);
  assert.match(platformSummary, /const knowledgeStatePromise = sections\.has\("knowledge"\) \? loadKnowledgeState/);
  assert.match(platformSummary, /const projects = await trackedProjectsPromise;[\s\S]*const buildsPromise = sections\.has\("builds"\) \? loadProjectBuilds\(projects/);
  assert.match(platformSummary, /const \[devices, builds, aiUsage, communitySummary, knowledgeState, learningProgress\] = await Promise\.all/);
  assert.doesNotMatch(platformSummary, /const devices = await loadUserIdeDevices/);
});

test("loads projects in the critical bootstrap only for routes that need them", () => {
  assert.match(devServer, /registerPlatformRoutes/);
  assert.match(platformRoutes, /path: "\/api\/platform\/bootstrap"/);
  assert.match(platformRoutes, /handleBootstrap\(res, session, url\.searchParams\.get\("include"\)\)/);
  assert.match(platformBootstrap, /requestedPlatformBootstrapSections\(requestedSections\)/);
  assert.match(platformBootstrap, /const projects = sections\.has\("projects"\) \? await loadUserIdeProjectSummaries\(session\) : \[\]/);
  assert.match(platformBootstrap, /if \(sections\.has\("projects"\)\) payload\.projects = projects\.map\(toPlatformProjectSummary\)/);
  assert.match(platformBootstrap, /bootstrap_duration_ms/);
  assert.doesNotMatch(platformBootstrap, /loadUserIdeDevices|loadProjectBuilds|loadAiUsageSummary|loadCommunityDashboardSummary/);
  assert.match(app, /const initialRoute = routeName\(\);[\s\S]*Promise\.all\(\[refreshBootstrap\(initialRoute\), loadRouteAssets\(initialRoute\)\]\);[\s\S]*loadRouteProjectDetail\(initialRoute\);[\s\S]*renderAll\(\);[\s\S]*renderRoute\(\{ contentRendered: true \}\);[\s\S]*hydratePlatformState\(initialRoute\)/);
  assert.match(app, /function platformBootstrapSectionsForRoute\(route\)/);
  assert.match(app, /async function hydratePlatformState\(route = routeName\(\)\)[\s\S]*if \(!sections\.length\) return false;[\s\S]*await refresh\(sections\)/);
  assert.doesNotMatch(app.match(/async function hydratePlatformState[\s\S]*?\n}/)?.[0] || "", /loadPlatformDownloads/);
});

test("uses lightweight data profiles for independent routes", () => {
  assert.match(app, /function platformSummarySectionsForRoute\(route\)/);
  assert.match(app, /if \(route === "billing"\) return \["ai", "billing"\]/);
  assert.match(app, /\/api\/platform\/summary\?include=\$\{encodeURIComponent\(sections\.join\(","\)\)\}/);
  assert.match(app, /\/api\/platform\/bootstrap\?include=\$\{include\}/);
  assert.match(app, /isPublicKnowledgePage[\s\S]*\? "account,knowledge,subscription"[\s\S]*: "account,subscription"/);
});

test("loads development configuration only for development routes and preserves it across partial summaries", () => {
  assert.match(devServer, /platformBootstrapSections = new Set\(\["projects", "development"\]\)/);
  assert.match(platformSummary, /if \(sections\.has\("development"\)\) \{[\s\S]*payload\.development_assistant/);
  assert.match(platformBootstrap, /if \(sections\.has\("development"\)\) \{[\s\S]*payload\.development_project_templates/);
  assert.match(app, /\["development-platform", "development-hardware"\]\.includes\(route\).*sections\.push\("development"\)/);
  assert.match(app, /Object\.hasOwn\(summary, "development_assistant"\)/);
  assert.match(app, /Object\.hasOwn\(summary, "development_project_templates"\)/);
  assert.match(app, /async function hydratePlatformBootstrap\(route = routeName\(\)\)/);
  assert.match(app, /hydrateRouteAfterNavigation\(activeRoute, \{ enterAfterHydration: waitingForAssets \|\| waitingForProject \}\)/);
  assert.match(app, /async function hydrateRouteAfterNavigation\(activeRoute = routeName\(\), \{ enterAfterHydration = false \} = \{\}\)[\s\S]*Promise\.all\([\s\S]*loadRouteAssets\(activeRoute\)[\s\S]*hydratePlatformBootstrap\(activeRoute\)[\s\S]*hydratePlatformState\(activeRoute\)[\s\S]*routeName\(\) !== activeRoute[\s\S]*renderAll\(\)/);
});

test("keeps project cards compact and loads one project detail on demand", () => {
  assert.match(devServer, /profile=summary/);
  assert.match(devServer, /function toPlatformProjectSummary\(project\)/);
  assert.doesNotMatch(devServer.match(/function toPlatformProjectSummary[\s\S]*?\n}/)?.[0] || "", /viewManifest|sourceFiles|buildConfig|steps/);
  assert.match(app, /getJson\(`\/api\/platform\/projects\/\$\{encodeURIComponent\(projectId\)\}`\)/);
  assert.match(app, /const projectDetailLoads = new Map\(\)/);
  assert.match(app, /loadRouteProjectDetail\(activeRoute\)/);
});

test("loads progress only for the open learning project after leaving the catalog", () => {
  assert.match(app, /if \(route === "learn"\) return \["progress"\]/);
  assert.doesNotMatch(app, /\["learn", "learning-project-overview", "learning-project"\]\.includes\(route\).*\["progress"\]/);
  assert.match(app, /response\.learning_progress/);
  assert.match(devServer, /const userId = projectServerUserId\(session\);[\s\S]*listLearningProgress\(userId, \[project\]\)/);
  assert.match(devServer, /learningProgress\?\.status === "completed"[\s\S]*hasSubmittedLearningFeedback\(userId, project\.project_server_id\)/);
});

test("synchronizes catalog projects once per account without blocking the project list", () => {
  assert.match(projectLoader, /scheduleProjectServerDemoProjects\(session\)/);
  assert.doesNotMatch(projectLoader, /await ensureProjectServerDemoProjects/);
  assert.match(devServer, /const projectServerSeededUsers = new Set\(\)/);
  assert.match(devServer, /const projectServerSeedPromises = new Map\(\)/);
  assert.match(devServer, /if \(projectServerSeedPromises\.has\(userId\)\) return projectServerSeedPromises\.get\(userId\)/);
});

test("shares the immediate project load between bootstrap and route hydration", () => {
  assert.match(devServer, /const userIdeProjectsCache = new Map\(\)/);
  assert.match(devServer, /const userIdeProjectLoads = new Map\(\)/);
  assert.match(projectLoader, /cached\.expires_at > Date\.now\(\)/);
  assert.match(projectLoader, /userIdeProjectLoads\.has\(userId\)/);
  assert.match(projectLoader, /loadUserIdeProjectsUncached\(session, userId\)/);
  assert.match(devServer, /userIdeProjectsCacheMs = 2_500/);
});
