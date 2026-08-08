const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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
  assert.equal((await service.listAuditEvents()).length, 1);
});

test("device detail is full with matching consent and secrets stay redacted", async () => {
  const service = createDefaultAdminTool();
  await service.createConsent({
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
  const consent = await service.createConsent({
    account_id: "acct_1",
    granted_to_role: "administrator",
    purpose: "support_case",
    valid_until: "2099-01-01T00:00:00.000Z",
  });
  await service.revokeConsent(consent.consent_id);

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
  assert.equal(summary.summary.cost_by_day.length, 1);
  assert.equal(summary.summary.cost_by_day[0].estimated_provider_cost, 0.05);
  assert.equal(summary.summary.rejection_breakdown[0].reason, "insufficient_credits");
  assert.equal(summary.summary.recent_rejections[0].rejection_reason, "insufficient_credits");
  assert.ok(summary.summary.cost_control.rules.some((rule) => rule.rule_id === "insufficient_credits"));
  assert.ok(summary.summary.provider_breakdown.some((item) => item.provider_type === "local" && item.provider_name === "Lokales Ollama"));
  assert.ok(summary.summary.provider_breakdown.some((item) => item.provider_name === "OpenAI-kompatible API" && item.provider_status_url === "https://status.openai.com/"));

  const action = await service.recordAiCostControlAction({
    action_type: "temporary_ai_block",
    account_id: "acct_2",
    reason: "suspicious_usage_pattern",
  }, adminContext({ purpose: "ai_cost_control" }));
  assert.equal(action.action_type, "temporary_ai_block");
  assert.ok((await service.listAuditEvents()).some((event) => event.accessed_data_model_id === "data_model.ai_admin_action_audit_event"));
});

test("remote ai usage summary exposes cost-control policy and rejection causes", async () => {
  const service = createAdminServiceWithHttpJson({
    "/api/ai-usage/admin/dashboard": {
      summary: {
        total_events: 2,
        successful: 1,
        rejected: 1,
        rejection_breakdown: [{ reason: "insufficient_credits", count: 1, tokens: 1768, models: ["gpt-5.5"], accounts: ["acct-demo"] }],
        recent_rejections: [{ account_id: "acct-demo", model: "gpt-5.5", rejection_reason: "insufficient_credits", protection_action: "block_call" }],
      },
      policy: {
        global_kill_switch: false,
        daily_credit_limit: 80,
        monthly_credit_limit: 500,
        max_prompt_tokens: 8000,
        max_response_tokens: 4000,
        allowed_models: ["gpt-5.5", "llama3.2:3b"],
        premium_models: ["gpt-5.5"],
        model_pricing: {
          "gpt-5.5": { credits_per_1k_input_tokens: 5, credits_per_1k_output_tokens: 18, provider_cost_per_1k_tokens: 0.005 },
        },
        source_ratings: {
          openai_gpt: { source_id: "openai_gpt", title: "GPT / OpenAI", provider_type: "external", billing_scope: "monthly", token_limit: 100000 },
        },
      },
      by_account: [{ account_id: "acct-demo", available_credits: 114.451 }],
      by_model: [
        { model: "gpt-5.6-terra", events: 2, successful: 1, rejected: 1, input_tokens: 900, output_tokens: 100, tokens: 1000, credits: 800, estimated_provider_cost: 0.01 },
        { model: "llama3.2:3b", events: 1, successful: 1, rejected: 0, input_tokens: 400, output_tokens: 100, tokens: 500, credits: 500, estimated_provider_cost: 0 },
      ],
      suspicious_usage: [{ finding_type: "repeated_rejections", severity: "warning" }],
    },
  });

  const result = await service.aiUsageSummary(adminContext({ purpose: "ai_usage_monitoring" }));

  assert.equal(result.summary.cost_control.daily_credit_limit, 80);
  assert.equal(result.summary.cost_control.model_pricing[0].model, "gpt-5.5");
  assert.match(result.summary.cost_control.rules.find((rule) => rule.rule_id === "source_token_limit_exceeded").value, /GPT \/ OpenAI: 500 Tokens/);
  assert.equal(result.summary.rejection_breakdown[0].reason, "insufficient_credits");
  assert.equal(result.summary.accounts[0].account_id, "acct-demo");
  assert.equal(result.summary.suspicious_usage[0].finding_type, "repeated_rejections");
  assert.equal(result.summary.external.tokens, 1000);
  assert.equal(result.summary.local.tokens, 500);
  assert.equal(result.summary.provider_breakdown.length, 2);
  assert.deepEqual(result.summary.model_breakdown.map((item) => item.model), ["gpt-5.6-terra", "llama3.2:3b"]);
});

test("account sheet exposes source based ai rating per account", async () => {
  const service = createDefaultAdminTool();
  const result = await service.accountSheet(adminContext({ purpose: "account_review" }));
  const account = result.accounts.find((item) => item.account_id === "acct_1");
  assert.ok(account);
  const gpt = account.ai_rating.sources.find((source) => source.source_id === "openai_gpt");
  const local = account.ai_rating.sources.find((source) => source.source_id === "local_llm");

  assert.equal(gpt.token_limit, 100000);
  assert.equal(gpt.month_tokens, 1300);
  assert.equal(local.unlimited, true);
  assert.equal(local.month_tokens, 800);
});

test("remote account sheet uses ai usage dashboard account ratings", async () => {
  const service = createAdminServiceWithHttpJson({
    "/api/ai-usage/admin/dashboard": {
      by_account: [{
        account_id: "acct-remote",
        available_credits: 42,
        ai_rating: {
          used_percent: 12.5,
          sources: [{
            source_id: "openai_gpt",
            title: "GPT / OpenAI",
            provider_type: "external",
            token_limit: 100000,
            month_tokens: 12500,
            used_percent: 12.5,
          }],
        },
      }],
    },
  });

  const result = await service.accountSheet(adminContext({ purpose: "account_review" }));

  assert.equal(result.accounts[0].account_id, "acct-remote");
  assert.equal(result.accounts[0].ai_rating.sources[0].used_percent, 12.5);
});

test("remote account sheet marks local snapshot fallback as degraded", async () => {
  const service = createAdminServiceWithHttpJson({}, new Error("connect ECONNREFUSED"));

  const result = await service.accountSheet(adminContext({ purpose: "account_review" }));

  assert.equal(result.degraded, true);
  assert.equal(result.source, "local_snapshot_after_remote_error");
  assert.match(result.remote_error, /ECONNREFUSED/);
});

test("system events can be recorded and summarized centrally", async () => {
  const service = createDefaultAdminTool();

  const event = await service.recordSystemEvent({
    severity: "error",
    source_service: "identity_server",
    target_service: "device_management",
    category: "dependency",
    event_type: "dependency_unreachable",
    message: "Device Management nicht erreichbar.",
    impact: "Device-Inventarisierung blockiert.",
    account_id: "acct-demo",
  });
  const result = await service.systemEvents();

  assert.equal(event.severity, "error");
  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.errors, 1);
  assert.equal(result.items[0].target_service, "device_management");
});

test("system event severity is normalized", async () => {
  const service = createDefaultAdminTool();
  const event = await service.recordSystemEvent({
    severity: "surprise",
    source_service: "identity_server",
    event_type: "notice",
    message: "Unbekannter Severity-Wert.",
  });

  assert.equal(event.severity, "info");
});

test("user action chains are persisted and summarized without local details", async () => {
  const service = createDefaultAdminTool();
  const base = {
    occurred_at: "2026-08-07T12:00:00.000Z", action_type: "nexi.flash.usb.start",
    action_id: "11111111-1111-4111-8111-111111111111", span_type: "action",
    span_id: "22222222-2222-4222-8222-222222222222", route_id: "/nachbauprojekte/nexi-sprachassistent/",
    release_id: "0.1.0-test", reason_code: "",
  };
  await service.recordUserActionEvent({ ...base, event_id: "event-triggered", phase: "triggered" });
  await service.recordUserActionEvent({ ...base, event_id: "event-failed", phase: "failed", span_type: "helper.status", reason_code: "local_dependency_unreachable" });

  const result = await service.userActionEvents();
  assert.equal(result.summary.attempts, 1);
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.failure_rate_percent, 100);
  assert.equal(result.summary.recent_failures[0].failed_span, "helper.status");
  assert.equal(result.summary.recent_actions[0].event_count, 2);
  assert.equal(result.summary.recent_actions[0].span_count, 1);
  assert.equal("local_port" in result.items[0], false);
});

test("user action explorer returns one exact validated action timeline", async () => {
  const service = createDefaultAdminTool();
  const firstActionId = "11111111-1111-4111-8111-111111111111";
  const secondActionId = "33333333-3333-4333-8333-333333333333";
  const base = {
    occurred_at: "2026-08-07T12:00:00.000Z", action_type: "project.build.start",
    span_type: "action", span_id: "22222222-2222-4222-8222-222222222222",
    route_id: "/app/ide/", release_id: "0.1.0-test", reason_code: "",
  };
  await service.recordUserActionEvent({ ...base, event_id: "event-first-started", action_id: firstActionId, phase: "started" });
  await service.recordUserActionEvent({ ...base, occurred_at: "2026-08-07T12:00:01.000Z", event_id: "event-first-succeeded", action_id: firstActionId, phase: "succeeded" });
  await service.recordUserActionEvent({ ...base, event_id: "event-second-failed", action_id: secondActionId, phase: "failed", reason_code: "build_execution_failed" });
  await service.recordInterfaceCall({
    occurred_at: "2026-08-07T12:00:00.500Z", source_service: "identity-server",
    target_service: "project-server", method: "POST", route: "/projects/project-1/builds?secret=no",
    status_code: 202, duration_ms: 42, succeeded: true, action_id: firstActionId,
    action_type: "project.build.start",
  });

  const result = await service.userActionEvents({ action_id: firstActionId.toUpperCase(), limit: 1000 });
  assert.equal(result.summary.attempts, 1);
  assert.equal(result.summary.succeeded, 1);
  assert.equal(result.summary.recent_actions[0].action_id, firstActionId);
  assert.deepEqual(result.items.map((item) => item.event_id), ["event-first-succeeded", "event-first-started"]);
  assert.equal(result.interface_calls.length, 1);
  assert.equal(result.interface_calls[0].action_id, firstActionId);
  assert.equal(result.interface_calls[0].route, "/projects/project-1/builds");

  await assert.rejects(
    service.userActionEvents({ action_id: "not-an-action-id" }),
    (error) => error.code === "invalid_action_id" && error.status === 400,
  );
});

test("user action operations compare releases and rank normalized reasons", async () => {
  const service = createDefaultAdminTool();
  const now = new Date();
  const base = {
    occurred_at: now.toISOString(), action_type: "project.build.start", span_type: "action",
    route_id: "/app/ide/", reason_code: "", phase: "succeeded",
  };
  const events = [
    { action_id: "11111111-1111-4111-8111-111111111111", release_id: "1.0.0", phase: "succeeded" },
    { action_id: "22222222-2222-4222-8222-222222222222", release_id: "1.0.0", phase: "succeeded" },
    { action_id: "33333333-3333-4333-8333-333333333333", release_id: "2.0.0", phase: "failed", reason_code: "build_execution_failed" },
    { action_id: "44444444-4444-4444-8444-444444444444", release_id: "2.0.0", phase: "succeeded" },
  ];
  for (const [index, event] of events.entries()) {
    await service.recordUserActionEvent({
      ...base, ...event, event_id: `aggregate-${index}`,
      occurred_at: new Date(now.getTime() + index * 1000).toISOString(),
      span_id: `0000000${index + 1}-0000-4000-8000-000000000000`,
    });
  }
  const result = await service.userActionEvents({ hours: 24, limit: 500 });
  assert.equal(result.summary.by_release.length, 2);
  assert.equal(result.summary.top_reason_codes[0].reason_code, "build_execution_failed");
  assert.equal(result.summary.release_regressions[0].release_id, "2.0.0");
  assert.equal(result.summary.release_regressions[0].regression, true);
});

test("user action incidents persist status, runbook and fix release with admin audit", async () => {
  const service = createDefaultAdminTool();
  const context = { actor: { actor_id: "ops-1", role: "administrator", capabilities: [] } };
  const incident = await service.createUserActionIncident({
    action_id: "11111111-1111-4111-8111-111111111111",
    action_type: "project.build.start", reason_code: "build_execution_failed",
    release_id: "2.0.0", owner: "Platform Ops", runbook_url: "docs/operations.md",
    note: "Builds schlagen nach dem Release fehl.",
  }, context);
  assert.equal(incident.status, "new");
  assert.equal((await service.userActionIncidents()).items.length, 1);

  const updated = await service.updateUserActionIncident(incident.incident_id, {
    status: "resolved", owner: "Platform Ops", runbook_url: "https://ops.example.test/build",
    fix_release_id: "2.0.1", note: "Korrektur ausgeliefert.", change_reason: "Fix 2.0.1 verifiziert",
  }, context);
  assert.equal(updated.status, "resolved");
  assert.equal(updated.fix_release_id, "2.0.1");
  assert.deepEqual(service.repository.adminActions.map((item) => item.action_type), [
    "user_action_incident.create", "user_action_incident.update",
  ]);
  await assert.rejects(
    service.updateUserActionIncident(incident.incident_id, { ...updated, change_reason: "test", runbook_url: "javascript:alert(1)" }, context),
    (error) => error.code === "invalid_runbook_url",
  );
  await assert.rejects(
    service.updateUserActionIncident(incident.incident_id, { ...updated, change_reason: "test", runbook_url: "../secrets.txt" }, context),
    (error) => error.code === "invalid_runbook_url",
  );
});

test("user action alert evaluation persists deduplicated candidates in observe-only mode", async () => {
  const service = createDefaultAdminTool();
  const now = new Date().toISOString();
  for (let index = 0; index < 10; index += 1) {
    await service.recordUserActionEvent({
      event_id: `alert-event-${index}`, occurred_at: now,
      action_type: "project.build.start",
      action_id: `${String(index + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
      span_type: "action", span_id: `${String(index + 20).padStart(8, "0")}-0000-4000-8000-000000000000`,
      phase: index < 2 ? "failed" : "succeeded",
      reason_code: index < 2 ? "build_execution_failed" : "",
      route_id: "/app/ide/", release_id: "3.0.0", duration_bucket: "lt_30s",
    });
  }
  const context = { actor: { actor_id: "ops-1", role: "administrator" } };
  const first = await service.evaluateUserActionAlerts({ hours: 24 }, context);
  assert.equal(first.mode, "observe_only");
  assert.equal(first.candidates.length, 1);
  assert.equal(first.candidates[0].alert_kind, "failure_rate");
  assert.equal(first.candidates[0].notification_state, "observe_only");

  await service.evaluateUserActionAlerts({ hours: 24 }, context);
  const listed = await service.userActionAlerts();
  assert.equal(listed.items.length, 1);
  assert.equal(service.repository.adminActions.at(-1).action_type, "user_action_alerts.evaluate");
});

test("synthetic core preflights are read-only, persisted and summarized per run", async () => {
  const service = createDefaultAdminTool();
  service.serviceClients = {
    identityBaseUrl: "http://identity.test",
    projectServerBaseUrl: "http://project.test",
    buildDeployBaseUrl: "http://build.test",
    publicDemoBaseUrl: "http://demo.test",
  };
  service.fetchImpl = async (url) => {
    if (url.endsWith("/app/auth/")) return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
    if (url.startsWith("http://project.test")) return Response.json({ status: "ok", service: "project-server" });
    if (url.startsWith("http://build.test")) return Response.json({ status: "ok", service: "build-deploy-server", coordination: { ready: true } });
    if (url.startsWith("http://demo.test")) return Response.json({ items: [{ demo_id: "nexi" }] });
    throw new Error("unexpected synthetic target");
  };
  const result = await service.runSyntheticChecks({}, { actor: { actor_id: "ops-1", role: "administrator" } });
  assert.deepEqual(result.summary, { total: 4, passed: 4, failed: 0, skipped: 0 });
  assert.equal(result.items.every((item) => item.reason_code === "ok"), true);
  assert.equal(result.items.some((item) => "body" in item || "url" in item), false);

  const persisted = await service.syntheticChecks();
  assert.equal(persisted.latest_run_id, result.latest_run_id);
  assert.equal(persisted.items.length, 4);
  assert.equal(service.repository.adminActions.at(-1).action_type, "synthetic_checks.run");
});

test("link inventory and authenticated check results are summarized centrally", async () => {
  const service = createDefaultAdminTool();
  await service.registerLinkInventory({
    source_service: "identity-server",
    generated_at: "2026-07-30T12:00:00.000Z",
    targets: [{
      reference_id: "identity.dashboard",
      target_url: "/app/dashboard/",
      link_type: "internal",
      owner_domain: "Identity",
      access_scope: "authenticated",
    }, {
      reference_id: "identity.docs",
      target_url: "https://example.test/docs",
      link_type: "external",
      owner_domain: "Identity",
      access_scope: "public",
    }],
    occurrences: [{
      occurrence_id: "occurrence-dashboard",
      reference_id: "identity.dashboard",
      source_location: "public/app/index.html",
      source_route: "/app/",
    }],
  });
  await service.recordLinkChecks({ checks: [{
    check_id: "check-dashboard",
    reference_id: "identity.dashboard",
    checked_at: "2026-07-30T12:01:00.000Z",
    status: "healthy",
    http_status: 200,
    access_profile: "authenticated",
  }] });

  const result = await service.linkIntegrity(adminContext());
  assert.equal(result.summary.total_targets, 2);
  assert.equal(result.summary.authenticated, 1);
  assert.equal(result.summary.healthy, 1);
  assert.equal(result.summary.not_checked, 1);
  assert.equal(result.items.find((item) => item.reference_id === "identity.dashboard").occurrence_count, 1);
});

test("support without link-integrity capability cannot read the central register", async () => {
  const service = createDefaultAdminTool();
  await assert.rejects(
    () => service.linkIntegrity(adminContext({
      actor: { actor_id: "support-1", role: "support", capabilities: [] },
    })),
    /Link-Integrität darf nicht verwaltet werden/,
  );
});

test("system events remain available after reopening the Admin Tool SQLite", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-admin-events-"));
  const sqlitePath = path.join(tempDir, "admin.sqlite");
  try {
    const first = createDefaultAdminTool({ persistenceBackend: "sqlite", sqlitePath });
    await first.recordSystemEvent({
      severity: "warning",
      source_service: "identity_server",
      category: "security",
      event_type: "passkey_login_failed",
      message: "Passkey-Login konnte nicht verifiziert werden.",
      account_id: "acct-1",
    });

    const second = createDefaultAdminTool({ persistenceBackend: "sqlite", sqlitePath });
    const events = await second.systemEvents();
    assert.equal(events.summary.total, 1);
    assert.equal(events.items[0].event_type, "passkey_login_failed");
    assert.equal(events.items[0].account_id, "acct-1");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("synthetic check results remain available after reopening the Admin Tool SQLite", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-admin-synthetic-"));
  const sqlitePath = path.join(tempDir, "admin.sqlite");
  try {
    const first = createDefaultAdminTool({ persistenceBackend: "sqlite", sqlitePath });
    first.serviceClients = {
      identityBaseUrl: "http://identity.test",
      projectServerBaseUrl: "http://project.test",
      buildDeployBaseUrl: "http://build.test",
      publicDemoBaseUrl: "http://demo.test",
    };
    first.fetchImpl = async (url) => {
      if (url.endsWith("/app/auth/")) return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
      if (url.startsWith("http://project.test")) return Response.json({ status: "ok", service: "project-server" });
      if (url.startsWith("http://build.test")) return Response.json({ status: "ok", service: "build-deploy-server" });
      if (url.startsWith("http://demo.test")) return Response.json({ items: [] });
      throw new Error("unexpected synthetic target");
    };
    await first.runSyntheticChecks({}, { actor: { actor_id: "ops-1", role: "administrator" } });

    const second = createDefaultAdminTool({ persistenceBackend: "sqlite", sqlitePath });
    const persisted = await second.syntheticChecks();
    assert.deepEqual(persisted.summary, { total: 4, passed: 4, failed: 0, skipped: 0 });
    assert.equal(persisted.items.length, 4);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
    "/api/ai-context/prompt-foundations": {
      items: [{
        foundation_id: "ai_prompt.architecture_discovery.system",
        title: "Architektur-Discovery Systemprompt",
        route_task: "architecture_discovery",
        source_scope: "prompt_foundations/architecture_discovery/system",
        content_kind: "system_prompt",
        allowed_sources: ["current_chat", "architecture_prompt"],
        blocked_sources: ["project_files", "customer_data"],
        content: "Minimalumfang akzeptieren.",
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
  assert.ok(result.summary.prompt_foundations.some((item) => item.route_task === "architecture_discovery"));
  assert.ok(result.summary.prompt_foundations.find((item) => item.route_task === "architecture_discovery").content.includes("Minimalumfang"));
});

test("ai context summary falls back when context service is unavailable", async () => {
  const service = createAdminServiceWithHttpJson({}, new Error("connect ECONNREFUSED"));

  const result = await service.aiContextAccessSummary(adminContext({ purpose: "ai_context_access_review" }));

  assert.equal(result.summary.service_available, false);
  assert.equal(result.summary.active_grants, 0);
  assert.match(result.summary.error, /ECONNREFUSED/);
});

test("admin exposes prioritized clarification cases and forwards review decisions", async () => {
  const service = createAdminServiceWithHttpJson({});
  const calls = [];
  service.httpJson = async (_baseUrl, pathname, options = {}) => {
    calls.push({ pathname, options });
    if (pathname.startsWith("/api/ai-context/clarification-cases?")) {
      return { summary:{total:2,open:1,urgent:1,resolved:1}, items:[{case_id:"case-1",priority:"urgent",status:"open"}] };
    }
    return { clarificationCase:{case_id:"case-1",status:"resolved"} };
  };

  const listed = await service.aiClarificationCases({status:"open",priority:"urgent"}, adminContext());
  const resolved = await service.resolveAiClarificationCase("case-1", {action:"correct",intent:"architecture.add_component",entity:"ESP32"}, adminContext());

  assert.equal(listed.summary.urgent, 1);
  assert.equal(listed.items[0].case_id, "case-1");
  assert.match(calls[0].pathname, /status=open/);
  assert.match(calls[0].pathname, /priority=urgent/);
  assert.equal(calls[1].options.body.resolved_by, "admin-1");
  assert.equal(resolved.clarificationCase.status, "resolved");
});

test("admin lists and maintains local help knowledge through AI Context", async () => {
  const service = createAdminServiceWithHttpJson({});
  const calls = [];
  service.httpJson = async (_baseUrl, pathname, options = {}) => {
    calls.push({ pathname, options });
    if (options.method === "POST") return { article: options.body };
    return { items: [{ article_id: "help.test", title: "Test", help_topic_id: "quick-start", status: "active" }] };
  };

  const listed = await service.helpKnowledge(adminContext());
  const saved = await service.upsertHelpKnowledge({
    article_id: "help.test", title: "Test", summary: "Kurz", content: "Inhalt", help_topic_id: "quick-start", status: "active",
  }, adminContext());

  assert.equal(listed.items[0].article_id, "help.test");
  assert.equal(calls[0].pathname, "/api/ai-context/help-articles");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(saved.article.article_id, "help.test");
});

test("admin keeps SMTP password server-side while configuring Identity mail delivery", async () => {
  const service = createAdminServiceWithHttpJson({});
  const calls = [];
  service.httpJson = async (_baseUrl, pathname, options = {}) => {
    calls.push({ pathname, options });
    return { config: { configured: true, has_password: true, from_address: "noreply@example.test" }, ok: true };
  };

  const saved = await service.updateEmailConfig({ username: "noreply@example.test", from_address: "noreply@example.test", password: "secret" }, adminContext());
  const tested = await service.testEmailConfig(adminContext());

  assert.equal(saved.config.has_password, true);
  assert.equal(calls[0].pathname, "/api/internal/email-config");
  assert.equal(calls[0].options.headers["x-gernetix-admin-token"], "test-identity-admin-token");
  assert.equal(calls[0].options.body.password, "secret");
  assert.equal(tested.ok, true);
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

test("loads selectable API models from the configured OpenAI provider", async () => {
  const service = createAdminServiceWithHttpJson({});
  const previousFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url, options) => {
    requestedUrl = url;
    assert.equal(options.headers.Authorization, "Bearer secret");
    return { ok: true, status: 200, json: async () => ({ data: [{ id: "gpt-5.6-terra" }, { id: "text-embedding-3-small" }, { id: "gpt-5.6-sol" }] }) };
  };
  service.llmConfigStore = {
    getConfig: () => ({ provider: "api", apiProvider: "openai-responses", apiBaseUrl: "https://api.openai.com/v1", apiKey: "secret" }),
    publicConfig: () => ({}),
    updateConfig: () => ({}),
  };
  try {
    const result = await service.listLlmModels({ provider: "api", apiProvider: "openai-responses" });
    assert.equal(requestedUrl, "https://api.openai.com/v1/models");
    assert.deepEqual(result.items.map((item) => item.model), ["gpt-5.6-terra", "gpt-5.6-sol"]);
  } finally {
    global.fetch = previousFetch;
  }
});

test("security events are mailed once and then suppressed during cooldown", async () => {
  const service = createAdminServiceWithHttpJson({ "/api/internal/security-alert": { accepted: true } });
  let calls = 0;
  service.identityEmailConfigRequest = async () => { calls += 1; return { accepted: true }; };
  const first = await service.recordSecurityEvent({ severity: "critical", source_service: "vps-security-monitor", event_type: "unhealthy_container", message: "Container unhealthy", alert_key: "unhealthy_container" });
  const second = await service.recordSecurityEvent({ severity: "critical", source_service: "vps-security-monitor", event_type: "unhealthy_container", message: "Container unhealthy", alert_key: "unhealthy_container" });
  assert.equal(first.email, "sent");
  assert.equal(second.email, "suppressed_duplicate");
  assert.equal(calls, 1);
});

test("critical basissoftware events notify the operator once while every event remains persisted", async () => {
  const service = createAdminServiceWithHttpJson({ "/api/internal/operator-alert": { accepted: true } });
  const requests = [];
  service.identityEmailConfigRequest = async (pathname, options) => { requests.push([pathname, options]); return { accepted: true }; };
  const incident = {
    severity: "critical",
    category: "basissoftware_runtime",
    source_service: "gernetix_basissoftware",
    event_type: "basissoftware_runtime_defect_detected",
    message: "Basissoftware-Stack ist kritisch.",
    correlation_id: "build-1:crashDiag",
  };
  await service.recordSystemEvent(incident);
  await service.recordSystemEvent(incident);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "/api/internal/operator-alert");
  assert.equal((await service.systemEvents()).items.filter((item) => item.category === "basissoftware_runtime").length, 2);

  await Promise.all([
    service.recordSystemEvent({ ...incident, correlation_id: "build-2:wifi-connect" }),
    service.recordSystemEvent({ ...incident, correlation_id: "build-2:wifi-connect" }),
  ]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 2, "simultaneous duplicate reports must produce exactly one additional notification");
});

test("monitoring reads Community operational counts without exposing the internal token", async () => {
  const repository = new InMemoryAdminRepository();
  const service = new AdminService({
    repository,
    accessPolicy: new AdminAccessPolicy({ repository }),
    serviceClients: {
      communityPlatformBaseUrl: "http://community.test",
      communityInternalToken: "community-secret",
    },
  });
  const previousFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url, headers: options.headers || {} });
    if (url.endsWith("/health")) {
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        persistence_backend: "sqlite",
        questions: { total: 3, public: 2, private: 1, open: 2 },
        answers: { total: 1, verified: 1 },
        knowledge_documents: { total: 1 },
      }),
    };
  };
  try {
    const result = await service.monitoring();
    const community = result.services.find((item) => item.service_id === "community_platform");
    assert.equal(community.operations.questions.private, 1);
    assert.equal(requests.find((item) => item.url.endsWith("/operations-summary")).headers["X-GerNetiX-Community-Token"], "community-secret");
    assert.doesNotMatch(JSON.stringify(community), /community-secret/);
  } finally {
    global.fetch = previousFetch;
  }
});

test("community support access is capability-gated, audited and uses the separate community admin token", async () => {
  const repository = new InMemoryAdminRepository();
  const service = new AdminService({
    repository,
    accessPolicy: new AdminAccessPolicy({ repository }),
    llmConfigStore: { publicConfig: () => ({}), getConfig: () => ({}), updateConfig: () => ({}) },
    serviceClients: {
      communityPlatformBaseUrl: "http://community.test",
      communityAdminToken: "community-admin-secret",
    },
  });
  let request = null;
  service.httpJson = async (baseUrl, pathname, options) => {
    request = { baseUrl, pathname, options };
    return { items: [{ thread_id: "thread-1", subject: "Hilfe" }] };
  };
  const context = adminContext({
    actor: { actor_id: "admin-support", role: "support", capabilities: ["admin_community_support"] },
  });
  const result = await service.communitySupportThreads({}, context);
  assert.equal(result.items[0].thread_id, "thread-1");
  assert.equal(request.baseUrl, "http://community.test");
  assert.equal(request.pathname, "/api/community/admin/support-threads");
  assert.equal(request.options.headers["x-gernetix-community-admin-token"], "community-admin-secret");
  const forwardedActor = JSON.parse(Buffer.from(request.options.headers["x-gernetix-community-admin-actor"], "base64url").toString("utf8"));
  assert.deepEqual(forwardedActor, { actor_id: "admin-support", role: "support", capabilities: ["admin_community_support"] });
  assert.ok((await repository.listAuditEvents()).some((event) => event.purpose === "community_support_queue_read" && event.access_decision === "full"));
  await assert.rejects(service.communitySupportThreads({}, adminContext({ actor: { actor_id: "admin-none", role: "community_moderator", capabilities: [] } })), /nicht freigegeben/);
});

test("resource policy updates require a reason, forward the actor and create an audit trail", async () => {
  const repository = new InMemoryAdminRepository();
  const service = new AdminService({
    repository,
    accessPolicy: new AdminAccessPolicy({ repository }),
    llmConfigStore: { publicConfig: () => ({}), getConfig: () => ({}), updateConfig: () => ({}) },
    serviceClients: { projectServerBaseUrl: "http://project.test" },
  });
  let updateRequest = null;
  service.httpJson = async (_baseUrl, pathname, options = {}) => {
    if (pathname === "/api/resource-policies") return { policies: [{ plan_id: "free", policy_version: 1, max_projects: 5 }] };
    updateRequest = { pathname, options };
    return { plan_id: "free", policy_id: "account-resource:free", policy_version: 2, max_projects: 4 };
  };
  const context = adminContext();
  await assert.rejects(service.updateResourcePolicy("free", { max_projects: 4 }, context), /change_reason/);
  const updated = await service.updateResourcePolicy("free", { max_projects: 4, change_reason: "Kostenmodell angepasst" }, context);
  assert.equal(updated.policy_version, 2);
  assert.equal(updateRequest.pathname, "/api/resource-policies/free");
  assert.equal(updateRequest.options.body.changed_by, "admin-1");
  assert.ok((await repository.listAuditEvents()).some((event) => event.policy_version === 2 && event.reason === "Kostenmodell angepasst"));
});

test("resource summary combines account quotas with the effective build retention policy", async () => {
  const repository = new InMemoryAdminRepository();
  const service = new AdminService({
    repository,
    accessPolicy: new AdminAccessPolicy({ repository }),
    llmConfigStore: { publicConfig: () => ({}), getConfig: () => ({}), updateConfig: () => ({}) },
    serviceClients: { projectServerBaseUrl: "http://project.test", buildDeployBaseUrl: "http://build.test" },
  });
  service.httpJson = async (baseUrl, pathname) => {
    if (baseUrl === "http://project.test") return { policies: [{ plan_id: "free" }], accounts: [] };
    assert.equal(pathname, "/api/policy");
    return { policy_id: "build_artifact_and_cache_policy", artifacts: [{ file_name: "firmware.elf", retention_days: 5 }] };
  };
  const result = await service.resourceSummary(adminContext());
  assert.equal(result.policies[0].plan_id, "free");
  assert.equal(result.build_policy.policy_id, "build_artifact_and_cache_policy");
  assert.equal(result.build_policy.artifacts[0].retention_days, 5);
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
      identityBaseUrl: "http://identity.test",
      identityAdminToken: "test-identity-admin-token",
    },
  });
  service.httpJson = async (_baseUrl, pathname) => {
    if (error) throw error;
    return routes[pathname] || {};
  };
  return service;
}
