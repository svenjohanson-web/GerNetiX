"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { staticCacheControl } = require("../src/dev/http-utils");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public", "app", "index.html"), "utf8");
const webRoutes = fs.readFileSync(path.join(root, "src", "dev", "server", "web-routes.js"), "utf8");
const ide = fs.readFileSync(path.join(root, "public", "app", "app-ide-controller.js"), "utf8");
const builds = fs.readFileSync(path.join(root, "public", "app", "app-device-build-controller.js"), "utf8");
const projects = fs.readFileSync(path.join(root, "public", "app", "app-project-controller.js"), "utf8");
const devServer = [
  "dev-server.js",
  path.join("dev", "account", "account-workspace-service.js"),
  path.join("dev", "projects", "project-runtime-service.js"),
  path.join("dev", "projects", "project-source-service.js"),
  path.join("dev", "projects", "project-configuration-service.js"),
]
  .map((file) => fs.readFileSync(path.join(root, "src", file), "utf8")).join("\n");
const shell = fs.readFileSync(path.join(root, "public", "app", "app-shell-controller.js"), "utf8");
const guided = fs.readFileSync(path.join(root, "public", "app", "guided-project-view.js"), "utf8");
const informationView = fs.readFileSync(path.join(root, "public", "app", "information-view.js"), "utf8");
const knowledgeContent = fs.readFileSync(path.join(root, "public", "app", "knowledge-content.js"), "utf8");
const hardwareFragment = fs.readFileSync(path.join(root, "public", "app", "fragments", "hardware-lab.html"), "utf8");
const messagesFragment = fs.readFileSync(path.join(root, "public", "app", "fragments", "messages.html"), "utf8");

test("platform scripts download in parallel and route-only knowledge assets stay out of the common path", () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)src="([^"]+)"[^>]*><\/script>/g)];
  const synchronousScripts = scripts.filter((match) => !/\bdefer\b/.test(match[1]));
  assert.ok(scripts.length < 50);
  assert.equal(scripts.some((match) => match[2].includes("knowledge-articles-")), false);
  assert.equal(scripts.some((match) => match[2].includes("knowledge-content.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("quiz-data.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("/quiz.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("project-app-renderer.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("project-app-controller.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("hardware-lab-controller.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("app-community-controller.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("community-portal-controller.js")), false);
  assert.equal(scripts.some((match) => match[2].includes("community-marketplace-controller.js")), false);
  assert.deepEqual(synchronousScripts.map((match) => match[2].split("?")[0]), ["/app/initial-view-router.js"]);
  assert.equal(scripts.every((match) => match[2].includes("?v=")), true);
  assert.match(webRoutes, /versioned: url\.searchParams\.has\("v"\)/);
  assert.equal(staticCacheControl("/app/app.js", { versioned: true }), "public, max-age=31536000, immutable");
  assert.equal(staticCacheControl("/images/software-evolution-ai.jpg", { versioned: true }), "public, max-age=31536000, immutable");
  assert.equal(staticCacheControl("/app/app.js"), "no-store");
  assert.equal(staticCacheControl("/app/index.html", { versioned: true }), "no-store");
});

test("renders only the active route and prefetches knowledge after an idle dashboard load", () => {
  const renderAll = shell.match(/function renderAll\(\)[\s\S]*?\n}/)?.[0] || "";
  assert.match(renderAll, /const route = routeName\(\)/);
  assert.match(renderAll, /if \(route === "dashboard"\) renderDashboard\(\)/);
  assert.match(renderAll, /if \(route === "hardware-lab"\) GerNetiXHardwareLab\.render\(\)/);
  assert.match(renderAll, /if \(route === "account-setup"\) renderAccountSetup\(\)/);
  assert.match(renderAll, /if \(route === "learn"\)/);
  assert.match(renderAll, /if \(route === "learning-project-overview"\) renderLearningProjectOverview\(\)/);
  assert.match(renderAll, /if \(route === "learning-project"\) learningProject\(\)\.render\(\)/);
  assert.match(shell, /if \(route === "dashboard"\) scheduleKnowledgeContentPrefetch\(\)/);
  assert.match(shell, /connection\?\.saveData/);
  assert.match(shell, /requestIdleCallback\(prefetch, \{ timeout: 5_000 \}\)/);
  assert.match(shell, /link\.rel = "prefetch"/);
  assert.match(shell, /return \["knowledge-chapter-index\.js", "knowledge-content\.js"\]/);
  assert.doesNotMatch(shell, /knowledge-chapters\/from-problem-to-system\.js/);
  assert.match(shell, /async function loadQuizAssets\(\)/);
  assert.match(shell, /async function loadProjectAppAssets\(\)/);
});

test("renders each active route once and enters lazy routes only after their assets are ready", () => {
  assert.match(shell, /renderAll\(\);\s*renderRoute\(\{ contentRendered: true \}\)/);
  const initialRender = shell.match(/function renderInitialRoute\(\)[\s\S]*?\n}/)?.[0] || "";
  assert.doesNotMatch(initialRender, /GerNetiXHardwareLab\.render\(\)/);
  const hydration = shell.match(/async function hydrateRouteAfterNavigation[\s\S]*?\n}/)?.[0] || "";
  assert.match(hydration, /Promise\.all/);
  assert.equal((hydration.match(/renderAll\(\)/g) || []).length, 1);
  assert.match(hydration, /loadRouteAssets\(activeRoute\)/);
  assert.match(hydration, /if \(enterAfterHydration\) renderRoute\(\{ contentRendered \}\)/);
  assert.match(shell, /hardware-lab-controller\.js\?v=\$\{version\}/);
  assert.match(shell, /app-community-controller\.js\?v=\$\{version\}/);
  assert.match(shell, /community-marketplace-controller\.js\?v=\$\{version\}/);
  assert.match(shell, /loadRouteFragment\("hardwareLabView", `\/app\/fragments\/hardware-lab\.html\?v=\$\{version\}`\)/);
  assert.match(shell, /loadRouteFragment\("messagesView", `\/app\/fragments\/messages\.html\?v=\$\{version\}`\)/);
  assert.match(shell, /route === "hardware-lab"\)[\s\S]*!document\.querySelector\("#hardwareLabView"\)/);
  assert.match(shell, /route === "messages"\)[\s\S]*!document\.querySelector\("#messagesView"\)/);
});

test("keeps route HTML fragments out of the shell and rejects executable fragment content", () => {
  assert.doesNotMatch(html, /id="hardwareLabView"|id="messagesView"/);
  assert.match(hardwareFragment, /^<section id="hardwareLabView"/);
  assert.match(messagesFragment, /^<section id="messagesView"/);
  assert.doesNotMatch(hardwareFragment + messagesFragment, /<script\b/i);
  assert.match(shell, /if \(parsed\.querySelector\("script"\)\) throw new Error/);
  assert.match(shell, /roots\.length !== 1 \|\| roots\[0\]\.id !== id/);
  assert.match(shell, /footer\.before\(document\.importNode\(roots\[0\], true\)\)/);
});

test("loads one knowledge chapter at a time without prefetching protected neighbors", () => {
  assert.match(knowledgeContent, /function loadArticle\(articleId\)/);
  assert.match(knowledgeContent, /fetch\(`\/api\/platform\/knowledge\/chapters\/\$\{encodeURIComponent\(articleId\)\}`/);
  assert.match(knowledgeContent, /function adjacentArticleIds\(chapterId\)/);
  assert.match(informationView, /const article = portal \? content\.loadedArticle\(selected\.articleId\)/);
  assert.match(informationView, /await KnowledgeContent\.loadArticle\(articleId\)/);
  assert.match(knowledgeContent, /Prefetching protected neighbors would place unnecessary content in the browser/);
  assert.doesNotMatch(informationView, /topics\.map\([\s\S]*renderArticle\(chapter, child/);
});

test("loads knowledge release state only where it is visible", () => {
  assert.match(shell, /isPublicKnowledgePage[\s\S]*\? "account,knowledge,subscription"[\s\S]*: "account,subscription"/);
  assert.match(shell, /route === "dashboard"[\s\S]*"knowledge"/);
});

test("IDE contents do not wait for USB discovery or start a duplicate route load", () => {
  const loadStart = ide.indexOf("async function loadIdeProject()");
  const loadEnd = ide.indexOf("\nfunction ideLayoutStorageKey", loadStart);
  const loadBody = ide.slice(loadStart, loadEnd);
  assert.match(loadBody, /void refreshUsbPorts\(false\)/);
  assert.doesNotMatch(loadBody, /await refreshUsbPorts\(false\)/);
  assert.match(loadBody, /const sources = await loadProjectSources\(project\)/);
  assert.match(ide, /const projectSourceListLoads = new Map\(\)/);
  assert.match(ide, /projectSourceListLoads\.has\(project\.id\)/);
  assert.match(ide, /const projectSourceContentLoads = new Map\(\)/);
  assert.match(ide, /if \(loadedIdeSourceKey === key\) return/);

  const openStart = projects.indexOf("async function openProjectInIde(projectId)");
  const openEnd = projects.indexOf("\nfunction", openStart + 1);
  const openBody = projects.slice(openStart, openEnd);
  assert.match(openBody, /navigate\(`\/app\/ide\//);
  assert.doesNotMatch(openBody, /loadIdeProject\(/);
});

test("browser-only learning projects do not load build flash or board workbenches", () => {
  assert.match(shell, /function activeLearningProjectNeedsHardwareWorkbench\(\)/);
  assert.match(shell, /startsWith\("runtime\.browser_"\)/);
  assert.match(shell, /if \(activeLearningProjectNeedsHardwareWorkbench\(\)\) \{[\s\S]*loadBuildWorkbenchAssets\(\)[\s\S]*\} else \{[\s\S]*loadGuidedProjectCoreAssets\(\)/);
  assert.match(shell, /route === "learning-project"[\s\S]*activeLearningProjectNeedsHardwareWorkbench\(\) && typeof startBuild === "undefined"/);
  assert.match(guided, /function projectRequiresHardware\(project\)[\s\S]*startsWith\("runtime\.browser_"\)/);
  assert.match(guided, /function renderLearningSoftwareTargetPanel\(project\) \{\s*if \(!projectRequiresHardware\(project\)\) return ""/);
  assert.match(guided, /if \(typeof BoardConfigurationPlugin === "undefined"\) \{\s*throw new Error/);
  assert.match(guided, /if \(typeof waitForCompletedBuild !== "function"\) \{\s*throw new Error/);
});

test("project file authorization does not reload every account project", () => {
  const accessStart = devServer.indexOf("async function requireSessionProject");
  const accessEnd = devServer.indexOf("\n  function sessionProjectNotFound", accessStart);
  const accessBody = devServer.slice(accessStart, accessEnd);
  assert.match(accessBody, /projectServerJson\(`\/api\/projects\/\$\{encodeURIComponent\(requestedProjectId\)\}`\)/);
  assert.match(accessBody, /storedProject\.user_id !== accountId/);
  assert.doesNotMatch(accessBody, /loadUserIdeProjects/);
});

test("resource-plan reconciliation is shared briefly across bootstrap calls", () => {
  assert.match(devServer, /const resourcePlanCache = new Map\(\)/);
  assert.match(devServer, /const resourcePlanLoads = new Map\(\)/);
  const planStart = devServer.indexOf("async function ensureAccountResourcePlan");
  const planEnd = devServer.indexOf("\nasync function updateAccountProjectSelection", planStart);
  const planBody = devServer.slice(planStart, planEnd);
  assert.match(planBody, /cached\.expires_at > Date\.now\(\)/);
  assert.match(planBody, /resourcePlanLoads\.has\(cacheKey\)/);
});

test("generated architecture and hardware files use one repository commit", () => {
  const helperStart = devServer.indexOf("async function persistGenerated");
  const helperEnd = devServer.indexOf("\n  return { read, list, search, write, persistGenerated }", helperStart);
  const helper = devServer.slice(helperStart, helperEnd);
  assert.match(helper, /\/repository\/commits/);
  assert.match(helper, /expected_head_sha: binding\.head_sha/);
  assert.match(helper, /changes: sources\.map/);
  assert.match(devServer, /projectSources\.persistGenerated\(project, sources, "Architekturansichten aktualisiert"\)/);
  assert.match(devServer, /projectSources\.persistGenerated\(project, sources, "Hardwareansichten aktualisiert"\)/);
  assert.match(devServer, /expected_head_sha: expectedHeadSha/);
});
