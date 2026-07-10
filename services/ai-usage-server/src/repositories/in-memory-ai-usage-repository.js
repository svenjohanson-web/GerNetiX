class InMemoryAiUsageRepository {
  constructor(seed = defaultSeed()) {
    this.creditAccounts = new Map((seed.creditAccounts || []).map((item) => [item.account_id, clone(item)]));
    this.ledgerEntries = (seed.ledgerEntries || []).map(clone);
    this.usageEvents = (seed.usageEvents || []).map(clone);
    this.adminAuditEvents = (seed.adminAuditEvents || []).map(clone);
    this.policy = clone(seed.policy || defaultPolicy());
  }

  saveCreditAccount(account) {
    this.creditAccounts.set(account.account_id, clone(account));
    return clone(account);
  }

  findCreditAccount(accountId) {
    return clone(this.creditAccounts.get(accountId));
  }

  listCreditAccounts() {
    return Array.from(this.creditAccounts.values()).map(clone);
  }

  addLedgerEntry(entry) {
    this.ledgerEntries.push(clone(entry));
    return clone(entry);
  }

  listLedgerEntries(filter = {}) {
    return this.ledgerEntries
      .filter((entry) => !filter.account_id || entry.account_id === filter.account_id)
      .map(clone);
  }

  addUsageEvent(event) {
    this.usageEvents.push(clone(event));
    return clone(event);
  }

  updateUsageEvent(eventId, patch) {
    const index = this.usageEvents.findIndex((event) => event.event_id === eventId);
    if (index < 0) return null;
    this.usageEvents[index] = { ...this.usageEvents[index], ...clone(patch) };
    return clone(this.usageEvents[index]);
  }

  findUsageEvent(eventId) {
    return clone(this.usageEvents.find((event) => event.event_id === eventId));
  }

  listUsageEvents(filter = {}) {
    return this.usageEvents
      .filter((event) => !filter.account_id || event.account_id === filter.account_id)
      .filter((event) => !filter.status || event.status === filter.status)
      .map(clone);
  }

  savePolicy(policy) {
    this.policy = clone(policy);
    return clone(policy);
  }

  getPolicy() {
    return clone(this.policy);
  }

  addAdminAuditEvent(event) {
    this.adminAuditEvents.push(clone(event));
    return clone(event);
  }

  listAdminAuditEvents() {
    return this.adminAuditEvents.map(clone);
  }
}

function defaultSeed() {
  const account = {
    account_id: "acct-demo",
    plan_id: "plan.premium",
    total_granted_credits: 120,
    consumed_credits: 0,
    held_credits: 0,
    blocked_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return {
    creditAccounts: [account],
    ledgerEntries: [],
    usageEvents: [],
    adminAuditEvents: [],
    policy: defaultPolicy(),
  };
}

function defaultPolicy() {
  return {
    policy_id: "ai_budget_policy.default",
    global_kill_switch: false,
    daily_credit_limit: 80,
    monthly_credit_limit: 500,
    max_prompt_tokens: 8000,
    max_response_tokens: 4000,
    budget_warning_threshold_percent: 80,
    allowed_models: ["gpt-4.1-mini", "gpt-4.1", "gpt-5", "gpt-5-mini", "gpt-5.5", "gpt-5.5-mini", "community-assistant-basic", "llama3.1", "llama3.2:3b"],
    premium_models: ["gpt-4.1", "gpt-5", "gpt-5.5"],
    model_pricing: {
      "gpt-4.1-mini": { credits_per_1k_input_tokens: 1, credits_per_1k_output_tokens: 4, provider_cost_per_1k_tokens: 0.0006 },
      "gpt-4.1": { credits_per_1k_input_tokens: 4, credits_per_1k_output_tokens: 12, provider_cost_per_1k_tokens: 0.003 },
      "gpt-5": { credits_per_1k_input_tokens: 4, credits_per_1k_output_tokens: 16, provider_cost_per_1k_tokens: 0.004 },
      "gpt-5-mini": { credits_per_1k_input_tokens: 1, credits_per_1k_output_tokens: 4, provider_cost_per_1k_tokens: 0.0008 },
      "gpt-5.5": { credits_per_1k_input_tokens: 5, credits_per_1k_output_tokens: 18, provider_cost_per_1k_tokens: 0.005 },
      "gpt-5.5-mini": { credits_per_1k_input_tokens: 1, credits_per_1k_output_tokens: 5, provider_cost_per_1k_tokens: 0.001 },
      "community-assistant-basic": { credits_per_1k_input_tokens: 1, credits_per_1k_output_tokens: 3, provider_cost_per_1k_tokens: 0.0004 },
      "llama3.1": { credits_per_1k_input_tokens: 0, credits_per_1k_output_tokens: 0, provider_cost_per_1k_tokens: 0 },
      "llama3.2:3b": { credits_per_1k_input_tokens: 0, credits_per_1k_output_tokens: 0, provider_cost_per_1k_tokens: 0 },
    },
    source_ratings: {
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
        token_limit: 100000,
        billing_scope: "monthly",
        provider_type: "external",
      },
    },
  };
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryAiUsageRepository, defaultPolicy };
