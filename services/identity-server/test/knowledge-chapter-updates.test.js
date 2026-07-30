const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  canReadKnowledgeChapter,
  findKnowledgeChapterRelease,
  knowledgeChapterHistory,
  unreadKnowledgeChapterReleases,
} = require("../src/knowledge/knowledge-chapter-releases");
const { InMemoryIdentityRepository } = require("../src/repositories/in-memory-identity-repository");
const { SqliteBackedIdentityRepository } = require("../src/repositories/sqlite-backed-identity-repository");

const server = fs.readFileSync(path.resolve(__dirname, "../src/dev-server.js"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "../public/app/app.js"), "utf8");
const css = fs.readFileSync(path.resolve(__dirname, "../public/app/app.css"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../public/app/index.html"), "utf8");
const informationView = fs.readFileSync(path.resolve(__dirname, "../public/app/information-view.js"), "utf8");

test("offers a chapter update only to accounts that may read the chapter", () => {
  const release = findKnowledgeChapterRelease("yaml-basics");
  assert.equal(canReadKnowledgeChapter(release, []), false);
  assert.equal(canReadKnowledgeChapter(release, ["learn_guided_projects"]), true);
  assert.deepEqual(unreadKnowledgeChapterReleases([], []), []);
  assert.deepEqual(
    unreadKnowledgeChapterReleases([], ["learn_guided_projects"]).map((item) => item.chapter_id),
    ["radio-technologies-understand", "security-basics", "home-server-internet-security", "yaml-basics"],
  );
});

test("publishes the home-server security chapter with an entitlement-gated read receipt", () => {
  const release = findKnowledgeChapterRelease("home-server-internet-security");
  assert.equal(release.version, "2026-07-28.1");
  assert.equal(canReadKnowledgeChapter(release, []), false);
  assert.equal(canReadKnowledgeChapter(release, ["learn_guided_projects"]), true);
});

test("publishes the cross-cutting security chapter with an entitlement-gated read receipt", () => {
  const release = findKnowledgeChapterRelease("security-basics");
  assert.equal(release.version, "2026-07-28.10");
  assert.equal(canReadKnowledgeChapter(release, []), false);
  assert.equal(canReadKnowledgeChapter(release, ["learn_guided_projects"]), true);
});

test("publishes the radio technologies chapter with an entitlement-gated read receipt", () => {
  const release = findKnowledgeChapterRelease("radio-technologies-understand");
  assert.equal(release.version, "2026-07-30.1");
  assert.match(release.summary, /Bluetooth, WLAN, LoRa, Zigbee, NFC und RC-Funksysteme/);
  assert.equal(canReadKnowledgeChapter(release, []), false);
  assert.equal(canReadKnowledgeChapter(release, ["learn_guided_projects"]), true);
});

test("a read receipt suppresses only the matching chapter version", () => {
  const current = findKnowledgeChapterRelease("yaml-basics");
  const entitlements = ["learn_guided_projects"];
  assert.equal(unreadKnowledgeChapterReleases([{
    account_id: "acct-1",
    chapter_id: current.chapter_id,
    chapter_version: current.version,
    seen_at: "2026-07-24T19:00:00.000Z",
  }], entitlements).length, 3);
  assert.equal(unreadKnowledgeChapterReleases([{
    account_id: "acct-1",
    chapter_id: current.chapter_id,
    chapter_version: "older-version",
    seen_at: "2026-07-24T19:00:00.000Z",
  }], entitlements).length, 4);
});

test("builds an entitlement-filtered knowledge history with publication and read state", () => {
  const current = findKnowledgeChapterRelease("yaml-basics");
  assert.deepEqual(knowledgeChapterHistory([], []).map((item) => item.chapter_id), []);
  const unread = knowledgeChapterHistory([], ["learn_guided_projects"]);
  assert.equal(unread[0].chapter_id, "radio-technologies-understand");
  assert.equal(unread[1].chapter_id, "security-basics");
  assert.equal(unread[2].chapter_id, "home-server-internet-security");
  assert.equal(unread[3].version, current.version);
  assert.equal(unread[3].is_current, true);
  assert.equal(unread[3].is_new, true);
  assert.equal(unread[3].seen_at, null);

  const seenAt = "2026-07-24T19:00:00.000Z";
  const read = knowledgeChapterHistory([{
    chapter_id: current.chapter_id,
    chapter_version: current.version,
    seen_at: seenAt,
  }], ["learn_guided_projects"]);
  const readYaml = read.find((item) => item.chapter_id === current.chapter_id);
  assert.equal(readYaml.is_new, false);
  assert.equal(readYaml.seen_at, seenAt);
});

test("persists chapter read receipts in local SQLite without storing notifications in browser state", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-knowledge-updates-"));
  const sqlitePath = path.join(directory, "identity.sqlite");
  try {
    const first = SqliteBackedIdentityRepository.create(sqlitePath, () => new Date("2026-07-24T20:00:00.000Z"));
    first.markKnowledgeChapterRead("acct-1", "yaml-basics", "2026-07-24.1");
    const second = SqliteBackedIdentityRepository.create(sqlitePath);
    assert.deepEqual(second.listKnowledgeChapterReads("acct-1"), [{
      account_id: "acct-1",
      chapter_id: "yaml-basics",
      chapter_version: "2026-07-24.1",
      seen_at: "2026-07-24T20:00:00.000Z",
    }]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("keeps in-memory test repositories account-partitioned", () => {
  const repository = new InMemoryIdentityRepository(() => new Date("2026-07-24T20:00:00.000Z"));
  repository.markKnowledgeChapterRead("acct-a", "yaml-basics", "2026-07-24.1");
  assert.equal(repository.listKnowledgeChapterReads("acct-b").length, 0);
  assert.equal(repository.listKnowledgeChapterReads("acct-a").length, 1);
});

test("exposes entitlement-filtered updates and an authenticated read endpoint", () => {
  assert.match(server, /knowledge_updates: knowledgeState\.updates/);
  assert.match(server, /knowledge_history: knowledgeState\.history/);
  assert.match(server, /unreadKnowledgeChapterReleases\(reads, entitlements\)/);
  assert.match(server, /knowledgeChapterHistory\(reads, entitlements\)/);
  assert.match(server, /knowledgeChapterRead = url\.pathname\.match/);
  assert.match(server, /api\\\/platform\\\/knowledge\\\/chapters/);
  assert.match(server, /if \(!session\)[\s\S]*not_authenticated/);
  assert.match(server, /canReadKnowledgeChapter\(release, accountSubscription\(session\)\.entitlements\)/);
  assert.match(server, /mark_knowledge_chapter_read/);
});

test("shows knowledge releases in the extensible dashboard news area and marks only opened chapters", () => {
  assert.match(html, /id="dashboardNews"[\s\S]*Was gibt es Neues\?/);
  assert.match(html, /id="knowledgeUpdateMenuBadge"/);
  assert.match(css, /\.knowledge-update-count\[hidden\] \{ display: none; \}/);
  assert.match(app, /updates\.length === 1 \? "platform\.nav\.new" : "platform\.nav\.new_count"/);
  assert.match(app, /updates\.length === 1 \? "Neu" : `Neu · \$\{updates\.length\}`/);
  assert.match(app, /state\.knowledgeUpdates = summary\.knowledge_updates \|\| \[\]/);
  assert.match(app, /state\.knowledgeHistory = summary\.knowledge_history \|\| \[\]/);
  assert.match(app, /function dashboardNewsItems\(\)[\s\S]*dashboard\.news\.knowledge\.category[\s\S]*\/wissen\/\?ansicht=historie/);
  assert.match(app, /dashboard-news-card[\s\S]*data-news-id/);
  assert.match(app, /api\/platform\/knowledge\/chapters\/\$\{encodeURIComponent\(chapterId\)\}\/read/);
  assert.match(informationView, /Historie des Wissensspeichers/);
  assert.match(informationView, /Version \$\{escapeHtml\(entry\.version\)\}/);
  assert.match(informationView, /data-knowledge-topic="\$\{escapeHtml\(entry\.chapter_id\)\}"/);
  assert.match(informationView, /knowledge-new-badge/);
  assert.match(informationView, /notifyKnowledgeChapterOpen/);
});
