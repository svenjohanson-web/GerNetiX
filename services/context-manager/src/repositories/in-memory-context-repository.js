class InMemoryContextRepository {
  constructor(seed = {}) {
    this.scopes = new Map((seed.scopes || []).map((item) => [item.scope_id, clone(item)]));
    this.requirementSlices = new Map((seed.requirementSlices || []).map((item) => [item.slice_id, clone(item)]));
    this.artifactReferences = new Map((seed.artifactReferences || []).map((item) => [item.artifact_reference_id, clone(item)]));
    this.runtimeReferences = new Map((seed.runtimeReferences || []).map((item) => [item.runtime_reference_id, clone(item)]));
    this.decisions = new Map((seed.decisions || []).map((item) => [item.decision_id, clone(item)]));
    this.events = new Map((seed.events || []).map((item) => [item.event_id, clone(item)]));
    this.contextPacks = new Map((seed.contextPacks || []).map((item) => [item.pack_id, clone(item)]));
    this.redactionPolicies = new Map((seed.redactionPolicies || []).map((item) => [item.policy_id, clone(item)]));
  }

  saveScope(scope) {
    this.scopes.set(scope.scope_id, clone(scope));
    return clone(scope);
  }

  findScope(scopeId) {
    return clone(this.scopes.get(scopeId));
  }

  findScopeByProject(accountId, projectId) {
    return clone(Array.from(this.scopes.values()).find((scope) => (
      (!accountId || scope.account_id === accountId) && (!projectId || scope.project_id === projectId)
    )));
  }

  saveRequirementSlice(slice) {
    this.requirementSlices.set(slice.slice_id, clone(slice));
    return clone(slice);
  }

  listRequirementSlices(scopeId) {
    return sortedByUpdatedAt(this.requirementSlices, scopeId).map(clone);
  }

  saveArtifactReference(reference) {
    this.artifactReferences.set(reference.artifact_reference_id, clone(reference));
    return clone(reference);
  }

  listArtifactReferences(scopeId) {
    return sortedByUpdatedAt(this.artifactReferences, scopeId).map(clone);
  }

  saveRuntimeReference(reference) {
    this.runtimeReferences.set(reference.runtime_reference_id, clone(reference));
    return clone(reference);
  }

  listRuntimeReferences(scopeId) {
    return sortedByUpdatedAt(this.runtimeReferences, scopeId).map(clone);
  }

  saveDecision(decision) {
    this.decisions.set(decision.decision_id, clone(decision));
    return clone(decision);
  }

  listDecisions(scopeId) {
    return sortedByUpdatedAt(this.decisions, scopeId).map(clone);
  }

  saveEvent(event) {
    this.events.set(event.event_id, clone(event));
    return clone(event);
  }

  listEvents(scopeId, limit = 50) {
    return sortedByUpdatedAt(this.events, scopeId).slice(0, limit).map(clone);
  }

  saveContextPack(pack) {
    this.contextPacks.set(pack.pack_id, clone(pack));
    return clone(pack);
  }

  findContextPack(packId) {
    return clone(this.contextPacks.get(packId));
  }

  listContextPacks(scopeId) {
    return sortedByUpdatedAt(this.contextPacks, scopeId).map(clone);
  }

  saveRedactionPolicy(policy) {
    this.redactionPolicies.set(policy.policy_id, clone(policy));
    return clone(policy);
  }

  listRedactionPolicies(scopeId) {
    return Array.from(this.redactionPolicies.values())
      .filter((policy) => !policy.scope_id || policy.scope_id === scopeId)
      .map(clone);
  }

  state() {
    return {
      scopes: Array.from(this.scopes.values()).map(clone),
      requirementSlices: Array.from(this.requirementSlices.values()).map(clone),
      artifactReferences: Array.from(this.artifactReferences.values()).map(clone),
      runtimeReferences: Array.from(this.runtimeReferences.values()).map(clone),
      decisions: Array.from(this.decisions.values()).map(clone),
      events: Array.from(this.events.values()).map(clone),
      contextPacks: Array.from(this.contextPacks.values()).map(clone),
      redactionPolicies: Array.from(this.redactionPolicies.values()).map(clone),
    };
  }
}

function sortedByUpdatedAt(map, scopeId) {
  return Array.from(map.values())
    .filter((item) => item.scope_id === scopeId)
    .sort((left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = { InMemoryContextRepository };
