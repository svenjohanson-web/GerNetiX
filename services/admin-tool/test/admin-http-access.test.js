const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp, sendJson } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");
const signingKey = "admin-operations-test-key";
const auth = (scope, audience = "admin-tool") => ({ Authorization: `Bearer ${issueInternalToken({ iss: "test-producer", sub: "test-producer", aud: audience, scopes: [scope] }, signingKey)}` });
const adminHeaders = (actor) => {
  const scopes = ["admin.gateway.proxy"];
  return {
    Authorization: `Bearer ${issueInternalToken({ iss: "admin-access-server", sub: "admin-access-server", aud: "admin-tool", scopes }, signingKey)}`,
    "X-GerNetiX-Admin-Delegation": issueInternalToken({ iss: "admin-access-server", sub: actor.actor_id, aud: "admin-tool", kind: "delegated_admin_action", scopes, context: { role: actor.role, capabilities: actor.capabilities } }, signingKey),
  };
};

async function withServer(handler, run) {
  const server = http.createServer((req, res) => handler(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal" })));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test("Admin API akzeptiert im geschuetzten Betrieb nur den Admin-Access-Proxy", async () => {
  const service = { serviceClients: { requireInternalAuth: true, internalApiSigningKey: signingKey }, overview: async () => ({ ok: true }) };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(denied.status, 403);
    const actor = { actor_id: "admin_1", role: "administrator", capabilities: [] };
    const allowed = await fetch(`${baseUrl}/api/admin/overview`, { headers: adminHeaders(actor) });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { ok: true });
  });
});

test("Admin API stellt das Projekt-Komponentenmetamodell nur ueber den geschuetzten Zugang bereit", async () => {
  const service = { serviceClients: { requireInternalAuth: true, internalApiSigningKey: signingKey } };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/admin/component-metamodel`);
    assert.equal(denied.status, 403);
    const actor = { actor_id: "admin_1", role: "administrator", capabilities: [] };
    const allowed = await fetch(`${baseUrl}/api/admin/component-metamodel`, { headers: adminHeaders(actor) });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.ok(body.component_types.some((item) => item.id === "iot_device"));
    assert.ok(body.relationship_rules.some((item) => item.id === "measures_for"));
  });
});

test("interner System-Event-Eingang akzeptiert nur den eigenen Ingest-Token", async () => {
  const recorded = [];
  const service = {
    serviceClients: { internalApiSigningKey: signingKey },
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

    const replayableHeaders = { "Content-Type": "application/json", ...auth("operations.system_events.write") };
    const allowed = await fetch(`${baseUrl}/api/internal/system-events`, {
      method: "POST",
      headers: replayableHeaders,
      body: JSON.stringify({ source_service: "identity_server", event_type: "passkey_login_failed", message: "Login fehlgeschlagen." }),
    });
    assert.equal(allowed.status, 201);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].event_type, "passkey_login_failed");
    const replayed = await fetch(`${baseUrl}/api/internal/system-events`, {
      method: "POST",
      headers: replayableHeaders,
      body: JSON.stringify({ source_service: "identity_server", event_type: "passkey_login_failed", message: "Wiederholung" }),
    });
    assert.equal(replayed.status, 403);
    assert.equal(recorded.length, 1);
  });
});

test("Operations-Ingest trennt Security- und System-Scopes", async () => {
  const recorded = [];
  const service = { serviceClients: { internalApiSigningKey: signingKey }, async recordSecurityEvent(event) { recorded.push(event); return { accepted: true }; } };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const wrong = await fetch(`${baseUrl}/api/internal/security-events`, { method: "POST", headers: { "Content-Type": "application/json", ...auth("operations.system_events.write") }, body: "{}" });
    assert.equal(wrong.status, 403);
    const accepted = await fetch(`${baseUrl}/api/internal/security-events`, { method: "POST", headers: { "Content-Type": "application/json", ...auth("operations.security_events.write") }, body: "{}" });
    assert.equal(accepted.status, 202);
    assert.equal(recorded.length, 1);
  });
});

test("interner Schnittstellen-Eingang verwendet denselben geschuetzten Ingest-Kanal", async () => {
  const recorded = [];
  const service = {
    serviceClients: { internalApiSigningKey: signingKey },
    async recordInterfaceCall(call) { recorded.push(call); return { accepted: true }; },
  };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/internal/interface-calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth("operations.interface_calls.write") },
      body: JSON.stringify({
        source_service: "identity-server", target_service: "project-server",
        method: "GET", route: "/api/projects", status_code: 200,
        duration_ms: 12, succeeded: true,
      }),
    });
    assert.equal(response.status, 202);
    assert.equal(recorded[0].target_service, "project-server");
  });
});

test("interner Nutzeraktions-Eingang verwendet den geschuetzten Operations-Ingest", async () => {
  const recorded = [];
  const service = {
    serviceClients: { internalApiSigningKey: signingKey },
    async recordUserActionEvent(event) { recorded.push(event); return event; },
  };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/internal/user-action-events`, { method: "POST", body: "{}" });
    assert.equal(denied.status, 403);
    const allowed = await fetch(`${baseUrl}/api/internal/user-action-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth("operations.user_actions.write") },
      body: JSON.stringify({ action_type: "nexi.flash.usb.start", action_id: "action-1" }),
    });
    assert.equal(allowed.status, 201);
    assert.equal(recorded[0].action_type, "nexi.flash.usb.start");
  });
});

test("Admin Action Explorer reicht die exakte Action-ID als Filter weiter", async () => {
  const calls = [];
  const service = {
    serviceClients: {},
    async userActionEvents(filter) { calls.push(filter); return { summary: {}, items: [] }; },
  };
  const actionId = "11111111-1111-4111-8111-111111111111";
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/admin/user-action-events?action_id=${actionId}&hours=168&limit=1000`);
    assert.equal(response.status, 200);
    assert.equal(calls[0].action_id, actionId);
    assert.equal(calls[0].limit, "1000");
    assert.equal(calls[0].hours, "168");
  });
});

test("Admin API liefert zentrale Schnittstellenstatistik fuer das angeforderte Zeitfenster", async () => {
  const calls=[];
  const service={
    serviceClients:{},
    async interfaceStatistics(filter){calls.push(filter);return {hours:48,summary:{calls:2,failed:0,targets:1},items:[]};},
  };
  const app=createHttpApp({service});
  await withServer(app,async(baseUrl)=>{
    const response=await fetch(`${baseUrl}/api/admin/interface-statistics?hours=48`);
    assert.equal(response.status,200);
    assert.equal((await response.json()).summary.calls,2);
    assert.deepEqual(calls,[{hours:"48"}]);
  });
});

test("Admin API exposes the audited user action incident lifecycle", async () => {
  const calls = [];
  const service = {
    serviceClients: {},
    async userActionIncidents() { return { items: [] }; },
    async createUserActionIncident(body, context) { calls.push(["create", body, context]); return { incident_id: "incident-1" }; },
    async updateUserActionIncident(id, body, context) { calls.push(["update", id, body, context]); return { incident_id: id, ...body }; },
  };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const listed = await fetch(`${baseUrl}/api/admin/user-action-incidents`);
    assert.equal(listed.status, 200);
    const created = await fetch(`${baseUrl}/api/admin/user-action-incidents`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_id: "action-1", action_type: "project.build.start" }),
    });
    assert.equal(created.status, 201);
    const updated = await fetch(`${baseUrl}/api/admin/user-action-incidents/incident-1`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", change_reason: "fixed" }),
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(calls.map((item) => item[0]), ["create", "update"]);
  });
});

test("synthetic checks can be read by admins and run by the protected scheduler", async () => {
  const calls = [];
  const service = {
    serviceClients: { internalApiSigningKey: signingKey },
    async syntheticChecks(filter) { calls.push(["list", filter]); return { items: [] }; },
    async runSyntheticChecks(body, context) { calls.push(["run", body, context]); return { summary: { total: 4, passed: 4 } }; },
  };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/admin/synthetic-checks?limit=20`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/internal/synthetic-checks/run`, { method: "POST", body: "{}" })).status, 403);
    const run = await fetch(`${baseUrl}/api/internal/synthetic-checks/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth("operations.synthetic_checks.run") },
      body: JSON.stringify({ timeout_ms: 1000 }),
    });
    assert.equal(run.status, 200);
    assert.equal(calls[0][0], "list");
    assert.equal(calls[1][0], "run");
    assert.equal(calls[1][2].actor.actor_id, "synthetic-monitor");
  });
});

test("Linkinventar und Prüfergebnisse verwenden einen getrennten Ingest-Token", async () => {
  const received = [];
  const service = {
    serviceClients: { internalApiSigningKey: signingKey },
    async registerLinkInventory(value) { received.push(["inventory", value]); return { targets: 1 }; },
    async recordLinkChecks(value) { received.push(["checks", value]); return { accepted: 1 }; },
  };
  const app = createHttpApp({ service });
  await withServer(app, async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/internal/link-integrity/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_service: "identity-server" }),
    });
    assert.equal(denied.status, 403);

    for (const [resource, payload] of [
      ["inventory", { source_service: "identity-server", targets: [{}] }],
      ["checks", { checks: [{}] }],
    ]) {
      const allowed = await fetch(`${baseUrl}/api/internal/link-integrity/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth("operations.link_integrity.write") },
        body: JSON.stringify(payload),
      });
      assert.equal(allowed.status, 202);
    }
    assert.deepEqual(received.map(([kind]) => kind), ["inventory", "checks"]);
  });
});
