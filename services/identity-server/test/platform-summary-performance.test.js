const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const devServer = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const platformSummary = devServer.match(/async function handlePlatformSummary[\s\S]*?\r?\n}\r?\n\r?\nfunction externalLoginMessage/)?.[0] || "";

test("loads independent platform summary dependencies concurrently", () => {
  assert.match(platformSummary, /const projectsPromise = loadUserIdeProjects/);
  assert.match(platformSummary, /const devicesPromise = loadUserIdeDevices/);
  assert.match(platformSummary, /const aiUsagePromise = loadAiUsageSummary/);
  assert.match(platformSummary, /const communitySummaryPromise = loadCommunityDashboardSummary/);
  assert.match(platformSummary, /const accountPromise = createAccountSummary/);
  assert.match(platformSummary, /const projects = await projectsPromise;[\s\S]*const buildsPromise = loadProjectBuilds\(projects/);
  assert.match(platformSummary, /const \[devices, builds, aiUsage, communitySummary, account\] = await Promise\.all/);
  assert.doesNotMatch(platformSummary, /const devices = await loadUserIdeDevices/);
});
