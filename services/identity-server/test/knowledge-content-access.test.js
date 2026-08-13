"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createKnowledgeContentStore } = require("../src/knowledge/knowledge-content-store");
const { registerKnowledgeRoutes } = require("../src/dev/server/knowledge-routes");
const { createRouteRegistry } = require("../src/dev/server/route-registry");
const fs = require("node:fs");
const path = require("node:path");

test("knowledge content store returns only a preview without an authenticated entitlement", () => {
  const store = createKnowledgeContentStore();
  const anonymous = store.responseFor("security-basics");
  const basicAccount = store.responseFor("security-basics", { authenticated: true, entitlements: [] });
  const premiumAccount = store.responseFor("security-basics", { authenticated: true, entitlements: ["knowledge_library"] });

  assert.equal(anonymous.access, "preview");
  assert.equal(basicAccount.access, "preview");
  assert.equal(anonymous.article.sections.length, 1);
  assert.equal(basicAccount.article.sections.length, 1);
  assert.equal(premiumAccount.access, "full");
  assert.ok(premiumAccount.article.sections.length > 1);
  assert.deepEqual(premiumAccount.required_entitlements, ["knowledge_library"]);
  assert.doesNotMatch(JSON.stringify(premiumAccount), /"answer"|"correctText"|"wrongText"|"explanation"/);
});

test("free books still require a session for their full content", () => {
  const store = createKnowledgeContentStore();
  const anonymous = store.responseFor("from-problem-to-system");
  const account = store.responseFor("from-problem-to-system", { authenticated: true, entitlements: [] });

  assert.equal(anonymous.access, "preview");
  assert.equal(anonymous.article.sections.length, 1);
  assert.equal(account.access, "full");
  assert.ok(account.article.sections.length > 1);
});

test("browser marks a server-delivered free preview as account protected", () => {
  const knowledgeClient = fs.readFileSync(path.join(__dirname, "..", "public", "app", "knowledge-content.js"), "utf8");
  const informationView = fs.readFileSync(path.join(__dirname, "..", "public", "app", "information-view.js"), "utf8");
  assert.match(knowledgeClient, /payload\.article\.delivery_access = payload\.access/);
  assert.match(informationView, /article\.delivery_access === "preview" && canAccess\(accessRequirement\)[\s\S]*\? "account"/);
});

test("knowledge API derives access from the resolved server session", async () => {
  const registry = createRouteRegistry();
  const store = createKnowledgeContentStore();
  const responses = [];
  registerKnowledgeRoutes({
    registry,
    requireSession: async () => null,
    resolveSession: async (req) => req.session || null,
    accountSubscription: (session) => ({ entitlements: session.account.entitlements || [] }),
    knowledgeContentStore: store,
    readJsonBody: async () => ({}),
    markChapterRead: async () => {},
    sendJson: (res, status, body) => responses.push({ status, body }),
  });

  await registry.dispatch({
    req: { method: "GET", session: { account: { entitlements: [] } } },
    res: {},
    url: new URL("http://localhost/api/platform/knowledge/chapters/security-basics"),
  });
  await registry.dispatch({
    req: { method: "GET", session: { account: { entitlements: ["knowledge_library"] } } },
    res: {},
    url: new URL("http://localhost/api/platform/knowledge/chapters/security-basics"),
  });

  assert.equal(responses[0].body.access, "preview");
  assert.equal(responses[1].body.access, "full");
  assert.ok(responses[1].body.article.sections.length > responses[0].body.article.sections.length);
});

test("knowledge API does not reveal unknown chapter files", async () => {
  const registry = createRouteRegistry();
  const responses = [];
  registerKnowledgeRoutes({
    registry,
    requireSession: async () => null,
    resolveSession: async () => null,
    accountSubscription: () => ({ entitlements: [] }),
    knowledgeContentStore: createKnowledgeContentStore(),
    readJsonBody: async () => ({}),
    markChapterRead: async () => {},
    sendJson: (res, status, body) => responses.push({ status, body }),
  });
  await registry.dispatch({
    req: { method: "GET" },
    res: {},
    url: new URL("http://localhost/api/platform/knowledge/chapters/not-a-chapter"),
  });
  assert.deepEqual(responses, [{ status: 404, body: { error: "knowledge_chapter_not_found" } }]);
});
