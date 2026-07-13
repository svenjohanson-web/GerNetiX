const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultAiUsageServer } = require("../src");

function createTestAiUsageServer() {
  return createDefaultAiUsageServer({ persistenceBackend: "memory" });
}

test("grants credits and exposes available credit balance", () => {
  const service = createTestAiUsageServer();
  const balance = service.grantCredits("acct-1", { amount_credits: 50, reason: "addon_purchase" });

  assert.equal(balance.available_credits, 100050);
  assert.equal(balance.ledger_entries.some((entry) => entry.entry_type === "credit_grant"), true);
});

test("approves preflight and consumes credits on completion", () => {
  const service = createTestAiUsageServer();
  const preflight = service.preflight({
    account_id: "acct-1",
    user_id: "acct-1",
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
  assert.equal(balance.consumed_credits, 2000);
});

test("prices GPT 5.6 Terra with separate input and output rates", () => {
  const service = createTestAiUsageServer();
  const preflight = service.preflight({
    account_id: "acct-terra",
    model: "gpt-5.6-terra",
    estimated_input_tokens: 1000,
    estimated_output_tokens: 1000,
    system_capabilities: ["system_capability.ai_premium_models"],
  });
  assert.equal(preflight.allowed, true);
  assert.equal(preflight.estimated_provider_cost, 0.0175);
});

test("does not count approved preflight estimates as spent usage until completion", () => {
  const service = createTestAiUsageServer();
  const preflight = service.preflight({
    account_id: "acct-provider-fails",
    user_id: "acct-provider-fails",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 1000,
    estimated_output_tokens: 1000,
  });
  const failed = service.failUsageEvent(preflight.event_id, {
    error_code: "provider_error",
    error_message: "provider rejected request",
  });
  const dashboard = service.adminDashboard();
  const account = dashboard.by_account.find((item) => item.account_id === "acct-provider-fails");

  assert.equal(preflight.allowed, true);
  assert.equal(preflight.estimated_credits, 2000);
  assert.equal(failed.status, "failed");
  assert.equal(dashboard.summary.credits, 0);
  assert.equal(dashboard.summary.estimated_provider_cost, 0);
  assert.equal(account.today_credits, 0);
  assert.equal(account.month_credits, 0);
});

test("rejects account id fallbacks instead of creating phantom usage accounts", () => {
  const service = createTestAiUsageServer();

  assert.throws(
    () => service.grantCredits("demo", { amount_credits: 10 }),
    /Account-ID-Fallbacks sind verboten/,
  );
  assert.throws(
    () => service.getCreditBalance(""),
    /Pflichtfeld fehlt: identity.user_id/,
  );
});

test("rejects mismatched user_id and account_id on preflight", () => {
  const service = createTestAiUsageServer();
  service.grantCredits("acct-1", { amount_credits: 50 });

  assert.throws(
    () => service.preflight({
      account_id: "acct-1",
      user_id: "other-user",
      model: "gpt-4.1-mini",
      estimated_input_tokens: 10,
      estimated_output_tokens: 10,
    }),
    /user_id muss der fuehrenden identity.user_id entsprechen/,
  );
});

test("rejects calls without sufficient credits and still logs usage event", () => {
  const service = createTestAiUsageServer();
  service.holdCredits("acct-low", { amount_credits: 99999, reason: "test_exhausted_budget" });
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
  const dashboard = service.adminDashboard();
  assert.equal(dashboard.summary.rejection_breakdown[0].reason, "insufficient_credits");
  assert.equal(dashboard.summary.recent_rejections[0].protection_action, "block_call");
});

test("blocks premium model without premium model capability", () => {
  const service = createTestAiUsageServer();
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
  const service = createTestAiUsageServer();
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
  const service = createTestAiUsageServer();
  service.recordCostControlAction({
    action_type: "update_policy",
    reason: "test low limits",
    payload: { monthly_credit_limit: 2500, daily_credit_limit: 2500, budget_warning_threshold_percent: 50 },
  });
  const preflight = service.preflight({
    account_id: "acct-1",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 1000,
    estimated_output_tokens: 1000,
  });
  service.completeUsageEvent(preflight.event_id, { input_tokens: 1000, output_tokens: 1000 });
  const dashboard = service.adminDashboard();

  assert.equal(dashboard.summary.successful, 1);
  assert.equal(dashboard.summary.cost_by_day.length, 1);
  assert.equal(dashboard.summary.cost_by_day[0].estimated_provider_cost, 0.0012);
  assert.equal(dashboard.suspicious_usage.some((item) => item.finding_type === "near_budget_limit"), true);
});

test("account rating tracks local unlimited and GPT token limits", () => {
  const service = createTestAiUsageServer();
  service.recordCostControlAction({
    action_type: "update_policy",
    reason: "test token rating",
    payload: { max_prompt_tokens: 100000, max_response_tokens: 100000, daily_credit_limit: 100000, monthly_credit_limit: 100000 },
  });
  const gptPreflight = service.preflight({
    account_id: "acct-rating",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 30000,
    estimated_output_tokens: 20000,
  });
  service.completeUsageEvent(gptPreflight.event_id, { input_tokens: 30000, output_tokens: 20000 });
  const localPreflight = service.preflight({
    account_id: "acct-rating",
    model: "llama3.2:3b",
    estimated_input_tokens: 1000,
    estimated_output_tokens: 1000,
  });
  const rating = service.getAccountRating("acct-rating");
  const gpt = rating.sources.find((source) => source.source_id === "openai_gpt");
  const local = rating.sources.find((source) => source.source_id === "local_llm");

  assert.equal(localPreflight.allowed, true);
  assert.equal(gpt.month_tokens, 50000);
  assert.equal(gpt.used_percent, 50);
  assert.equal(local.unlimited, true);
});

test("preflight rejects GPT source when monthly token rating is exhausted", () => {
  const service = createTestAiUsageServer();
  service.recordCostControlAction({
    action_type: "update_policy",
    reason: "test token rating",
    payload: { max_prompt_tokens: 100000, max_response_tokens: 100000, daily_credit_limit: 100000, monthly_credit_limit: 100000 },
  });
  const first = service.preflight({
    account_id: "acct-limit",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 60000,
    estimated_output_tokens: 30000,
  });
  service.completeUsageEvent(first.event_id, { input_tokens: 60000, output_tokens: 30000 });
  service.grantCredits("acct-limit", { amount_credits: 20000 });
  const second = service.preflight({
    account_id: "acct-limit",
    model: "gpt-4.1-mini",
    estimated_input_tokens: 8000,
    estimated_output_tokens: 3000,
  });

  assert.equal(second.allowed, false);
  assert.equal(second.rejection_reason, "source_token_limit_exceeded");
});
