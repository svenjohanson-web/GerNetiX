function defaultPolicy() {
  return {
    policy_id: "default",
    deny_without_grant: true,
    require_explicit_source_scope: true,
    allow_external_provider_customer_data: false,
    default_max_context_items: 12,
    protected_source_types: ["customer_data", "project_files", "graph_database", "device_data", "hardware_catalog"],
    updated_at: nowIso(),
  };
}

function defaultSources() {
  return [
    {
      source_id: "ai_source.hardware_catalog.esp32_processor_boards",
      source_type: "hardware_catalog",
      source_scope: "processor_boards/esp32",
      title: "ESP32 ProcessorBoards und Capabilities",
      summary: "Fachliche Hardware-Catalog-Quelle fuer ESP32-Boardtypen, MCU-/Modulvarianten, Basissoftwareprofile, Provisioningprofile und TechnicalCapabilities.",
      backing_service: "hardware-catalog",
      endpoint: "/api/hardware-catalog/processor-boards?processor_family=esp32",
      contains: ["processor_boards", "technical_capabilities", "basissoftware_profiles", "provisioning_profiles"],
      default_redaction_level: "summary_only",
      default_provider_scope: "local_only",
      allowed_purposes: ["architecture_assistance"],
      status: "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      source_id: "ai_source.ai_context.sqlite",
      source_type: "graph_database",
      source_scope: ".runtime/gernetix-ai-context.sqlite",
      title: "AI Context SQLite",
      summary: "Metadatenquelle fuer Grants, Policies, Audit-Events und registrierte AI-Kontextquellen.",
      backing_service: "ai-context-server",
      endpoint: "/api/ai-context/sqlite/summary",
      contains: ["ai_context_grants", "ai_context_policy", "ai_context_audit_events", "ai_context_sources"],
      default_redaction_level: "metadata_only",
      default_provider_scope: "local_only",
      allowed_purposes: ["architecture_assistance", "usage_analysis"],
      status: "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];
}

class InMemoryAiContextRepository {
  constructor(seed = {}) {
    this.grants = new Map((seed.grants || []).map((item) => [item.grant_id, clone(item)]));
    this.auditEvents = [...(seed.auditEvents || [])].map(clone);
    this.sources = new Map(mergeSources(defaultSources(), seed.sources || []).map((item) => [item.source_id, clone(item)]));
    this.policy = clone(mergePolicy(defaultPolicy(), seed.policy));
  }

  saveGrant(grant) {
    this.grants.set(grant.grant_id, clone(grant));
    return clone(grant);
  }

  findGrant(grantId) {
    return clone(this.grants.get(grantId));
  }

  listGrants(filter = {}) {
    return Array.from(this.grants.values())
      .filter((grant) => matchesGrantFilter(grant, filter))
      .map(clone);
  }

  revokeGrant(grantId, revokedAt = nowIso()) {
    const grant = this.grants.get(grantId);
    if (!grant) return null;
    const next = { ...grant, revoked_at: revokedAt };
    this.grants.set(grantId, next);
    return clone(next);
  }

  savePolicy(policy) {
    this.policy = clone({ ...this.policy, ...policy, policy_id: "default", updated_at: nowIso() });
    return clone(this.policy);
  }

  getPolicy() {
    return clone(this.policy);
  }

  addAuditEvent(event) {
    this.auditEvents.push(clone(event));
    return clone(event);
  }

  listAuditEvents(filter = {}) {
    return this.auditEvents
      .filter((event) => matchesAuditFilter(event, filter))
      .map(clone);
  }

  saveSource(source) {
    this.sources.set(source.source_id, clone(source));
    return clone(source);
  }

  listSources(filter = {}) {
    return Array.from(this.sources.values())
      .filter((source) => matchesSourceFilter(source, filter))
      .map(clone);
  }
}

function mergeSources(defaultItems, seedItems) {
  const byId = new Map(defaultItems.map((item) => [item.source_id, item]));
  for (const item of seedItems || []) byId.set(item.source_id, item);
  return Array.from(byId.values());
}

function mergePolicy(defaultItem, seedItem) {
  if (!seedItem) return defaultItem;
  return {
    ...defaultItem,
    ...seedItem,
    protected_source_types: Array.from(new Set([
      ...(defaultItem.protected_source_types || []),
      ...(seedItem.protected_source_types || []),
    ])),
  };
}

function matchesGrantFilter(grant, filter) {
  if (filter.account_id && grant.account_id !== filter.account_id) return false;
  if (filter.source_type && grant.source_type !== filter.source_type) return false;
  if (filter.purpose && grant.purpose !== filter.purpose) return false;
  if (filter.status === "active" && !isGrantActive(grant, new Date())) return false;
  return true;
}

function matchesAuditFilter(event, filter) {
  if (filter.account_id && event.account_id !== filter.account_id) return false;
  if (filter.access_decision && event.access_decision !== filter.access_decision) return false;
  if (filter.source_type && event.source_type !== filter.source_type) return false;
  return true;
}

function matchesSourceFilter(source, filter) {
  if (filter.source_type && source.source_type !== filter.source_type) return false;
  if (filter.status && source.status !== filter.status) return false;
  return true;
}

function isGrantActive(grant, at) {
  if (grant.revoked_at) return false;
  if (grant.valid_from && new Date(grant.valid_from).getTime() > at.getTime()) return false;
  if (grant.valid_until && new Date(grant.valid_until).getTime() <= at.getTime()) return false;
  return true;
}

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryAiContextRepository, defaultPolicy, defaultSources, isGrantActive };
