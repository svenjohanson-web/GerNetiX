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

test("initialer Admin wird nur einmal aus der kontrollierten Bootstrap-Konfiguration angelegt", () => {
  const runtime = createRuntime();
  assert.deepEqual(runtime.service.bootstrap(), { created: true, username: "operator" });
  assert.deepEqual(runtime.service.bootstrap(), { created: false });
  assert.equal(runtime.repository.countUsers(), 1);
  runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
});

test("Admin-Login persistiert nur einen gehashten Sitzungstoken und liefert serverseitige Rolle", () => {
  const runtime = createRuntime(); runtime.service.bootstrap();
  assert.equal(runtime.service.login({ username: "operator", password: "falsch" }), null);
  const login = runtime.service.login({ username: "OPERATOR", password: "ein-ausreichend-langes-admin-passwort" });
  assert.equal(login.admin.role, "administrator");
  assert.ok(login.token.length > 30);
  const session = runtime.service.session(login.token);
  assert.equal(session.admin.username, "operator");
  assert.ok(runtime.service.actorFor(login.token).capabilities.includes("admin_identity_configuration"));
  runtime.service.logout(login.token);
  assert.equal(runtime.service.session(login.token), null);
  runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
});

test("nur ein angemeldeter Administrator kann weitere Admin-Konten anlegen", () => {
  const runtime = createRuntime(); runtime.service.bootstrap();
  const login = runtime.service.login({ username: "operator", password: "ein-ausreichend-langes-admin-passwort" });
  const created = runtime.service.createAdministrator(login.token, { username: "backup-admin", password: "noch-ein-ausreichend-langes-passwort" });
  assert.equal(created.username, "backup-admin");
  assert.equal(runtime.service.createAdministrator("ungueltig", { username: "nope", password: "noch-ein-ausreichend-langes-passwort" }), null);
  runtime.repository.close(); fs.rmSync(runtime.dir, { recursive: true, force: true });
});

test("Login-PWA setzt eine HttpOnly-Sitzung und schuetzt die Console", async () => {
  const runtime = createRuntime(); runtime.service.bootstrap();
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
