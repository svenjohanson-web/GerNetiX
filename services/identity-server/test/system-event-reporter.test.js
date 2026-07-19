const assert = require("node:assert/strict");
const test = require("node:test");
const { createSystemEventReporter } = require("../src/services/system-event-reporter");

test("reports identity events through the token-protected internal Admin Tool endpoint", async () => {
  const requests = [];
  const warnings = [];
  const report = createSystemEventReporter({
    baseUrl: "http://admin-tool:4600/",
    ingestToken: "event-ingest-token",
    logger: { warn(value) { warnings.push(value); } },
    async fetchImpl(url, options) {
      requests.push({ url, options });
      return { ok: true, status: 201 };
    },
  });

  const delivered = await report({
    severity: "warning",
    source_service: "identity_server",
    event_type: "passkey_login_failed",
    message: "Passkey-Login fehlgeschlagen.",
    details: { stage: "verification", error_code: "bad_signature" },
  });

  assert.equal(delivered, true);
  assert.equal(requests[0].url, "http://admin-tool:4600/api/internal/system-events");
  assert.equal(requests[0].options.headers["X-GerNetiX-System-Event-Token"], "event-ingest-token");
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.event_type, "passkey_login_failed");
  assert.equal(body.details.error_code, "bad_signature");
  assert.ok(body.occurred_at);
  assert.equal(warnings[0], "GerNetiX system event");
});

test("keeps login failure handling available when Admin Tool delivery fails", async () => {
  const warnings = [];
  const report = createSystemEventReporter({
    baseUrl: "http://admin-tool:4600",
    ingestToken: "event-ingest-token",
    logger: { warn(value) { warnings.push(String(value)); } },
    async fetchImpl() { throw new Error("connect ECONNREFUSED"); },
  });

  assert.equal(await report({
    source_service: "identity_server",
    event_type: "passkey_login_failed",
    message: "Passkey-Login fehlgeschlagen.",
  }), false);
  assert.ok(warnings.some((entry) => entry.includes("System event delivery failed")));
});
