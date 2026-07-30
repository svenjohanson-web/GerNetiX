"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  createIdentityLinkInventory,
  normalizeTarget,
} = require("../src/link-integrity/identity-link-inventory");
const {
  classifyStatus,
  containsFragment,
  main,
} = require("../scripts/check-link-integrity");

test("Identity link inventory combines registered authenticated routes and discovered links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-link-inventory-"));
  try {
    fs.mkdirSync(path.join(root, "hilfe"), { recursive: true });
    fs.writeFileSync(path.join(root, "index.html"), '<a href="/app/dashboard/">Dashboard</a><a href="https://example.test/docs">Docs</a>');
    fs.writeFileSync(path.join(root, "hilfe", "index.html"), '<a href="../#answer">Antwort</a>');
    const inventory = createIdentityLinkInventory({
      publicDir: root,
      generatedAt: "2026-07-30T00:00:00.000Z",
    });

    const dashboard = inventory.targets.find((item) => item.reference_id === "identity.dashboard");
    const external = inventory.targets.find((item) => item.target_url === "https://example.test/docs");
    assert.equal(dashboard.access_scope, "authenticated");
    assert.equal(external.link_type, "external");
    assert.ok(inventory.occurrences.some((item) => item.reference_id === dashboard.reference_id && item.source_location === "index.html"));
    assert.equal(new Set(inventory.targets.map((item) => item.reference_id)).size, inventory.targets.length);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("relative and fragment targets are normalized against their source route", () => {
  assert.equal(normalizeTarget("../#answer", "/hilfe/"), "/#answer");
  assert.equal(normalizeTarget("#details", "/hilfe/"), "/hilfe/#details");
  assert.equal(normalizeTarget("javascript:alert(1)", "/"), "");
});

test("authenticated redirects to login are classified as broken", () => {
  assert.equal(classifyStatus(302, "authenticated", "/app/auth/?next=%2Fapp%2Fdashboard%2F"), "broken");
  assert.equal(classifyStatus(302, "public", "/nachbauprojekte/"), "redirected");
  assert.equal(classifyStatus(200, "authenticated", ""), "healthy");
  assert.equal(containsFragment('<section id="answer"></section>', "answer"), true);
});

test("link checker logs in for protected routes and ingests inventory plus checks", async () => {
  const received = { inventory: null, checks: null, dashboardCookie: "" };
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/internal/link-integrity/inventory" && req.method === "GET") {
      assert.equal(req.headers["x-gernetix-admin-token"], "identity-token");
      return json(res, 200, {
        source_service: "identity-server",
        generated_at: "2026-07-30T12:00:00.000Z",
        targets: [{
          reference_id: "identity.dashboard",
          target_url: "/app/dashboard/",
          link_type: "internal",
          owner_domain: "Identity",
          access_scope: "authenticated",
          active: true,
        }],
        occurrences: [],
      });
    }
    if (req.url === "/api/login" && req.method === "POST") {
      res.setHeader("Set-Cookie", "gernetix_demo_session=test-session; Path=/; HttpOnly");
      return json(res, 200, { authenticated: true });
    }
    if (req.url === "/app/dashboard/" && req.method === "GET") {
      received.dashboardCookie = req.headers.cookie || "";
      return html(res, received.dashboardCookie.includes("test-session") ? 200 : 302, "<main>Dashboard</main>");
    }
    if (req.url === "/api/internal/link-integrity/inventory" && req.method === "POST") {
      assert.equal(req.headers["x-gernetix-link-integrity-token"], "ingest-token");
      received.inventory = await body(req);
      return json(res, 202, { accepted: true });
    }
    if (req.url === "/api/internal/link-integrity/checks" && req.method === "POST") {
      assert.equal(req.headers["x-gernetix-link-integrity-token"], "ingest-token");
      received.checks = await body(req);
      return json(res, 202, { accepted: true });
    }
    if (req.url === "/api/logout") return json(res, 200, { logged_out: true });
    return json(res, 404, { error: "not_found" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await main({
      IDENTITY_BASE_URL: baseUrl,
      ADMIN_TOOL_BASE_URL: baseUrl,
      IDENTITY_ADMIN_TOKEN: "identity-token",
      LINK_INTEGRITY_INGEST_TOKEN: "ingest-token",
      LINK_CHECK_IDENTIFIER: "link-check-user",
      LINK_CHECK_PASSWORD: "secret",
    }, []);
    assert.equal(result.summary.healthy, 1);
    assert.match(received.dashboardCookie, /test-session/);
    assert.equal(received.inventory.source_service, "identity-server");
    assert.equal(received.checks.checks[0].access_profile, "authenticated");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

function html(res, status, payload) {
  res.writeHead(status, { "content-type": "text/html" });
  res.end(payload);
}

function body(req) {
  return new Promise((resolve, reject) => {
    let value = "";
    req.on("data", (chunk) => { value += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(value || "{}")); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}
