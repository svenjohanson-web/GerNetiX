"use strict";

function createSubscriptionAccess({ effectiveSubscriptionPlan, defaultAccountPlan, sendJson }) {
  function accountSubscription(session) {
    const account = session?.account || {};
    const configuredPlan = effectiveSubscriptionPlan({
      subscription_plan: account.subscription_plan || account.plan || defaultAccountPlan,
      plan_valid_until: account.plan_valid_until || null,
    });
    const premium = ["premium", "premium_demo", "premium-demo"].includes(configuredPlan);
    return {
      plan_id: premium ? configuredPlan.replace("-", "_") : "free",
      plan: premium ? "Premium" : "Basis",
      entitlements: premium
        ? ["learn_guided_projects", "ide_edit_code", "build_and_flash", "ai_assistant", "web_push", "project_history"]
        : ["ide_edit_code", "build_and_flash"],
    };
  }

  function hasEntitlements(session, requiredEntitlements = []) {
    const granted = new Set(accountSubscription(session).entitlements);
    return (requiredEntitlements || []).every((entitlement) => granted.has(entitlement));
  }

  function requireEntitlement(res, session, entitlement) {
    return requireEntitlements(res, session, [entitlement]);
  }

  function requireEntitlements(res, session, requiredEntitlements = []) {
    if (hasEntitlements(session, requiredEntitlements)) return true;
    sendJson(res, 403, {
      error: "premium_required",
      message: "Diese Funktion ist nur mit einem Premium-Abo verfuegbar.",
      required_entitlements: requiredEntitlements,
      help_url: "/hilfe/#ai-premium",
    });
    return false;
  }

  return { accountSubscription, hasEntitlements, requireEntitlement, requireEntitlements };
}

module.exports = { createSubscriptionAccess };
