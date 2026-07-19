const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp, sendJson } = require("../src/http-app");

async function withServer(handler, run) {
  const server = http.createServer((req, res) => handler(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test("Admin API akzeptiert im geschuetzten Betrieb nur den Admin-Access-Proxy", async () => {
  const service = { serviceClients: { adminToolAccessToken: "internal-test-token" }, overview: async () => ({ ok: true }) };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(denied.status, 403);
    const actor = Buffer.from(JSON.stringify({ actor_id: "admin_1", role: "administrator", capabilities: [] })).toString("base64url");
    const allowed = await fetch(`${baseUrl}/api/admin/overview`, { headers: { "x-gernetix-admin-access-token": "internal-test-token", "x-gernetix-admin-actor": actor } });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { ok: true });
  });
});

test("Admin API stellt das Projekt-Komponentenmetamodell nur ueber den geschuetzten Zugang bereit", async () => {
  const service = { serviceClients: { adminToolAccessToken: "internal-test-token" } };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/admin/component-metamodel`);
    assert.equal(denied.status, 403);
    const actor = Buffer.from(JSON.stringify({ actor_id: "admin_1", role: "administrator", capabilities: [] })).toString("base64url");
    const allowed = await fetch(`${baseUrl}/api/admin/component-metamodel`, { headers: { "x-gernetix-admin-access-token": "internal-test-token", "x-gernetix-admin-actor": actor } });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.ok(body.component_types.some((item) => item.id === "iot_device"));
    assert.ok(body.relationship_rules.some((item) => item.id === "measures_for"));
  });
});

test("interner System-Event-Eingang akzeptiert nur den eigenen Ingest-Token", async () => {
  const recorded = [];
  const service = {
    serviceClients: { systemEventIngestToken: "event-ingest-token" },
    recordSystemEvent(event) { recorded.push(event); return { event_id: "evt-1", ...event }; },
  };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/internal/system-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_service: "identity_server", event_type: "passkey_login_failed", message: "Login fehlgeschlagen." }),
    });
    assert.equal(denied.status, 403);

    const allowed = await fetch(`${baseUrl}/api/internal/system-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GerNetiX-System-Event-Token": "event-ingest-token" },
      body: JSON.stringify({ source_service: "identity_server", event_type: "passkey_login_failed", message: "Login fehlgeschlagen." }),
    });
    assert.equal(allowed.status, 201);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].event_type, "passkey_login_failed");
  });
});
