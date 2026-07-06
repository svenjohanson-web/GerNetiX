const crypto = require("node:crypto");
const { AiUsageError } = require("../errors");

class AiUsageService {
  constructor(options) {
    this.repository = options.repository;
  }

  getCreditBalance(accountId) {
    const account = this.ensureCreditAccount(accountId);
    return summarizeCreditAccount(account, this.repository.listLedgerEntries({ account_id: accountId }));
  }

  grantCredits(accountId, input = {}) {
    const amount = positiveNumber(input.amount_credits || input.amount, "amount_credits");
    const account = this.ensureCreditAccount(accountId);
    const now = new Date().toISOString();
    const next = {
      ...account,
      total_granted_credits: account.total_granted_credits + amount,
      updated_at: now,
    };
    this.repository.saveCreditAccount(next);
    this.repository.addLedgerEntry({
      ledger_entry_id: createId("ledger"),
      account_id: accountId,
      entry_type: "credit_grant",
      amount_credits: amount,
      reason: input.reason || "manual_credit_grant",
      reference_id: input.reference_id || "",
      created_at: now,
    });
    return this.getCreditBalance(accountId);
  }

  holdCredits(accountId, input = {}) {
    const amount = positiveNumber(input.amount_credits || input.amount, "amount_credits");
    const account = this.ensureCreditAccount(accountId);
    if (availableCredits(account) < amount) {
      throw new AiUsageError("insufficient_available_credits", "Nicht genug verfuegbare Credits fuer Sperre.", 409);
    }
    const now = new Date().toISOString();
    this.repository.saveCreditAccount({
      ...account,
      held_credits: account.held_credits + amount,
      updated_at: now,
    });
    this.repository.addLedgerEntry({
      ledger_entry_id: createId("ledger"),
      account_id: accountId,
      entry_type: "credit_hold",
      amount_credits: -amount,
      reason: input.reason || "manual_credit_hold",
      reference_id: input.reference_id || "",
      created_at: now,
    });
    return this.getCreditBalance(accountId);
  }

  preflight(input = {}) {
    const accountId = required(input.account_id, "account_id");
    const model = required(input.model, "model");
    const account = this.ensureCreditAccount(accountId);
    const policy = this.repository.getPolicy();
    const estimate = estimateCredits(policy, {
      model,
      input_tokens: Number(input.estimated_input_tokens || input.input_tokens || 0),
      output_tokens: Number(input.estimated_output_tokens || input.output_tokens || 0),
    });
    const decision = this.decidePreflight({ account, policy, input, model, estimate });
    const event = this.repository.addUsageEvent(createUsageEvent({
      input,
      account,
      model,
      estimate,
      status: decision.allowed ? "preflight_approved" : "rejected",
      rejection_reason: decision.allowed ? "" : decision.reason,
      protection_action: decision.protection_action,
    }));

    return {
      allowed: decision.allowed,
      event_id: event.event_id,
      rejection_reason: decision.allowed ? "" : decision.reason,
      protection_action: decision.protection_action,
      estimated_credits: estimate.credits,
      estimated_provider_cost: estimate.provider_cost,
      remaining_credits_after_estimate: Number((availableCredits(account) - estimate.credits).toFixed(4)),
    };
  }

  completeUsageEvent(eventId, input = {}) {
    const event = this.requireUsageEvent(eventId);
    if (event.status !== "preflight_approved") {
      throw new AiUsageError("event_not_billable", "Nur genehmigte Preflight-Events koennen abgeschlossen werden.", 409);
    }
    const policy = this.repository.getPolicy();
    const actual = estimateCredits(policy, {
      model: event.model,
      input_tokens: Number(input.input_tokens || event.input_tokens || 0),
      output_tokens: Number(input.output_tokens || event.output_tokens || 0),
    });
    const account = this.ensureCreditAccount(event.account_id);
    if (availableCredits(account) < actual.credits) {
      const failed = this.repository.updateUsageEvent(eventId, {
        status: "failed",
        error_code: "insufficient_credits_at_completion",
        protection_action: "block_completion",
        finished_at: new Date().toISOString(),
      });
      return failed;
    }
    this.consumeCredits(account.account_id, actual.credits, eventId);
    return this.repository.updateUsageEvent(eventId, {
      status: "success",
      input_tokens: actual.input_tokens,
      output_tokens: actual.output_tokens,
      calculated_credits: actual.credits,
      estimated_provider_cost: actual.provider_cost,
      finished_at: new Date().toISOString(),
    });
  }

  failUsageEvent(eventId, input = {}) {
    this.requireUsageEvent(eventId);
    return this.repository.updateUsageEvent(eventId, {
      status: "failed",
      error_code: input.error_code || "provider_error",
      error_message: input.error_message || "",
      finished_at: new Date().toISOString(),
    });
  }

  listUsageEvents(query = {}) {
    return this.repository.listUsageEvents({
      account_id: query.account_id || query.accountId || "",
      status: query.status || "",
    });
  }

  adminDashboard() {
    const events = this.repository.listUsageEvents();
    const accounts = this.repository.listCreditAccounts();
    const summary = summarizeUsage(events);
    return {
      summary,
      by_account: accounts.map((account) => accountDashboard(account, events, this.repository.getPolicy())),
      by_model: groupByModel(events),
      suspicious_usage: detectSuspiciousUsage(accounts, events, this.repository.getPolicy()),
      policy: this.repository.getPolicy(),
    };
  }

  recordCostControlAction(input = {}) {
    const actionType = required(input.action_type, "action_type");
    const actorId = input.actor_id || "admin";
    const reason = required(input.reason, "reason");
    const accountId = input.account_id || "";
    const payload = input.payload || {};
    let result = null;

    if (actionType === "grant_credits") result = this.grantCredits(required(accountId, "account_id"), { ...payload, reason });
    else if (actionType === "hold_credits") result = this.holdCredits(required(accountId, "account_id"), { ...payload, reason });
    else if (actionType === "block_account") result = this.blockAccount(required(accountId, "account_id"), payload);
    else if (actionType === "unblock_account") result = this.unblockAccount(required(accountId, "account_id"));
    else if (actionType === "update_policy") result = this.updatePolicy(payload);
    else if (actionType === "set_global_kill_switch") result = this.updatePolicy({ global_kill_switch: Boolean(payload.enabled) });
    else if (actionType === "allow_model") result = this.allowModel(required(payload.model, "model"));
    else if (actionType === "block_model") result = this.blockModel(required(payload.model, "model"));
    else throw new AiUsageError("unknown_cost_control_action", "Unbekannte KI-Cost-Control-Aktion.");

    const auditEvent = this.repository.addAdminAuditEvent({
      admin_audit_event_id: createId("ai_admin_audit"),
      actor_id: actorId,
      action_type: actionType,
      account_id: accountId || null,
      reason,
      payload,
      created_at: new Date().toISOString(),
    });
    return { audit_event: auditEvent, result };
  }

  listAdminAuditEvents() {
    return this.repository.listAdminAuditEvents();
  }

  blockAccount(accountId, input = {}) {
    const account = this.ensureCreditAccount(accountId);
    const blockedUntil = input.blocked_until || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return this.repository.saveCreditAccount({ ...account, blocked_until: blockedUntil, updated_at: new Date().toISOString() });
  }

  unblockAccount(accountId) {
    const account = this.ensureCreditAccount(accountId);
    return this.repository.saveCreditAccount({ ...account, blocked_until: null, updated_at: new Date().toISOString() });
  }

  updatePolicy(input = {}) {
    const policy = this.repository.getPolicy();
    return this.repository.savePolicy({
      ...policy,
      ...input,
      allowed_models: input.allowed_models || policy.allowed_models,
      premium_models: input.premium_models || policy.premium_models,
      model_pricing: input.model_pricing || policy.model_pricing,
    });
  }

  allowModel(model) {
    const policy = this.repository.getPolicy();
    return this.repository.savePolicy({ ...policy, allowed_models: unique([...policy.allowed_models, model]) });
  }

  blockModel(model) {
    const policy = this.repository.getPolicy();
    return this.repository.savePolicy({ ...policy, allowed_models: policy.allowed_models.filter((item) => item !== model) });
  }

  decidePreflight({ account, policy, input, model, estimate }) {
    if (policy.global_kill_switch) return reject("global_kill_switch", "global_kill_switch");
    if (isBlocked(account)) return reject("account_blocked", "block_account");
    if (!policy.allowed_models.includes(model)) return reject("model_not_allowed", "block_model");
    if (policy.premium_models.includes(model) && !normalizeList(input.system_capabilities).includes("system_capability.ai_premium_models")) {
      return reject("premium_model_not_allowed", "block_model");
    }
    if (Number(input.estimated_input_tokens || input.input_tokens || 0) > policy.max_prompt_tokens) return reject("prompt_too_large", "limit_prompt");
    if (Number(input.estimated_output_tokens || input.output_tokens || 0) > policy.max_response_tokens) return reject("response_too_large", "limit_response");
    if (availableCredits(account) < estimate.credits) return reject("insufficient_credits", "block_call");
    const usage = usageForAccount(this.repository.listUsageEvents({ account_id: account.account_id }));
    if (usage.today_credits + estimate.credits > policy.daily_credit_limit) return reject("daily_limit_exceeded", "rate_limit");
    if (usage.month_credits + estimate.credits > policy.monthly_credit_limit) return reject("monthly_limit_exceeded", "budget_limit");
    return { allowed: true, reason: "", protection_action: "preflight_approved" };
  }

  consumeCredits(accountId, amount, referenceId) {
    const account = this.ensureCreditAccount(accountId);
    const now = new Date().toISOString();
    const next = {
      ...account,
      consumed_credits: Number((account.consumed_credits + amount).toFixed(4)),
      updated_at: now,
    };
    if (next.consumed_credits + next.held_credits > next.total_granted_credits) {
      throw new AiUsageError("negative_credit_balance_forbidden", "Negative KI-Credits sind unzulaessig.", 409);
    }
    this.repository.saveCreditAccount(next);
    this.repository.addLedgerEntry({
      ledger_entry_id: createId("ledger"),
      account_id: accountId,
      entry_type: "credit_consumption",
      amount_credits: -amount,
      reason: "ai_usage_event_completed",
      reference_id: referenceId,
      created_at: now,
    });
  }

  ensureCreditAccount(accountId) {
    const existing = this.repository.findCreditAccount(accountId);
    if (existing) return normalizeAccount(existing);
    const now = new Date().toISOString();
    return this.repository.saveCreditAccount({
      account_id: accountId,
      plan_id: "plan.free",
      total_granted_credits: 20,
      consumed_credits: 0,
      held_credits: 0,
      blocked_until: null,
      created_at: now,
      updated_at: now,
    });
  }

  requireUsageEvent(eventId) {
    const event = this.repository.findUsageEvent(eventId);
    if (!event) throw new AiUsageError("usage_event_not_found", "Usage Event wurde nicht gefunden.", 404);
    return event;
  }
}

function createUsageEvent({ input, account, model, estimate, status, rejection_reason, protection_action }) {
  const now = new Date().toISOString();
  return {
    event_id: createId("ai_usage"),
    account_id: account.account_id,
    user_id: input.user_id || account.account_id,
    project_id: input.project_id || "",
    feature: input.feature || "ai_assistant",
    model,
    plan_id: account.plan_id,
    status,
    input_tokens: estimate.input_tokens,
    output_tokens: estimate.output_tokens,
    calculated_credits: status === "rejected" ? 0 : estimate.credits,
    estimated_provider_cost: status === "rejected" ? 0 : estimate.provider_cost,
    rejection_reason,
    protection_action,
    error_code: "",
    error_message: "",
    created_at: now,
    finished_at: status === "rejected" ? now : null,
  };
}

function estimateCredits(policy, usage) {
  const pricing = policy.model_pricing[usage.model];
  if (!pricing) throw new AiUsageError("model_pricing_missing", "Fuer dieses Modell ist keine Preispolicy hinterlegt.");
  const inputTokens = Number(usage.input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  const credits = Number(((inputTokens / 1000) * pricing.credits_per_1k_input_tokens + (outputTokens / 1000) * pricing.credits_per_1k_output_tokens).toFixed(4));
  const providerCost = Number((((inputTokens + outputTokens) / 1000) * pricing.provider_cost_per_1k_tokens).toFixed(6));
  return { input_tokens: inputTokens, output_tokens: outputTokens, credits, provider_cost: providerCost };
}

function summarizeCreditAccount(account, ledgerEntries) {
  return {
    account_id: account.account_id,
    plan_id: account.plan_id,
    total_granted_credits: account.total_granted_credits,
    consumed_credits: account.consumed_credits,
    held_credits: account.held_credits,
    available_credits: availableCredits(account),
    blocked_until: account.blocked_until,
    ledger_entries: ledgerEntries,
  };
}

function summarizeUsage(events) {
  return {
    total_events: events.length,
    approved: events.filter((event) => event.status === "preflight_approved").length,
    successful: events.filter((event) => event.status === "success").length,
    rejected: events.filter((event) => event.status === "rejected").length,
    failed: events.filter((event) => event.status === "failed").length,
    credits: Number(events.reduce((sum, event) => sum + Number(event.calculated_credits || 0), 0).toFixed(4)),
    tokens: events.reduce((sum, event) => sum + Number(event.input_tokens || 0) + Number(event.output_tokens || 0), 0),
    estimated_provider_cost: Number(events.reduce((sum, event) => sum + Number(event.estimated_provider_cost || 0), 0).toFixed(6)),
  };
}

function accountDashboard(account, events, policy) {
  const accountEvents = events.filter((event) => event.account_id === account.account_id);
  const usage = usageForAccount(accountEvents);
  const usedPercent = policy.monthly_credit_limit ? (usage.month_credits / policy.monthly_credit_limit) * 100 : 0;
  return {
    account_id: account.account_id,
    available_credits: availableCredits(account),
    today_credits: usage.today_credits,
    month_credits: usage.month_credits,
    budget_used_percent: Number(usedPercent.toFixed(2)),
    rejected_events: accountEvents.filter((event) => event.status === "rejected").length,
    blocked: isBlocked(account),
  };
}

function groupByModel(events) {
  const grouped = new Map();
  for (const event of events) {
    const current = grouped.get(event.model) || { model: event.model, events: 0, credits: 0, tokens: 0, estimated_provider_cost: 0 };
    current.events += 1;
    current.credits += Number(event.calculated_credits || 0);
    current.tokens += Number(event.input_tokens || 0) + Number(event.output_tokens || 0);
    current.estimated_provider_cost += Number(event.estimated_provider_cost || 0);
    grouped.set(event.model, current);
  }
  return Array.from(grouped.values()).map((item) => ({
    ...item,
    credits: Number(item.credits.toFixed(4)),
    estimated_provider_cost: Number(item.estimated_provider_cost.toFixed(6)),
  }));
}

function detectSuspiciousUsage(accounts, events, policy) {
  const findings = [];
  for (const account of accounts) {
    const dashboard = accountDashboard(account, events, policy);
    if (dashboard.budget_used_percent >= policy.budget_warning_threshold_percent) {
      findings.push({ account_id: account.account_id, finding_type: "near_budget_limit", severity: "warning", details: dashboard });
    }
    if (dashboard.rejected_events >= 3) {
      findings.push({ account_id: account.account_id, finding_type: "repeated_rejections", severity: "warning", details: dashboard });
    }
    if (dashboard.blocked) {
      findings.push({ account_id: account.account_id, finding_type: "account_blocked", severity: "info", details: dashboard });
    }
  }
  for (const event of events) {
    if (Number(event.estimated_provider_cost || 0) >= 0.05) {
      findings.push({ account_id: event.account_id, finding_type: "unusually_expensive_call", severity: "warning", event_id: event.event_id });
    }
  }
  return findings;
}

function usageForAccount(events) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  return {
    today_credits: Number(events.filter((event) => event.created_at.slice(0, 10) === day).reduce((sum, event) => sum + Number(event.calculated_credits || 0), 0).toFixed(4)),
    month_credits: Number(events.filter((event) => event.created_at.slice(0, 7) === month).reduce((sum, event) => sum + Number(event.calculated_credits || 0), 0).toFixed(4)),
  };
}

function availableCredits(account) {
  return Number((account.total_granted_credits - account.consumed_credits - account.held_credits).toFixed(4));
}

function normalizeAccount(account) {
  return {
    ...account,
    total_granted_credits: Number(account.total_granted_credits || 0),
    consumed_credits: Number(account.consumed_credits || 0),
    held_credits: Number(account.held_credits || 0),
  };
}

function isBlocked(account) {
  return Boolean(account.blocked_until && new Date(account.blocked_until).getTime() > Date.now());
}

function reject(reason, protectionAction) {
  return { allowed: false, reason, protection_action: protectionAction };
}

function positiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new AiUsageError("invalid_number", `${field} muss positiv sein.`);
  return number;
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new AiUsageError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { AiUsageService };
