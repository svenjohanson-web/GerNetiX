"use strict";

function createAccountWorkspaceService({
  accountSubscription,
  getUserIdeState,
  loadAiUsageSummary,
  projectServerJson,
  projectServerUserId,
  resourcePlanCacheMs = 15_000,
}) {
  const resourcePlanCache = new Map();
  const resourcePlanLoads = new Map();

  function getWorkspaceState(userId) {
    return getUserIdeState().workspaceStates.get(userId) || {
      userId,
      lastProjectId: "",
      lastMode: "learn",
      lastRoute: "/app/dashboard/",
      updatedAt: "",
    };
  }

  function touchWorkspace(session, projectId, mode, route) {
    return updateWorkspaceState(session, {
      lastProjectId: projectId,
      lastMode: mode,
      lastRoute: route,
    });
  }

  function updateWorkspaceState(session, input = {}) {
    const userId = projectServerUserId(session);
    const current = getWorkspaceState(userId);
    const updated = {
      userId,
      lastProjectId: input.lastProjectId || input.last_project_id || current.lastProjectId || "",
      lastMode: input.lastMode || input.last_mode || current.lastMode || "learn",
      lastRoute: input.lastRoute || input.last_route || current.lastRoute || "/app/dashboard/",
      updatedAt: new Date().toISOString(),
    };
    getUserIdeState().workspaceStates.set(userId, updated);
    return updated;
  }

  async function loadBillingSummary(session, existingAiUsage = null) {
    const aiUsage = existingAiUsage || await loadAiUsageSummary(session);
    const subscription = accountSubscription(session);
    const accountId = projectServerUserId(session);
    const resources = await ensureAccountResourcePlan(session)
      .catch((error) => ({ available: false, error: error.message || String(error) }));
    return {
      account_id: accountId,
      plan: subscription.plan,
      plan_id: subscription.plan_id,
      configured_plan_id: session.account?.subscription_plan || "free",
      plan_valid_until: session.account?.plan_valid_until || null,
      lifecycle_state: session.account?.lifecycle_state || "active",
      grace_until: session.account?.grace_until || null,
      entitlements: subscription.entitlements,
      resources,
      ai_credits: aiUsage.credits,
      ai_credit_packages: aiUsage.credit_packages || [],
    };
  }

  async function ensureAccountResourcePlan(session) {
    const subscription = accountSubscription(session);
    const accountId = projectServerUserId(session);
    const cacheKey = `${accountId}\u0000${subscription.plan_id}`;
    const cached = resourcePlanCache.get(cacheKey);
    if (cached && cached.expires_at > Date.now()) return cached.value;
    if (resourcePlanLoads.has(cacheKey)) return resourcePlanLoads.get(cacheKey);
    const load = projectServerJson(`/api/internal/accounts/${encodeURIComponent(accountId)}/resource-plan`, {
      method: "PUT",
      body: { plan_id: subscription.plan_id },
    }).then((value) => {
      resourcePlanCache.set(cacheKey, { value, expires_at: Date.now() + resourcePlanCacheMs });
      return value;
    }).finally(() => resourcePlanLoads.delete(cacheKey));
    resourcePlanLoads.set(cacheKey, load);
    return load;
  }

  async function updateAccountProjectSelection(session, input = {}) {
    const subscription = accountSubscription(session);
    const accountId = projectServerUserId(session);
    const activeProjectIds = Array.from(new Set((input.active_project_ids || []).map(String).filter(Boolean)));
    const result = await projectServerJson(`/api/internal/accounts/${encodeURIComponent(accountId)}/resource-plan`, {
      method: "PUT",
      body: {
        plan_id: subscription.plan_id,
        active_project_ids: activeProjectIds,
      },
    });
    for (const key of resourcePlanCache.keys()) {
      if (key.startsWith(`${accountId}\u0000`)) resourcePlanCache.delete(key);
    }
    resourcePlanCache.set(`${accountId}\u0000${subscription.plan_id}`, {
      value: result,
      expires_at: Date.now() + resourcePlanCacheMs,
    });
    return result;
  }

  return {
    ensureAccountResourcePlan,
    getWorkspaceState,
    loadBillingSummary,
    touchWorkspace,
    updateAccountProjectSelection,
    updateWorkspaceState,
  };
}

module.exports = { createAccountWorkspaceService };
