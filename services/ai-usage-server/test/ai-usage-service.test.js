const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultAiUsageServer } = require("../src");

test("grants credits and exposes available credit balance", () => {
  const service = createDefaultAiUsageServer();
  const balance = service.grantCredits("acct-1", { amount_credits: 50, reason: "addon_purchase" });

  assert.equal(balance.available_credits, 70);
  assert.equal(balance.ledger_entries.some((entry) => entry.entry_type === "credit_grant"), true);
});

test("approves preflight and consumes credits on completion", () => {
  const service = createDefaultAiUsageServer();
  service.grantCredits("acct-1", { amount_credits: 50 });
  const preflight = service.preflight({
    account_id: "acct-1",
    user_id: "user-1",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 1000,
    estimated_output_tokens: 1000,
  });
  const event = service.completeUsageEvent(preflight.event_id, {
    input_tokens: 1000,
    output_tokens: 1000,
  });
  const balance = service.getCreditBalance("acct-1");

  assert.equal(preflight.allowed, true);
  assert.equal(event.status, "success");
  assert.equal(balance.consumed_credits, 5);
});

test("rejects calls without sufficient credits and still logs usage event", () => {
  const service = createDefaultAiUsageServer();
  const preflight = service.preflight({
    account_id: "acct-low",
    model: "gpt-4.1",
    estimated_input_tokens: 8000,
    estimated_output_tokens: 4000,
    system_capabilities: ["system_capability.ai_premium_models"],
  });
  const events = service.listUsageEvents({ account_id: "acct-low" });

  assert.equal(preflight.allowed, false);
  assert.equal(preflight.rejection_reason, "insufficient_credits");
  assert.equal(events[0].status, "rejected");
});

test("blocks premium model without premium model capability", () => {
  const service = createDefaultAiUsageServer();
  service.grantCredits("acct-1", { amount_credits: 100 });
  const preflight = service.preflight({
    account_id: "acct-1",
    model: "gpt-4.1",
    estimated_input_tokens: 100,
    estimated_output_tokens: 100,
  });

  assert.equal(preflight.allowed, false);
  assert.equal(preflight.rejection_reason, "premium_model_not_allowed");
});

test("admin cost controls can enable kill switch and audit the action", () => {
  const service = createDefaultAiUsageServer();
  const action = service.recordCostControlAction({
    actor_id: "admin-1",
    action_type: "set_global_kill_switch",
    reason: "provider outage",
    payload: { enabled: true },
  });
  const preflight = service.preflight({
    account_id: "acct-1",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 100,
    estimated_output_tokens: 100,
  });

  assert.equal(action.result.global_kill_switch, true);
  assert.equal(preflight.rejection_reason, "global_kill_switch");
  assert.equal(service.listAdminAuditEvents().length, 1);
});

test("admin dashboard summarizes usage and flags budget proximity", () => {
  const service = createDefaultAiUsageServer();
  service.recordCostControlAction({
    action_type: "update_policy",
    reason: "test low limits",
    payload: { monthly_credit_limit: 5, daily_credit_limit: 5, budget_warning_threshold_percent: 50 },
  });
  service.grantCredits("acct-1", { amount_credits: 20 });
  const preflight = service.preflight({
    account_id: "acct-1",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 1000,
    estimated_output_tokens: 1000,
  });
  service.completeUsageEvent(preflight.event_id, { input_tokens: 1000, output_tokens: 1000 });
  const dashboard = service.adminDashboard();

  assert.equal(dashboard.summary.successful, 1);
  assert.equal(dashboard.suspicious_usage.some((item) => item.finding_type === "near_budget_limit"), true);
});
