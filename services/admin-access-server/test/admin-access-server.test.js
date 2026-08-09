const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const test = require("node:test");
const { AdminAccessRepository } = require("../src/admin-access-repository");
const { AdminAccessService } = require("../src/admin-access-service");
const { createHttpApp, sendJson } = require("../src/http-app");

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
  const app = createHttpApp({ service: runtime.service, config: { adminToolAccessToken: "", cookieSecure: false } });
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
  const app = createHttpApp({ service: runtime.service, config: { adminToolAccessToken: "proxy-token", adminToolBaseUrl: "http://127.0.0.1:1", cookieSecure: false } });
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
