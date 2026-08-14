const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const test = require("node:test");
const { AdminAccessRepository } = require("../src/admin-access-repository");
const { AdminAccessService } = require("../src/admin-access-service");
const { createHttpApp, sendJson } = require("../src/http-app");
const { verifyInternalToken } = require("../../shared/internal-api-auth");

function createRuntime() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-admin-access-"));
  const repository = AdminAccessRepository.create(path.join(dir, "admin.sqlite"));
  const config = { bootstrapUsername: "operator", bootstrapPassword: "ein-ausreichend-langes-admin-passwort", sessionHours: 8 };
  const service = new AdminAccessService({ repository, config });
  return { repository, service, dir };
}

test("initialer Admin wird nur einmal aus der kontrollierten Bootstrap-Konfiguration angelegt", async () => {
  const runtime = createRuntime();
  assert.deepEqual(await runtime.service.bootstrap(), { created: true, username: "operator" });
  assert.deepEqual(await runtime.service.bootstrap(), { created: false });
  assert.equal(runtime.repository.countUsers(), 1);
  runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
});

test("Admin-Login persistiert nur einen gehashten Sitzungstoken und liefert serverseitige Rolle", async () => {
  const runtime = createRuntime(); await runtime.service.bootstrap();
  assert.equal(await runtime.service.login({ username: "operator", password: "falsch" }), null);
  const login = await runtime.service.login({ username: "OPERATOR", password: "ein-ausreichend-langes-admin-passwort" });
  assert.equal(login.admin.role, "administrator");
  assert.ok(login.token.length > 30);
  const session = await runtime.service.session(login.token);
  assert.equal(session.admin.username, "operator");
  assert.ok((await runtime.service.actorFor(login.token)).capabilities.includes("admin_identity_configuration"));
  await runtime.service.logout(login.token);
  assert.equal(await runtime.service.session(login.token), null);
  runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
});

test("nur ein angemeldeter Administrator kann weitere Admin-Konten anlegen", async () => {
  const runtime = createRuntime(); await runtime.service.bootstrap();
  const login = await runtime.service.login({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" });
  const created = await runtime.service.createAdministrator(login.token, { username: "backup-admin", password: "noch-ein-ausreichend-langes-passwort" });
  assert.equal(created.username, "backup-admin");
  assert.equal(await runtime.service.createAdministrator("ungueltig", { username: "nope", password: "noch-ein-ausreichend-langes-passwort" }), null);
  runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
});

test("Admin-Zugänge können auf Support oder Community-Moderation begrenzt werden", async () => {
  const runtime = createRuntime(); await runtime.service.bootstrap();
  const login = await runtime.service.login({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" });
  const support = await runtime.service.createAdministrator(login.token, {
    username: "support-team",
    password: "ein-weiteres-ausreichend-langes-passwort",
    role: "support",
  });
  const moderator = await runtime.service.createAdministrator(login.token, {
    username: "community-team",
    password: "noch-ein-ausreichend-langes-passwort",
    role: "community_moderator",
  });
  assert.deepEqual(support.capabilities, ["admin_device_management", "support_registered_board_check", "admin_community_support"]);
  assert.deepEqual(moderator.capabilities, ["admin_community_moderation"]);
  runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
});

test("Login-PWA setzt eine HttpOnly-Sitzung und schuetzt die Console", async () => {
  const runtime = createRuntime(); await runtime.service.bootstrap();
  const app = createHttpApp({ service: runtime.service, config: { internalApiSigningKey: "", cookieSecure: false } });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/admin/console/`, { redirect: "manual" })).status, 302);
    const login = await fetch(`${base}/api/admin-access/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie()[0].split(";")[0];
    const consoleResponse = await fetch(`${base}/admin/console/`, { headers: { Cookie: cookie } });
    assert.equal(consoleResponse.status, 200);
    assert.match(await consoleResponse.text(), /Operator Console/);
  } finally { await new Promise((resolve) => server.close(resolve)); runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true }); }
});

test("Admin-Proxy trennt Support und Moderation nach Capabilities", async () => {
  const runtime = createRuntime(); await runtime.service.bootstrap();
  const administrator = await runtime.service.login({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" });
  const support = await runtime.service.createAdministrator(administrator.token, { username: "support-team", password: "ein-weiteres-ausreichend-langes-passwort", role: "support" });
  const moderator = await runtime.service.createAdministrator(administrator.token, { username: "community-team", password: "noch-ein-ausreichend-langes-passwort", role: "community_moderator" });
  const supportLogin = await runtime.service.login({ username: support.username, password: "ein-weiteres-ausreichend-langes-passwort" });
  const moderatorLogin = await runtime.service.login({ username: moderator.username, password: "noch-ein-ausreichend-langes-passwort" });
  const app = createHttpApp({ service: runtime.service, config: { internalApiSigningKey: "proxy-signing-key", adminToolBaseUrl: "http://127.0.0.1:1", cookieSecure: false } });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const cookieFor = (login) => `gernetix_admin_session=${login.token}`;
    assert.equal((await fetch(`${base}/api/admin/accounts`, { headers: { Cookie: cookieFor(supportLogin) } })).status, 403);
    assert.equal((await fetch(`${base}/api/admin/community/questions`, { headers: { Cookie: cookieFor(supportLogin) } })).status, 403);
    assert.equal((await fetch(`${base}/api/admin/community/support-threads`, { headers: { Cookie: cookieFor(supportLogin) } })).status, 500);
    assert.equal((await fetch(`${base}/api/admin/community/support-threads`, { headers: { Cookie: cookieFor(moderatorLogin) } })).status, 403);
    assert.equal((await fetch(`${base}/api/admin/community/questions`, { headers: { Cookie: cookieFor(moderatorLogin) } })).status, 500);
  } finally { await new Promise((resolve) => server.close(resolve)); runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true }); }
});

test("Admin-Proxy signs a target-bound service token and admin delegation", async () => {
  const runtime = createRuntime(); await runtime.service.bootstrap();
  const login = await runtime.service.login({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" });
  let delegatedActor;
  const backend = http.createServer((req, res) => {
    verifyInternalToken(String(req.headers.authorization || "").replace(/^Bearer\s+/, ""), "proxy-signing-key", { audience: "admin-tool", requiredScopes: ["admin.gateway.proxy"] });
    delegatedActor = verifyInternalToken(req.headers["x-gernetix-admin-delegation"], "proxy-signing-key", { audience: "admin-tool", requiredScopes: ["admin.gateway.proxy"] });
    sendJson(res, 200, { ok: true });
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const app = createHttpApp({ service: runtime.service, config: { internalApiSigningKey: "proxy-signing-key", adminToolBaseUrl: `http://127.0.0.1:${backend.address().port}`, cookieSecure: false } });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/overview`, { headers: { Cookie: `gernetix_admin_session=${login.token}` } });
    assert.equal(response.status, 200);
    assert.equal(delegatedActor.kind, "delegated_admin_action");
    assert.equal(delegatedActor.sub, login.admin.admin_id);
    assert.equal(delegatedActor.context.role, "administrator");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => backend.close(resolve));
    runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
  }
});

test("Context-Manager-BFF keeps tokens server-side and separates read write and analyze", async () => {
  const runtime = createRuntime(); await runtime.service.bootstrap();
  const login = await runtime.service.login({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" });
  const support = await runtime.service.createAdministrator(login.token, { username: "context-support", password: "ein-weiteres-ausreichend-langes-passwort", role: "support" });
  const supportLogin = await runtime.service.login({ username: support.username, password: "ein-weiteres-ausreichend-langes-passwort" });
  const backendCalls = [];
  const backend = http.createServer(async (req, res) => {
    const expectedScope = req.url.startsWith("/context-manager/") || req.method === "GET"
      ? "context_manager.read"
      : req.url === "/api/context/analyze" || req.url === "/api/context/packs"
        ? "context_manager.analyze"
        : "context_manager.write";
    const claims = verifyInternalToken(String(req.headers.authorization || "").replace(/^Bearer\s+/, ""), "context-bff-signing-key", { audience: "context-manager", requiredScopes: [expectedScope] });
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    backendCalls.push({ method: req.method, url: req.url, claims, cookie: req.headers.cookie, body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null });
    if (req.url.startsWith("/context-manager/")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<h1>Context Manager</h1>");
    }
    return sendJson(res, 200, { ok: true });
  });
  await new Promise((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const app = createHttpApp({ service: runtime.service, config: { internalApiSigningKey: "context-bff-signing-key", contextManagerBaseUrl: `http://127.0.0.1:${backend.address().port}`, adminToolBaseUrl: "http://127.0.0.1:1", cookieSecure: false } });
  const server = http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/context-manager/`)).status, 401);
    const loginResponse = await fetch(`${base}/api/admin-access/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" }) });
    const cookies = loginResponse.headers.getSetCookie().map((value) => value.split(";")[0]);
    const cookieHeader = cookies.join("; ");
    const csrf = decodeURIComponent(cookies.find((value) => value.startsWith("gernetix_admin_csrf=" )).split("=")[1]);

    const asset = await fetch(`${base}/context-manager/`, { headers: { Cookie: cookieHeader } });
    assert.equal(asset.status, 200);
    assert.match(await asset.text(), /Context Manager/);
    assert.match(asset.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.equal((await fetch(`${base}/api/context/current?account_id=a`, { headers: { Cookie: cookieHeader } })).status, 200);
    assert.equal((await fetch(`${base}/api/context/current`, { method: "PUT", headers: { Cookie: cookieHeader, "Content-Type": "application/json" }, body: "{}" })).status, 403);
    assert.equal((await fetch(`${base}/api/context/current`, { method: "PUT", headers: { Cookie: cookieHeader, "Content-Type": "application/json", "X-GerNetiX-CSRF": csrf }, body: "{}" })).status, 200);
    assert.equal((await fetch(`${base}/api/context/analyze`, { method: "POST", headers: { Cookie: cookieHeader, "Content-Type": "application/json", "X-GerNetiX-CSRF": csrf }, body: "{}" })).status, 200);
    assert.equal((await fetch(`${base}/api/context/packs`, { method: "POST", headers: { Cookie: cookieHeader, "Content-Type": "application/json", "X-GerNetiX-CSRF": csrf }, body: "{}" })).status, 200);
    assert.equal((await fetch(`${base}/api/context/events`, { method: "POST", headers: { Cookie: cookieHeader, "Content-Type": "application/json", "X-GerNetiX-CSRF": csrf }, body: JSON.stringify({ actor_id: "forged-browser-actor", event_type: "context.updated" }) })).status, 200);
    assert.equal((await fetch(`${base}/api/context/unknown`, { headers: { Cookie: cookieHeader } })).status, 404);
    assert.equal((await fetch(`${base}/api/context/current`, { headers: { Cookie: `gernetix_admin_session=${supportLogin.token}` } })).status, 403);

    assert.deepEqual(backendCalls.map((call) => call.claims.scopes[0]), ["context_manager.read", "context_manager.read", "context_manager.write", "context_manager.analyze", "context_manager.analyze", "context_manager.write"]);
    assert.ok(backendCalls.every((call) => call.claims.sub === login.admin.admin_id));
    assert.ok(backendCalls.every((call) => call.cookie === undefined));
    assert.equal(backendCalls.at(-1).body.actor_id, login.admin.admin_id);
    const audits = runtime.repository.db.prepare("SELECT event_type, detail FROM admin_access_audit_events WHERE event_type LIKE 'context_%' ORDER BY occurred_at, rowid").all();
    assert.ok(audits.some((entry) => entry.event_type === "context_request" && entry.detail === "PUT /api/context/current"));
    assert.ok(audits.some((entry) => entry.event_type === "context_result" && entry.detail === "200 POST /api/context/events"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => backend.close(resolve));
    runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
  }
});
