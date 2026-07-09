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
      } catch {
        return this.localOverview();
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
        return { access, summary: dashboard.summary };
      } catch {
        return { access, summary: summarizeAiUsage(this.repository.listAiUsageEvents()) };
      }
    }
    return { access, summary: summarizeAiUsage(this.repository.listAiUsageEvents()) };
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
      const [policy, grants, auditEvents, sources, sqlite, contentSources] = await Promise.all([
        this.remoteAiContextPolicy(),
        this.remoteAiContextGrants(),
        this.remoteAiContextAuditEvents(),
        this.remoteAiContextSources(),
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
    }, event);
    addAiUsageStats(modelGroups, modelKey, {
      provider_type: providerType,
      provider_name: providerName,
      model: event.model || "unknown",
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
    local: finalizeAiUsageStats(providerStats.filter((item) => item.provider_type === "local").reduce(mergeAiUsageStats, emptyAiUsageStats({ provider_type: "local", provider_name: "Lokale LLMs" }))),
    external: finalizeAiUsageStats(providerStats.filter((item) => item.provider_type === "external").reduce(mergeAiUsageStats, emptyAiUsageStats({ provider_type: "external", provider_name: "Oeffentliche LLMs" }))),
    provider_breakdown,
    model_breakdown,
  };
}

function summarizeAiContextAccess({ policy = {}, grants = [], auditEvents = [], sources = [], sqlite = null, contentSources = null, serviceAvailable = false }) {
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
    sqlite: {
      available: false,
      tables: [],
      service_documents: [],
    },
    content_sources: emptyAiContextContentSources(),
  };
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
