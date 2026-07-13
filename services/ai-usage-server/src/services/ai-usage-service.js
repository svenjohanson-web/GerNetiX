const crypto = require("node:crypto");
const { AiUsageError } = require("../errors");

const DEFAULT_DAILY_TOKEN_CREDIT_LIMIT = 20000;
const DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT = 100000;
const DEFAULT_INITIAL_CREDITS = DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT;
const BUILTIN_MODEL_PRICING = {
  "gpt-5.6-sol": { credits_per_1k_input_tokens: 1000, credits_per_1k_output_tokens: 1000, provider_input_cost_per_1k_tokens: 0.005, provider_output_cost_per_1k_tokens: 0.03 },
  "gpt-5.6": { credits_per_1k_input_tokens: 1000, credits_per_1k_output_tokens: 1000, provider_input_cost_per_1k_tokens: 0.005, provider_output_cost_per_1k_tokens: 0.03 },
  "gpt-5.6-terra": { credits_per_1k_input_tokens: 1000, credits_per_1k_output_tokens: 1000, provider_input_cost_per_1k_tokens: 0.0025, provider_output_cost_per_1k_tokens: 0.015 },
  "gpt-5.6-luna": { credits_per_1k_input_tokens: 1000, credits_per_1k_output_tokens: 1000, provider_input_cost_per_1k_tokens: 0.001, provider_output_cost_per_1k_tokens: 0.006 },
};

class AiUsageService {
  constructor(options) {
    this.repository = options.repository;
  }

  getCreditBalance(accountId) {
    const account = this.ensureCreditAccount(accountId);
    return summarizeCreditAccount(account, this.repository.listLedgerEntries({ account_id: account.account_id }));
  }

  getAccountRating(accountId) {
    const account = this.ensureCreditAccount(accountId);
    return accountRating(account, this.repository.listUsageEvents({ account_id: account.account_id }), normalizePolicy(this.repository.getPolicy()));
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
      account_id: account.account_id,
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
      account_id: account.account_id,
      entry_type: "credit_hold",
      amount_credits: -amount,
      reason: input.reason || "manual_credit_hold",
      reference_id: input.reference_id || "",
      created_at: now,
    });
    return this.getCreditBalance(accountId);
  }

  preflight(input = {}) {
    const accountId = identityAccountId(input.account_id);
    if (input.user_id && String(input.user_id).trim() !== accountId) {
      throw new AiUsageError("identity_user_id_mismatch", "user_id muss der fuehrenden identity.user_id entsprechen.", 400);
    }
    const model = required(input.model, "model");
    const account = this.ensureCreditAccount(accountId);
    const policy = normalizePolicy(this.repository.getPolicy());
    const estimate = estimateCredits(policy, {
      model,
      input_tokens: Number(input.estimated_input_tokens || input.input_tokens || 0),
      output_tokens: Number(input.estimated_output_tokens || input.output_tokens || 0),
    });
    const decision = this.decidePreflight({ account, policy, input, model, estimate });
    const currentUsage = usageForAccount(this.repository.listUsageEvents({ account_id: account.account_id }));
    const event = this.repository.addUsageEvent(createUsageEvent({
      input,
      account,
      model,
      estimate,
      policy,
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
      daily_usage_tokens: currentUsage.today_credits,
      daily_limit_tokens: policy.daily_credit_limit,
      monthly_usage_tokens: currentUsage.month_credits,
      monthly_limit_tokens: policy.monthly_credit_limit,
    };
  }

  completeUsageEvent(eventId, input = {}) {
    const event = this.requireUsageEvent(eventId);
    if (event.status !== "preflight_approved") {
      throw new AiUsageError("event_not_billable", "Nur genehmigte Preflight-Events koennen abgeschlossen werden.", 409);
    }
    const policy = normalizePolicy(this.repository.getPolicy());
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
    const accountId = query.account_id || query.accountId || "";
    return this.repository.listUsageEvents({
      account_id: accountId ? identityAccountId(accountId) : "",
      status: query.status || "",
    });
  }

  adminDashboard() {
    const events = this.repository.listUsageEvents();
    const accounts = this.repository.listCreditAccounts();
    const summary = summarizeUsage(events);
    return {
      summary,
      by_account: accounts.map((account) => accountDashboard(account, events, normalizePolicy(this.repository.getPolicy()))),
      by_model: groupByModel(events),
      suspicious_usage: detectSuspiciousUsage(accounts, events, normalizePolicy(this.repository.getPolicy())),
      policy: normalizePolicy(this.repository.getPolicy()),
    };
  }

  recordCostControlAction(input = {}) {
    const actionType = required(input.action_type, "action_type");
    const actorId = input.actor_id || "admin";
    const reason = required(input.reason, "reason");
    const accountId = input.account_id ? identityAccountId(input.account_id) : "";
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
    const policy = normalizePolicy(this.repository.getPolicy());
    const limitPatch = unifiedLimitPatch(input);
    return this.repository.savePolicy({
      ...normalizePolicy({ ...policy, ...input, ...limitPatch }),
      allowed_models: input.allowed_models || policy.allowed_models,
      premium_models: input.premium_models || policy.premium_models,
      model_pricing: input.model_pricing || policy.model_pricing,
    });
  }

  allowModel(model) {
    const policy = normalizePolicy(this.repository.getPolicy());
    return this.repository.savePolicy({ ...policy, allowed_models: unique([...policy.allowed_models, model]) });
  }

  blockModel(model) {
    const policy = normalizePolicy(this.repository.getPolicy());
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
    const rating = sourceRatingForModel(policy, model);
    const sourceUsage = sourceUsageForAccount(
      this.repository.listUsageEvents({ account_id: account.account_id }),
      policy,
      rating.source_id,
    );
    if (rating.token_limit !== null && sourceUsage.month_tokens + estimate.input_tokens + estimate.output_tokens > rating.token_limit) {
      return reject("source_token_limit_exceeded", "budget_limit");
    }
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
      account_id: account.account_id,
      entry_type: "credit_consumption",
      amount_credits: -amount,
      reason: "ai_usage_event_completed",
      reference_id: referenceId,
      created_at: now,
    });
  }

  ensureCreditAccount(accountId) {
    const identityUserId = identityAccountId(accountId);
    const existing = this.repository.findCreditAccount(identityUserId);
    if (existing) return normalizeAccount(existing);
    const now = new Date().toISOString();
    return this.repository.saveCreditAccount({
      account_id: identityUserId,
      plan_id: "plan.free",
      total_granted_credits: normalizePolicy(this.repository.getPolicy()).monthly_credit_limit || DEFAULT_INITIAL_CREDITS,
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

function createUsageEvent({ input, account, model, estimate, policy, status, rejection_reason, protection_action }) {
  const now = new Date().toISOString();
  return {
    event_id: createId("ai_usage"),
    account_id: account.account_id,
    user_id: account.account_id,
    project_id: input.project_id || "",
    feature: input.feature || "ai_assistant",
    model,
    source_id: input.source_id || sourceRatingForModel(policy, model).source_id,
    plan_id: account.plan_id,
    status,
    input_tokens: estimate.input_tokens,
    output_tokens: estimate.output_tokens,
    calculated_credits: 0,
    estimated_provider_cost: 0,
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
  const credits = inputTokens + outputTokens;
  const legacyCost = Number(pricing.provider_cost_per_1k_tokens || 0);
  const inputCost = Number(pricing.provider_input_cost_per_1k_tokens ?? legacyCost);
  const outputCost = Number(pricing.provider_output_cost_per_1k_tokens ?? legacyCost);
  const providerCost = Number((((inputTokens / 1000) * inputCost) + ((outputTokens / 1000) * outputCost)).toFixed(6));
  return { input_tokens: inputTokens, output_tokens: outputTokens, credits, provider_cost: providerCost };
}

function normalizePolicy(policy = {}) {
  const dailyLimit = finiteNumber(policy.daily_token_limit ?? policy.daily_credit_limit, DEFAULT_DAILY_TOKEN_CREDIT_LIMIT);
  const monthlyLimit = finiteNumber(policy.monthly_token_limit ?? policy.monthly_credit_limit, DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT);
  return {
    ...policy,
    allowed_models: unique([...(policy.allowed_models || []), ...Object.keys(BUILTIN_MODEL_PRICING)]),
    premium_models: unique([...(policy.premium_models || []), "gpt-5.6-sol", "gpt-5.6", "gpt-5.6-terra"]),
    model_pricing: { ...BUILTIN_MODEL_PRICING, ...(policy.model_pricing || {}) },
    daily_credit_limit: dailyLimit,
    daily_token_limit: dailyLimit,
    monthly_credit_limit: monthlyLimit,
    monthly_token_limit: monthlyLimit,
    source_ratings: normalizeSourceRatings(policy.source_ratings, monthlyLimit),
  };
}

function unifiedLimitPatch(input = {}) {
  const patch = {};
  if (Object.hasOwn(input, "daily_token_limit") || Object.hasOwn(input, "daily_credit_limit")) {
    const dailyLimit = finiteNumber(input.daily_token_limit ?? input.daily_credit_limit, DEFAULT_DAILY_TOKEN_CREDIT_LIMIT);
    patch.daily_credit_limit = dailyLimit;
    patch.daily_token_limit = dailyLimit;
  }
  if (Object.hasOwn(input, "monthly_token_limit") || Object.hasOwn(input, "monthly_credit_limit")) {
    const monthlyLimit = finiteNumber(input.monthly_token_limit ?? input.monthly_credit_limit, DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT);
    patch.monthly_credit_limit = monthlyLimit;
    patch.monthly_token_limit = monthlyLimit;
  }
  return patch;
}

function normalizeSourceRatings(sourceRatings = {}, monthlyTokenCreditLimit = DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT) {
  const ratings = {
    local_llm: {
      source_id: "local_llm",
      title: "Lokale LLM",
      token_limit: null,
      billing_scope: "unlimited",
      provider_type: "local",
    },
    openai_gpt: {
      source_id: "openai_gpt",
      title: "GPT / OpenAI",
      token_limit: monthlyTokenCreditLimit,
      billing_scope: "monthly",
      provider_type: "external",
    },
    ...sourceRatings,
  };
  return Object.fromEntries(Object.entries(ratings).map(([key, rating]) => [
    key,
    rating.provider_type === "local"
      ? { ...rating, token_limit: null, billing_scope: rating.billing_scope || "unlimited" }
      : { ...rating, token_limit: monthlyTokenCreditLimit, billing_scope: "monthly" },
  ]));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
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
    credits: Number(events.reduce((sum, event) => sum + billableCredits(event), 0).toFixed(4)),
    tokens: events.reduce((sum, event) => sum + Number(event.input_tokens || 0) + Number(event.output_tokens || 0), 0),
    estimated_provider_cost: Number(events.reduce((sum, event) => sum + billableProviderCost(event), 0).toFixed(6)),
    cost_by_day: costByDay(events),
    rejection_breakdown: rejectionBreakdown(events),
    recent_rejections: recentRejections(events),
  };
}

function rejectionBreakdown(events) {
  const groups = new Map();
  for (const event of events.filter((item) => item.status === "rejected" || item.rejection_reason)) {
    const reason = event.rejection_reason || "unknown";
    const current = groups.get(reason) || { reason, count: 0, tokens: 0, models: new Set(), accounts: new Set(), latest_at: "" };
    current.count += 1;
    current.tokens += Number(event.input_tokens || 0) + Number(event.output_tokens || 0);
    if (event.model) current.models.add(event.model);
    if (event.account_id) current.accounts.add(event.account_id);
    if (String(event.created_at || "") > current.latest_at) current.latest_at = event.created_at;
    groups.set(reason, current);
  }
  return Array.from(groups.values())
    .map((item) => ({
      reason: item.reason,
      count: item.count,
      tokens: item.tokens,
      models: Array.from(item.models).sort(),
      accounts: Array.from(item.accounts).sort(),
      latest_at: item.latest_at,
    }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function recentRejections(events) {
  return events
    .filter((event) => event.status === "rejected" || event.rejection_reason)
    .slice()
    .sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")))
    .slice(0, 10)
    .map((event) => ({
      event_id: event.event_id,
      account_id: event.account_id,
      project_id: event.project_id || "",
      feature: event.feature || "",
      model: event.model || "",
      rejection_reason: event.rejection_reason || "unknown",
      protection_action: event.protection_action || "",
      input_tokens: Number(event.input_tokens || 0),
      output_tokens: Number(event.output_tokens || 0),
      created_at: event.created_at || "",
    }));
}

function costByDay(events) {
  const groups = new Map();
  for (const event of events) {
    const day = String(event.created_at || event.occurred_at || "").slice(0, 10) || "unknown";
    const current = groups.get(day) || {
      day,
      total_events: 0,
      tokens: 0,
      credits: 0,
      estimated_provider_cost: 0,
    };
    current.total_events += 1;
    current.tokens += Number(event.input_tokens || 0) + Number(event.output_tokens || 0);
    current.credits += billableCredits(event);
    current.estimated_provider_cost += billableProviderCost(event);
    groups.set(day, current);
  }
  return Array.from(groups.values())
    .sort((left, right) => String(left.day).localeCompare(String(right.day)))
    .map((item) => ({
      ...item,
      credits: Number(item.credits.toFixed(4)),
      estimated_provider_cost: Number(item.estimated_provider_cost.toFixed(6)),
    }));
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
    ai_rating: accountRating(account, accountEvents, policy),
  };
}

function groupByModel(events) {
  const grouped = new Map();
  for (const event of events) {
    const current = grouped.get(event.model) || { model: event.model, events: 0, successful: 0, rejected: 0, input_tokens: 0, output_tokens: 0, credits: 0, tokens: 0, estimated_provider_cost: 0 };
    current.events += 1;
    current.successful += event.status === "success" ? 1 : 0;
    current.rejected += event.status === "rejected" ? 1 : 0;
    current.input_tokens += Number(event.input_tokens || 0);
    current.output_tokens += Number(event.output_tokens || 0);
    current.credits += billableCredits(event);
    current.tokens += Number(event.input_tokens || 0) + Number(event.output_tokens || 0);
    current.estimated_provider_cost += billableProviderCost(event);
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
    if (billableProviderCost(event) >= 0.05) {
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
    today_credits: Number(events.filter((event) => event.created_at.slice(0, 10) === day).reduce((sum, event) => sum + billableCredits(event), 0).toFixed(4)),
    month_credits: Number(events.filter((event) => event.created_at.slice(0, 7) === month).reduce((sum, event) => sum + billableCredits(event), 0).toFixed(4)),
  };
}

function accountRating(account, events, policy) {
  const ratings = effectiveSourceRatings(policy);
  const sources = Object.values(ratings).map((rating) => {
    const usage = sourceUsageForAccount(events, policy, rating.source_id);
    const limit = rating.token_limit === null || rating.token_limit === undefined ? null : Number(rating.token_limit);
    const usedPercent = limit ? Math.min(100, (usage.month_tokens / limit) * 100) : 0;
    return {
      source_id: rating.source_id,
      title: rating.title || rating.source_id,
      provider_type: rating.provider_type || "external",
      billing_scope: rating.billing_scope || "monthly",
      token_limit: limit,
      month_tokens: usage.month_tokens,
      total_tokens: usage.total_tokens,
      used_percent: limit ? Number(usedPercent.toFixed(2)) : 0,
      unlimited: limit === null,
    };
  });
  const limited = sources.filter((source) => !source.unlimited);
  const usedPercent = limited.length
    ? Math.max(...limited.map((source) => source.used_percent))
    : 0;
  return {
    account_id: account.account_id,
    used_percent: Number(usedPercent.toFixed(2)),
    sources,
  };
}

function sourceUsageForAccount(events, policy, sourceId) {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const matching = events.filter((event) => event.status === "success" && eventSourceId(event, policy) === sourceId);
  return {
    month_tokens: matching
      .filter((event) => String(event.created_at || event.occurred_at || "").slice(0, 7) === month)
      .reduce((sum, event) => sum + Number(event.input_tokens || 0) + Number(event.output_tokens || 0), 0),
    total_tokens: matching.reduce((sum, event) => sum + Number(event.input_tokens || 0) + Number(event.output_tokens || 0), 0),
  };
}

function eventSourceId(event, policy) {
  if (event.source_id) return event.source_id;
  return sourceRatingForModel(policy, event.model, event).source_id;
}

function sourceRatingForModel(policy = {}, model = "", event = {}) {
  const ratings = effectiveSourceRatings(policy);
  if (event.provider_type === "local" || /^llama|ollama|mistral|qwen|gemma/i.test(model)) {
    return ratings.local_llm || { source_id: "local_llm", title: "Lokale LLM", token_limit: null, provider_type: "local" };
  }
  if (/^gpt-|^o\d|openai/i.test(model) || event.provider_type === "external") {
    return ratings.openai_gpt || { source_id: "openai_gpt", title: "GPT / OpenAI", token_limit: policy.monthly_credit_limit || DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT, provider_type: "external" };
  }
  return ratings.openai_gpt || Object.values(ratings)[0] || { source_id: "openai_gpt", title: "GPT / OpenAI", token_limit: policy.monthly_credit_limit || DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT, provider_type: "external" };
}

function effectiveSourceRatings(policy = {}) {
  return normalizeSourceRatings(policy.source_ratings, policy.monthly_credit_limit || DEFAULT_MONTHLY_TOKEN_CREDIT_LIMIT);
}

function availableCredits(account) {
  return Number((account.total_granted_credits - account.consumed_credits - account.held_credits).toFixed(4));
}

function billableCredits(event) {
  return event.status === "success" ? Number(event.calculated_credits || 0) : 0;
}

function billableProviderCost(event) {
  return event.status === "success" ? Number(event.estimated_provider_cost || 0) : 0;
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

function identityAccountId(value) {
  const accountId = required(value, "identity.user_id");
  if (["demo", "unknown", "anonymous"].includes(accountId.toLowerCase())) {
    throw new AiUsageError("fallback_account_id_forbidden", "Account-ID-Fallbacks sind verboten; erforderlich ist identity.user_id.", 400);
  }
  return accountId;
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
