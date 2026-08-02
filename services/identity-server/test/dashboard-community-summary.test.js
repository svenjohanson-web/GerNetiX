const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { summarizeCommunityQuestions } = require("../src/dev/community-summary");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const app = readPlatformAppSource();
const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");

test("summarizes own community requests by visibility and lifecycle", () => {
  const summary = summarizeCommunityQuestions([
    { visibility: "public", status: "open" },
    { visibility: "public", status: "answered" },
    { visibility: "public", status: "resolved" },
    { visibility: "private", status: "open" },
    { visibility: "private", status: "closed" },
  ]);

  assert.deepEqual(summary, {
    available: true,
    total: 5,
    public: { open: 2, closed: 1 },
    private: { open: 1, closed: 1 },
  });
});

test("shows all four community areas on the dashboard", () => {
  assert.match(html, /id="dashboardCommunityTitle">Austauschen, vorstellen und weitergeben/);
  assert.match(html, /id="dashboardCommunitySummary"/);
  assert.match(app, /label: "Forum & Hilfe"/);
  assert.match(app, /label: "Ideenwerkstatt"/);
  assert.match(app, /label: "Projekt-Showcase"/);
  assert.match(app, /label: "Elektronik-Marktplatz"/);
  assert.match(app, /summary\.public\?\.open/);
  assert.match(app, /data-dashboard-community-target/);
});

test("shows the personal message overview on the dashboard", () => {
  assert.match(app, /function renderDashboardMessageOverview/);
  assert.match(app, /Dein Community-Postfach/);
  assert.match(app, /summary\.messages\?\.unread/);
  assert.match(app, /summary\.messages\?\.threads/);
  assert.match(app, /data-dashboard-community-route="\/app\/messages\/"/);
});

test("loads only the authenticated account's requests and messages for the dashboard summary", () => {
  assert.match(server, /communityJson\("\/api\/community\/questions\?mine=true"/);
  assert.match(server, /communityJson\("\/api\/community\/message-threads"/);
  assert.match(server, /const headers = \{[\s\S]*"X-GerNetiX-Community-Actor": session\.account\.user_id/);
  assert.match(server, /community_summary: communitySummary/);
});
