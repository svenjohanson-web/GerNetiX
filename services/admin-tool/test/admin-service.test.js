const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultAdminTool } = require("../src");

function adminContext(overrides = {}) {
  return {
    actor: {
      actor_id: "admin-1",
      role: "administrator",
      capabilities: [],
    },
    purpose: "support_case",
    legal_basis: "",
    security_reason: "",
    ...overrides,
  };
}

test("device detail is masked without consent or legal basis and audited", async () => {
  const service = createDefaultAdminTool();
  const result = await service.getDevice("device_verified_1", adminContext());

  assert.equal(result.access.decision, "masked");
  assert.equal(result.device.display_name, "masked");
  assert.equal(result.device.last_seen_ip, undefined);
  assert.equal(service.listAuditEvents().length, 1);
});

test("device detail is full with matching consent and secrets stay redacted", async () => {
  const service = createDefaultAdminTool();
  service.createConsent({
    account_id: "acct_1",
    granted_to_role: "administrator",
    purpose: "support_case",
    valid_until: "2099-01-01T00:00:00.000Z",
  });

  const result = await service.getDevice("device_verified_1", adminContext());

  assert.equal(result.access.decision, "full");
  assert.equal(result.device.display_name, "Sven ESP32 DevKit");
  assert.equal(result.device.credential_history[0].secret, undefined);
  assert.equal(result.device.credential_history[0].key_reference, "device-key://device_verified_1/cred_verified_1");
});

test("revoked consent no longer grants full access", async () => {
  const service = createDefaultAdminTool();
  const consent = service.createConsent({
    account_id: "acct_1",
    granted_to_role: "administrator",
    purpose: "support_case",
    valid_until: "2099-01-01T00:00:00.000Z",
  });
  service.revokeConsent(consent.consent_id);

  const result = await service.getDevice("device_verified_1", adminContext());
  assert.equal(result.access.decision, "masked");
});

test("learning feedback is masked without consent", async () => {
  const service = createDefaultAdminTool();
  const result = await service.listLearningFeedback(adminContext({ purpose: "feedback_review" }));

  assert.equal(result[0].access.decision, "masked");
  assert.equal(result[0].feedback.contact_email, "masked");
});

test("ai usage summary requires monitoring capability and cost control action is audited", async () => {
  const service = createDefaultAdminTool();
  const summary = await service.aiUsageSummary(adminContext({ purpose: "ai_usage_monitoring" }));
  assert.equal(summary.summary.total_events, 3);
  assert.equal(summary.summary.rejected, 1);
  assert.equal(summary.summary.local.total_events, 1);
  assert.equal(summary.summary.external.total_events, 2);
  assert.equal(summary.summary.external.estimated_provider_cost, 0.05);
  assert.ok(summary.summary.provider_breakdown.some((item) => item.provider_type === "local" && item.provider_name === "Lokales Ollama"));

  const action = await service.recordAiCostControlAction({
    action_type: "temporary_ai_block",
    account_id: "acct_2",
    reason: "suspicious_usage_pattern",
  }, adminContext({ purpose: "ai_cost_control" }));
  assert.equal(action.action_type, "temporary_ai_block");
  assert.ok(service.listAuditEvents().some((event) => event.accessed_data_model_id === "data_model.ai_admin_action_audit_event"));
});

test("support without admin ai capability cannot read ai monitoring", async () => {
  const service = createDefaultAdminTool();
  await assert.rejects(
    () => service.aiUsageSummary(adminContext({
      actor: { actor_id: "support-1", role: "support", capabilities: [] },
      purpose: "ai_usage_monitoring",
    })),
    /KI Usage Monitoring ist nicht erlaubt/,
  );
});
