function defaultPolicy() {
  return {
    policy_id: "default",
    deny_without_grant: true,
    require_explicit_source_scope: true,
    allow_external_provider_customer_data: false,
    default_max_context_items: 12,
    protected_source_types: ["customer_data", "project_files", "graph_database", "device_data"],
    updated_at: nowIso(),
  };
}

class InMemoryAiContextRepository {
  constructor(seed = {}) {
    this.grants = new Map((seed.grants || []).map((item) => [item.grant_id, clone(item)]));
    this.auditEvents = [...(seed.auditEvents || [])].map(clone);
    this.policy = clone(seed.policy || defaultPolicy());
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

module.exports = { InMemoryAiContextRepository, defaultPolicy, isGrantActive };
