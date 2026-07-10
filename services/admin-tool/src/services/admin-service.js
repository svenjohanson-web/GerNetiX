const { AdminToolError } = require("../errors");

class AdminService {
  constructor(options) {
    this.repository = options.repository;
    this.accessPolicy = options.accessPolicy;
    this.llmConfigStore = options.llmConfigStore;
    this.serviceClients = options.serviceClients || null;
  }

  async overview() {
    if (this.serviceClients) {
      try {
        const [devices, feedback, aiUsage] = await Promise.all([
          this.remoteDevices(),
          this.remoteFeedback(),
          this.remoteAiDashboard(),
        ]);
        return {
          devices: summarizeDevices(devices),
          feedback: {
            total: feedback.length,
            new: feedback.length,
          },
          ai_usage: aiUsage.summary,
          audit_events: {
            total: this.repository.listAuditEvents().length,
          },
        };
      } catch (error) {
        return {
          ...this.localOverview(),
          degraded: true,
          source: "local_snapshot_after_remote_error",
          remote_error: error.message || String(error),
        };
      }
    }
    return this.localOverview();
  }

  localOverview() {
    const devices = this.repository.listDevices();
    const feedback = this.repository.listFeedback();
    const aiUsage = this.repository.listAiUsageEvents();
    return {
      devices: summarizeDevices(devices),
      feedback: {
        total: feedback.length,
        new: feedback.filter((item) => item.status === "new").length,
      },
      ai_usage: summarizeAiUsage(aiUsage),
      audit_events: {
        total: this.repository.listAuditEvents().length,
      },
    };
  }

  async listDevices() {
    if (this.serviceClients) {
      return (await this.remoteDevices()).map((device) => ({
        device_id: device.device_id,
        display_name: device.serial_number || device.device_id,
        hardware_profile_id: device.hardware_profile_id,
        authenticity_status: device.authenticity_status,
        lifecycle_state: device.lifecycle_state,
        connectivity_status: device.connectivity_status,
        ota_status: device.ota_status,
        support_entitlement_status: device.support_entitlement?.entitlement_status || "unknown",
      }));
    }
    return this.repository.listDevices().map((device) => ({
      device_id: device.device_id,
      display_name: device.display_name,
      hardware_profile_id: device.hardware_profile_id,
      authenticity_status: device.authenticity_status,
      lifecycle_state: device.lifecycle_state,
      connectivity_status: device.connectivity_status,
      ota_status: device.ota_status,
      support_entitlement_status: device.support_entitlement.status,
    }));
  }

  async getDevice(deviceId, context) {
    if (this.serviceClients) {
      const query = new URLSearchParams({
        actor_id: context.actor.actor_id,
        role: context.actor.role,
        purpose: context.purpose,
        legal_basis: context.legal_basis,
        security_reason: context.security_reason,
      });
      return this.httpJson(this.serviceClients.deviceManagementBaseUrl, `/api/device-management/admin/devices/${encodeURIComponent(deviceId)}?${query}`);
    }
    const device = this.repository.findDevice(deviceId);
    if (!device) throw new AdminToolError("device_not_found", "Device wurde nicht gefunden.", 404);
    const access = this.accessPolicy.decideCustomerDataAccess({
      actor: context.actor,
      accountId: device.account_id,
      dataModelId: "data_model.account_device",
      purpose: context.purpose,
      legalBasis: context.legal_basis,
      securityReason: context.security_reason,
    });

    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "Zugriff auf Device-Daten wurde abgelehnt.", 403, access);
    }

    return {
      access,
      device: access.decision === "full" ? redactSecrets(device) : maskDevice(device),
    };
  }

  createConsent(input) {
    validateRequired(input, ["account_id", "granted_to_role", "purpose", "valid_until"]);
    return this.repository.createConsent(input);
  }

  revokeConsent(consentId) {
    const consent = this.repository.revokeConsent(consentId);
    if (!consent) throw new AdminToolError("consent_not_found", "Consent wurde nicht gefunden.", 404);
    return consent;
  }

  listAuditEvents(filter = {}) {
    return this.repository.listAuditEvents(filter);
  }

  async listLearningFeedback(context) {
    if (this.serviceClients) {
      const feedback = await this.remoteFeedback();
      return feedback.map((item) => {
        const access = this.accessPolicy.decideCustomerDataAccess({
          actor: context.actor,
          accountId: item.user_id || item.account_id || null,
          dataModelId: "data_model.learning_feedback",
          purpose: context.purpose,
          legalBasis: context.legal_basis,
          securityReason: context.security_reason,
        });
        return {
          access,
          feedback: access.decision === "full" ? item : maskProjectFeedback(item),
        };
      });
    }
    return this.repository.listFeedback().map((feedback) => {
      const access = this.accessPolicy.decideCustomerDataAccess({
        actor: context.actor,
        accountId: feedback.account_id,
        dataModelId: "data_model.learning_feedback",
        purpose: context.purpose,
        legalBasis: context.legal_basis,
        securityReason: context.security_reason,
      });
      return {
        access,
        feedback: access.decision === "full" ? feedback : maskFeedback(feedback),
      };
    });
  }

  async aiUsageSummary(context) {
    const access = this.accessPolicy.decideAdminCapability({
      actor: context.actor,
      capability: "admin_ai_usage_monitoring",
      purpose: "ai_usage_monitoring",
      dataModelId: "data_model.ai_usage_event",
    });
    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "KI Usage Monitoring ist nicht erlaubt.", 403, access);
    }
    if (this.serviceClients) {
      try {
        const dashboard = await this.remoteAiDashboard();
        return { access, summary: summarizeAiUsageDashboard(dashboard) };
      } catch (error) {
        return {
          access,
          summary: summarizeAiUsage(this.repository.listAiUsageEvents()),
          degraded: true,
          source: "local_snapshot_after_remote_error",
          remote_error: error.message || String(error),
        };
      }
    }
    return { access, summary: summarizeAiUsage(this.repository.listAiUsageEvents()) };
  }

  async accountSheet(context) {
    const access = this.accessPolicy.decideAdminCapability({
      actor: context.actor,
      capability: "admin_ai_usage_monitoring",
      purpose: "account_review",
      dataModelId: "data_model.ai_usage_event",
    });
    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "Account-Uebersicht ist nicht erlaubt.", 403, access);
    }
    if (this.serviceClients) {
      try {
        const dashboard = await this.remoteAiDashboard();
        return { access, accounts: (dashboard.by_account || []).map(normalizeAccountSheet) };
      } catch (error) {
        return {
          access,
          accounts: summarizeAccountSheets(this.repository.listAiUsageEvents()),
          degraded: true,
          source: "local_snapshot_after_remote_error",
          remote_error: error.message || String(error),
        };
      }
    }
    return { access, accounts: summarizeAccountSheets(this.repository.listAiUsageEvents()) };
  }

  async aiContextAccessSummary(context) {
    const access = this.accessPolicy.decideAdminCapability({
      actor: context.actor,
      capability: "admin_ai_usage_monitoring",
      purpose: "ai_context_access_review",
      dataModelId: "data_model.ai_context_access_audit_event",
    });
    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "KI Kontextzugriff-Monitoring ist nicht erlaubt.", 403, access);
    }
    if (!this.serviceClients?.aiContextBaseUrl) {
      return { access, summary: emptyAiContextSummary("ai_context_service_not_configured") };
    }
    try {
      const [policy, grants, auditEvents, sources, promptFoundations, sqlite, contentSources] = await Promise.all([
        this.remoteAiContextPolicy(),
        this.remoteAiContextGrants(),
        this.remoteAiContextAuditEvents(),
        this.remoteAiContextSources(),
        this.remoteAiContextPromptFoundations(),
        this.remoteAiContextSqliteSummary(),
        this.remoteAiContextContentSources(),
      ]);
      return {
        access,
        summary: summarizeAiContextAccess({
          policy: policy.policy || policy,
          grants: grants.items || [],
          auditEvents: auditEvents.items || [],
          sources: sources.items || [],
          promptFoundations: promptFoundations.items || [],
          sqlite: sqlite.summary || sqlite,
          contentSources,
          serviceAvailable: true,
        }),
      };
    } catch (error) {
      return { access, summary: emptyAiContextSummary(error.message || String(error)) };
    }
  }

  async recordAiCostControlAction(input, context) {
    const access = this.accessPolicy.decideAdminCapability({
      actor: context.actor,
      capability: "admin_ai_cost_controls",
      purpose: "ai_cost_control",
      dataModelId: "data_model.ai_admin_action_audit_event",
      accountId: input.account_id || null,
    });
    if (access.decision === "denied") {
      throw new AdminToolError("access_denied", "KI Kostensteuerung ist nicht erlaubt.", 403, access);
    }
    validateRequired(input, ["action_type", "reason"]);
    if (this.serviceClients) {
      const action = await this.httpJson(this.serviceClients.aiUsageBaseUrl, "/api/ai-usage/admin/cost-controls", {
        method: "POST",
        body: {
          actor_id: context.actor.actor_id,
          action_type: mapAiActionType(input.action_type),
          account_id: input.account_id || null,
          reason: input.reason,
          payload: input.payload || {},
        },
      });
      return action.audit_event || action;
    }
    return this.repository.addAdminAction({
      actor_id: context.actor.actor_id,
      actor_role: context.actor.role,
      action_type: input.action_type,
      account_id: input.account_id || null,
      reason: input.reason,
      payload: input.payload || {},
    });
  }

  llmConfig() {
    return this.llmConfigStore.publicConfig();
  }

  updateLlmConfig(input) {
    return this.llmConfigStore.updateConfig(input);
  }

  async listLlmModels() {
    const config = this.llmConfigStore.getConfig();
    try {
      const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, "")}/api/tags`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Ollama antwortet mit HTTP ${response.status}.`);
      }
      return {
        provider: "ollama",
        baseUrl: config.ollamaBaseUrl,
        items: (payload.models || []).map((model) => ({
          name: model.name || model.model,
          model: model.model || model.name,
          size: model.size || 0,
          modifiedAt: model.modified_at || "",
        })),
      };
    } catch (error) {
      return {
        provider: "ollama",
        baseUrl: config.ollamaBaseUrl,
        items: [],
        error: error.message || String(error),
      };
    }
  }

  async testLlmConfig() {
    const config = this.llmConfigStore.getConfig();
    const messages = [
      { role: "system", content: "Du bist ein kurzer Verbindungstest fuer GerNetiX." },
      { role: "user", content: "Antworte nur mit OK." },
    ];
    const start = Date.now();
    try {
      const result = config.provider === "api"
        ? await this.callApiConfigTest(config, messages)
        : await this.callOllamaConfigTest(config, messages);
      return {
        ok: true,
        config: this.llmConfigStore.publicConfig(),
        durationMs: Date.now() - start,
        content: result.content,
        usage: result.usage,
      };
    } catch (error) {
      return {
        ok: false,
        config: this.llmConfigStore.publicConfig({ lastError: error.message || String(error) }),
        durationMs: Date.now() - start,
        error: error.message || String(error),
      };
    }
  }

  async callOllamaConfigTest(config, messages) {
    const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        stream: false,
        messages,
        options: { temperature: 0 },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Ollama antwortet mit HTTP ${response.status}.`);
    }
    return {
      content: payload.message?.content || "",
      usage: {
        promptTokens: Number.isFinite(payload.prompt_eval_count) ? payload.prompt_eval_count : null,
        completionTokens: Number.isFinite(payload.eval_count) ? payload.eval_count : null,
        totalTokens: Number.isFinite(payload.prompt_eval_count) || Number.isFinite(payload.eval_count)
          ? (payload.prompt_eval_count || 0) + (payload.eval_count || 0)
          : null,
      },
    };
  }

  async callApiConfigTest(config, messages) {
    if (config.apiProvider === "anthropic") return this.callAnthropicConfigTest(config, messages);
    if (config.apiProvider === "openai-responses") return this.callOpenAiResponsesConfigTest(config, messages);
    return this.callOpenAiCompatibleConfigTest(config, messages);
  }

  async callOpenAiResponsesConfigTest(config, messages) {
    const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.apiModel,
        input: responseInput(messages),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || payload.error || `OpenAI Responses API antwortet mit HTTP ${response.status}.`);
    }
    return {
      content: responseOutputText(payload),
      usage: {
        promptTokens: payload.usage?.input_tokens ?? null,
        completionTokens: payload.usage?.output_tokens ?? null,
        totalTokens: payload.usage?.total_tokens ?? null,
      },
    };
  }

  async callOpenAiCompatibleConfigTest(config, messages) {
    const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.apiModel,
        messages,
        temperature: 0,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || payload.error || `API antwortet mit HTTP ${response.status}.`);
    }
    return {
      content: payload.choices?.[0]?.message?.content || "",
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? null,
        completionTokens: payload.usage?.completion_tokens ?? null,
        totalTokens: payload.usage?.total_tokens ?? null,
      },
    };
  }

  async callAnthropicConfigTest(config, messages) {
    const system = messages.find((message) => message.role === "system")?.content || "";
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));
    const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
      },
      body: JSON.stringify({
        model: config.apiModel,
        max_tokens: 32,
        temperature: 0,
        system,
        messages: conversation,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || payload.error || `Anthropic antwortet mit HTTP ${response.status}.`);
    }
    return {
      content: (payload.content || []).map((part) => part.text || "").join("").trim(),
      usage: {
        promptTokens: payload.usage?.input_tokens ?? null,
        completionTokens: payload.usage?.output_tokens ?? null,
        totalTokens: Number.isFinite(payload.usage?.input_tokens) || Number.isFinite(payload.usage?.output_tokens)
          ? (payload.usage?.input_tokens || 0) + (payload.usage?.output_tokens || 0)
          : null,
      },
    };
  }

  async remoteDevices() {
    const response = await this.httpJson(this.serviceClients.deviceManagementBaseUrl, "/api/device-management/admin/devices");
    return response.items || [];
  }

  async remoteFeedback() {
    const response = await this.httpJson(this.serviceClients.projectServerBaseUrl, "/api/learning-feedback");
    return response.items || [];
  }

  async remoteAiDashboard() {
    return this.httpJson(this.serviceClients.aiUsageBaseUrl, "/api/ai-usage/admin/dashboard");
  }

  async remoteAiContextPolicy() {
    return this.httpJson(this.serviceClients.aiContextBaseUrl, "/api/ai-context/policy");
  }

  async remoteAiContextGrants() {
    return this.httpJson(this.serviceClients.aiContextBaseUrl, "/api/ai-context/grants");
  }

  async remoteAiContextAuditEvents() {
    return this.httpJson(this.serviceClients.aiContextBaseUrl, "/api/ai-context/audit-events");
  }

  async remoteAiContextSources() {
    return this.httpJson(this.serviceClients.aiContextBaseUrl, "/api/ai-context/sources");
  }

  async remoteAiContextPromptFoundations() {
    return this.httpJson(this.serviceClients.aiContextBaseUrl, "/api/ai-context/prompt-foundations");
  }

  async remoteAiContextSqliteSummary() {
    return this.httpJson(this.serviceClients.aiContextBaseUrl, "/api/ai-context/sqlite/summary");
  }

  async remoteAiContextContentSources() {
    if (!this.serviceClients?.hardwareCatalogBaseUrl) return emptyAiContextContentSources("hardware_catalog_not_configured");
    try {
      const [capabilities, boards] = await Promise.all([
        this.httpJson(this.serviceClients.hardwareCatalogBaseUrl, "/api/hardware-catalog/capabilities"),
        this.httpJson(this.serviceClients.hardwareCatalogBaseUrl, "/api/hardware-catalog/processor-boards"),
      ]);
      return summarizeHardwareCatalogContent(capabilities.items || [], boards.items || []);
    } catch (error) {
      return emptyAiContextContentSources(error.message || String(error));
    }
  }

  async httpJson(baseUrl, pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AdminToolError(payload.error || "remote_service_error", payload.message || "Remote Service Fehler.", response.status, payload.details || {});
    }
    return payload;
  }
}

function summarizeDevices(devices) {
  return {
    total: devices.length,
    gernetix_verified: devices.filter((device) => device.authenticity_status === "gernetix_verified").length,
    community_unverified: devices.filter((device) => device.authenticity_status === "community_unverified").length,
    online: devices.filter((device) => device.connectivity_status === "online").length,
  };
}

function summarizeAiUsage(events) {
  const providerGroups = new Map();
  const modelGroups = new Map();
  for (const event of events) {
    const providerType = event.provider_type || inferProviderType(event);
    const providerName = event.provider_name || (providerType === "local" ? "Lokales LLM" : "Externe API");
    const providerKey = `${providerType}:${providerName}`;
    const modelKey = `${providerKey}:${event.model || "unknown"}`;
    addAiUsageStats(providerGroups, providerKey, {
      provider_type: providerType,
      provider_name: providerName,
      provider_status_url: providerStatusUrl(event, providerType, providerName),
    }, event);
    addAiUsageStats(modelGroups, modelKey, {
      provider_type: providerType,
      provider_name: providerName,
      model: event.model || "unknown",
      provider_status_url: providerStatusUrl(event, providerType, providerName),
    }, event);
  }
  const providerStats = Array.from(providerGroups.values());
  const provider_breakdown = providerStats.map(finalizeAiUsageStats);
  const model_breakdown = Array.from(modelGroups.values()).map(finalizeAiUsageStats);
  return {
    total_events: events.length,
    successful: events.filter((event) => event.status === "success").length,
    rejected: events.filter((event) => event.status === "rejected").length,
    credits: events.reduce((sum, event) => sum + Number(event.calculated_credits || 0), 0),
    tokens: events.reduce((sum, event) => sum + Number(event.input_tokens || 0) + Number(event.output_tokens || 0), 0),
    estimated_provider_cost: Number(events.reduce((sum, event) => sum + Number(event.estimated_provider_cost || 0), 0).toFixed(4)),
    cost_by_day: costByDay(events),
    rejection_breakdown: rejectionBreakdown(events),
    recent_rejections: recentRejections(events),
    cost_control: summarizeCostControlPolicy({}),
    accounts: summarizeAccountSheets(events),
    suspicious_usage: [],
    local: finalizeAiUsageStats(providerStats.filter((item) => item.provider_type === "local").reduce(mergeAiUsageStats, emptyAiUsageStats({ provider_type: "local", provider_name: "Lokale LLMs" }))),
    external: finalizeAiUsageStats(providerStats.filter((item) => item.provider_type === "external").reduce(mergeAiUsageStats, emptyAiUsageStats({ provider_type: "external", provider_name: "Oeffentliche LLMs" }))),
    provider_breakdown,
    model_breakdown,
  };
}

function summarizeAiUsageDashboard(dashboard = {}) {
  const summary = dashboard.summary || {};
  return {
    ...summary,
    cost_control: summarizeCostControlPolicy(dashboard.policy || {}),
    accounts: (dashboard.by_account || []).map(normalizeAccountSheet),
    suspicious_usage: dashboard.suspicious_usage || [],
    rejection_breakdown: summary.rejection_breakdown || [],
    recent_rejections: summary.recent_rejections || [],
  };
}

function summarizeCostControlPolicy(policy = {}) {
  const sourceRatings = effectivePolicySourceRatings(policy);
  const allowedModels = policy.allowed_models || [];
  const premiumModels = policy.premium_models || [];
  const pricing = policy.model_pricing || {};
  return {
    global_kill_switch: Boolean(policy.global_kill_switch),
    daily_credit_limit: numericOrNull(policy.daily_credit_limit),
    monthly_credit_limit: numericOrNull(policy.monthly_credit_limit),
    max_prompt_tokens: numericOrNull(policy.max_prompt_tokens),
    max_response_tokens: numericOrNull(policy.max_response_tokens),
    budget_warning_threshold_percent: numericOrNull(policy.budget_warning_threshold_percent),
    allowed_models: allowedModels,
    premium_models: premiumModels,
    source_ratings: sourceRatings,
    model_pricing: Object.entries(pricing).map(([model, item]) => ({
      model,
      premium: premiumModels.includes(model),
      allowed: allowedModels.includes(model),
      credits_per_1k_input_tokens: Number(item.credits_per_1k_input_tokens || 0),
      credits_per_1k_output_tokens: Number(item.credits_per_1k_output_tokens || 0),
      provider_cost_per_1k_tokens: Number(item.provider_cost_per_1k_tokens || 0),
    })).sort((left, right) => left.model.localeCompare(right.model)),
    rules: [
      { rule_id: "global_kill_switch", title: "Globaler Kill-Switch", status: policy.global_kill_switch ? "blockiert alle Aufrufe" : "aktiviert, nicht ausgeloest", value: policy.global_kill_switch ? "an" : "aus" },
      { rule_id: "account_blocked", title: "Account-Sperre", status: "pro Account", value: "blocked_until" },
      { rule_id: "model_not_allowed", title: "Modellfreigabe", status: "nur erlaubte Modelle", value: allowedModels.join(", ") || "-" },
      { rule_id: "premium_model_not_allowed", title: "Premium-Freigabe", status: "Capability erforderlich", value: premiumModels.join(", ") || "-" },
      { rule_id: "prompt_too_large", title: "Prompt-Limit", status: "Preflight blockt", value: formatPolicyNumber(policy.max_prompt_tokens, "Tokens") },
      { rule_id: "response_too_large", title: "Antwort-Limit", status: "Preflight blockt", value: formatPolicyNumber(policy.max_response_tokens, "Tokens") },
      { rule_id: "insufficient_credits", title: "Credit-Budget", status: "kein negatives Guthaben", value: "Account-Credits" },
      { rule_id: "source_token_limit_exceeded", title: "Quellenlimit", status: "Provider-Monatslimit", value: sourceRatings.map((source) => `${source.title}: ${source.token_limit === null ? "unbegrenzt" : `${source.token_limit} Tokens`}`).join(", ") || "-" },
      { rule_id: "daily_limit_exceeded", title: "Tageslimit", status: "Preflight blockt", value: formatPolicyNumber(policy.daily_credit_limit, "Credits") },
      { rule_id: "monthly_limit_exceeded", title: "Monatslimit", status: "Preflight blockt", value: formatPolicyNumber(policy.monthly_credit_limit, "Credits") },
    ],
  };
}

function effectivePolicySourceRatings(policy = {}) {
  const ratings = {
    local_llm: {
      source_id: "local_llm",
      title: "Lokale LLM",
      provider_type: "local",
      billing_scope: "unlimited",
      token_limit: null,
    },
    openai_gpt: {
      source_id: "openai_gpt",
      title: "GPT / OpenAI",
      provider_type: "external",
      billing_scope: "monthly",
      token_limit: 100000,
    },
    ...(policy.source_ratings || {}),
  };
  return Object.values(ratings).map((source) => ({
    source_id: source.source_id,
    title: source.title || source.source_id,
    provider_type: source.provider_type || "external",
    billing_scope: source.billing_scope || "monthly",
    token_limit: source.token_limit === null || source.token_limit === undefined ? null : Number(source.token_limit),
  }));
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
    if (String(event.occurred_at || event.created_at || "") > current.latest_at) current.latest_at = event.occurred_at || event.created_at || "";
    groups.set(reason, current);
  }
  return Array.from(groups.values()).map((item) => ({
    reason: item.reason,
    count: item.count,
    tokens: item.tokens,
    models: Array.from(item.models).sort(),
    accounts: Array.from(item.accounts).sort(),
    latest_at: item.latest_at,
  })).sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function recentRejections(events) {
  return events
    .filter((event) => event.status === "rejected" || event.rejection_reason)
    .slice()
    .sort((left, right) => String(right.occurred_at || right.created_at || "").localeCompare(String(left.occurred_at || left.created_at || "")))
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
      created_at: event.created_at || event.occurred_at || "",
    }));
}

function numericOrNull(value) {
  return value === null || value === undefined || value === "" ? null : Number(value);
}

function formatPolicyNumber(value, unit) {
  return value === null || value === undefined || value === "" ? "-" : `${value} ${unit}`;
}

function costByDay(events) {
  const groups = new Map();
  for (const event of events) {
    const day = String(event.occurred_at || event.created_at || "").slice(0, 10) || "unknown";
    const current = groups.get(day) || {
      day,
      total_events: 0,
      tokens: 0,
      credits: 0,
      estimated_provider_cost: 0,
    };
    current.total_events += 1;
    current.tokens += Number(event.input_tokens || 0) + Number(event.output_tokens || 0);
    current.credits += Number(event.calculated_credits || 0);
    current.estimated_provider_cost += Number(event.estimated_provider_cost || 0);
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

function summarizeAccountSheets(events) {
  const groups = new Map();
  for (const event of events) {
    const accountId = event.account_id || "unknown";
    if (!groups.has(accountId)) {
      groups.set(accountId, {
        account_id: accountId,
        available_credits: null,
        today_credits: 0,
        month_credits: 0,
        budget_used_percent: 0,
        rejected_events: 0,
        blocked: false,
        ai_rating: {
          account_id: accountId,
          used_percent: 0,
          sources: defaultSourceRatings().map((rating) => ({
            ...rating,
            month_tokens: 0,
            total_tokens: 0,
            used_percent: 0,
            unlimited: rating.token_limit === null,
          })),
        },
      });
    }
    const group = groups.get(accountId);
    const tokens = Number(event.input_tokens || 0) + Number(event.output_tokens || 0);
    const credits = Number(event.calculated_credits || 0);
    group.month_credits += credits;
    if (event.status === "rejected") group.rejected_events += 1;
    const sourceId = inferSourceId(event);
    const source = group.ai_rating.sources.find((item) => item.source_id === sourceId) || group.ai_rating.sources[1];
    source.month_tokens += tokens;
    source.total_tokens += tokens;
  }
  return Array.from(groups.values()).map((account) => {
    for (const source of account.ai_rating.sources) {
      source.used_percent = source.token_limit ? Number(Math.min(100, (source.month_tokens / source.token_limit) * 100).toFixed(2)) : 0;
    }
    account.ai_rating.used_percent = Math.max(...account.ai_rating.sources.filter((source) => !source.unlimited).map((source) => source.used_percent), 0);
    account.month_credits = Number(account.month_credits.toFixed(4));
    return normalizeAccountSheet(account);
  });
}

function normalizeAccountSheet(account) {
  return {
    account_id: account.account_id,
    available_credits: account.available_credits,
    today_credits: Number(account.today_credits || 0),
    month_credits: Number(account.month_credits || 0),
    budget_used_percent: Number(account.budget_used_percent || 0),
    rejected_events: Number(account.rejected_events || 0),
    blocked: Boolean(account.blocked),
    ai_rating: {
      account_id: account.ai_rating?.account_id || account.account_id,
      used_percent: Number(account.ai_rating?.used_percent || 0),
      sources: (account.ai_rating?.sources || []).map((source) => ({
        source_id: source.source_id,
        title: source.title || source.source_id,
        provider_type: source.provider_type || "external",
        billing_scope: source.billing_scope || "monthly",
        token_limit: source.token_limit ?? null,
        month_tokens: Number(source.month_tokens || 0),
        total_tokens: Number(source.total_tokens || 0),
        used_percent: Number(source.used_percent || 0),
        unlimited: Boolean(source.unlimited),
      })),
    },
  };
}

function defaultSourceRatings() {
  return [
    { source_id: "local_llm", title: "Lokale LLM", provider_type: "local", billing_scope: "unlimited", token_limit: null },
    { source_id: "openai_gpt", title: "GPT / OpenAI", provider_type: "external", billing_scope: "monthly", token_limit: 100000 },
  ];
}

function inferSourceId(event) {
  if (event.source_id) return event.source_id;
  if (inferProviderType(event) === "local") return "local_llm";
  if (/^gpt-|^o\d|openai/i.test(String(event.model || ""))) return "openai_gpt";
  return "openai_gpt";
}

function summarizeAiContextAccess({ policy = {}, grants = [], auditEvents = [], sources = [], promptFoundations = [], sqlite = null, contentSources = null, serviceAvailable = false }) {
  const now = new Date();
  const grantsWithState = grants.map((grant) => ({
    ...grant,
    state: grantState(grant, now),
    external_allowed: grant.allowed_provider_scope === "external_allowed" || grant.allowed_provider_scope === "external_redacted_only",
  }));
  const activeGrants = grantsWithState.filter((grant) => grant.state === "active");
  const source_breakdown = summarizeContextSources(activeGrants);
  const audit_summary = summarizeContextAudit(auditEvents);
  return {
    service_available: serviceAvailable,
    policy: {
      deny_without_grant: policy.deny_without_grant !== false,
      require_explicit_source_scope: policy.require_explicit_source_scope !== false,
      allow_external_provider_customer_data: policy.allow_external_provider_customer_data === true,
      default_max_context_items: policy.default_max_context_items || 0,
      protected_source_types: policy.protected_source_types || [],
    },
    total_grants: grants.length,
    active_grants: activeGrants.length,
    revoked_grants: grantsWithState.filter((grant) => grant.state === "revoked").length,
    expired_grants: grantsWithState.filter((grant) => grant.state === "expired").length,
    external_grants: activeGrants.filter((grant) => grant.external_allowed).length,
    customer_data_external_blocked: policy.allow_external_provider_customer_data !== true,
    source_breakdown,
    grants: grantsWithState.sort(sortGrantsForReview),
    audit_summary,
    recent_audit_events: auditEvents.slice(-12).reverse(),
    source_registry: summarizeAiContextSourcesRegistry(sources),
    prompt_foundations: summarizePromptFoundations(promptFoundations),
    sqlite: summarizeAiContextSqlite(sqlite),
    content_sources: contentSources || emptyAiContextContentSources(),
  };
}

function emptyAiContextSummary(error = "") {
  return {
    service_available: false,
    error,
    policy: {
      deny_without_grant: true,
      require_explicit_source_scope: true,
      allow_external_provider_customer_data: false,
      default_max_context_items: 0,
      protected_source_types: [],
    },
    total_grants: 0,
    active_grants: 0,
    revoked_grants: 0,
    expired_grants: 0,
    external_grants: 0,
    customer_data_external_blocked: true,
    source_breakdown: [],
    grants: [],
    audit_summary: {
      total_events: 0,
      allowed: 0,
      denied: 0,
      by_source: [],
      by_reason: [],
    },
    recent_audit_events: [],
    source_registry: [],
    prompt_foundations: [],
    sqlite: {
      available: false,
      tables: [],
      service_documents: [],
    },
    content_sources: emptyAiContextContentSources(),
  };
}

function summarizePromptFoundations(items) {
  return (items || []).map((item) => ({
    foundation_id: item.foundation_id,
    title: item.title,
    route_task: item.route_task,
    source_scope: item.source_scope,
    content_kind: item.content_kind,
    allowed_sources: item.allowed_sources || [],
    blocked_sources: item.blocked_sources || [],
    content: item.content || "",
    status: item.status || "active",
    updated_at: item.updated_at || "",
  })).sort((left, right) => String(left.route_task).localeCompare(String(right.route_task)) || String(left.foundation_id).localeCompare(String(right.foundation_id)));
}

function summarizeAiContextSourcesRegistry(sources) {
  return (sources || []).map((source) => ({
    source_id: source.source_id,
    source_type: source.source_type,
    source_scope: source.source_scope,
    title: source.title,
    summary: source.summary,
    backing_service: source.backing_service,
    endpoint: source.endpoint,
    contains: source.contains || [],
    default_redaction_level: source.default_redaction_level,
    default_provider_scope: source.default_provider_scope,
    allowed_purposes: source.allowed_purposes || [],
    status: source.status || "active",
  })).sort((left, right) => String(left.source_type).localeCompare(String(right.source_type)) || String(left.source_scope).localeCompare(String(right.source_scope)));
}

function summarizeHardwareCatalogContent(capabilities, boards) {
  const capabilityById = new Map(capabilities.map((capability) => [capability.capability_id, capability]));
  const processorBoards = boards.map((board) => ({
    hardware_item_id: board.hardware_item_id,
    title: board.title,
    summary: board.summary,
    processor_family: board.processor_family,
    mcu_variant: board.mcu_variant,
    module_name: board.module_name,
    vendor: board.vendor,
    support_policy: board.support_policy,
    provisioning_profile_id: board.provisioning_profile_id,
    basissoftware_profile_id: board.basissoftware_profile_id,
    min_basissoftware_version: board.min_basissoftware_version,
    capability_ids: board.capability_ids || [],
    capabilities: (board.capability_ids || []).map((capabilityId) => ({
      capability_id: capabilityId,
      title: capabilityById.get(capabilityId)?.title || capabilityId,
    })),
  }));
  const esp32Boards = processorBoards.filter((board) => board.processor_family === "esp32");
  const capabilityIdsInUse = new Set(processorBoards.flatMap((board) => board.capability_ids));
  return {
    available: true,
    sources: [{
      source_type: "hardware_catalog",
      title: "Hardware Catalog",
      total_processor_boards: processorBoards.length,
      esp32_processor_boards: esp32Boards.length,
      total_capabilities: capabilities.length,
      capabilities_in_use: capabilityIdsInUse.size,
    }],
    processor_boards: processorBoards,
    esp32_boards: esp32Boards,
    capabilities: capabilities.map((capability) => ({
      capability_id: capability.capability_id,
      title: capability.title,
      owner_domain: capability.owner_domain,
      status: capability.status,
      used_by_processor_boards: processorBoards
        .filter((board) => board.capability_ids.includes(capability.capability_id))
        .map((board) => board.hardware_item_id),
    })),
  };
}

function emptyAiContextContentSources(error = "") {
  return {
    available: false,
    error,
    sources: [],
    processor_boards: [],
    esp32_boards: [],
    capabilities: [],
  };
}

function summarizeAiContextSqlite(sqlite) {
  if (!sqlite) {
    return {
      available: false,
      tables: [],
      service_documents: [],
    };
  }
  return {
    available: sqlite.available === true,
    db_path: sqlite.db_path || "",
    service_key: sqlite.service_key || "",
    schema_version: sqlite.schema_version || 0,
    tables: (sqlite.tables || []).map((table) => ({
      table_name: table.table_name,
      row_count: table.row_count || 0,
      columns: table.columns || [],
      preview_rows: (table.preview_rows || []).slice(0, 10),
    })),
    service_documents: sqlite.service_documents || [],
  };
}

function summarizeContextSources(grants) {
  const groups = new Map();
  for (const grant of grants) {
    const key = grant.source_type || "unknown";
    if (!groups.has(key)) {
      groups.set(key, {
        source_type: key,
        active_grants: 0,
        external_grants: 0,
        local_only_grants: 0,
        redaction_levels: new Set(),
        purposes: new Set(),
      });
    }
    const group = groups.get(key);
    group.active_grants += 1;
    group.external_grants += grant.external_allowed ? 1 : 0;
    group.local_only_grants += grant.allowed_provider_scope === "local_only" ? 1 : 0;
    group.redaction_levels.add(grant.redaction_level || "unknown");
    group.purposes.add(grant.purpose || "unknown");
  }
  return Array.from(groups.values()).map((group) => ({
    source_type: group.source_type,
    active_grants: group.active_grants,
    external_grants: group.external_grants,
    local_only_grants: group.local_only_grants,
    redaction_levels: Array.from(group.redaction_levels).sort(),
    purposes: Array.from(group.purposes).sort(),
  })).sort((left, right) => left.source_type.localeCompare(right.source_type));
}

function summarizeContextAudit(events) {
  const bySource = new Map();
  const byReason = new Map();
  let allowed = 0;
  let denied = 0;
  for (const event of events) {
    if (event.access_decision === "allowed") allowed += 1;
    if (event.access_decision === "denied") denied += 1;
    increment(bySource, event.source_type || "unknown");
    if (event.rejection_reason) increment(byReason, event.rejection_reason);
  }
  return {
    total_events: events.length,
    allowed,
    denied,
    by_source: mapCounts(bySource),
    by_reason: mapCounts(byReason),
  };
}

function grantState(grant, now) {
  if (grant.revoked_at) return "revoked";
  if (grant.valid_from && new Date(grant.valid_from).getTime() > now.getTime()) return "scheduled";
  if (grant.valid_until && new Date(grant.valid_until).getTime() <= now.getTime()) return "expired";
  return "active";
}

function sortGrantsForReview(left, right) {
  const stateOrder = { active: 0, scheduled: 1, expired: 2, revoked: 3 };
  const stateCompare = (stateOrder[left.state] ?? 9) - (stateOrder[right.state] ?? 9);
  if (stateCompare) return stateCompare;
  return String(left.source_type || "").localeCompare(String(right.source_type || ""));
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function mapCounts(map) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function addAiUsageStats(groups, key, base, event) {
  if (!groups.has(key)) groups.set(key, emptyAiUsageStats(base));
  const stats = groups.get(key);
  const inputTokens = Number(event.input_tokens || 0);
  const outputTokens = Number(event.output_tokens || 0);
  stats.total_events += 1;
  stats.successful += event.status === "success" ? 1 : 0;
  stats.rejected += event.status === "rejected" ? 1 : 0;
  stats.input_tokens += inputTokens;
  stats.output_tokens += outputTokens;
  stats.tokens += inputTokens + outputTokens;
  stats.credits += Number(event.calculated_credits || 0);
  stats.estimated_provider_cost += Number(event.estimated_provider_cost || 0);
  stats.total_duration_ms += Number(event.duration_ms || 0);
  stats.total_latency_ms += Number(event.latency_ms || event.duration_ms || 0);
  stats.total_calls_with_duration += Number(event.duration_ms || event.latency_ms || 0) > 0 ? 1 : 0;
  stats.local_eval_tokens_per_second += Number(event.eval_tokens_per_second || 0);
  stats.local_eval_samples += Number(event.eval_tokens_per_second || 0) > 0 ? 1 : 0;
  return stats;
}

function emptyAiUsageStats(base = {}) {
  return {
    ...base,
    total_events: 0,
    successful: 0,
    rejected: 0,
    input_tokens: 0,
    output_tokens: 0,
    tokens: 0,
    credits: 0,
    estimated_provider_cost: 0,
    total_duration_ms: 0,
    total_latency_ms: 0,
    total_calls_with_duration: 0,
    local_eval_tokens_per_second: 0,
    local_eval_samples: 0,
  };
}

function mergeAiUsageStats(left, right) {
  left.total_events += right.total_events || 0;
  left.successful += right.successful || 0;
  left.rejected += right.rejected || 0;
  left.input_tokens += right.input_tokens || 0;
  left.output_tokens += right.output_tokens || 0;
  left.tokens += right.tokens || 0;
  left.credits += right.credits || 0;
  left.estimated_provider_cost += right.estimated_provider_cost || 0;
  left.total_duration_ms += right.total_duration_ms || 0;
  left.total_latency_ms += right.total_latency_ms || 0;
  left.total_calls_with_duration += right.total_calls_with_duration || 0;
  left.local_eval_tokens_per_second += right.local_eval_tokens_per_second || 0;
  left.local_eval_samples += right.local_eval_samples || 0;
  return left;
}

function finalizeAiUsageStats(stats) {
  const callsWithDuration = stats.total_calls_with_duration || 0;
  const evalSamples = stats.local_eval_samples || 0;
  return {
    provider_type: stats.provider_type,
    provider_name: stats.provider_name,
    provider_status_url: stats.provider_status_url || "",
    model: stats.model,
    total_events: stats.total_events,
    successful: stats.successful,
    rejected: stats.rejected,
    input_tokens: stats.input_tokens,
    output_tokens: stats.output_tokens,
    tokens: stats.tokens,
    credits: Number(stats.credits.toFixed(4)),
    estimated_provider_cost: Number(stats.estimated_provider_cost.toFixed(4)),
    average_latency_ms: callsWithDuration ? Math.round(stats.total_latency_ms / callsWithDuration) : null,
    average_duration_ms: callsWithDuration ? Math.round(stats.total_duration_ms / callsWithDuration) : null,
    average_eval_tokens_per_second: evalSamples ? Number((stats.local_eval_tokens_per_second / evalSamples).toFixed(2)) : null,
  };
}

function inferProviderType(event) {
  const baseUrl = String(event.provider_base_url || "");
  const providerName = String(event.provider_name || "");
  if (baseUrl.includes("127.0.0.1") || baseUrl.includes("localhost") || providerName.toLowerCase().includes("ollama")) return "local";
  if (Number(event.estimated_provider_cost || 0) > 0) return "external";
  return "local";
}

function providerStatusUrl(event = {}, providerType = "", providerName = "") {
  const baseUrl = String(event.provider_base_url || "");
  const name = String(providerName || event.provider_name || "").toLowerCase();
  if (baseUrl.includes("api.openai.com") || name.includes("openai")) return "https://status.openai.com/";
  if (baseUrl.includes("anthropic.com") || name.includes("anthropic") || name.includes("claude")) return "https://status.anthropic.com/";
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") || providerType === "local") return baseUrl || "http://127.0.0.1:11434";
  if (/^https?:\/\//i.test(baseUrl)) return baseUrl;
  return "";
}

function maskDevice(device) {
  return {
    device_id: device.device_id,
    display_name: maskText(device.display_name),
    hardware_profile_id: device.hardware_profile_id,
    authenticity_status: device.authenticity_status,
    lifecycle_state: device.lifecycle_state,
    connectivity_status: device.connectivity_status,
    ota_status: device.ota_status,
    support_entitlement: {
      status: device.support_entitlement.status,
      source: device.support_entitlement.source,
    },
  };
}

function redactSecrets(device) {
  return {
    ...device,
    credential_history: device.credential_history.map((credential) => ({
      credential_id: credential.credential_id,
      credential_type: credential.credential_type,
      key_reference: credential.key_reference,
      status: credential.status,
    })),
  };
}

function maskFeedback(feedback) {
  return {
    feedback_id: feedback.feedback_id,
    project_id: feedback.project_id,
    step_id: feedback.step_id,
    rating: feedback.rating,
    status: feedback.status,
    feedback_text: feedback.feedback_text,
    account_id: "masked",
    contact_email: "masked",
  };
}

function maskProjectFeedback(feedback) {
  return {
    feedback_id: feedback.feedback_id,
    project_id: feedback.project_id,
    learning_step_id: feedback.learning_step_id,
    category: feedback.category,
    message: feedback.message,
    user_id: "masked",
    contact_email: "masked",
  };
}

function mapAiActionType(actionType) {
  if (actionType === "temporary_ai_block") return "block_account";
  return actionType;
}

function maskText(value) {
  return value ? "masked" : "";
}

function validateRequired(input, fields) {
  for (const field of fields) {
    if (!String(input[field] || "").trim()) {
      throw new AdminToolError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
    }
  }
}

function responseInput(messages) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "assistant" : message.role === "system" ? "developer" : "user",
    content: [{ type: "input_text", text: message.content }],
  }));
}

function responseOutputText(payload) {
  if (payload.output_text) return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

module.exports = { AdminService };
