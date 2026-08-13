"use strict";

function createSubscriptionAccess({ effectiveSubscriptionPlan, defaultAccountPlan, sendJson }) {
  function accountSubscription(session) {
    const account = session?.account || {};
    const configuredPlan = effectiveSubscriptionPlan({
      subscription_plan: account.subscription_plan || account.plan || defaultAccountPlan,
      plan_valid_until: account.plan_valid_until || null,
    });
    const premium = ["premium", "premium_demo", "premium-demo"].includes(configuredPlan);
    const purchasedEntitlements = Array.isArray(account.purchased_entitlements)
      ? account.purchased_entitlements.filter((entitlement) => typeof entitlement === "string")
      : [];
    const subscriptionEntitlements = premium
      ? ["learn_guided_projects", "ide_edit_code", "build_and_flash", "ai_assistant", "web_push", "project_history", "knowledge_library"]
      : ["ide_edit_code", "build_and_flash"];
    return {
      plan_id: premium ? configuredPlan.replace("-", "_") : "free",
      plan: premium ? "Premium" : "Basis",
      entitlements: [...new Set([...subscriptionEntitlements, ...purchasedEntitlements])],
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
