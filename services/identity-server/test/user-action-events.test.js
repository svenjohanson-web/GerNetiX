"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeUserActionEvent, createUserActionIngestHandler, readUserActionContext } = require("../src/services/user-action-events");
const { createUserActionReporter } = require("../src/services/user-action-reporter");
const { verifyInternalToken } = require("../../shared/internal-api-auth");

const validInput = {
  action_type: "nexi.flash.usb.start",
  action_id: "11111111-1111-4111-8111-111111111111",
  span_type: "helper.status",
  span_id: "22222222-2222-4222-8222-222222222222",
  parent_span_id: "33333333-3333-4333-8333-333333333333",
  phase: "failed",
  reason_code: "local_dependency_unreachable",
  route_id: "/nachbauprojekte/nexi-sprachassistent/",
  release_id: "0.1.0-test",
  duration_bucket: "lt_1s",
};

test("normalizes an allowlisted action chain without local or free-form details", () => {
  const event = normalizeUserActionEvent({
    ...validInput,
    message: "Load failed for /dev/cu.usbmodem101",
    local_port: "/dev/cu.usbmodem101",
    hostname: "private-mac.local",
  }, new Date("2026-08-07T12:00:00.000Z"));

  assert.equal(event.action_id, validInput.action_id);
  assert.equal(event.span_type, "helper.status");
  assert.equal(event.occurred_at, "2026-08-07T12:00:00.000Z");
  assert.equal("message" in event, false);
  assert.equal("local_port" in event, false);
  assert.equal("hostname" in event, false);
});

test("rejects unknown actions, spans and free reason codes", () => {
  assert.throws(() => normalizeUserActionEvent({ ...validInput, action_type: "unknown.button" }), /unknown_action_type/);
  assert.throws(() => normalizeUserActionEvent({ ...validInput, span_type: "/dev/cu.usbmodem101" }), /invalid_action_span/);
  assert.throws(() => normalizeUserActionEvent({ ...validInput, reason_code: "Load failed for private host" }), /invalid_action_reason/);
});

test("accepts the four initial action chains on their explicit routes", () => {
  const chains = [
    ["identity.login.passkey", "auth.verify", "/app/auth/"],
    ["project.settings.save", "project.settings.persist", "/app/project-app/"],
    ["project.build.start", "build.submit", "/app/development-platform/"],
  ];
  for (const [actionType, spanType, routeId] of chains) {
    const event = normalizeUserActionEvent({ ...validInput, action_type: actionType, span_type: spanType, route_id: routeId, reason_code: "" });
    assert.equal(event.action_type, actionType);
    assert.equal(event.span_type, spanType);
  }
});

test("forwards only a validated action context and ignores malformed tracing headers", () => {
  const context = readUserActionContext({ headers: {
    "x-gernetix-action-id": validInput.action_id,
    "x-gernetix-action-type": "project.build.start",
  } }, "project.build.start");
  assert.deepEqual(context.headers, {
    "X-GerNetiX-Action-Id": validInput.action_id,
    "X-GerNetiX-Action-Type": "project.build.start",
  });
  assert.equal(readUserActionContext({ headers: {
    "x-gernetix-action-id": "not-an-id",
    "x-gernetix-action-type": "project.build.start",
  } }, "project.build.start"), null);
  assert.equal(readUserActionContext({ headers: {
    "x-gernetix-action-id": validInput.action_id,
    "x-gernetix-action-type": "project.settings.save",
  } }, "project.build.start"), null);
});

test("same-origin action ingest forwards only the normalized event", async () => {
  let forwarded = null;
  let response = null;
  const handler = createUserActionIngestHandler({
    readJsonBody: async () => ({ ...validInput, message: "private detail" }),
    reportUserAction: async (event) => { forwarded = event; return true; },
    sendJson: (_res, status, body) => { response = { status, body }; },
  });
  await handler({ headers: { origin: "http://localhost:4300", host: "localhost:4300" }, socket: { remoteAddress: "127.0.0.1" } }, {});

  assert.equal(response.status, 202);
  assert.equal(response.body.delivered, true);
  assert.equal(forwarded.action_type, validInput.action_type);
  assert.equal("message" in forwarded, false);
});

test("identity reports user actions through the protected Admin Tool endpoint", async () => {
  const requests = [];
  const report = createUserActionReporter({
    baseUrl: "http://admin-tool:4600/", internalApiSigningKey: "ops-signing-key", logger: { warn() {} },
    fetchImpl: async (url, options) => { requests.push({ url, options }); return { ok: true, status: 201 }; },
  });
  assert.equal(await report(normalizeUserActionEvent(validInput)), true);
  assert.equal(requests[0].url, "http://admin-tool:4600/api/internal/user-action-events");
  verifyInternalToken(requests[0].options.headers.Authorization.replace(/^Bearer\s+/, ""), "ops-signing-key", { audience: "admin-tool", requiredScopes: ["operations.user_actions.write"] });
});

test("identity keeps failed Operations deliveries in a persistent outbox and flushes after recovery", async () => {
  let state = { items: [] };
  let available = false;
  const store = {
    load() { return structuredClone(state); },
    async save(value) { state = structuredClone(value); },
  };
  const report = createUserActionReporter({
    baseUrl: "http://admin-tool:4600", internalApiSigningKey: "ops-signing-key", outboxStore: store,
    logger: { warn() {} },
    fetchImpl: async () => available ? { ok: true, status: 201 } : { ok: false, status: 503 },
  });
  const event = normalizeUserActionEvent(validInput);
  assert.equal(await report(event), false);
  assert.equal(await report.pending(), 1);
  assert.equal(state.items[0].event_id, event.event_id);

  available = true;
  const flushed = await report.flush();
  assert.deepEqual(flushed, { pending: 0, delivered: 1 });
  assert.equal(await report.pending(), 0);
});
