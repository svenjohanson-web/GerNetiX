const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { summarizeCommunityQuestions } = require("../src/dev/community-summary");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
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

test("shows the four personal request counters on the dashboard", () => {
  assert.match(html, /id="dashboardCommunityTitle">Meine Anfragen/);
  assert.match(html, /id="dashboardCommunitySummary"/);
  assert.match(app, /\["Öffentlich", "Für alle lesbare Community-Anfragen", summary\.public\]/);
  assert.match(app, /\["Privat", "Nur für dich und GerNetiX sichtbar", summary\.private\]/);
  assert.match(app, /<span>Offen<\/span>/);
  assert.match(app, /<span>Geschlossen<\/span>/);
});

test("loads only the authenticated account's requests for the dashboard summary", () => {
  assert.match(server, /communityJson\("\/api\/community\/questions\?mine=true"/);
  assert.match(server, /"X-GerNetiX-Community-Actor": session\.account\.user_id/);
  assert.match(server, /community_summary: communitySummary/);
});
