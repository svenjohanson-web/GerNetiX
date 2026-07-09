const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultAdminTool } = require("../src");
const { AdminService, InMemoryAdminRepository, AdminAccessPolicy } = require("../src");

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

test("ai context summary shows grants policy and recent decisions", async () => {
  const service = createAdminServiceWithHttpJson({
    "/api/ai-context/policy": {
      policy: {
        deny_without_grant: true,
        require_explicit_source_scope: true,
        allow_external_provider_customer_data: false,
        default_max_context_items: 12,
        protected_source_types: ["customer_data", "project_files"],
      },
    },
    "/api/ai-context/grants": {
      items: [{
        grant_id: "grant-1",
        account_id: "acct_1",
        project_id: "project-1",
        source_type: "project_files",
        source_scope: "projects/project-1",
        purpose: "architecture_assistance",
        allowed_provider_scope: "external_redacted_only",
        redaction_level: "masked",
        max_context_items: 8,
        valid_from: "2026-01-01T00:00:00.000Z",
        valid_until: "2099-01-01T00:00:00.000Z",
      }],
    },
    "/api/ai-context/audit-events": {
      items: [{
        audit_event_id: "audit-1",
        source_type: "project_files",
        access_decision: "allowed",
        purpose: "architecture_assistance",
      }, {
        audit_event_id: "audit-2",
        source_type: "customer_data",
        access_decision: "denied",
        rejection_reason: "external_provider_customer_data_blocked_by_policy",
      }],
    },
    "/api/ai-context/sources": {
      items: [{
        source_id: "ai_source.hardware_catalog.esp32_processor_boards",
        source_type: "hardware_catalog",
        source_scope: "processor_boards/esp32",
        title: "ESP32 ProcessorBoards und Capabilities",
        backing_service: "hardware-catalog",
        endpoint: "/api/hardware-catalog/processor-boards?processor_family=esp32",
        contains: ["processor_boards", "technical_capabilities"],
        default_provider_scope: "local_only",
        default_redaction_level: "summary_only",
        allowed_purposes: ["architecture_assistance"],
        status: "active",
      }],
    },
    "/api/ai-context/sqlite/summary": {
      summary: {
        available: true,
        db_path: ".runtime/gernetix-ai-context.sqlite",
        service_key: "ai-context-server",
        schema_version: 3,
        tables: [{
          table_name: "ai_context_grants",
          row_count: 1,
          columns: ["grant_id", "source_scope"],
          preview_rows: [{ grant_id: "grant-1", source_scope: "projects/project-1" }],
        }],
        service_documents: [{ collection_name: "grants", row_count: 1 }],
      },
    },
    "/api/hardware-catalog/capabilities": {
      items: [{
        capability_id: "capability.processor_esp32",
        title: "ESP32 ProcessorBoard",
        owner_domain: "Hardware",
        status: "active",
      }, {
        capability_id: "capability.ota",
        title: "OTA",
        owner_domain: "Hardware",
        status: "active",
      }],
    },
    "/api/hardware-catalog/processor-boards": {
      items: [{
        hardware_item_id: "hardware.processor_board.espressif_esp32_devkitc",
        title: "Espressif ESP32-DevKitC",
        summary: "Offizielles Espressif-Development-Board.",
        processor_family: "esp32",
        mcu_variant: "ESP32",
        module_name: "ESP-WROOM-32",
        vendor: "Espressif",
        capability_ids: ["capability.processor_esp32", "capability.ota"],
        basissoftware_profile_id: "basissoftware.profile.esp32_factory",
        provisioning_profile_id: "provisioning_profile.esp32_ota_bootstrap",
        min_basissoftware_version: "0.1.0",
      }],
    },
  });

  const result = await service.aiContextAccessSummary(adminContext({ purpose: "ai_context_access_review" }));

  assert.equal(result.summary.service_available, true);
  assert.equal(result.summary.active_grants, 1);
  assert.equal(result.summary.external_grants, 1);
  assert.equal(result.summary.customer_data_external_blocked, true);
  assert.equal(result.summary.source_breakdown[0].source_type, "project_files");
  assert.equal(result.summary.audit_summary.allowed, 1);
  assert.equal(result.summary.audit_summary.denied, 1);
  assert.equal(result.summary.sqlite.available, true);
  assert.equal(result.summary.sqlite.tables[0].table_name, "ai_context_grants");
  assert.equal(result.summary.sqlite.tables[0].preview_rows[0].grant_id, "grant-1");
  assert.equal(result.summary.source_registry[0].source_type, "hardware_catalog");
  assert.equal(result.summary.source_registry[0].source_scope, "processor_boards/esp32");
  assert.equal(result.summary.content_sources.available, true);
  assert.equal(result.summary.content_sources.esp32_boards[0].title, "Espressif ESP32-DevKitC");
  assert.equal(result.summary.content_sources.esp32_boards[0].capabilities[1].title, "OTA");
});

test("ai context summary falls back when context service is unavailable", async () => {
  const service = createAdminServiceWithHttpJson({}, new Error("connect ECONNREFUSED"));

  const result = await service.aiContextAccessSummary(adminContext({ purpose: "ai_context_access_review" }));

  assert.equal(result.summary.service_available, false);
  assert.equal(result.summary.active_grants, 0);
  assert.match(result.summary.error, /ECONNREFUSED/);
});

test("llm config test uses OpenAI Responses API when configured", async () => {
  const service = createAdminServiceWithHttpJson({});
  let requestedUrl = "";
  const previousFetch = global.fetch;
  global.fetch = async (url, options) => {
    requestedUrl = url;
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-5.5");
    assert.equal(body.input[0].role, "developer");
    assert.equal(Object.hasOwn(body, "temperature"), false);
    return {
      ok: true,
      json: async () => ({
        output_text: "OK",
        usage: { input_tokens: 4, output_tokens: 1, total_tokens: 5 },
      }),
    };
  };
  service.llmConfigStore = {
    publicConfig: () => ({ provider: "api", apiProvider: "openai-responses", apiModel: "gpt-5.5" }),
    getConfig: () => ({
      provider: "api",
      apiProvider: "openai-responses",
      apiBaseUrl: "https://api.openai.com/v1",
      apiModel: "gpt-5.5",
      apiKey: "secret",
    }),
    updateConfig: () => ({}),
  };

  try {
    const result = await service.testLlmConfig();
    assert.equal(requestedUrl, "https://api.openai.com/v1/responses");
    assert.equal(result.ok, true);
    assert.equal(result.content, "OK");
    assert.equal(result.usage.totalTokens, 5);
  } finally {
    global.fetch = previousFetch;
  }
});

function createAdminServiceWithHttpJson(routes, error = null) {
  const repository = new InMemoryAdminRepository();
  const service = new AdminService({
    repository,
    accessPolicy: new AdminAccessPolicy({ repository }),
    llmConfigStore: {
      publicConfig: () => ({}),
      getConfig: () => ({}),
      updateConfig: () => ({}),
    },
    serviceClients: {
      deviceManagementBaseUrl: "http://device.test",
      projectServerBaseUrl: "http://project.test",
      hardwareCatalogBaseUrl: "http://hardware.test",
      aiUsageBaseUrl: "http://usage.test",
      aiContextBaseUrl: "http://context.test",
    },
  });
  service.httpJson = async (_baseUrl, pathname) => {
    if (error) throw error;
    return routes[pathname] || {};
  };
  return service;
}
